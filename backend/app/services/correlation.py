from __future__ import annotations

from datetime import datetime, timedelta

from app.core.geo import haversine_meters
from app.core.models import (
    AnomalySignal,
    AssetState,
    AssetType,
    CitizenReport,
    Crew,
    Evidence,
    EvidenceKind,
    Incident,
    IncidentStatus,
    IncidentType,
    InfrastructureAsset,
    Severity,
    TimelineEvent,
)
from app.services.playbooks import PlaybookService
from app.services.store import InMemoryStore


_WATER_INCIDENTS = {IncidentType.WATER_LEAK, IncidentType.LOW_WATER_PRESSURE}

_COMPATIBLE_ASSETS: dict[IncidentType, set[AssetType]] = {
    IncidentType.WATER_LEAK: {AssetType.WATER_MAIN},
    IncidentType.LOW_WATER_PRESSURE: {AssetType.WATER_MAIN},
    IncidentType.HEATING_FAILURE: {AssetType.HEATING_MAIN},
    IncidentType.POWER_OUTAGE: {AssetType.ELECTRIC_SUBSTATION},
    IncidentType.SEWER_FAILURE: {AssetType.SEWER_COLLECTOR},
    IncidentType.UNKNOWN: set(AssetType),
}


class IncidentCorrelator:
    def __init__(
        self,
        store: InMemoryStore,
        playbooks: PlaybookService,
        correlation_window: timedelta = timedelta(minutes=90),
        maximum_report_distance_meters: float = 1_200.0,
    ):
        self.store = store
        self.playbooks = playbooks
        self.correlation_window = correlation_window
        self.maximum_report_distance_meters = maximum_report_distance_meters

    def correlate_report(self, report: CitizenReport) -> Incident | None:
        asset = self._nearest_asset(report)
        if asset is None:
            self.store.add_event(
                TimelineEvent(
                    kind="unmatched_report",
                    title="Обращение требует ручной привязки",
                    detail=f"{report.address}: {report.summary}",
                    happened_at=report.created_at,
                    related_id=report.id,
                )
            )
            return None

        incident = self._find_or_create(asset, report.incident_type, report.created_at)
        distance = haversine_meters(
            report.latitude,
            report.longitude,
            asset.latitude,
            asset.longitude,
        )
        kind = (
            EvidenceKind.VOICE_TRANSCRIPT
            if report.channel.value == "call_109"
            else EvidenceKind.CITIZEN_REPORT
        )
        incident.add_evidence(
            Evidence(
                kind=kind,
                source_id=report.id,
                label=f"Обращение {report.language.value.upper()}",
                detail=report.summary,
                observed_at=report.created_at,
                weight=0.72 if kind is EvidenceKind.VOICE_TRANSCRIPT else 0.64,
                metadata={
                    "channel": report.channel.value,
                    "distance_to_asset_m": round(distance, 1),
                    "address": report.address,
                    "urgency_score": report.urgency_score,
                },
            )
        )
        if report.incident_type is IncidentType.WATER_LEAK:
            incident.incident_type = IncidentType.WATER_LEAK
            incident.title = "Вероятная утечка на водопроводной сети"
        self._refresh(incident, asset)
        self.store.add_event(
            TimelineEvent(
                kind="report_correlated",
                title="Обращение связано с инцидентом",
                detail=(
                    f"{report.address}; объект {asset.external_id}; "
                    f"расстояние {distance:.0f} м"
                ),
                happened_at=report.created_at,
                related_id=incident.id,
            )
        )
        return self.store.save_incident(incident)

    def correlate_anomaly(self, anomaly: AnomalySignal) -> Incident:
        asset = self.store.assets[anomaly.asset_id]
        incident_type = self._incident_type_for_anomaly(asset, anomaly)
        incident = self._find_or_create(asset, incident_type, anomaly.detected_at)
        incident.add_evidence(
            Evidence(
                kind=EvidenceKind.TELEMETRY,
                source_id=anomaly.id,
                label="Аномалия телеметрии",
                detail=anomaly.reason,
                observed_at=anomaly.detected_at,
                weight=min(1.0, anomaly.score / 100.0),
                metadata={
                    "metric": anomaly.metric,
                    "score": anomaly.score,
                    "current_value": anomaly.current_value,
                    "baseline_value": anomaly.baseline_value,
                },
            )
        )
        self._refresh(incident, asset)
        self.store.add_event(
            TimelineEvent(
                kind="anomaly_detected",
                title="Зафиксирована аномалия",
                detail=anomaly.reason,
                happened_at=anomaly.detected_at,
                related_id=incident.id,
            )
        )
        return self.store.save_incident(incident)

    def _nearest_asset(self, report: CitizenReport) -> InfrastructureAsset | None:
        compatible = _COMPATIBLE_ASSETS.get(report.incident_type, set(AssetType))
        candidates: list[tuple[float, InfrastructureAsset]] = []
        for asset in self.store.assets.values():
            if compatible and asset.asset_type not in compatible:
                continue
            distance = haversine_meters(
                report.latitude,
                report.longitude,
                asset.latitude,
                asset.longitude,
            )
            if distance <= self.maximum_report_distance_meters:
                candidates.append((distance, asset))
        return min(candidates, key=lambda item: item[0])[1] if candidates else None

    def _find_or_create(
        self,
        asset: InfrastructureAsset,
        incident_type: IncidentType,
        observed_at: datetime,
    ) -> Incident:
        for incident in self.store.open_incidents():
            if incident.asset_id != asset.id:
                continue
            if abs(observed_at - incident.detected_at) > self.correlation_window:
                continue
            same_water_family = (
                incident.incident_type in _WATER_INCIDENTS
                and incident_type in _WATER_INCIDENTS
            )
            if incident.incident_type == incident_type or same_water_family:
                return incident

        title = {
            IncidentType.WATER_LEAK: "Вероятная утечка на водопроводной сети",
            IncidentType.LOW_WATER_PRESSURE: "Падение давления в водопроводной сети",
            IncidentType.HEATING_FAILURE: "Отклонение параметров теплоснабжения",
            IncidentType.POWER_OUTAGE: "Вероятное нарушение электроснабжения",
            IncidentType.SEWER_FAILURE: "Вероятная авария канализационной сети",
            IncidentType.UNKNOWN: "Новый инфраструктурный сигнал",
        }[incident_type]
        incident = Incident(
            incident_type=incident_type,
            title=title,
            asset_id=asset.id,
            latitude=asset.latitude,
            longitude=asset.longitude,
            detected_at=observed_at,
        )
        self.store.add_event(
            TimelineEvent(
                kind="incident_created",
                title="Создан единый инцидент",
                detail=f"{title}; объект {asset.external_id}",
                happened_at=observed_at,
                related_id=incident.id,
            )
        )
        return self.store.save_incident(incident)

    @staticmethod
    def _incident_type_for_anomaly(
        asset: InfrastructureAsset, anomaly: AnomalySignal
    ) -> IncidentType:
        if asset.asset_type is AssetType.WATER_MAIN:
            return IncidentType.LOW_WATER_PRESSURE
        if asset.asset_type is AssetType.HEATING_MAIN:
            return IncidentType.HEATING_FAILURE
        if asset.asset_type is AssetType.ELECTRIC_SUBSTATION:
            return IncidentType.POWER_OUTAGE
        if asset.asset_type is AssetType.SEWER_COLLECTOR:
            return IncidentType.SEWER_FAILURE
        return IncidentType.UNKNOWN

    def _refresh(self, incident: Incident, asset: InfrastructureAsset) -> None:
        telemetry = [
            item for item in incident.evidence if item.kind is EvidenceKind.TELEMETRY
        ]
        reports = [
            item
            for item in incident.evidence
            if item.kind
            in {EvidenceKind.CITIZEN_REPORT, EvidenceKind.VOICE_TRANSCRIPT}
        ]
        anomaly_score = max(
            (float(item.metadata.get("score", 0)) for item in telemetry), default=0.0
        )
        max_urgency = max(
            (int(item.metadata.get("urgency_score", 0)) for item in reports), default=0
        )
        channel_count = len(
            {str(item.metadata.get("channel", item.kind.value)) for item in reports}
        )

        risk = (
            anomaly_score * 0.48
            + min(24, len(reports) * 8)
            + asset.criticality * 0.16
            + max_urgency * 0.12
            + (6 if telemetry and reports else 0)
        )
        incident.risk_score = max(0, min(100, round(risk)))
        incident.confidence = round(
            min(
                0.98,
                0.20
                + (0.35 if telemetry else 0)
                + min(0.30, len(reports) * 0.10)
                + (0.08 if channel_count >= 2 else 0)
                + (0.08 if telemetry and reports else 0),
            ),
            2,
        )
        incident.severity = self._severity(incident.risk_score)
        operator_owned_statuses = {
            IncidentStatus.ASSIGNED,
            IncidentStatus.IN_PROGRESS,
            IncidentStatus.MONITORING,
        }
        if incident.status not in operator_owned_statuses:
            incident.status = (
                IncidentStatus.CONFIRMED
                if incident.confidence >= 0.72 and len(incident.evidence) >= 3
                else IncidentStatus.DETECTED
            )
        incident.affected_radius_meters = max(200, min(1_500, incident.risk_score * 12))
        incident.probable_cause = self._probable_cause(incident, telemetry, reports)
        incident.recommended_crew_id = (
            incident.assigned_crew_id or self._recommend_crew(asset)
        )
        incident.recommendations = self.playbooks.recommendations_for(incident)
        asset.state = (
            AssetState.CRITICAL
            if incident.severity is Severity.CRITICAL
            else AssetState.DEGRADED
        )

    @staticmethod
    def _severity(score: int) -> Severity:
        if score >= 85:
            return Severity.CRITICAL
        if score >= 65:
            return Severity.HIGH
        if score >= 40:
            return Severity.MEDIUM
        return Severity.LOW

    @staticmethod
    def _probable_cause(
        incident: Incident,
        telemetry: list[Evidence],
        reports: list[Evidence],
    ) -> str:
        if incident.incident_type is IncidentType.WATER_LEAK and telemetry and reports:
            return "Разгерметизация участка: падение давления подтверждается сообщениями из одной зоны"
        if incident.incident_type is IncidentType.LOW_WATER_PRESSURE and telemetry:
            return "Отклонение давления; требуется исключить датчик, насосную станцию и утечку"
        if incident.incident_type is IncidentType.HEATING_FAILURE:
            return "Снижение параметров теплоносителя на связанном участке"
        if incident.incident_type is IncidentType.POWER_OUTAGE:
            return "Снижение напряжения или срабатывание защиты на связанном фидере"
        return "Недостаточно данных; требуется проверка диспетчером"

    def _recommend_crew(self, asset: InfrastructureAsset) -> str | None:
        candidates: list[tuple[float, Crew]] = []
        for crew in self.store.crews.values():
            if crew.status != "available" or asset.asset_type not in crew.specialization:
                continue
            distance = haversine_meters(
                asset.latitude,
                asset.longitude,
                crew.latitude,
                crew.longitude,
            )
            candidates.append((distance, crew))
        return min(candidates, key=lambda item: item[0])[1].id if candidates else None
