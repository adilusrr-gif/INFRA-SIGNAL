import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertOctagon,
  Bell,
  Building2,
  ChevronDown,
  CircleDot,
  Database,
  Languages,
  LayoutDashboard,
  LoaderCircle,
  Map,
  Menu,
  Moon,
  Play,
  RadioTower,
  RefreshCw,
  ServerCog,
  Settings,
  ShieldCheck,
  Siren,
  Sun,
  Waves,
  X,
} from "lucide-react";
import {
  AuditView,
  DashboardView,
  IncidentsView,
  InfrastructureView,
  IntegrationsView,
  MapView,
  SettingsView,
  SourcesView,
  TelemetryView,
  type ThemeMode,
  type ViewId,
} from "./components/ModuleViews";
import { api } from "./lib/api";
import { translate, type UiLanguage } from "./lib/i18n";
import type { DashboardData, HealthStatus } from "./types";

const validViews: ViewId[] = [
  "dashboard",
  "incidents",
  "map",
  "telemetry",
  "sources",
  "infrastructure",
  "integrations",
  "audit",
  "settings",
];

function savedView(): ViewId {
  const value = window.localStorage.getItem("infra-signal-view") as ViewId | null;
  return value && validViews.includes(value) ? value : "dashboard";
}

function savedLanguage(): UiLanguage {
  return window.localStorage.getItem("infra-signal-language") === "kz" ? "kz" : "ru";
}

