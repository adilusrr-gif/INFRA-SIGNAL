import type { InfrastructureAsset, TelemetrySample } from "../types";

interface TelemetryChartProps {
  asset?: InfrastructureAsset;
  telemetry: TelemetrySample[];
}

export function TelemetryChart({ asset, telemetry }: TelemetryChartProps) {
  const points = telemetry
    .filter((item) => item.asset_id === asset?.id && item.metric === "pressure")
    .sort((a, b) => Date.parse(a.captured_at) - Date.parse(b.captured_at))
    .slice(-24);

  if (!asset || points.length === 0) {
    return (
      <div className="chart-empty">
        <span>SCADA</span>
        <p>Нет телеметрии. Запустите демонстрационный сценарий.</p>
      </div>
    );
  }

  const width = 760;
  const height = 184;
  const padding = { x: 34, y: 24 };
  const values = points.map((item) => item.value);
  const min = Math.min(...values, 1.5) - 0.2;
  const max = Math.max(...values, 4.5) + 0.2;
  const baseline = [...values.slice(0, Math.min(12, values.length))].sort((a, b) => a - b)[
    Math.floor(Math.min(12, values.length) / 2)
  ];
  const x = (index: number) =>
    padding.x + (index / Math.max(1, points.length - 1)) * (width - padding.x * 2);
  const y = (value: number) =>
    padding.y + ((max - value) / Math.max(0.01, max - min)) * (height - padding.y * 2);
  const line = points.map((point, index) => `${x(index)},${y(point.value)}`).join(" ");

  return (
    <div className="telemetry-chart">
      <div className="chart-heading">
        <div>
          <span>Давление · последние {points.length} измерений</span>
          <strong>{points.at(-1)?.value.toFixed(2)} bar</strong>
        </div>
        <div className="chart-delta">
          {(((points.at(-1)?.value ?? baseline) - baseline) / baseline * 100).toFixed(1)}%
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} aria-label="График давления">
        {[0, 1, 2, 3].map((index) => {
          const yy = padding.y + index * ((height - padding.y * 2) / 3);
          return <line key={index} x1={padding.x} x2={width - padding.x} y1={yy} y2={yy} className="chart-grid" />;
        })}
        <line x1={padding.x} x2={width - padding.x} y1={y(baseline)} y2={y(baseline)} className="baseline-line" />
        <polyline points={line} fill="none" className="pressure-line" />
        {points.map((point, index) => {
          const isLow = point.value < baseline * 0.88;
          return <circle key={point.id} cx={x(index)} cy={y(point.value)} r={isLow ? 4.5 : 2.3} className={isLow ? "point-anomaly" : "point-normal"} />;
        })}
        <text x={padding.x + 5} y={y(baseline) - 7} className="baseline-label">baseline {baseline.toFixed(2)}</text>
      </svg>
    </div>
  );
}
