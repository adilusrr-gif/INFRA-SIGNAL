import { Activity, Droplets, Flame, Zap } from "lucide-react";
import type { Incident, InfrastructureAsset } from "../types";

interface InfrastructureMapProps {
  assets: InfrastructureAsset[];
  incidents: Incident[];
  selectedAssetId: string | null;
  onSelectAsset: (assetId: string) => void;
  onSelectIncident: (incidentId: string) => void;
}

const bounds = {
  minLat: 53.274,
  maxLat: 53.298,
  minLon: 69.374,
  maxLon: 69.411,
};

function project(latitude: number, longitude: number) {
  const x = 32 + ((longitude - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * 736;
  const y = 444 - ((latitude - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 408;
  return { x, y };
}

function assetColor(state: InfrastructureAsset["state"]) {
  if (state === "critical") return "#ff5c67";
  if (state === "degraded") return "#ffb84d";
  if (state === "offline") return "#77838a";
  return "#37d6c0";
}

function AssetIcon({ type }: { type: string }) {
  if (type === "water_main") return <Droplets size={15} />;
  if (type === "heating_main") return <Flame size={15} />;
  if (type === "electric_substation") return <Zap size={15} />;
  return <Activity size={15} />;
}

export function InfrastructureMap({
  assets,
  incidents,
  selectedAssetId,
  onSelectAsset,
  onSelectIncident,
}: InfrastructureMapProps) {
  const selected = assets.find((asset) => asset.id === selectedAssetId) ?? assets[0];
  return (
    <div className="map-shell">
      <svg
        className="network-map"
        viewBox="0 0 800 480"
        role="img"
        aria-label="Схема инфраструктурных объектов Кокшетау"
      >
        <defs>
          <pattern id="smallGrid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#163038" strokeWidth="0.55" />
          </pattern>
          <filter id="glow">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="river" x1="0" x2="1">
            <stop offset="0" stopColor="#0c2933" />
            <stop offset="0.5" stopColor="#114251" />
            <stop offset="1" stopColor="#0a252e" />
          </linearGradient>
        </defs>
        <rect width="800" height="480" fill="#081419" />
        <rect width="800" height="480" fill="url(#smallGrid)" opacity="0.78" />
        <path d="M-20 390 C180 340 258 445 450 371 S690 294 830 327" fill="none" stroke="url(#river)" strokeWidth="26" opacity="0.8" />
        <path d="M-30 147 C164 176 241 121 402 160 S634 222 832 168" fill="none" stroke="#1a3035" strokeWidth="12" />
        <path d="M160 -20 C180 116 225 187 211 500" fill="none" stroke="#1a3035" strokeWidth="9" />
        <path d="M520 -20 C478 111 570 207 535 500" fill="none" stroke="#1a3035" strokeWidth="8" />
        <path d="M35 265 C195 221 344 293 508 252 S700 222 810 246" fill="none" stroke="#193137" strokeWidth="7" />

        <text x="36" y="43" className="map-label">КӨКШЕТАУ · ОПЕРАЦИОННАЯ СХЕМА</text>
        <text x="675" y="454" className="map-coordinate">53.28° N · 69.39° E</text>

        {incidents.map((incident) => {
          const point = project(incident.latitude, incident.longitude);
          const radius = Math.min(78, Math.max(28, incident.affected_radius_meters / 16));
          return (
            <g
              key={incident.id}
              className="incident-map-group"
              onClick={() => onSelectIncident(incident.id)}
              role="button"
              tabIndex={0}
            >
              <circle cx={point.x} cy={point.y} r={radius} fill="#ff53621a" stroke="#ff657480" strokeDasharray="5 5" />
              <circle cx={point.x} cy={point.y} r="30" className="incident-pulse" />
            </g>
          );
        })}

        {assets.map((asset) => {
          const point = project(asset.latitude, asset.longitude);
          const active = asset.id === selectedAssetId;
          return (
            <g
              key={asset.id}
              className="asset-marker"
              onClick={() => onSelectAsset(asset.id)}
              role="button"
              tabIndex={0}
            >
              <circle
                cx={point.x}
                cy={point.y}
                r={active ? 14 : 11}
                fill="#081419"
                stroke={assetColor(asset.state)}
                strokeWidth={active ? 4 : 3}
                filter={asset.state === "critical" ? "url(#glow)" : undefined}
              />
              <circle cx={point.x} cy={point.y} r="4" fill={assetColor(asset.state)} />
              <text x={point.x + 17} y={point.y - 12} className="asset-code">
                {asset.external_id}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="map-legend">
        <span><i className="legend-dot normal" />Норма</span>
        <span><i className="legend-dot degraded" />Отклонение</span>
        <span><i className="legend-dot critical" />Авария</span>
      </div>

      {selected && (
        <div className="asset-popover">
          <div className="asset-popover-icon"><AssetIcon type={selected.asset_type} /></div>
          <div>
            <small>{selected.external_id} · {selected.district}</small>
            <strong>{selected.name}</strong>
            <span>Ввод: {selected.commissioned_year} · Критичность {selected.criticality}/100</span>
          </div>
          <b className={`state-${selected.state}`}>{selected.state}</b>
        </div>
      )}
    </div>
  );
}
