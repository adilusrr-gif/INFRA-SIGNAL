from __future__ import annotations

import statistics
from dataclasses import dataclass

from app.core.models import AnomalySignal, TelemetrySample


@dataclass(frozen=True, slots=True)
class MetricRule:
    direction: str
    minimum_relative_change: float
    robust_z_threshold: float


DEFAULT_RULES: dict[str, MetricRule] = {
    "pressure": MetricRule("low", 0.12, 3.0),
    "temperature": MetricRule("low", 0.10, 3.0),
    "flow": MetricRule("high", 0.25, 3.5),
    "voltage": MetricRule("low", 0.08, 3.0),
}


class TelemetryAnomalyDetector:
    """Robust deterministic detector using median and MAD.

    The LLM never receives authority to decide whether a sensor value is an
    anomaly. This component is reproducible and can be calibrated per utility.
    """

    def __init__(self, minimum_history: int = 8, window_size: int = 24):
        self.minimum_history = minimum_history
        self.window_size = window_size

    def detect(
        self,
        sample: TelemetrySample,
        history: list[TelemetrySample],
    ) -> AnomalySignal | None:
        rule = DEFAULT_RULES.get(sample.metric)
        relevant = [
            item.value
            for item in history
            if item.asset_id == sample.asset_id and item.metric == sample.metric
        ][-self.window_size :]
        if rule is None or len(relevant) < self.minimum_history:
            return None

        baseline = statistics.median(relevant)
        absolute_deviations = [abs(value - baseline) for value in relevant]
        mad = statistics.median(absolute_deviations)
        scale = max(1.4826 * mad, abs(baseline) * 0.02, 0.01)

        if rule.direction == "low":
            signed_delta = baseline - sample.value
        else:
            signed_delta = sample.value - baseline
        relative_change = signed_delta / max(abs(baseline), 0.01)
        robust_z = signed_delta / scale

        if (
            relative_change < rule.minimum_relative_change
            and robust_z < rule.robust_z_threshold
        ):
            return None

        score = min(
            100.0,
            max(
                0.0,
                24.0
                + max(0.0, robust_z) * 7.0
                + max(0.0, relative_change) * 75.0,
            ),
        )
        reason = (
            f"{sample.metric}: {sample.value:.2f} {sample.unit}; "
            f"robust baseline {baseline:.2f}; change {relative_change * 100:.1f}%"
        )
        return AnomalySignal(
            asset_id=sample.asset_id,
            metric=sample.metric,
            current_value=sample.value,
            baseline_value=round(baseline, 3),
            score=round(score, 1),
            direction=rule.direction,
            reason=reason,
            detected_at=sample.captured_at,
        )
