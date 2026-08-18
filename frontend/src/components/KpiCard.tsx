import type { ReactNode } from "react";

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  tone?: "neutral" | "cyan" | "amber" | "red";
  hint: string;
}

export function KpiCard({ label, value, icon, tone = "neutral", hint }: KpiCardProps) {
  return (
    <article className={`kpi-card kpi-${tone}`}>
      <div className="kpi-topline">
        <span className="kpi-icon">{icon}</span>
        <span className="kpi-live-dot" />
      </div>
      <strong>{value}</strong>
      <span className="kpi-label">{label}</span>
      <small>{hint}</small>
    </article>
  );
}
