import { AlertTriangle, CheckCircle2, Radio } from "lucide-react";
import type { Incident } from "../types";

interface IncidentListProps {
  incidents: Incident[];
  selectedId: string | null;
  onSelect: (incidentId: string) => void;
}

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(value)) / 60_000));
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин назад`;
  return `${Math.floor(minutes / 60)} ч назад`;
}

export function IncidentList({ incidents, selectedId, onSelect }: IncidentListProps) {
  if (incidents.length === 0) {
    return (
      <div className="incident-list-empty">
        <CheckCircle2 size={28} />
        <strong>Активных инцидентов нет</strong>
        <span>Система продолжает мониторинг сигналов</span>
      </div>
    );
  }
  return (
    <div className="incident-list">
      {incidents.map((incident) => (
        <button
          key={incident.id}
          className={`incident-row severity-${incident.severity} ${selectedId === incident.id ? "selected" : ""}`}
          onClick={() => onSelect(incident.id)}
        >
          <span className="incident-row-icon">
            {incident.severity === "critical" ? <AlertTriangle size={17} /> : <Radio size={17} />}
          </span>
          <span className="incident-row-main">
            <b>{incident.title}</b>
            <small>{incident.status} · {relativeTime(incident.detected_at)}</small>
          </span>
          <span className="risk-chip">{incident.risk_score}</span>
        </button>
      ))}
    </div>
  );
}
