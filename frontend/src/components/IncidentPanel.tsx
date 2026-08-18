import { useState, type CSSProperties } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  Bot,
  Check,
  FileSearch,
  MapPin,
  Radio,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import type { Crew, Incident, InfrastructureAsset } from "../types";
import type { UiLanguage } from "../lib/i18n";
import { translate } from "../lib/i18n";

interface IncidentPanelProps {
  incident: Incident | null;
  asset?: InfrastructureAsset;
  crews: Crew[];
  language: UiLanguage;
  onAssign: (incidentId: string, crewId: string) => Promise<void>;
  onAcknowledge: (incidentId: string) => Promise<void>;
}

function EvidenceIcon({ kind }: { kind: string }) {
  if (kind === "telemetry") return <Radio size={14} />;
  if (kind === "voice_transcript") return <Bot size={14} />;
  return <FileSearch size={14} />;
}

export function IncidentPanel({
  incident,
  asset,
  crews,
  language,
  onAssign,
  onAcknowledge,
}: IncidentPanelProps) {
  const [busy, setBusy] = useState(false);
  const t = translate(language);

  if (!incident) {
    return (
      <section className="incident-detail empty-detail">
        <div className="empty-radar"><Radio size={34} /></div>
        <h3>{t.noIncident}</h3>
        <p>AI объединит телеметрию и обращения, но решение останется за диспетчером.</p>
      </section>
    );
  }

  const recommendedCrew = crews.find((crew) => crew.id === incident.recommended_crew_id);

  async function execute(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="incident-detail">
      <div className="incident-detail-header">
        <div className={`incident-alert-icon severity-${incident.severity}`}>
          <AlertTriangle size={20} />
        </div>
        <div>
          <div className="incident-eyebrow">
            <span>{incident.id.slice(-8).toUpperCase()}</span>
            <i />
            <b>{incident.status}</b>
          </div>
          <h2>{incident.title}</h2>
          <p><MapPin size={13} /> {asset?.name ?? incident.asset_id}</p>
        </div>
      </div>

      <div className="risk-overview">
        <div
          className="risk-gauge"
          style={{ "--risk": `${incident.risk_score * 3.6}deg` } as CSSProperties}
        >
          <div><strong>{incident.risk_score}</strong><span>/100</span></div>
        </div>
        <div className="risk-metrics">
          <div><span>{t.risk}</span><b className={`severity-text-${incident.severity}`}>{incident.severity}</b></div>
          <div><span>{t.confidence}</span><b>{Math.round(incident.confidence * 100)}%</b></div>
          <div><span>Зона влияния</span><b>{incident.affected_radius_meters} м</b></div>
        </div>
      </div>

      <div className="cause-box">
        <span><Bot size={14} /> {t.cause}</span>
        <p>{incident.probable_cause}</p>
        <small><ShieldCheck size={12} /> Вывод основан на {incident.evidence.length} независимых сигналах</small>
      </div>

      <div className="detail-section">
        <div className="detail-section-title">
          <h3>{t.evidence}</h3>
          <span>{incident.evidence.length}</span>
        </div>
        <div className="evidence-list">
          {incident.evidence.map((item) => (
            <article key={item.id}>
              <span className="evidence-icon"><EvidenceIcon kind={item.kind} /></span>
              <div>
                <b>{item.label}</b>
                <p>{item.detail}</p>
                <small>{new Date(item.observed_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })} · вес {Math.round(item.weight * 100)}%</small>
              </div>
              <Check size={14} className="evidence-check" />
            </article>
          ))}
        </div>
      </div>

      <div className="detail-section">
        <div className="detail-section-title">
          <h3>{t.response}</h3>
          <span><BookOpenCheck size={13} /> RAG</span>
        </div>
        <ol className="recommendation-list">
          {incident.recommendations.map((item) => (
            <li key={item.id}>
              <span>{item.order}</span>
              <div>
                <p>{item.action}</p>
                <small>{t.source}: {item.source} · {item.section}</small>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {recommendedCrew && (
        <div className="crew-suggestion">
          <div className="crew-avatar"><UserCheck size={18} /></div>
          <div>
            <small>Рекомендованная бригада</small>
            <b>{recommendedCrew.name}</b>
            <span>{recommendedCrew.phone} · доступна</span>
          </div>
          <ArrowRight size={17} />
        </div>
      )}

      <div className="human-gate"><ShieldCheck size={14} /> {t.humanGate}</div>
      <div className="incident-actions">
        {recommendedCrew && !incident.assigned_crew_id && (
          <button
            className="primary-action"
            disabled={busy}
            onClick={() => execute(() => onAssign(incident.id, recommendedCrew.id))}
          >
            <UserCheck size={16} /> {t.assign}
          </button>
        )}
        {incident.status !== "in_progress" && (
          <button
            className="secondary-action"
            disabled={busy}
            onClick={() => execute(() => onAcknowledge(incident.id))}
          >
            <Check size={16} /> {t.acknowledge}
          </button>
        )}
      </div>
    </section>
  );
}
