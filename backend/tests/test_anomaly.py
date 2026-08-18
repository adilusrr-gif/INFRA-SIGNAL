from __future__ import annotations

import unittest
from datetime import timedelta

from app.core.models import TelemetrySample, utcnow
from app.services.anomaly import TelemetryAnomalyDetector


class TelemetryAnomalyTests(unittest.TestCase):
    def setUp(self) -> None:
        self.detector = TelemetryAnomalyDetector()
        base = utcnow() - timedelta(minutes=20)
        values = [4.20, 4.22, 4.18, 4.24, 4.21, 4.19, 4.23, 4.20, 4.22, 4.18]
        self.history = [
            TelemetrySample(
                asset_id="water-1",
                metric="pressure",
                value=value,
                unit="bar",
                captured_at=base + timedelta(minutes=index),
            )
            for index, value in enumerate(values)
        ]

    def test_normal_jitter_is_not_anomaly(self) -> None:
        sample = TelemetrySample(
            asset_id="water-1",
            metric="pressure",
            value=4.17,
            unit="bar",
            captured_at=utcnow(),
        )
        self.assertIsNone(self.detector.detect(sample, self.history))

    def test_pressure_drop_is_anomaly(self) -> None:
        sample = TelemetrySample(
            asset_id="water-1",
            metric="pressure",
            value=2.65,
            unit="bar",
            captured_at=utcnow(),
        )
        result = self.detector.detect(sample, self.history)
        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(result.direction, "low")
        self.assertGreaterEqual(result.score, 80)
        self.assertAlmostEqual(result.baseline_value, 4.205, places=2)


if __name__ == "__main__":
    unittest.main()
