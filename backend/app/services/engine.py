from __future__ import annotations

from datetime import datetime

from app.core.config import Settings, settings
from app.core.models import (
    CitizenReport,
    IncidentStatus,
    TelemetrySample,
    TimelineEvent,
    to_dict,
    utcnow,
)
from app.services.anomaly import TelemetryAnomalyDetector
from app.services.correlation import IncidentCorrelator
from app.services.ollama_adapter import LocalReportAnalyzer
from app.services.playbooks import PlaybookService
from app.services.store import InMemoryStore


class IncidentIntelligenceService:
    def __init__(self, app_settings: Settings = settings):
        self.settings = app_settings
        self.store = InMemoryStore()
        self.detector = TelemetryAnomalyDetector()
        self.report_analyzer = LocalReportAnalyzer(app_settings)
        self.playbooks = PlaybookService()
        self.correlator = IncidentCorrelator(self.store, self.playbooks)

    def ingest_telemetry(self, sample: TelemetrySample):
        history = self.store.telemetry_history(sample.asset_id, sample.metric)
        anomaly = self.detector.detect(sample, history)
        self.store.add_telemetry(sample)
        if anomaly is None:
            return None
        self.store.add_anomaly(anomaly)
        return self.correlator.correlate_anomaly(anomaly)

    def ingest_report(self, report: CitizenReport):
        analysis = self.report_analyzer.analyze(report.text)
        report.language = analysis.language
        report.incident_type = analysis.incident_type
        report.urgency_score = analysis.urgency_score
        report.summary = analysis.summary
        self.store.add_report(report)
        return self.correlator.correlate_report(report)

    def assign_crew(self, incident_id: str, crew_id: str):
        incident = self.store.incidents[incident_id]
        crew = self.store.crews[crew_id]
        incident.assigned_crew_id = crew.id
        incident.status = IncidentStatus.ASSIGNED
        incident.updated_at = utcnow()
        crew.status = "busy"
        self.store.add_event(
            TimelineEvent(
                kind="crew_assigned",
                title="Бригада назначена диспетчером",
                detail=crew.name,
                happened_at=incident.updated_at,
                related_id=incident.id,
            )
        )
        return self.store.save_incident(incident)

    def update_status(self, incident_id: str, status: IncidentStatus):
        incident = self.store.incidents[incident_id]
        incident.status = status
        incident.updated_at = utcnow()
        self.store.add_event(
            TimelineEvent(
                kind="status_changed",
                title="Статус инцидента обновлён",
                detail=status.value,
                happened_at=incident.updated_at,
                related_id=incident.id,
            )
        )
        return self.store.save_incident(incident)

    def dashboard(self) -> dict:
        incidents = sorted(
            self.store.incidents.values(), key=lambda item: item.detected_at, reverse=True
        )
        latest_telemetry = sorted(
            self.store.telemetry, key=lambda item: item.captured_at, reverse=True
        )[:120]
        open_incidents = self.store.open_incidents()
        confirmed = [item for item in open_incidents if item.confidence >= 0.72]
        critical = [item for item in open_incidents if item.severity.value == "critical"]
        return {
            "generated_at": datetime.now().astimezone().isoformat(),
            "kpis": {
                "open_incidents": len(open_incidents),
                "confirmed_incidents": len(confirmed),
                "critical_incidents": len(critical),
                "signals_processed": len(self.store.telemetry)
                + len(self.store.reports),
                "average_confidence": round(
                    sum(item.confidence for item in incidents) / max(1, len(incidents)), 2
                ),
            },
            "assets": [to_dict(item) for item in self.store.assets.values()],
            "incidents": [to_dict(item) for item in incidents],
            "crews": [to_dict(item) for item in self.store.crews.values()],
            "reports": [
                to_dict(item)
                for item in sorted(
                    self.store.reports.values(),
                    key=lambda report: report.created_at,
                    reverse=True,
                )
            ],
            "telemetry": [to_dict(item) for item in latest_telemetry],
            "timeline": [to_dict(item) for item in self.store.events[-40:]],
            "ai": to_dict(self.report_analyzer.status()),
        }
