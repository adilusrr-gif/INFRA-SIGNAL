from __future__ import annotations

import unittest

from app.core.config import Settings
from app.core.models import (
    CitizenReport,
    EvidenceKind,
    IncidentStatus,
    IncidentType,
    ReportChannel,
    Severity,
    utcnow,
)
from app.services.engine import IncidentIntelligenceService
from app.services.simulation import run_water_leak_scenario


class LeakScenarioTests(unittest.TestCase):
    def setUp(self) -> None:
        settings = Settings(enable_ollama=False)
        self.service = IncidentIntelligenceService(settings)

    def test_cross_source_signals_become_one_explainable_incident(self) -> None:
        snapshot = run_water_leak_scenario(self.service)
        self.assertEqual(len(snapshot["incidents"]), 1)
        incident = next(iter(self.service.store.incidents.values()))
        self.assertEqual(incident.incident_type, IncidentType.WATER_LEAK)
        self.assertEqual(incident.status, IncidentStatus.CONFIRMED)
        self.assertEqual(incident.severity, Severity.CRITICAL)
        self.assertGreaterEqual(incident.confidence, 0.8)
        self.assertGreaterEqual(incident.risk_score, 85)
        self.assertEqual(incident.recommended_crew_id, "crew_water_1")

        kinds = {item.kind for item in incident.evidence}
        self.assertIn(EvidenceKind.TELEMETRY, kinds)
        self.assertIn(EvidenceKind.CITIZEN_REPORT, kinds)
        self.assertIn(EvidenceKind.VOICE_TRANSCRIPT, kinds)
        self.assertGreaterEqual(len(incident.recommendations), 3)
        self.assertTrue(
            all(item.source and item.section for item in incident.recommendations)
        )

    def test_demo_metrics_are_consistent(self) -> None:
        snapshot = run_water_leak_scenario(self.service)
        self.assertEqual(snapshot["kpis"]["open_incidents"], 1)
        self.assertEqual(snapshot["kpis"]["confirmed_incidents"], 1)
        self.assertEqual(snapshot["kpis"]["critical_incidents"], 1)
        self.assertEqual(len(snapshot["reports"]), 3)
        self.assertGreaterEqual(snapshot["kpis"]["signals_processed"], 18)

    def test_new_evidence_does_not_undo_dispatcher_assignment(self) -> None:
        run_water_leak_scenario(self.service)
        incident = next(iter(self.service.store.incidents.values()))
        self.service.assign_crew(incident.id, "crew_water_1")

        self.service.ingest_report(
            CitizenReport(
                text="На Абая снова сообщают о сильной утечке воды.",
                channel=ReportChannel.OPERATOR,
                latitude=53.2874,
                longitude=69.3897,
                address="ул. Абая, 78",
                created_at=utcnow(),
            )
        )

        self.assertEqual(incident.status, IncidentStatus.ASSIGNED)
        self.assertEqual(incident.assigned_crew_id, "crew_water_1")
        self.assertEqual(incident.recommended_crew_id, "crew_water_1")


if __name__ == "__main__":
    unittest.main()
