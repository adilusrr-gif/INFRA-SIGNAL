import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  AlertOctagon,
  ArrowRight,
  Bot,
  Building2,
  Check,
  CheckCircle2,
  Database,
  Download,
  FileJson,
  Filter,
  Gauge,
  Languages,
  MapPin,
  Moon,
  RadioTower,
  RefreshCw,
  Search,
  ServerCog,
  ShieldCheck,
  Siren,
  Sun,
  UploadCloud,
} from "lucide-react";
import { api, ApiRequestError } from "../lib/api";
import { translate, type UiLanguage } from "../lib/i18n";
import type {
  DashboardData,
  GisImportResult,
  HealthStatus,
  TimelineEvent,
} from "../types";
import { IncidentList } from "./IncidentList";
import { IncidentPanel } from "./IncidentPanel";
import { InfrastructureMap } from "./InfrastructureMap";
import { KpiCard } from "./KpiCard";
import { TelemetryChart } from "./TelemetryChart";
import { Timeline } from "./Timeline";

export type ViewId =
  | "dashboard"
  | "incidents"
  | "map"
  | "telemetry"
  | "sources"
  | "infrastructure"
  | "integrations"
  | "audit"
  | "settings";

export type ThemeMode = "dark" | "light";

interface SelectionProps {
  selectedIncidentId: string | null;
  selectedAssetId: string | null;
  onSelectIncident: (incidentId: string) => void;
  onSelectAsset: (assetId: string) => void;
}

interface ActionProps {
  onAssign: (incidentId: string, crewId: string) => Promise<void>;
  onAcknowledge: (incidentId: string) => Promise<void>;
}

function assetTypeLabel(value: string) {
  const labels: Record<string, string> = {
    water_main: "Водопровод",
    heating_main: "Теплосеть",
    electric_substation: "Подстанция",
    sewer_collector: "Канализация",
  };
  return labels[value] ?? value;
}

function stateLabel(value: string) {
  const labels: Record<string, string> = {
    normal: "Норма",
    degraded: "Отклонение",
    critical: "Критическое",
    offline: "Нет связи",
  };
  return labels[value] ?? value;
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    detected: "Обнаружен",
    confirmed: "Подтверждён",
    assigned: "Бригада назначена",
    in_progress: "В работе",
    monitoring: "Мониторинг",
    resolved: "Завершён",
    false_positive: "Ложный сигнал",
  };
  return labels[value] ?? value;
}

