from __future__ import annotations

from threading import RLock

from app.core.models import (
    AnomalySignal,
    CitizenReport,
    Crew,
    Incident,
    IncidentStatus,
    InfrastructureAsset,
    TelemetrySample,
    TimelineEvent,
)


class InMemoryStore:
    """Thread-safe MVP repository behind a replaceable persistence boundary."""

    def __init__(self):
        self._lock = RLock()
        self.reset()

    def reset(self) -> None:
        with getattr(self, "_lock", RLock()):
            self.assets: dict[str, InfrastructureAsset] = {}
            self.telemetry: list[TelemetrySample] = []
            self.anomalies: dict[str, AnomalySignal] = {}
            self.reports: dict[str, CitizenReport] = {}
            self.incidents: dict[str, Incident] = {}
            self.crews: dict[str, Crew] = {}
            self.events: list[TimelineEvent] = []

    def add_asset(self, asset: InfrastructureAsset) -> InfrastructureAsset:
        with self._lock:
            self.assets[asset.id] = asset
        return asset

    def add_crew(self, crew: Crew) -> Crew:
        with self._lock:
            self.crews[crew.id] = crew
        return crew

    def add_telemetry(self, sample: TelemetrySample) -> TelemetrySample:
        with self._lock:
            self.telemetry.append(sample)
        return sample

    def telemetry_history(self, asset_id: str, metric: str) -> list[TelemetrySample]:
        with self._lock:
            return [
                item
                for item in self.telemetry
                if item.asset_id == asset_id and item.metric == metric
            ]

    def add_anomaly(self, anomaly: AnomalySignal) -> AnomalySignal:
        with self._lock:
            self.anomalies[anomaly.id] = anomaly
        return anomaly

    def add_report(self, report: CitizenReport) -> CitizenReport:
        with self._lock:
            self.reports[report.id] = report
        return report

    def save_incident(self, incident: Incident) -> Incident:
        with self._lock:
            self.incidents[incident.id] = incident
        return incident

    def add_event(self, event: TimelineEvent) -> TimelineEvent:
        with self._lock:
            self.events.append(event)
            self.events.sort(key=lambda item: item.happened_at)
        return event

    def open_incidents(self) -> list[Incident]:
        terminal = {IncidentStatus.RESOLVED, IncidentStatus.FALSE_POSITIVE}
        with self._lock:
            return [item for item in self.incidents.values() if item.status not in terminal]
