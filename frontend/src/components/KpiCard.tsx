import type { ReactNode } from "react";

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  tone?: "neutral" | "cyan" | "amber" | "red";
  hint: string;
  onClick?: () => void;
}

export function KpiCard({ label, value, icon, tone = "neutral", hint, onClick }: KpiCardProps) {
  const content = (
    <>
      <div className="kpi-topline">
        <span className="kpi-icon">{icon}</span>
        <span className="kpi-live-dot" />
      </div>
      <strong>{value}</strong>
      <span className="kpi-label">{label}</span>
      <small>{hint}</small>
    </>
  );
  if (onClick) {
    return <button className={`kpi-card kpi-${tone}`} onClick={onClick}>{content}</button>;
  }
  return <article className={`kpi-card kpi-${tone}`}>{content}</article>;
}