function dateTime(value: string) {
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function EmptyState({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="module-empty">
      <span>{icon}</span>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

export function DashboardView({
  data,
  language,
  selectedIncidentId,
  selectedAssetId,
  onSelectIncident,
  onSelectAsset,
  onAssign,
  onAcknowledge,
  onNavigate,
}: {
  data: DashboardData;
  language: UiLanguage;
  onNavigate: (view: ViewId) => void;
} & SelectionProps & ActionProps) {
  const t = translate(language);
  const selectedIncident = data.incidents.find((item) => item.id === selectedIncidentId) ?? null;
  const selectedAsset = data.assets.find((item) => item.id === selectedAssetId);

  return (
    <>
      <section className="kpi-grid" aria-label="Ключевые показатели">
        <KpiCard label={t.open} value={data.kpis.open_incidents} icon={<Siren size={18} />} tone="amber" hint="за текущую смену" onClick={() => onNavigate("incidents")} />
        <KpiCard label={t.confirmed} value={data.kpis.confirmed_incidents} icon={<ShieldCheck size={18} />} tone="cyan" hint="cross-source correlation" onClick={() => onNavigate("audit")} />
        <KpiCard label={t.critical} value={data.kpis.critical_incidents} icon={<AlertOctagon size={18} />} tone="red" hint="требуют подтверждения" onClick={() => onNavigate("incidents")} />
        <KpiCard label={t.signals} value={data.kpis.signals_processed} icon={<Gauge size={18} />} hint={`confidence ${Math.round(data.kpis.average_confidence * 100)}%`} onClick={() => onNavigate("sources")} />
      </section>

      <section className="operations-grid">
        <div className="left-operations">
          <article className="panel map-panel">
            <div className="panel-heading">
              <div><span className="section-index">01</span><div><h2>{t.map}</h2><p>Объекты, сигналы и зона предполагаемого воздействия</p></div></div>
              <button className="panel-link" onClick={() => onNavigate("map")}>Развернуть <ArrowRight size={13} /></button>
            </div>
            <InfrastructureMap assets={data.assets} incidents={data.incidents} selectedAssetId={selectedAssetId} onSelectAsset={onSelectAsset} onSelectIncident={onSelectIncident} />
          </article>

          <div className="lower-grid">
            <article className="panel telemetry-panel">
              <div className="panel-heading compact">
                <div><span className="section-index">02</span><div><h2>{t.telemetry}</h2><p>{selectedAsset?.external_id ?? "—"}</p></div></div>
                <button className="icon-link" aria-label="Открыть телеметрию" onClick={() => onNavigate("telemetry")}><Activity size={17} /></button>
              </div>
              <TelemetryChart asset={selectedAsset} telemetry={data.telemetry} />
            </article>
            <article className="panel incident-list-panel">
              <div className="panel-heading compact">
                <div><span className="section-index">03</span><div><h2>{t.incidents}</h2><p>Единые карточки вместо дублей</p></div></div>
                <button className="count-badge" onClick={() => onNavigate("incidents")} aria-label="Открыть все инциденты">{data.incidents.length}</button>
              </div>
              <IncidentList incidents={data.incidents} selectedId={selectedIncidentId} onSelect={onSelectIncident} />
            </article>
          </div>

          <article className="panel timeline-panel">
            <div className="panel-heading compact">
              <div><span className="section-index">04</span><div><h2>{t.timeline}</h2><p>Аудитируемая цепочка принятия решения</p></div></div>
              <button className="panel-link" onClick={() => onNavigate("audit")}>Весь журнал <ArrowRight size={13} /></button>
            </div>
            <Timeline events={data.timeline} />
          </article>
        </div>

        <IncidentPanel incident={selectedIncident} asset={data.assets.find((asset) => asset.id === selectedIncident?.asset_id)} crews={data.crews} language={language} onAssign={onAssign} onAcknowledge={onAcknowledge} />
      </section>
    </>
  );
}

export function IncidentsView({
  data,
  language,
  selectedIncidentId,
  onSelectIncident,
  onAssign,
  onAcknowledge,
}: {
  data: DashboardData;
  language: UiLanguage;
} & Pick<SelectionProps, "selectedIncidentId" | "onSelectIncident"> & ActionProps) {
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all");
  const [status, setStatus] = useState("all");
  const incidents = useMemo(() => data.incidents.filter((incident) => {
    const matchesQuery = `${incident.title} ${incident.id} ${incident.probable_cause}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (severity === "all" || incident.severity === severity) && (status === "all" || incident.status === status);
  }), [data.incidents, query, severity, status]);
  const selected = incidents.find((item) => item.id === selectedIncidentId) ?? incidents[0] ?? null;

  useEffect(() => {
    if (selected && selected.id !== selectedIncidentId) onSelectIncident(selected.id);
  }, [onSelectIncident, selected, selectedIncidentId]);

  return (
    <section className="module-grid incident-module-grid">
      <article className="panel module-panel">
        <div className="module-toolbar">
          <label className="search-control"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по инцидентам" /></label>
          <label className="select-control"><Filter size={14} /><select value={severity} onChange={(event) => setSeverity(event.target.value)}><option value="all">Все риски</option><option value="critical">Критические</option><option value="high">Высокие</option><option value="medium">Средние</option><option value="low">Низкие</option></select></label>
          <label className="select-control"><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Все статусы</option><option value="detected">Обнаружены</option><option value="confirmed">Подтверждены</option><option value="assigned">Назначены</option><option value="in_progress">В работе</option><option value="resolved">Завершены</option></select></label>
          <span className="result-count">Найдено: {incidents.length}</span>
        </div>
        {incidents.length ? (
          <div className="incident-catalog">
            {incidents.map((incident) => (
              <button key={incident.id} className={`incident-catalog-card severity-${incident.severity} ${selected?.id === incident.id ? "selected" : ""}`} onClick={() => onSelectIncident(incident.id)}>
                <span className="incident-catalog-icon"><Siren size={17} /></span>
                <span><small>{incident.id.slice(-8).toUpperCase()} · {dateTime(incident.detected_at)}</small><strong>{incident.title}</strong><em>{statusLabel(incident.status)} · уверенность {Math.round(incident.confidence * 100)}%</em></span>
                <b>{incident.risk_score}</b>
              </button>
            ))}
          </div>
        ) : <EmptyState icon={<CheckCircle2 size={28} />} title="Инциденты не найдены" text="Измените фильтры или запустите демонстрационный сценарий." />}
      </article>
      <IncidentPanel incident={selected} asset={data.assets.find((asset) => asset.id === selected?.asset_id)} crews={data.crews} language={language} onAssign={onAssign} onAcknowledge={onAcknowledge} />
    </section>
  );
}

export function MapView({ data, selectedAssetId, onSelectAsset, onSelectIncident }: { data: DashboardData } & SelectionProps) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState("all");
  const assets = data.assets.filter((asset) => `${asset.name} ${asset.external_id} ${asset.district}`.toLowerCase().includes(query.toLowerCase()) && (state === "all" || asset.state === state));

  return (
    <section className="map-module-layout">
      <article className="panel map-module-panel">
        <div className="panel-heading"><div><span className="section-index">MAP</span><div><h2>Карта инфраструктуры</h2><p>{assets.length} объектов отображено</p></div></div><span className="panel-live"><i /> LIVE</span></div>
        <InfrastructureMap assets={assets} incidents={data.incidents} selectedAssetId={selectedAssetId} onSelectAsset={onSelectAsset} onSelectIncident={onSelectIncident} />
      </article>
      <aside className="panel asset-browser">
        <div className="module-toolbar vertical">
          <label className="search-control"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Объект или район" /></label>
          <label className="select-control"><Filter size={14} /><select value={state} onChange={(event) => setState(event.target.value)}><option value="all">Все состояния</option><option value="normal">Норма</option><option value="degraded">Отклонение</option><option value="critical">Критическое</option><option value="offline">Нет связи</option></select></label>
        </div>
        <div className="asset-browser-list">
          {assets.map((asset) => (
            <button key={asset.id} className={selectedAssetId === asset.id ? "selected" : ""} onClick={() => onSelectAsset(asset.id)}>
              <span className={`asset-state-dot state-${asset.state}`} />
              <span><strong>{asset.name}</strong><small>{asset.external_id} · {asset.district}</small></span>
              <b>{asset.criticality}</b>
            </button>
          ))}
        </div>
      </aside>
    </section>
  );
}

export function TelemetryView({ data, selectedAssetId, onSelectAsset }: { data: DashboardData } & Pick<SelectionProps, "selectedAssetId" | "onSelectAsset">) {
  const selectedAsset = data.assets.find((asset) => asset.id === selectedAssetId) ?? data.assets[0];
  const metrics = Array.from(new Set(data.telemetry.filter((item) => item.asset_id === selectedAsset?.id).map((item) => item.metric)));
  const [metric, setMetric] = useState(metrics[0] ?? "pressure");
  useEffect(() => {
    if (metrics.length && !metrics.includes(metric)) setMetric(metrics[0]);
  }, [metric, metrics]);
  const readings = data.telemetry.filter((item) => item.asset_id === selectedAsset?.id && item.metric === metric).sort((a, b) => Date.parse(b.captured_at) - Date.parse(a.captured_at));
  const latest = readings[0];

  return (
    <section className="telemetry-module">
      <div className="module-toolbar panel toolbar-panel">
        <label className="field-control"><span>Объект</span><select value={selectedAsset?.id ?? ""} onChange={(event) => onSelectAsset(event.target.value)}>{data.assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.external_id} · {asset.name}</option>)}</select></label>
        <label className="field-control"><span>Метрика</span><select value={metric} onChange={(event) => setMetric(event.target.value)}>{metrics.length ? metrics.map((item) => <option key={item} value={item}>{item}</option>) : <option value="pressure">pressure</option>}</select></label>
        <div className="live-reading"><small>Последнее значение</small><strong>{latest ? `${latest.value.toFixed(2)} ${latest.unit}` : "—"}</strong><span className={latest ? "online" : "offline"}>{latest ? "SCADA online" : "нет данных"}</span></div>
      </div>
      <div className="telemetry-content-grid">
        <article className="panel chart-module-panel"><div className="panel-heading"><div><span className="section-index">01</span><div><h2>Динамика показателей</h2><p>{selectedAsset?.name ?? "Объект не выбран"}</p></div></div><Activity size={17} /></div><TelemetryChart asset={selectedAsset} telemetry={data.telemetry} metric={metric} /></article>
        <article className="panel readings-panel"><div className="panel-heading compact"><div><span className="section-index">02</span><div><h2>Последние измерения</h2><p>Необработанные данные адаптера</p></div></div><span className="count-badge">{readings.length}</span></div>{readings.length ? <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Время</th><th>Значение</th><th>Источник</th></tr></thead><tbody>{readings.slice(0, 20).map((reading) => <tr key={reading.id}><td>{dateTime(reading.captured_at)}</td><td><b>{reading.value.toFixed(2)} {reading.unit}</b></td><td>{reading.source}</td></tr>)}</tbody></table></div> : <EmptyState icon={<Activity size={27} />} title="Нет телеметрии" text="Запустите сценарий или подключите SCADA-адаптер." />}</article>
      </div>
    </section>
  );
}

export function SourcesView({ data, onRunDemo }: { data: DashboardData; onRunDemo: () => Promise<void> }) {
  const [source, setSource] = useState("all");
  const [busy, setBusy] = useState(false);
  const reportChannels = Array.from(new Set(data.reports.map((report) => report.channel)));
  const filteredReports = source === "all" ? data.reports : data.reports.filter((report) => report.channel === source);
  const sourceCards = [
    { id: "all", label: "Все обращения", detail: `${data.reports.length} сообщений`, icon: <Database size={18} />, state: "online" },
    { id: "scada", label: "SCADA / IoT", detail: `${data.telemetry.length} измерений`, icon: <RadioTower size={18} />, state: "online" },
    ...reportChannels.map((channel) => ({ id: channel, label: channel, detail: `${data.reports.filter((report) => report.channel === channel).length} обращений`, icon: <Siren size={18} />, state: "online" })),
  ];

  async function run() {
    setBusy(true);
    try { await onRunDemo(); } finally { setBusy(false); }
  }

  return (
    <section className="sources-module">
      <div className="source-card-grid">
        {sourceCards.map((item) => <button key={item.id} className={`source-card ${source === item.id ? "selected" : ""}`} onClick={() => setSource(item.id)}><span>{item.icon}</span><div><strong>{item.label}</strong><small>{item.detail}</small></div><i className={item.state} /></button>)}
      </div>
      <article className="panel source-records-panel">
        <div className="panel-heading"><div><span className="section-index">LOG</span><div><h2>{source === "scada" ? "Поток телеметрии" : "Входящие обращения"}</h2><p>Данные сохраняют источник и время получения</p></div></div><button className="primary-compact" onClick={() => void run()} disabled={busy}><RefreshCw className={busy ? "spinner" : ""} size={14} /> Сгенерировать поток</button></div>
        {source === "scada" ? (
          data.telemetry.length ? <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Время</th><th>Объект</th><th>Метрика</th><th>Значение</th><th>Источник</th></tr></thead><tbody>{[...data.telemetry].reverse().slice(0, 30).map((item) => <tr key={item.id}><td>{dateTime(item.captured_at)}</td><td>{data.assets.find((asset) => asset.id === item.asset_id)?.external_id ?? item.asset_id}</td><td>{item.metric}</td><td><b>{item.value} {item.unit}</b></td><td>{item.source}</td></tr>)}</tbody></table></div> : <EmptyState icon={<RadioTower size={28} />} title="Поток пуст" text="Подключите SCADA или запустите демонстрационный сценарий." />
        ) : filteredReports.length ? <div className="report-feed">{[...filteredReports].reverse().map((report) => <article key={report.id}><span className="report-channel">{report.channel}</span><div><strong>{report.summary || report.text}</strong><p>{report.text}</p><small><MapPin size={11} /> {report.address} · {dateTime(report.created_at)} · {report.language.toUpperCase()}</small></div><b>{report.urgency_score}</b></article>)}</div> : <EmptyState icon={<Database size={28} />} title="Обращений пока нет" text="Сгенерируйте поток или выберите другой источник." />}
      </article>
    </section>
  );
}

export function InfrastructureView({
  data,
  onReload,
  onSelectAsset,
  onNotify,
}: {
  data: DashboardData;
  onReload: () => Promise<void>;
  onSelectAsset: (assetId: string) => void;
  onNotify: (message: string, tone?: "success" | "error") => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<GisImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importIssues, setImportIssues] = useState<ApiRequestError["issues"]>([]);
  const assets = data.assets.filter((asset) => `${asset.name} ${asset.external_id} ${asset.district}`.toLowerCase().includes(query.toLowerCase()) && (type === "all" || asset.asset_type === type));
  const assetTypes = Array.from(new Set(data.assets.map((asset) => asset.asset_type)));

  async function validateFile() {
    if (!file) return;
    setBusy(true);
    setImportError(null);
    setImportIssues([]);
    try {
      const result = await api.importGis(file, true);
      setPreview(result);
      onNotify(`Файл проверен: ${result.received} объектов`, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ошибка проверки GIS-файла";
      setImportError(message);
      setImportIssues(error instanceof ApiRequestError ? error.issues : []);
      setPreview(null);
      onNotify(message, "error");
    } finally { setBusy(false); }
  }

  async function applyFile() {
    if (!file || !preview?.valid) return;
    setBusy(true);
    setImportError(null);
    setImportIssues([]);
    try {
      const result = await api.importGis(file, false);
      setPreview(result);
      await onReload();
      onNotify(`Реестр обновлён: +${result.created}, изменено ${result.updated}`, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ошибка импорта GIS-файла";
      setImportError(message);
      setImportIssues(error instanceof ApiRequestError ? error.issues : []);
      onNotify(message, "error");
    } finally { setBusy(false); }
  }

  return (
    <section className="infrastructure-module">
      <article className="panel gis-import-panel">
        <div className="gis-copy"><span className="section-index">GIS</span><div><h2>Импорт реестра объектов</h2><p>CSV или GeoJSON · сначала безопасная проверка без записи</p></div></div>
        <input ref={fileInput} type="file" accept=".csv,.geojson,.json,text/csv,application/geo+json,application/json" hidden onChange={(event) => { setFile(event.target.files?.[0] ?? null); setPreview(null); setImportError(null); setImportIssues([]); }} />
        <div className="gis-actions">
          <button className="secondary-compact" onClick={() => fileInput.current?.click()}><UploadCloud size={15} /> {file ? file.name : "Выбрать файл"}</button>
          <button className="secondary-compact" disabled={!file || busy} onClick={() => void validateFile()}>{busy ? <RefreshCw className="spinner" size={14} /> : <Check size={14} />} Проверить</button>
          <button className="primary-compact" disabled={!file || !preview?.valid || !preview.dry_run || busy} onClick={() => void applyFile()}><Database size={14} /> Применить импорт</button>
        </div>
        {preview && <div className={`import-result ${preview.applied ? "applied" : "valid"}`}><CheckCircle2 size={18} /><div><strong>{preview.applied ? "Импорт применён" : "Файл прошёл проверку"}</strong><span>Получено {preview.received} · новых {preview.created} · обновится {preview.updated} · без изменений {preview.unchanged}</span></div></div>}
        {importError && <div className="inline-error"><AlertOctagon size={16} /> {importError}</div>}
        {importIssues.length > 0 && <div className="import-issues">{importIssues.slice(0, 12).map((issue, index) => <div key={`${issue.row}-${issue.field}-${index}`}><b>{issue.row}</b><span>{issue.field}</span><p>{issue.message}</p></div>)}</div>}
      </article>

      <article className="panel registry-panel">
        <div className="module-toolbar">
          <label className="search-control"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Название, ID или район" /></label>
          <label className="select-control"><Building2 size={14} /><select value={type} onChange={(event) => setType(event.target.value)}><option value="all">Все типы</option>{assetTypes.map((item) => <option key={item} value={item}>{assetTypeLabel(item)}</option>)}</select></label>
          <span className="result-count">Объектов: {assets.length}</span>
        </div>
        <div className="data-table-wrap"><table className="data-table registry-table"><thead><tr><th>Объект</th><th>Тип</th><th>Район</th><th>Состояние</th><th>Год</th><th>Критичность</th></tr></thead><tbody>{assets.map((asset) => <tr key={asset.id}><td><button className="table-link" onClick={() => onSelectAsset(asset.id)}><strong>{asset.name}</strong><small>{asset.external_id}</small></button></td><td>{assetTypeLabel(asset.asset_type)}</td><td>{asset.district}</td><td><span className={`status-tag state-${asset.state}`}>{stateLabel(asset.state)}</span></td><td>{asset.commissioned_year}</td><td><b>{asset.criticality}/100</b></td></tr>)}</tbody></table></div>
      </article>
    </section>
  );
}

export function IntegrationsView({ health, onRefresh, onNavigate }: { health: HealthStatus | null; onRefresh: () => Promise<void>; onNavigate: (view: ViewId) => void }) {
  const [busy, setBusy] = useState(false);
  const integrations = [
    { id: "scada", title: "SCADA / IoT", text: "Приём телеметрии через REST gateway", icon: <RadioTower size={20} />, configured: true, target: "telemetry" as ViewId },
    { id: "callcentrai", title: "Callcentrai", text: "Аудио и расшифровки звонков 109", icon: <Bot size={20} />, configured: health?.integrations.callcentrai?.configured ?? false, target: "sources" as ViewId },
    { id: "gis_import", title: "GIS Registry", text: "Импорт CSV и GeoJSON, dry-run и upsert", icon: <MapPin size={20} />, configured: health?.integrations.gis_import?.configured ?? true, target: "infrastructure" as ViewId },
    { id: "kence", title: "KENCE", text: "Регламенты и рекомендации с цитатами", icon: <FileJson size={20} />, configured: health?.integrations.kence?.configured ?? false, target: "audit" as ViewId },
  ];

  async function refresh() {
    setBusy(true);
    try { await onRefresh(); } finally { setBusy(false); }
  }

  return (
    <section className="integrations-module">
      <div className="integration-summary panel"><div><span className={health?.status === "ok" ? "health-ok" : "health-warn"}><ServerCog size={18} /></span><div><strong>Шина интеграций</strong><p>{health?.status === "ok" ? "API работает штатно" : "Ожидается проверка API"}</p></div></div><button className="secondary-compact" onClick={() => void refresh()} disabled={busy}><RefreshCw className={busy ? "spinner" : ""} size={14} /> Проверить подключения</button></div>
      <div className="integration-grid">
        {integrations.map((item) => <article key={item.id} className="integration-card"><div className="integration-card-top"><span>{item.icon}</span><i className={item.configured ? "configured" : "not-configured"}>{item.configured ? "Готово" : "Не настроено"}</i></div><h3>{item.title}</h3><p>{item.text}</p>{item.id === "gis_import" && <small>Форматы: {health?.integrations.gis_import?.formats?.join(", ") ?? "csv, geojson"}</small>}<button onClick={() => onNavigate(item.target)}>Открыть модуль <ArrowRight size={14} /></button></article>)}
      </div>
      <div className="trust-note"><ShieldCheck size={18} /><div><strong>Безопасный контур</strong><p>Интеграции только принимают данные. Управление промышленным оборудованием не выполняется без отдельного шлюза и подтверждения человека.</p></div></div>
    </section>
  );
}

export function AuditView({ events }: { events: TimelineEvent[] }) {
  const [kind, setKind] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(events.at(-1)?.id ?? null);
  const kinds = Array.from(new Set(events.map((event) => event.kind)));
  const filtered = kind === "all" ? events : events.filter((event) => event.kind === kind);
  const selected = events.find((event) => event.id === selectedId) ?? filtered.at(-1);

  function exportAudit() {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `infra-signal-audit-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="audit-layout">
      <article className="panel audit-log-panel">
        <div className="module-toolbar"><label className="select-control"><Filter size={14} /><select value={kind} onChange={(event) => setKind(event.target.value)}><option value="all">Все события</option>{kinds.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><span className="result-count">Событий: {filtered.length}</span><button className="secondary-compact" onClick={exportAudit}><Download size={14} /> Экспорт JSON</button></div>
        <div className="audit-event-list">{[...filtered].reverse().map((event) => <button key={event.id} className={selected?.id === event.id ? "selected" : ""} onClick={() => setSelectedId(event.id)}><span><ShieldCheck size={14} /></span><div><strong>{event.title}</strong><p>{event.detail}</p><small>{event.kind}</small></div><time>{dateTime(event.happened_at)}</time></button>)}</div>
      </article>
      <aside className="panel audit-detail-panel">{selected ? <><div className="audit-detail-icon"><ShieldCheck size={24} /></div><span>Неизменяемая запись решения</span><h2>{selected.title}</h2><p>{selected.detail}</p><dl><div><dt>Тип события</dt><dd>{selected.kind}</dd></div><div><dt>Дата и время</dt><dd>{dateTime(selected.happened_at)}</dd></div><div><dt>Связанный ID</dt><dd>{selected.related_id ?? "—"}</dd></div><div><dt>ID записи</dt><dd>{selected.id}</dd></div></dl><div className="audit-integrity"><CheckCircle2 size={15} /> Запись сформирована системой</div></> : <EmptyState icon={<ShieldCheck size={27} />} title="Журнал пуст" text="События появятся после обработки сигналов." />}</aside>
    </section>
  );
}

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (value: boolean) => void; label: string; description: string }) {
  return <div className="setting-row"><div><strong>{label}</strong><p>{description}</p></div><button className={`toggle ${checked ? "on" : ""}`} role="switch" aria-checked={checked} onClick={() => onChange(!checked)}><span /></button></div>;
}

export function SettingsView({
  theme,
  language,
  autoRefresh,
  compactMode,
  onTheme,
  onLanguage,
  onAutoRefresh,
  onCompactMode,
  onReset,
}: {
  theme: ThemeMode;
  language: UiLanguage;
  autoRefresh: boolean;
  compactMode: boolean;
  onTheme: (theme: ThemeMode) => void;
  onLanguage: (language: UiLanguage) => void;
  onAutoRefresh: (value: boolean) => void;
  onCompactMode: (value: boolean) => void;
  onReset: () => void;
}) {
  return (
    <section className="settings-layout">
      <article className="panel settings-panel">
        <div className="settings-section"><div className="settings-heading"><span><Sun size={18} /></span><div><h2>Оформление</h2><p>Выбор сохраняется на этом устройстве</p></div></div><div className="theme-choice"><button className={theme === "light" ? "selected" : ""} onClick={() => onTheme("light")}><Sun size={19} /><span><strong>День</strong><small>Светлый интерфейс</small></span><Check size={15} /></button><button className={theme === "dark" ? "selected" : ""} onClick={() => onTheme("dark")}><Moon size={19} /><span><strong>Ночь</strong><small>Тёмный ситуационный центр</small></span><Check size={15} /></button></div></div>
        <div className="settings-section"><div className="settings-heading"><span><Languages size={18} /></span><div><h2>Язык интерфейса</h2><p>Русский и қазақша</p></div></div><div className="language-choice"><button className={language === "ru" ? "selected" : ""} onClick={() => onLanguage("ru")}><b>RU</b><span>Русский</span></button><button className={language === "kz" ? "selected" : ""} onClick={() => onLanguage("kz")}><b>KZ</b><span>Қазақша</span></button></div></div>
        <div className="settings-section"><div className="settings-heading"><span><RefreshCw size={18} /></span><div><h2>Поведение</h2><p>Настройки рабочего места диспетчера</p></div></div><Toggle checked={autoRefresh} onChange={onAutoRefresh} label="Автоматическое обновление" description="Запрашивать свежие данные каждые 30 секунд" /><Toggle checked={compactMode} onChange={onCompactMode} label="Компактный режим" description="Уменьшить отступы и показать больше данных" /></div>
      </article>
      <aside className="panel settings-summary"><div className="settings-summary-mark"><ShieldCheck size={27} /></div><h3>Рабочее место диспетчера</h3><p>Настройки применяются сразу и не влияют на правила расчёта риска.</p><dl><div><dt>Тема</dt><dd>{theme === "dark" ? "Ночь" : "День"}</dd></div><div><dt>Язык</dt><dd>{language.toUpperCase()}</dd></div><div><dt>Автообновление</dt><dd>{autoRefresh ? "Включено" : "Выключено"}</dd></div><div><dt>Плотность</dt><dd>{compactMode ? "Компактная" : "Обычная"}</dd></div></dl><button className="secondary-compact" onClick={onReset}><RefreshCw size={14} /> Сбросить настройки</button></aside>
    </section>
  );
}