function savedTheme(): ThemeMode {
  const value = window.localStorage.getItem("infra-signal-theme");
  if (value === "light" || value === "dark") return value;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function savedBoolean(key: string, fallback: boolean) {
  const value = window.localStorage.getItem(key);
  return value === null ? fallback : value === "true";
}

const navigation: Array<{
  group: "operations" | "analytics" | "system";
  id: ViewId;
  icon: typeof LayoutDashboard;
  ru: string;
  kz: string;
}> = [
  { group: "operations", id: "dashboard", icon: LayoutDashboard, ru: "Центр управления", kz: "Басқару орталығы" },
  { group: "operations", id: "incidents", icon: Siren, ru: "Инциденты", kz: "Инциденттер" },
  { group: "operations", id: "map", icon: Map, ru: "Карта объектов", kz: "Нысандар картасы" },
  { group: "analytics", id: "telemetry", icon: Activity, ru: "Телеметрия", kz: "Телеметрия" },
  { group: "analytics", id: "sources", icon: Database, ru: "Источники данных", kz: "Дереккөздер" },
  { group: "analytics", id: "infrastructure", icon: Building2, ru: "Инфраструктура", kz: "Инфрақұрылым" },
  { group: "system", id: "integrations", icon: ServerCog, ru: "Интеграции", kz: "Интеграциялар" },
  { group: "system", id: "audit", icon: ShieldCheck, ru: "Аудит решений", kz: "Шешімдер аудиті" },
  { group: "system", id: "settings", icon: Settings, ru: "Настройки", kz: "Баптаулар" },
];

const viewCopy: Record<ViewId, { ru: [string, string]; kz: [string, string] }> = {
  dashboard: { ru: ["Ситуационный центр", "Раннее обнаружение коммунальных аварий"], kz: ["Жағдайлық орталық", "Коммуналдық апаттарды ерте анықтау"] },
  incidents: { ru: ["Управление инцидентами", "Фильтрация, проверка доказательств и действия диспетчера"], kz: ["Инциденттерді басқару", "Сүзгілеу, дәлелдерді тексеру және диспетчер әрекеттері"] },
  map: { ru: ["Карта объектов", "Состояние инфраструктуры и зоны воздействия"], kz: ["Нысандар картасы", "Инфрақұрылым күйі және әсер ету аймақтары"] },
  telemetry: { ru: ["Телеметрия", "Поток измерений и отклонения от базовой линии"], kz: ["Телеметрия", "Өлшемдер ағыны және базалық деңгейден ауытқу"] },
  sources: { ru: ["Источники данных", "SCADA, 109, e-Өтініш и операторские сообщения"], kz: ["Дереккөздер", "SCADA, 109, e-Өтініш және оператор хабарламалары"] },
  infrastructure: { ru: ["Реестр инфраструктуры", "Объекты, критичность и безопасный GIS-импорт"], kz: ["Инфрақұрылым тізілімі", "Нысандар, маңыздылық және қауіпсіз GIS импорты"] },
  integrations: { ru: ["Интеграции", "Состояние внешних адаптеров и контуров данных"], kz: ["Интеграциялар", "Сыртқы адаптерлер мен деректер контурларының күйі"] },
  audit: { ru: ["Аудит решений", "Прослеживаемая история сигналов и действий"], kz: ["Шешімдер аудиті", "Сигналдар мен әрекеттердің бақыланатын тарихы"] },
  settings: { ru: ["Настройки", "Персонализация рабочего места диспетчера"], kz: ["Баптаулар", "Диспетчер жұмыс орнын жекелендіру"] },
};

function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [view, setView] = useState<ViewId>(savedView);
  const [language, setLanguage] = useState<UiLanguage>(savedLanguage);
  const [theme, setTheme] = useState<ThemeMode>(savedTheme);
  const [autoRefresh, setAutoRefresh] = useState(() => savedBoolean("infra-signal-auto-refresh", true));
  const [compactMode, setCompactMode] = useState(() => savedBoolean("infra-signal-compact", false));
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningDemo, setRunningDemo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [operatorOpen, setOperatorOpen] = useState(false);
  const [lastReadAt, setLastReadAt] = useState(() => Number(window.localStorage.getItem("infra-signal-read-at") ?? 0));
  const t = translate(language);

  const applyData = useCallback((next: DashboardData) => {
    setData(next);
    setSelectedIncidentId((current) => next.incidents.some((incident) => incident.id === current) ? current : next.incidents[0]?.id ?? null);
    setSelectedAssetId((current) => next.assets.some((asset) => asset.id === current) ? current : next.incidents[0]?.asset_id ?? next.assets[0]?.id ?? null);
  }, []);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [dashboardResult, healthResult] = await Promise.allSettled([api.dashboard(), api.health()]);
      if (dashboardResult.status === "rejected") throw dashboardResult.reason;
      applyData(dashboardResult.value);
      if (healthResult.status === "fulfilled") setHealth(healthResult.value);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "API недоступен");
    } finally {
      setLoading(false);
    }
  }, [applyData]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, load]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem("infra-signal-theme", theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#071013" : "#f2f7f7");
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = language === "kz" ? "kk" : "ru";
    window.localStorage.setItem("infra-signal-language", language);
  }, [language]);

  useEffect(() => { window.localStorage.setItem("infra-signal-auto-refresh", String(autoRefresh)); }, [autoRefresh]);
  useEffect(() => { window.localStorage.setItem("infra-signal-compact", String(compactMode)); }, [compactMode]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 4_000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const unreadCount = data?.timeline.filter((event) => Date.parse(event.happened_at) > lastReadAt).length ?? 0;
  const [pageTitle, pageSubtitle] = viewCopy[view][language];

  function notify(message: string, tone: "success" | "error" = "success") {
    setToast({ message, tone });
  }

  function navigate(next: ViewId) {
    setView(next);
    window.localStorage.setItem("infra-signal-view", next);
    setSidebarOpen(false);
    setNotificationsOpen(false);
    setOperatorOpen(false);
  }

  function selectIncident(incidentId: string) {
    setSelectedIncidentId(incidentId);
    const incident = data?.incidents.find((item) => item.id === incidentId);
    if (incident) setSelectedAssetId(incident.asset_id);
  }

  async function runDemo() {
    setRunningDemo(true);
    setError(null);
    try {
      applyData(await api.runLeakDemo());
      notify("Демонстрационный аварийный поток обработан");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Сценарий не запустился";
      setError(message);
      notify(message, "error");
    } finally { setRunningDemo(false); }
  }

  async function reset() {
    setRunningDemo(true);
    setError(null);
    try {
      applyData(await api.resetDemo());
      notify("Демонстрационные данные сброшены");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Не удалось сбросить данные";
      setError(message);
      notify(message, "error");
    } finally { setRunningDemo(false); }
  }

  async function assignCrew(incidentId: string, crewId: string) {
    try {
      await api.assignCrew(incidentId, crewId);
      await load();
      notify("Бригада назначена диспетчером");
    } catch (caught) { notify(caught instanceof Error ? caught.message : "Не удалось назначить бригаду", "error"); }
  }

  async function acknowledge(incidentId: string) {
    try {
      await api.updateStatus(incidentId, "in_progress");
      await load();
      notify("Инцидент принят в работу");
    } catch (caught) { notify(caught instanceof Error ? caught.message : "Не удалось изменить статус", "error"); }
  }

  function markNotificationsRead() {
    const now = Date.now();
    setLastReadAt(now);
    window.localStorage.setItem("infra-signal-read-at", String(now));
  }

  function resetPreferences() {
    setTheme("dark");
    setLanguage("ru");
    setAutoRefresh(true);
    setCompactMode(false);
    notify("Настройки рабочего места сброшены");
  }

  function renderView() {
    if (!data) return <div />;
    const selection = { selectedIncidentId, selectedAssetId, onSelectIncident: selectIncident, onSelectAsset: setSelectedAssetId };
    const actions = { onAssign: assignCrew, onAcknowledge: acknowledge };
    switch (view) {
      case "incidents": return <IncidentsView data={data} language={language} selectedIncidentId={selectedIncidentId} onSelectIncident={selectIncident} {...actions} />;
      case "map": return <MapView data={data} {...selection} />;
      case "telemetry": return <TelemetryView data={data} selectedAssetId={selectedAssetId} onSelectAsset={setSelectedAssetId} />;
      case "sources": return <SourcesView data={data} onRunDemo={runDemo} />;
      case "infrastructure": return <InfrastructureView data={data} onReload={load} onSelectAsset={(assetId) => { setSelectedAssetId(assetId); navigate("map"); }} onNotify={notify} />;
      case "integrations": return <IntegrationsView health={health} onRefresh={load} onNavigate={navigate} />;
      case "audit": return <AuditView events={data.timeline} />;
      case "settings": return <SettingsView theme={theme} language={language} autoRefresh={autoRefresh} compactMode={compactMode} onTheme={setTheme} onLanguage={setLanguage} onAutoRefresh={setAutoRefresh} onCompactMode={setCompactMode} onReset={resetPreferences} />;
      default: return <DashboardView data={data} language={language} onNavigate={navigate} {...selection} {...actions} />;
    }
  }

  if (loading) {
    return <div className="app-loading"><div className="loading-mark"><Waves size={34} /></div><LoaderCircle className="spinner" size={24} /><span>Инициализация ситуационного центра</span></div>;
  }

  return (
    <div className={`app-shell ${compactMode ? "compact-mode" : ""}`}>
      <button className="mobile-menu-button" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label={sidebarOpen ? "Закрыть меню" : "Открыть меню"}>{sidebarOpen ? <X size={20} /> : <Menu size={20} />}</button>
      {sidebarOpen && <button className="sidebar-overlay" onClick={() => setSidebarOpen(false)} aria-label="Закрыть меню" />}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <button className="brand" onClick={() => navigate("dashboard")}><span className="brand-symbol"><Waves size={23} /></span><span><strong>INFRA<span>SIGNAL</span></strong><small>AI EARLY WARNING</small></span></button>
        <nav aria-label="Основная навигация">
          {(["operations", "analytics", "system"] as const).map((group) => (
            <div className="nav-group" key={group}>
              <span>{group === "operations" ? (language === "ru" ? "Операции" : "Операциялар") : group === "analytics" ? "Аналитика" : (language === "ru" ? "Система" : "Жүйе")}</span>
              {navigation.filter((item) => item.group === group).map((item) => {
                const Icon = item.icon;
                return <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => navigate(item.id)}><Icon size={17} /> {item[language]}{item.id === "incidents" && (data?.kpis.open_incidents ?? 0) > 0 && <i>{data?.kpis.open_incidents}</i>}</button>;
              })}
            </div>
          ))}
        </nav>
        <button className="sidebar-status" onClick={() => navigate("integrations")}><span><RadioTower size={16} /><span><b>{t.live}</b><small>5 источников · online</small></span></span><i /></button>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="topbar-copy"><div className="breadcrumbs">SMART AQMOLA <span>/</span> INFRA SIGNAL <span>/</span> {view.toUpperCase()}</div><h1>{pageTitle}</h1><p>{pageSubtitle}</p></div>
          <div className="topbar-actions">
            <div className="system-pill"><CircleDot size={13} /><span>{t.deterministic}</span></div>
            <button className="theme-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему"}>{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}</button>
            <button className="language-button" onClick={() => setLanguage(language === "ru" ? "kz" : "ru")}><Languages size={16} /> {language.toUpperCase()} <ChevronDown size={13} /></button>
            <div className="popover-anchor"><button className="icon-button" aria-label="Уведомления" aria-expanded={notificationsOpen} onClick={() => { setNotificationsOpen(!notificationsOpen); setOperatorOpen(false); }}><Bell size={17} />{unreadCount > 0 && <i />}</button>{notificationsOpen && <div className="top-popover notifications-popover"><div className="popover-heading"><div><strong>Уведомления</strong><small>{unreadCount} непрочитанных</small></div><button onClick={markNotificationsRead}>Прочитать все</button></div><div className="notification-list">{data?.timeline.length ? [...data.timeline].reverse().slice(0, 5).map((event) => <button key={event.id} onClick={() => { if (event.related_id && data.incidents.some((item) => item.id === event.related_id)) selectIncident(event.related_id); navigate("audit"); }}><span className={Date.parse(event.happened_at) > lastReadAt ? "unread" : ""} /><div><strong>{event.title}</strong><p>{event.detail}</p><small>{new Date(event.happened_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</small></div></button>) : <p className="popover-empty">Новых событий нет</p>}</div></div>}</div>
            <div className="popover-anchor"><button className="operator-button" aria-expanded={operatorOpen} onClick={() => { setOperatorOpen(!operatorOpen); setNotificationsOpen(false); }}><span>AD</span><div><b>Диспетчер</b><small>Смена 04</small></div><ChevronDown size={13} /></button>{operatorOpen && <div className="top-popover operator-popover"><div className="operator-profile"><span>AD</span><div><strong>Адиль · Диспетчер</strong><small>Смена активна · UTC+5</small></div></div><button onClick={() => navigate("settings")}><Settings size={15} /> Настройки рабочего места</button><button onClick={() => navigate("audit")}><ShieldCheck size={15} /> Мои действия в аудите</button></div>}</div>
          </div>
        </header>

        {error && <div className="error-banner"><AlertOctagon size={17} /><span>Backend недоступен: {error}</span><button onClick={() => void load()}>Повторить</button></div>}
        <section className="control-strip"><div className="source-statuses"><button onClick={() => navigate("telemetry")}><i className="green" /> SCADA <b>online</b></button><button onClick={() => navigate("sources")}><i className="green" /> 109 <b>adapter</b></button><button onClick={() => navigate("sources")}><i className="green" /> e‑Өтініш <b>adapter</b></button><button onClick={() => navigate("infrastructure")}><i className="green" /> GIS <b>{data?.assets.length ?? 0} assets</b></button><button onClick={() => navigate("integrations")}><i className={data?.ai.available ? "green" : "amber"} /> {t.localAi} <b>{data?.ai.available ? data.ai.model : "safe fallback"}</b></button></div><div className="demo-controls"><button className="reset-button" onClick={() => void reset()} disabled={runningDemo}><RefreshCw size={15} /> {t.reset}</button><button className="demo-button" onClick={() => void runDemo()} disabled={runningDemo}>{runningDemo ? <LoaderCircle className="spinner" size={16} /> : <Play size={16} fill="currentColor" />} {t.runDemo}</button></div></section>
        <div className="module-stage">{renderView()}</div>
      </main>
      {toast && <div className={`toast toast-${toast.tone}`} role="status">{toast.tone === "success" ? <ShieldCheck size={17} /> : <AlertOctagon size={17} />}<span>{toast.message}</span><button onClick={() => setToast(null)} aria-label="Закрыть"><X size={14} /></button></div>}
    </div>
  );
}

export default App;
