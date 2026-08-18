import { Activity, FileText, Link2, Radio, Users } from "lucide-react";
import type { TimelineEvent } from "../types";

function iconFor(kind: string) {
  if (kind.includes("anomaly")) return <Activity size={14} />;
  if (kind.includes("report")) return <FileText size={14} />;
  if (kind.includes("crew")) return <Users size={14} />;
  if (kind.includes("incident")) return <Radio size={14} />;
  return <Link2 size={14} />;
}

export function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="timeline-list">
      {[...events].reverse().slice(0, 9).map((event) => (
        <div className="timeline-row" key={event.id}>
          <span className={`timeline-icon event-${event.kind}`}>{iconFor(event.kind)}</span>
          <div>
            <strong>{event.title}</strong>
            <p>{event.detail}</p>
          </div>
          <time>{new Date(event.happened_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</time>
        </div>
      ))}
    </div>
  );
}
