import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertOctagon,
  Bell,
  Building2,
  ChevronDown,
  CircleDot,
  Database,
  Gauge,
  Languages,
  LayoutDashboard,
  LoaderCircle,
  Map,
  Play,
  RadioTower,
  RefreshCw,
  ServerCog,
  Settings,
  ShieldCheck,
  Siren,
  Waves,
} from "lucide-react";
import { IncidentList } from "./components/IncidentList";
import { IncidentPanel } from "./components/IncidentPanel";
import { InfrastructureMap } from "./components/InfrastructureMap";
import { KpiCard } from "./components/KpiCard";
import { TelemetryChart } from "./components/TelemetryChart";
import { Timeline } from "./components/Timeline";
import { api } from "./lib/api";
import { translate, type UiLanguage } from "./lib/i18n";
import type { DashboardData } from "./types";

function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [language, setLanguage] = useState<UiLanguage>("ru");
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningDemo, setRunningDemo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = translate(language);

  const applyData = useCallback((next: DashboardData) => {
    setData(next);
    if (next.incidents.length > 0) {
      setSelectedIncidentId((current) =>
        next.incidents.some((incident) => incident.id === current)
          ? current
          : next.incidents[0].id,
      );
      setSelectedAssetId(next.incidents[0].asset_id);
    } else if (next.assets.length > 0) {
      setSelectedIncidentId(null);
      setSelectedAssetId(next.assets[0].id);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      setError(null);
      applyData(await api.dashboard());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "API недоступен");
    } finally {
      setLoading(false);
    }
  }, [applyData]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedIncident = useMemo(
    () => data?.incidents.find((incident) => incident.id === selectedIncidentId) ?? null,
    [data, selectedIncidentId],
  );
  const selectedAsset = useMemo(
    () => data?.assets.find((asset) => asset.id === selectedAssetId),
    [data, selectedAssetId],
  );

  async function runDemo() {
    setRunningDemo(true);
    setError(null);
    try {
      const next = await api.runLeakDemo();
      applyData(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Сценарий не запустился");
    } finally {
      setRunningDemo(false);
    }
  }

  async function reset() {
    setRunningDemo(true);
    try {
      applyData(await api.resetDemo());
    } finally {
      setRunningDemo(false);
    }
  }

  async function assignCrew(incidentId: string, crewId: string) {
    await api.assignCrew(incidentId, crewId);
    await load();
  }

  async function acknowledge(incidentId: string) {
    await api.updateStatus(incidentId, "in_progress");
    await load();
  }

  function selectIncident(incidentId: string) {
    setSelectedIncidentId(incidentId);
    const incident = data?.incidents.find((item) => item.id === incidentId);
    if (incident) setSelectedAssetId(incident.asset_id);
  }

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-mark"><Waves size={34} /></div>
        <LoaderCircle className="spinner" size={24} />
        <span>Инициализация ситуационного центра</span>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-symbol"><Waves size={23} /></div>
          <div><strong>INFRA<span>SIGNAL</span></strong><small>AI EARLY WARNING</small></div>
        </div>
        <nav>
          <span>Операции</span>
          <button className="active"><LayoutDashboard size={17} /> Центр управления</button>
          <button><Siren size={17} /> Инциденты <i>{data?.kpis.open_incidents ?? 0}</i></button>
          <button><Map size={17} /> Карта объектов</button>
          <span>Аналитика</span>
          <button><Activity size={17} /> Телеметрия</button>
          <button><Database size={17} /> Источники данных</button>
          <button><Building2 size={17} /> Инфраструктура</button>
          <span>Система</span>
          <button><ServerCog size={17} /> Интеграции</button>
          <button><ShieldCheck size={17} /> Аудит решений</button>
          <button><Settings size={17} /> Настройки</button>
        </nav>
        <div className="sidebar-status">
          <div><RadioTower size={16} /><span><b>{t.live}</b><small>5 источников · online</small></span></div>
          <i />
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <div className="breadcrumbs">SMART AQMOLA <span>/</span> UTILITIES <span>/</span> LIVE</div>
            <h1>{t.command}</h1>
            <p>{t.subtitle}</p>
          </div>
          <div className="topbar-actions">
            <div className="system-pill"><CircleDot size={13} /><span>{t.deterministic}</span></div>
            <button className="language-button" onClick={() => setLanguage(language === "ru" ? "kz" : "ru")}>
              <Languages size={16} /> {language.toUpperCase()} <ChevronDown size={13} />
            </button>
            <button className="icon-button" aria-label="Уведомления"><Bell size={17} /><i /></button>
            <button className="operator-button"><span>AD</span><div><b>Диспетчер</b><small>Смена 04</small></div></button>
          </div>
        </header>

        {error && (
          <div className="error-banner"><AlertOctagon size={17} /><span>Backend недоступен: {error}</span><button onClick={() => void load()}>Повторить</button></div>
        )}

        <section className="control-strip">
          <div className="source-statuses">
            <span><i className="green" /> SCADA <b>online</b></span>
            <span><i className="green" /> 109 <b>adapter</b></span>
            <span><i className="green" /> e‑Өтініш <b>adapter</b></span>
            <span><i className="green" /> Регламенты <b>6 sections</b></span>
            <span><i className={data?.ai.available ? "green" : "amber"} /> {t.localAi} <b>{data?.ai.available ? data.ai.model : "safe fallback"}</b></span>
          </div>
          <div className="demo-controls">
            <button className="reset-button" onClick={() => void reset()} disabled={runningDemo}><RefreshCw size={15} /> {t.reset}</button>
            <button className="demo-button" onClick={() => void runDemo()} disabled={runningDemo}>
              {runningDemo ? <LoaderCircle className="spinner" size={16} /> : <Play size={16} fill="currentColor" />} {t.runDemo}
            </button>
          </div>
        </section>

        <section className="kpi-grid">
          <KpiCard label={t.open} value={data?.kpis.open_incidents ?? 0} icon={<Siren size={18} />} tone="amber" hint="за текущую смену" />
          <KpiCard label={t.confirmed} value={data?.kpis.confirmed_incidents ?? 0} icon={<ShieldCheck size={18} />} tone="cyan" hint="cross-source correlation" />
          <KpiCard label={t.critical} value={data?.kpis.critical_incidents ?? 0} icon={<AlertOctagon size={18} />} tone="red" hint="требуют подтверждения" />
          <KpiCard label={t.signals} value={data?.kpis.signals_processed ?? 0} icon={<Gauge size={18} />} hint={`confidence ${Math.round((data?.kpis.average_confidence ?? 0) * 100)}%`} />
        </section>

        <section className="operations-grid">
          <div className="left-operations">
            <article className="panel map-panel">
              <div className="panel-heading"><div><span className="section-index">01</span><div><h2>{t.map}</h2><p>Объекты, сигналы и зона предполагаемого воздействия</p></div></div><span className="panel-live"><i /> LIVE</span></div>
              <InfrastructureMap
                assets={data?.assets ?? []}
                incidents={data?.incidents ?? []}
                selectedAssetId={selectedAssetId}
                onSelectAsset={setSelectedAssetId}
                onSelectIncident={selectIncident}
              />
            </article>

            <div className="lower-grid">
              <article className="panel telemetry-panel">
                <div className="panel-heading compact"><div><span className="section-index">02</span><div><h2>{t.telemetry}</h2><p>{selectedAsset?.external_id ?? "—"}</p></div></div><Activity size={17} /></div>
                <TelemetryChart asset={selectedAsset} telemetry={data?.telemetry ?? []} />
              </article>
              <article className="panel incident-list-panel">
                <div className="panel-heading compact"><div><span className="section-index">03</span><div><h2>{t.incidents}</h2><p>Единые карточки вместо дублей</p></div></div><span className="count-badge">{data?.incidents.length ?? 0}</span></div>
                <IncidentList incidents={data?.incidents ?? []} selectedId={selectedIncidentId} onSelect={selectIncident} />
              </article>
            </div>

            <article className="panel timeline-panel">
              <div className="panel-heading compact"><div><span className="section-index">04</span><div><h2>{t.timeline}</h2><p>Аудитируемая цепочка принятия решения</p></div></div><span className="mono-label">UTC+5</span></div>
              <Timeline events={data?.timeline ?? []} />
            </article>
          </div>

          <IncidentPanel
            incident={selectedIncident}
            asset={data?.assets.find((asset) => asset.id === selectedIncident?.asset_id)}
            crews={data?.crews ?? []}
            language={language}
            onAssign={assignCrew}
            onAcknowledge={acknowledge}
          />
        </section>
      </main>
    </div>
  );
}

export default App;
