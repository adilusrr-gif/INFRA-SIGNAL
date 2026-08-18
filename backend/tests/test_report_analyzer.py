from __future__ import annotations

import unittest

from app.core.models import IncidentType, ReportLanguage
from app.services.report_analyzer import analyze_report


class ReportAnalyzerTests(unittest.TestCase):
    def test_russian_water_leak(self) -> None:
        result = analyze_report("Срочно, прорвало трубу, вода течет по улице")
        self.assertEqual(result.language, ReportLanguage.RU)
        self.assertEqual(result.incident_type, IncidentType.WATER_LEAK)
        self.assertGreaterEqual(result.urgency_score, 55)
        self.assertGreater(result.confidence, 0.7)

    def test_kazakh_water_leak(self) -> None:
        result = analyze_report(
            "Абай көшесінде құбыр жарылды, су көшеде ағып жатыр. Шұғыл!"
        )
        self.assertEqual(result.language, ReportLanguage.KZ)
        self.assertEqual(result.incident_type, IncidentType.WATER_LEAK)
        self.assertGreaterEqual(result.urgency_score, 55)

    def test_unknown_report_is_not_overclassified(self) -> None:
        result = analyze_report("Во дворе требуется осмотр специалиста")
        self.assertEqual(result.incident_type, IncidentType.UNKNOWN)
        self.assertLess(result.confidence, 0.5)


if __name__ == "__main__":
    unittest.main()
