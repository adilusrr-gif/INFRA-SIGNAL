"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from "react";
import { ExpandMap } from "@/components/ui/expand-map";
import { AnimatedFlowPath, type FlowKind } from "@/components/ui/animated-flow-path";
import { RealAstanaMap } from "@/components/astana-real-map";
import {
  adapterCatalog,
  getDemoOperationsSnapshot,
  type AdapterSource,
  type AdapterStatus,
  type OperationEventType,
  type OperationsSnapshot,
} from "@/lib/operations-contract";

type Locale = "ru" | "kz";
type DemoStage = "watch" | "detecting" | "incident" | "assigned";
type ThemeMode = "dark" | "light";
type MapLayer = "network" | "risk" | "reports" | "city3d" | "real";
type UtilityFilter = "all" | FlowKind;
type DashboardMapMode = "real" | "flow" | "telemetry" | "impact" | "city3d";
type TwinLayer = "buildings" | "flows" | "sensors" | "impact";
type TwinLayerState = Record<TwinLayer, boolean>;

const copy = {
  ru: {
    command: "Ситуационный центр",
    subtitle: "Раннее обнаружение аварий городской инфраструктуры",
    run: "Запустить сценарий",
    replay: "Повторить сценарий",
    reset: "Сбросить",
    open: "Открытые инциденты",
    confirmed: "Подтверждено ИИ",
    critical: "Критические",
    signals: "Сигналов обработано",
    map: "Операционная карта",
    telemetry: "Давление в сети",
    incidents: "Очередь инцидентов",
    timeline: "Хронология решения",
    risk: "Оценка риска",
    confidence: "Достоверность",
    cause: "Вероятная причина",
    evidence: "Подтверждающие сигналы",
    response: "Рекомендованный план",
    assign: "Назначить бригаду",
    assigned: "Бригада направлена",
    human: "Финальное решение принимает диспетчер",
    noIncident: "Аномалий не обнаружено",
    analyzing: "ИИ сопоставляет независимые сигналы",
    demo: "ДЕМО · СИНТЕТИЧЕСКИЕ ДАННЫЕ",
    signalStage: "Сигналы получены",
    correlationStage: "Корреляция ИИ",
    actionStage: "Решение диспетчера",
  },
  kz: {
    command: "Ахуалдық орталық",
    subtitle: "Қалалық инфрақұрылым апаттарын ерте анықтау",
    run: "Сценарийді іске қосу",
    replay: "Сценарийді қайталау",
    reset: "Қалпына келтіру",
    open: "Ашық оқиғалар",
    confirmed: "ЖИ растаған",
    critical: "Маңызды оқиғалар",
    signals: "Өңделген сигналдар",
    map: "Операциялық карта",
    telemetry: "Желідегі қысым",
    incidents: "Оқиғалар кезегі",
    timeline: "Шешім хронологиясы",
    risk: "Тәуекел бағасы",
    confidence: "Сенімділік",
    cause: "Ықтимал себеп",
    evidence: "Растаушы сигналдар",
    response: "Ұсынылған жоспар",
    assign: "Бригаданы жіберу",
    assigned: "Бригада жолға шықты",
    human: "Соңғы шешімді диспетчер қабылдайды",
    noIncident: "Ауытқу анықталған жоқ",
    analyzing: "ЖИ тәуелсіз сигналдарды салыстыруда",
    demo: "ДЕМО · СИНТЕТИКАЛЫҚ ДЕРЕКТЕР",
    signalStage: "Сигналдар алынды",
    correlationStage: "ЖИ корреляциясы",
    actionStage: "Диспетчер шешімі",
  },
} as const;

const navGroups = [
  { label: "ОПЕРАЦИИ", items: [["⌂", "Центр управления"], ["!", "Инциденты"], ["⌖", "Карта объектов"]] },
  { label: "АНАЛИТИКА", items: [["◈", "Аналитика"], ["⌁", "Телеметрия"], ["◫", "Источники данных"], ["▦", "Инфраструктура"]] },
  { label: "СИСТЕМА", items: [["⇄", "Интеграции"], ["✓", "Аудит решений"], ["⚙", "Настройки"]] },
];

const moduleCopy: Record<string, [string, string]> = {
  "Центр управления": ["Ситуационный центр", "Раннее обнаружение аварий городской инфраструктуры"],
  "Инциденты": ["Управление инцидентами", "Фильтрация, доказательства и действия диспетчера"],
  "Карта объектов": ["Карта объектов", "Состояние инфраструктуры и зоны предполагаемого воздействия"],
  "Аналитика": ["Аналитика и прогнозы", "Динамика инцидентов, SLA и упреждающая оценка риска"],
  "Телеметрия": ["Телеметрия", "Поток измерений и отклонения от базовой линии"],
  "Источники данных": ["Источники данных", "SCADA, 109, e‑Өтініш и сообщения операторов"],
  "Инфраструктура": ["Реестр инфраструктуры", "Объекты, критичность и безопасный GIS‑импорт"],
  "Интеграции": ["Интеграции", "Состояние внешних адаптеров и контуров данных"],
  "Аудит решений": ["Аудит решений", "Прослеживаемая история сигналов и действий"],
  "Настройки": ["Настройки", "Персонализация рабочего места диспетчера"],
};

const recommendations = [
  ["01", "Проверить телеметрию соседних контрольных точек и подтвердить направление падения давления.", "Регламент АДС · §4.2"],
  ["02", "Уточнить границы отключения и согласовать схему задвижек с дежурным инженером.", "Регламент АДС · §4.4"],
  ["03", "Направить водопроводную бригаду с оборудованием для поиска скрытой утечки.", "Регламент АДС · §5.1"],
];

const timeline = [
  ["10:42:11", "Аномалия телеметрии", "Давление снизилось на 31% за 8 минут", "red"],
  ["10:43:02", "Звонок 109", "Житель сообщил о воде на проезжей части", "cyan"],
  ["10:44:18", "e‑Өтініш", "Получено второе обращение из той же зоны", "cyan"],
  ["10:44:24", "Инцидент сформирован", "Три сигнала объединены в единую карточку", "amber"],
];

function MiniIcon({ children, tone = "default" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`mini-icon mini-icon-${tone}`}>{children}</span>;
}

function Kpi({ label, value, trend, tone, icon }: { label: string; value: string; trend: string; tone: string; icon: string }) {
  return (
    <article className={`kpi kpi-${tone}`}>
      <div className="kpi-top"><span>{label}</span><MiniIcon tone={tone}>{icon}</MiniIcon></div>
      <strong>{value}</strong>
      <small><i /> {trend}</small>
    </article>
  );
}

function MapBuilding({ x, y, width, depth, height, tone = "cyan" }: { x: number; y: number; width: number; depth: number; height: number; tone?: "cyan" | "amber" | "red" }) {
  const offsetX = Number((depth * .42).toFixed(1));
  const offsetY = Number((depth * .24).toFixed(1));
  return <g className={`city3d-building city3d-building-${tone}`} transform={`translate(${x} ${y})`}>
    <path className="city3d-building-front" d={`M0 ${-height}H${width}V0H0Z`} />
    <path className="city3d-building-side" d={`M${width} ${-height}L${width + offsetX} ${-height - offsetY}V${-offsetY}L${width} 0Z`} />
    <path className="city3d-building-roof" d={`M0 ${-height}L${offsetX} ${-height - offsetY}H${width + offsetX}L${width} ${-height}Z`} />
    <path className="city3d-building-window" d={`M8 ${-height + 9}H${Math.max(15, width - 7)}M8 ${-height + 18}H${Math.max(15, width - 7)}`} />
  </g>;
}

function NetworkMap({
  active,
  detecting,
  selectedAssetId = "WM-042",
  onSelectAsset,
  layer = "network",
  utilityFilter = "all",
  context = "detail",
  dashboardMode = "flow",
  pitch = 46,
  yaw = -3,
  showBuildings = true,
  showFlows = true,
  showSensors = true,
  showImpact = true,
  incidentMoment = 3,
  showChrome = true,
  showAssetCard = true,
  locale = "ru",
  zoom = 1,
}: {
  active: boolean;
  detecting: boolean;
  selectedAssetId?: string;
  onSelectAsset?: (assetId: string) => void;
  layer?: MapLayer;
  utilityFilter?: UtilityFilter;
  context?: "dashboard" | "detail";
  dashboardMode?: DashboardMapMode;
  pitch?: number;
  yaw?: number;
  showBuildings?: boolean;
  showFlows?: boolean;
  showSensors?: boolean;
  showImpact?: boolean;
  incidentMoment?: number;
  showChrome?: boolean;
  showAssetCard?: boolean;
  locale?: Locale;
  zoom?: number;
}) {
  const selected = assets.find((asset) => asset.id === selectedAssetId) ?? assets[0];
  const is3D = dashboardMode === "city3d" || layer === "city3d";
  const pitchYScale = Math.min(1.82, 1 / Math.max(.55, Math.cos((pitch * Math.PI) / 180)));
  const mapTransform = is3D
    ? `perspective(1100px) rotateX(${pitch}deg) rotateZ(${yaw}deg) scale3d(${(1.12 * zoom).toFixed(2)},${(pitchYScale * zoom).toFixed(2)},1)`
    : `scale(${zoom})`;
  const activateAsset = (assetId: string) => onSelectAsset?.(assetId);
  const assetClass = (assetId: string, state: "normal" | "warning" | "critical", utility: string) => `asset asset-${state} asset-utility-${utility} ${selectedAssetId === assetId ? "asset-selected" : ""} ${onSelectAsset ? "asset-selectable" : ""}`;
  const utilityVisible = (utility: FlowKind) => utilityFilter === "all" || utilityFilter === utility;
  const mapLabel = is3D
    ? "3D CITY DIGITAL TWIN"
    : context === "dashboard" && dashboardMode === "telemetry"
    ? "SENSOR DIAGNOSTICS"
    : context === "dashboard" && dashboardMode === "impact"
      ? "IMPACT FORECAST"
      : layer === "risk"
    ? "RISK HEATMAP"
    : layer === "reports"
      ? "CITIZEN REPORTS"
      : utilityFilter === "water"
        ? "WATER INCIDENT"
        : utilityFilter === "electricity"
          ? "ELECTRIC PULSE"
          : utilityFilter === "gas"
            ? "GAS FLOW"
            : "MULTI-UTILITY FLOW";
  const dashboardSummary = dashboardMode === "city3d"
    ? {
        eyebrow: locale === "ru" ? "ЦИФРОВОЙ ДВОЙНИК РАЙОНА" : "АУДАННЫҢ ЦИФРЛЫҚ ЕГІЗІ",
        title: locale === "ru" ? "3D-модель воздействия" : "Әсердің 3D-моделі",
        detail: `${locale === "ru" ? "камера" : "камера"} ${pitch}° / ${yaw > 0 ? "+" : ""}${yaw}° · 12 ${locale === "ru" ? "объектов" : "нысан"}`,
      }
    : dashboardMode === "telemetry"
    ? {
        eyebrow: locale === "ru" ? "ПЕРЕПАД МЕЖДУ ДАТЧИКАМИ" : "ДАТЧИКТЕР АРАСЫНДАҒЫ АЙЫРМА",
        title: locale === "ru" ? "4.1 → 2.8 bar" : "4.1 → 2.8 bar",
        detail: locale === "ru" ? "−1.3 bar · участок VM-207 → WM-042" : "−1.3 bar · VM-207 → WM-042 учаскесі",
      }
    : dashboardMode === "impact"
      ? {
          eyebrow: locale === "ru" ? "ПРОГНОЗ ЗОНЫ ВОЗДЕЙСТВИЯ" : "ӘСЕР АЙМАҒЫНЫҢ БОЛЖАМЫ",
          title: locale === "ru" ? "Радиус 640 м" : "Радиус 640 м",
          detail: locale === "ru" ? "12 объектов · ≈1 840 жителей" : "12 нысан · ≈1 840 тұрғын",
        }
      : {
          eyebrow: active ? (locale === "ru" ? "КРИТИЧЕСКИЙ ИНЦИДЕНТ" : "МАҢЫЗДЫ ОҚИҒА") : detecting ? (locale === "ru" ? "ИДЁТ КОРРЕЛЯЦИЯ" : "КОРРЕЛЯЦИЯ ЖҮРУДЕ") : (locale === "ru" ? "СЕТЬ ПОД НАБЛЮДЕНИЕМ" : "ЖЕЛІ БАҚЫЛАУДА"),
          title: active ? (locale === "ru" ? "Разрыв водяного потока" : "Су ағынының үзілуі") : (locale === "ru" ? "Поток стабилен" : "Ағын тұрақты"),
          detail: active ? "2.8 bar · −31% · 8 мин" : detecting ? (locale === "ru" ? "Сопоставляем 3 источника" : "3 дереккөз салыстырылуда") : "4.2 bar · 94% confidence",
        };
  return (
    <div className={`map-wrap map-view-${layer} map-filter-${utilityFilter} map-context-${context} map-dashboard-${dashboardMode} map-moment-${incidentMoment} ${showBuildings ? "twin-buildings-on" : "twin-buildings-off"} ${showFlows ? "twin-flows-on" : "twin-flows-off"} ${showSensors ? "twin-sensors-on" : "twin-sensors-off"} ${showImpact ? "twin-impact-on" : "twin-impact-off"}`}>
      <svg className={`network-map map-layer-${layer}`} style={{ transform: mapTransform, transformOrigin: "50% 54%" }} viewBox="0 0 860 490" preserveAspectRatio="xMidYMid slice" role="img" aria-label={is3D ? "Трёхмерная модель городской инженерной сети" : "Интерактивная схема городской инженерной сети"}>
        <defs>
          <pattern id="networkGrid" width="26" height="26" patternUnits="userSpaceOnUse"><path d="M26 0H0V26" fill="none" stroke="#163039" strokeWidth="0.7" /></pattern>
          <linearGradient id="networkRiver" x1="0" x2="1"><stop offset="0" stopColor="#0a2933" /><stop offset=".5" stopColor="#145062" /><stop offset="1" stopColor="#0a2730" /></linearGradient>
          <radialGradient id="riskHot"><stop offset="0" stopColor="#ff5c68" stopOpacity=".42" /><stop offset="1" stopColor="#ff5c68" stopOpacity="0" /></radialGradient>
          <radialGradient id="riskWarm"><stop offset="0" stopColor="#ffb84d" stopOpacity=".30" /><stop offset="1" stopColor="#ffb84d" stopOpacity="0" /></radialGradient>
          <linearGradient id="city3dTerrain" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#10282e" /><stop offset=".5" stopColor="#08191e" /><stop offset="1" stopColor="#0c2429" /></linearGradient>
          <radialGradient id="city3dIncident"><stop offset="0" stopColor="#ff5c68" stopOpacity=".3" /><stop offset=".58" stopColor="#ff5c68" stopOpacity=".08" /><stop offset="1" stopColor="#ff5c68" stopOpacity="0" /></radialGradient>
          <filter id="networkGlow"><feGaussianBlur stdDeviation="5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <filter id="city3dShadow" x="-40%" y="-50%" width="190%" height="210%"><feDropShadow dx="7" dy="10" stdDeviation="6" floodColor="#000" floodOpacity=".5" /></filter>
        </defs>
        <rect width="860" height="490" fill="#071419" /><rect width="860" height="490" fill="url(#networkGrid)" opacity=".75" />
        {is3D && <g className="city3d-layer">
          <path className="city3d-ground" d="M35 86L735 46L832 402L115 455Z" fill="url(#city3dTerrain)" />
          <path className="city3d-block" d="M70 155L202 140L229 216L94 229Z" />
          <path className="city3d-block" d="M254 105L401 92L426 182L278 190Z" />
          <path className="city3d-block" d="M612 87L786 78L801 182L632 191Z" />
          <path className="city3d-block" d="M630 245L807 229L822 349L648 366Z" />
          <path className="city3d-block" d="M95 286L268 269L287 403L116 420Z" />
          {showBuildings && <g className="city3d-buildings">
            <MapBuilding x={96} y={190} width={42} depth={30} height={38} />
            <MapBuilding x={151} y={180} width={31} depth={25} height={55} tone="amber" />
            <MapBuilding x={285} y={152} width={50} depth={28} height={46} />
            <MapBuilding x={352} y={146} width={34} depth={24} height={67} />
            <MapBuilding x={650} y={145} width={46} depth={31} height={52} />
            <MapBuilding x={716} y={137} width={38} depth={27} height={72} />
            <MapBuilding x={667} y={319} width={48} depth={31} height={45} tone="red" />
            <MapBuilding x={742} y={311} width={31} depth={24} height={58} />
            <MapBuilding x={124} y={376} width={46} depth={29} height={42} />
            <MapBuilding x={194} y={368} width={35} depth={25} height={62} />
          </g>}
          {showImpact && incidentMoment >= 2 && <g className="city3d-impact">
            <circle cx="523" cy="286" r="128" fill="url(#city3dIncident)" className="city3d-incident-volume" />
            <g className="city3d-beacon" transform="translate(523 286)"><ellipse rx="34" ry="13" /><line y2="-70" /><circle cy="-70" r="8" /><text x="14" y="-66">WM-042 · −31%</text></g>
          </g>}
        </g>}
        <path d="M-20 392C155 330 274 454 458 378S704 295 890 332" fill="none" stroke="url(#networkRiver)" strokeWidth="30" opacity=".84" />
        <path d="M-20 128C168 182 282 102 441 157S678 218 888 163" fill="none" stroke="#193139" strokeWidth="12" />
        <path d="M173-20C164 125 238 193 205 520M555-20C501 125 588 225 539 520" fill="none" stroke="#1a333a" strokeWidth="9" />
        <path d="M30 278C180 212 356 301 527 252S732 224 890 245" fill="none" stroke="#19343a" strokeWidth="8" />
        {showFlows && (layer === "network" || layer === "city3d") ? <g className="utility-flow-network">
          {utilityVisible("electricity") && <>
            <AnimatedFlowPath kind="electricity" label="Электросеть: импульсный поток до подстанции EL-016" d="M58 118C145 82 225 106 302 126" />
            <AnimatedFlowPath kind="electricity" label="Электросеть: нарушение ритма у EL-016" d="M302 126C320 129 338 122 356 114" anomaly duration={2.8} />
            <AnimatedFlowPath kind="electricity" label="Электросеть: импульсный поток после EL-016" d="M356 114C435 82 470 88 548 112S692 157 814 108" delay={.35} />
          </>}
          {utilityVisible("water") && <>
            <AnimatedFlowPath kind="water" label="Водопровод: медленный стабильный поток до WM-042" d="M40 330C145 305 230 350 325 312S435 260 523 286" duration={9.5} />
            <AnimatedFlowPath kind="water" label="Водопровод: падение давления после WM-042" d="M523 286C615 315 704 329 825 300" anomaly duration={14} />
            {active && incidentMoment >= 1 && <AnimatedFlowPath kind="water" label="Аварийный отток воды в точке WM-042" d="M523 286C526 315 536 348 554 390" anomaly duration={2.2} />}
          </>}
          {utilityVisible("gas") && <AnimatedFlowPath kind="gas" label="Газопровод: непрерывный стабильный поток" d="M90 425C180 390 300 420 385 382S580 350 755 394" duration={5.2} />}
        </g> : <path className="utility-link" d="M58 118C195 75 297 143 420 103S660 166 814 108M40 330C205 292 351 356 523 286S691 338 825 300M90 425C265 372 477 430 755 394" fill="none" stroke="#1a8995" strokeWidth="2.5" strokeDasharray="8 8" opacity=".4" />}
        {layer === "risk" && <g className="risk-heat-layer"><circle cx="523" cy="286" r="115" fill="url(#riskHot)" /><circle cx="302" cy="126" r="88" fill="url(#riskWarm)" /><circle cx="185" cy="318" r="55" fill="url(#riskWarm)" opacity=".55" /></g>}
        {layer === "reports" && <g className="report-layer"><g transform="translate(559 312)" className="report-marker report-109"><circle r="12" /><text x="17" y="4">109 · 10:43</text></g><g transform="translate(493 257)" className="report-marker report-eotinish"><circle r="12" /><text x="17" y="4">e‑Өтініш · 10:44</text></g><g transform="translate(179 185)" className="report-marker report-109"><circle r="9" /><text x="14" y="4">109</text></g></g>}
        {showSensors && context === "dashboard" && dashboardMode === "telemetry" && <g className="dashboard-telemetry-layer">
          <path d="M185 318L385 290L523 286" className="telemetry-guide" />
          <g transform="translate(148 266)" className="sensor-reading sensor-warning"><rect width="104" height="38" rx="9" /><text x="10" y="15">PS-104</text><text x="10" y="29">4.1 bar · 128 м³/ч</text></g>
          <g transform="translate(336 224)" className="sensor-reading"><rect width="104" height="38" rx="9" /><text x="10" y="15">VM-207</text><text x="10" y="29">3.7 bar · −10%</text></g>
          <g transform="translate(537 216)" className="sensor-reading sensor-critical"><rect width="112" height="38" rx="9" /><text x="10" y="15">WM-042</text><text x="10" y="29">2.8 bar · −31%</text></g>
          <g transform="translate(445 342)" className="pressure-drop-label"><rect width="138" height="26" rx="8" /><text x="12" y="17">ΔP −1.3 bar / 8 мин</text></g>
        </g>}
        {showImpact && context === "dashboard" && dashboardMode === "impact" && <g className="dashboard-impact-layer">
          <circle cx="523" cy="286" r="126" className="impact-zone impact-zone-outer" />
          <circle cx="523" cy="286" r="78" className="impact-zone impact-zone-inner" />
          <path d="M480 224L595 241L638 318L568 380L465 347L438 276Z" className="impact-sector" />
          <g transform="translate(607 247)" className="impact-object"><circle r="9" /><text x="15" y="4">2 соцобъекта</text></g>
          <g transform="translate(603 344)" className="impact-object"><circle r="9" /><text x="15" y="4">4 жилых квартала</text></g>
          <g transform="translate(451 371)" className="impact-object impact-road"><circle r="9" /><text x="15" y="4">1 участок дороги</text></g>
        </g>}
        <text x="36" y="82" className="map-title">ASTANA · {mapLabel} / LIVE</text><text x="676" y="458" className="map-coord">51.13° N · 71.43° E</text>
        <g className="district-labels"><text x="92" y="232">САРЫАРҚА</text><text x="353" y="106">БАЙҚОҢЫР</text><text x="650" y="275">АЛМАТЫ</text></g>
        {showSensors && utilityVisible("electricity") && <g className={assetClass("EL-016", "warning", "electricity")} transform="translate(302 126)" role={onSelectAsset ? "button" : undefined} tabIndex={onSelectAsset ? 0 : undefined} onClick={() => activateAsset("EL-016")} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") activateAsset("EL-016"); }}><title>EL-016 · Подстанция №16 · пропуски импульсов</title><circle className="signal-halo signal-halo-electricity" r="28" /><circle className="asset-shell" r="12" /><circle className="asset-core" r="4" /><circle className="selection-ring" r="24" /><text x="18" y="-14">EL-016</text></g>}
        {showSensors && utilityVisible("water") && <g className={assetClass("PS-104", "warning", "water")} transform="translate(185 318)" role={onSelectAsset ? "button" : undefined} tabIndex={onSelectAsset ? 0 : undefined} onClick={() => activateAsset("PS-104")} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") activateAsset("PS-104"); }}><title>PS-104 · Насосная станция №12</title><circle className="asset-shell" r="11" /><circle className="asset-core" r="4" /><circle className="selection-ring" r="22" /><text x="17" y="-13">PS-104</text></g>}
        {showSensors && utilityVisible("water") && <g className={assetClass("VM-207", "normal", "water")} transform="translate(385 290)" role={onSelectAsset ? "button" : undefined} tabIndex={onSelectAsset ? 0 : undefined} onClick={() => activateAsset("VM-207")} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") activateAsset("VM-207"); }}><title>VM-207 · Камера задвижек №7</title><circle className="asset-shell" r="11" /><circle className="asset-core" r="4" /><circle className="selection-ring" r="22" /><text x="17" y="-13">VM-207</text></g>}
        {showSensors && utilityFilter === "all" && <g className={assetClass("HS-011", "normal", "heat")} transform="translate(690 170)" role={onSelectAsset ? "button" : undefined} tabIndex={onSelectAsset ? 0 : undefined} onClick={() => activateAsset("HS-011")} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") activateAsset("HS-011"); }}><title>HS-011 · Тепловой пункт №11</title><circle className="asset-shell" r="11" /><circle className="asset-core" r="4" /><circle className="selection-ring" r="22" /><text x="17" y="-13">HS-011</text></g>}
        {showSensors && utilityVisible("gas") && <g className={assetClass("GS-009", "normal", "gas")} transform="translate(655 369)" role={onSelectAsset ? "button" : undefined} tabIndex={onSelectAsset ? 0 : undefined} onClick={() => activateAsset("GS-009")} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") activateAsset("GS-009"); }}><title>GS-009 · Газорегуляторный пункт №9 · стабильный поток</title><circle className="signal-halo signal-halo-gas" r="25" /><circle className="asset-shell" r="11" /><circle className="asset-core" r="4" /><circle className="selection-ring" r="22" /><text x="17" y="-13">GS-009</text></g>}
        {showSensors && utilityVisible("water") && <g className={`${assetClass("WM-042", active ? "critical" : "normal", "water")}`} transform="translate(523 286)" role={onSelectAsset ? "button" : undefined} tabIndex={onSelectAsset ? 0 : undefined} onClick={() => activateAsset("WM-042")} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") activateAsset("WM-042"); }}>
          <title>WM-042 · Магистральный водопровод №4</title>
          {showImpact && active && incidentMoment >= 2 && <><circle className="impact impact-one" r="63" /><circle className="impact impact-two" r="38" /></>}{detecting && <circle className="scan-ring" r="50" />}
          <circle className="asset-shell" r="14" /><circle className="asset-core" r="5" /><circle className="selection-ring" r="25" /><text x="19" y="-15">WM-042</text>
        </g>}
        {showFlows && (layer === "network" || layer === "city3d") && utilityVisible("electricity") && <g className="flow-fault-tag flow-fault-electricity" transform="translate(302 164)"><rect x="-42" y="-12" width="84" height="24" rx="7" /><circle cx="-28" r="4" /><text x="-18" y="3">СБОЙ РИТМА</text></g>}
        {showFlows && (layer === "network" || layer === "city3d") && active && incidentMoment >= 1 && utilityVisible("water") && <g className="flow-fault-tag flow-fault-water" transform="translate(566 315)"><rect x="-47" y="-12" width="94" height="24" rx="7" /><circle cx="-33" r="4" /><text x="-23" y="3">УТЕЧКА · −31%</text></g>}
        {showFlows && (layer === "network" || layer === "city3d") && utilityVisible("gas") && <g className="flow-normal-tag" transform="translate(690 420)"><circle r="4" /><text x="10" y="3">ПОТОК СТАБИЛЕН</text></g>}
      </svg>
      {showChrome && context === "dashboard" && <div className={`map-incident-summary ${active ? "critical" : detecting ? "detecting" : "stable"}`}>
        <span><i />{dashboardSummary.eyebrow}</span>
        <strong>{dashboardSummary.title}</strong>
        <small>{dashboardSummary.detail}</small>
      </div>}
      {showChrome && layer === "network" && <div className="flow-diagnostic" aria-label="Диагностика по характеру потока"><small>СИГНАТУРЫ ПОТОКА</small><div className={utilityFilter === "water" || utilityFilter === "gas" ? "muted" : ""}><i className="flow-key electricity" /><span><b>Электро</b><em className="text-amber">импульсы · сбой ритма</em></span></div><div className={utilityFilter === "electricity" || utilityFilter === "gas" ? "muted" : ""}><i className="flow-key water" /><span><b>Вода</b><em className="text-red">медленно · разрыв потока</em></span></div><div className={utilityFilter === "electricity" || utilityFilter === "water" ? "muted" : ""}><i className="flow-key gas" /><span><b>Газ</b><em className="text-green">непрерывно · норма</em></span></div></div>}
      {showChrome && <div className="map-legend">{layer === "reports" ? <><span><i className="normal" />109</span><span><i className="warning" />e‑Өтініш</span><span><i className="critical" />Совпадение</span></> : layer === "risk" ? <><span><i className="normal" />Низкий</span><span><i className="warning" />Средний</span><span><i className="critical" />Высокий</span></> : <><span><i className="flow-legend electricity" />Импульс</span><span><i className="flow-legend water" />Медленно</span><span><i className="flow-legend gas" />Непрерывно</span></>}</div>}
      {showChrome && showAssetCard && <div className="asset-card"><MiniIcon tone={selected.risk > 70 ? "red" : selected.risk > 40 ? "amber" : "cyan"}>{selected.utilityKey === "electricity" ? "ϟ" : selected.utilityKey === "gas" ? "◌" : "≈"}</MiniIcon><div><small>{selected.id} · {selected.utility} · район {selected.district}</small><b>{selected.name}</b><span>{selected.flowSignature} · риск {selected.risk}/100</span></div><strong className={selected.state === "Критично" ? "text-red" : selected.state === "Отклонение" ? "text-amber" : "text-green"}>{selected.state.toUpperCase()}</strong></div>}
    </div>
  );
}

function SignalChart({ status, metric, value, unit, trend }: { status: "normal" | "warning" | "danger"; metric: string; value: string; unit: string; trend: string }) {
  const abnormal = status !== "normal";
  const points = abnormal ? "5,36 55,34 106,38 158,32 210,37 260,44 312,68 364,96 416,126 468,145" : "5,42 55,39 106,43 158,37 210,40 260,36 312,39 364,35 416,40 468,37";
  const signalColor = status === "danger" ? "#ff5d68" : status === "warning" ? "#ffb84d" : "#21d4c0";
  return (
    <div className="chart-wrap">
      <div className="chart-value"><strong>{value}</strong><span>{unit}</span><small className={status === "danger" ? "down" : status === "warning" ? "warning" : "stable"}>{trend}</small></div>
      <svg viewBox="0 0 480 170" role="img" aria-label={`График: ${metric}`}>
        <defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={signalColor} stopOpacity=".28" /><stop offset="1" stopColor="#071419" stopOpacity="0" /></linearGradient></defs>
        {[35, 75, 115, 155].map((y) => <line key={y} x1="0" x2="480" y1={y} y2={y} className="chart-grid" />)}
        <polygon points={`${points} 468,165 5,165`} fill="url(#chartFill)" /><polyline points={points} className={`chart-line ${status}`} />
        {abnormal && <><line x1="306" x2="306" y1="20" y2="160" className={`chart-marker ${status}`} /><text x="314" y="26" className={`chart-label ${status}`}>10:42 · {status === "danger" ? "ANOMALY" : "DEVIATION"}</text></>}
      </svg>
      <div className="chart-axis"><span>10:30</span><span>10:35</span><span>10:40</span><span>10:45</span></div>
    </div>
  );
}

const incidentRows = [
  { id: "INC-2026-0819", title: "Падение давления · WM-042", district: "Алматы", risk: 87, status: "Критический", tone: "red" },
  { id: "INC-2026-0817", title: "Нестабильный расход · PS-104", district: "Сарыарқа", risk: 54, status: "Проверка", tone: "amber" },
  { id: "INC-2026-0814", title: "Сигнал датчика · HS-011", district: "Байқоңыр", risk: 31, status: "Наблюдение", tone: "cyan" },
];

const assets = [
  { id: "WM-042", name: "Магистральный водопровод №4", type: "Водопровод", utility: "Вода", utilityKey: "water", flowSignature: "медленно · разрыв −31%", district: "Алматы", state: "Критично", risk: 86, coordinates: "51.1218° N · 71.4924° E" },
  { id: "EL-016", name: "Распределительная подстанция №16", type: "Подстанция", utility: "Электро", utilityKey: "electricity", flowSignature: "импульсы · нарушен ритм", district: "Байқоңыр", state: "Отклонение", risk: 68, coordinates: "51.1696° N · 71.4321° E" },
  { id: "PS-104", name: "Насосная станция №12", type: "Насосная станция", utility: "Вода", utilityKey: "water", flowSignature: "медленно · пульсация насоса", district: "Сарыарқа", state: "Отклонение", risk: 54, coordinates: "51.1814° N · 71.4048° E" },
  { id: "VM-207", name: "Камера задвижек №7", type: "Узел сети", utility: "Вода", utilityKey: "water", flowSignature: "медленно · стабильно", district: "Байқоңыр", state: "Норма", risk: 24, coordinates: "51.1572° N · 71.4451° E" },
  { id: "GS-009", name: "Газорегуляторный пункт №9", type: "Газовый узел", utility: "Газ", utilityKey: "gas", flowSignature: "непрерывно · стабильно", district: "Алматы", state: "Норма", risk: 21, coordinates: "51.1138° N · 71.4712° E" },
  { id: "HS-011", name: "Тепловой пункт №11", type: "Теплосеть", utility: "Тепло", utilityKey: "heat", flowSignature: "циклично · стабильно", district: "Есиль", state: "Норма", risk: 18, coordinates: "51.1129° N · 71.4236° E" },
];

type TelemetryProfile = {
  metric: string;
  metricKey: string;
  value: string;
  unit: string;
  trend: string;
  status: "normal" | "warning" | "danger";
  metrics: Array<{ label: string; value: string; detail: string; tone?: "red" | "amber" | "green" }>;
  samples: string[];
};

const telemetryProfiles: Record<string, TelemetryProfile> = {
  "WM-042": { metric: "Давление", metricKey: "pressure", value: "2.8", unit: "bar", trend: "↓ 31%", status: "danger", samples: ["2.80", "2.92", "3.04", "3.18"], metrics: [{ label: "Давление", value: "2.8 bar", detail: "−31% от базовой линии", tone: "red" }, { label: "Расход", value: "128 м³/ч", detail: "+18% за 8 минут", tone: "amber" }, { label: "Температура", value: "8.4 °C", detail: "в пределах нормы" }, { label: "Качество пакета", value: "99.7%", detail: "0 потерянных сообщений", tone: "green" }] },
  "EL-016": { metric: "Напряжение", metricKey: "voltage", value: "32.4", unit: "kV", trend: "↓ 7.4%", status: "warning", samples: ["32.40", "32.71", "33.18", "34.05"], metrics: [{ label: "Напряжение", value: "32.4 kV", detail: "−7.4% от номинала", tone: "amber" }, { label: "Ток нагрузки", value: "418 A", detail: "+9% за 6 минут", tone: "amber" }, { label: "Частота", value: "49.98 Hz", detail: "в пределах допуска" }, { label: "Качество пакета", value: "99.9%", detail: "1 повторный пакет", tone: "green" }] },
  "PS-104": { metric: "Расход", metricKey: "flow_rate", value: "146", unit: "м³/ч", trend: "↑ 12%", status: "warning", samples: ["146.0", "142.8", "139.4", "135.1"], metrics: [{ label: "Расход", value: "146 м³/ч", detail: "+12% к базовой линии", tone: "amber" }, { label: "Вибрация", value: "6.8 mm/s", detail: "выше предупредительного порога", tone: "amber" }, { label: "Мощность", value: "42.1 kW", detail: "нагрузка 78%" }, { label: "Качество пакета", value: "99.5%", detail: "0 потерянных сообщений", tone: "green" }] },
  "VM-207": { metric: "Положение задвижки", metricKey: "valve_position", value: "100", unit: "%", trend: "● стабильно", status: "normal", samples: ["100", "100", "100", "100"], metrics: [{ label: "Положение", value: "100%", detail: "полностью открыта", tone: "green" }, { label: "Давление до", value: "4.1 bar", detail: "стабильно" }, { label: "Давление после", value: "4.0 bar", detail: "перепад 0.1 bar" }, { label: "Качество пакета", value: "99.8%", detail: "0 потерянных сообщений", tone: "green" }] },
  "GS-009": { metric: "Давление газа", metricKey: "gas_pressure", value: "0.62", unit: "MPa", trend: "● стабильно", status: "normal", samples: ["0.62", "0.62", "0.61", "0.62"], metrics: [{ label: "Давление", value: "0.62 MPa", detail: "в пределах режима", tone: "green" }, { label: "Расход", value: "3 420 м³/ч", detail: "+1.2% за час" }, { label: "Температура", value: "11.3 °C", detail: "компенсация активна" }, { label: "Качество пакета", value: "99.9%", detail: "0 потерянных сообщений", tone: "green" }] },
  "HS-011": { metric: "Температура подачи", metricKey: "supply_temp", value: "72.4", unit: "°C", trend: "● стабильно", status: "normal", samples: ["72.4", "72.2", "72.5", "72.3"], metrics: [{ label: "Подача", value: "72.4 °C", detail: "по температурному графику", tone: "green" }, { label: "Обратка", value: "49.8 °C", detail: "ΔT 22.6 °C" }, { label: "Расход", value: "84 т/ч", detail: "нагрузка 64%" }, { label: "Качество пакета", value: "99.6%", detail: "0 потерянных сообщений", tone: "green" }] },
};

const sourceIcons: Record<AdapterSource, string> = { scada: "⌁", "109": "◫", eotinish: "▣", gis: "⌖" };
const sourceTone: Record<AdapterSource, string> = { scada: "cyan", "109": "cyan", eotinish: "cyan", gis: "amber" };
const sourceEventTone: Record<AdapterSource, string> = { scada: "red", "109": "cyan", eotinish: "cyan", gis: "amber" };
const eventTypeLabels: Record<OperationEventType, string> = {
  telemetry: "Телеметрия",
  citizen_report: "Обращение жителя",
  gis_update: "Обновление GIS",
  adapter_health: "Heartbeat адаптера",
};

function adapterStatusLabel(status: AdapterStatus) {
  if (status === "online") return "ONLINE";
  if (status === "degraded") return "DEGRADED";
  return "OFFLINE";
}

function formatLatency(milliseconds: number) {
  if (milliseconds < 1_000) return `${Math.max(0, Math.round(milliseconds))} мс`;
  if (milliseconds < 60_000) return `${(milliseconds / 1_000).toFixed(milliseconds < 10_000 ? 1 : 0)} сек`;
  return `${Math.round(milliseconds / 60_000)} мин`;
}

function formatEventTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Almaty",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function formatFreshness(value: string | null, generatedAt: string) {
  if (!value) return "нет пакетов";
  const ageSeconds = Math.max(0, Math.round((new Date(generatedAt).getTime() - new Date(value).getTime()) / 1_000));
  if (!Number.isFinite(ageSeconds)) return "время неизвестно";
  if (ageSeconds < 60) return `${ageSeconds} сек назад`;
  if (ageSeconds < 3_600) return `${Math.round(ageSeconds / 60)} мин назад`;
  return `${Math.round(ageSeconds / 3_600)} ч назад`;
}

async function requestOperationsSnapshot() {
  const response = await fetch("/api/operations/snapshot", { cache: "no-store", headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`snapshot ${response.status}`);
  const payload = await response.json() as OperationsSnapshot;
  if (!payload || !Array.isArray(payload.adapters) || !Array.isArray(payload.events)) {
    throw new Error("invalid operations snapshot");
  }
  return payload;
}

const analyticsSeries = {
  "24 часа": { opened: [2, 3, 2, 4, 3, 5, 4, 7, 6, 8, 7, 9], confirmed: [1, 2, 2, 3, 2, 4, 3, 5, 5, 6, 6, 7], labels: ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00"] },
  "7 дней": { opened: [9, 11, 8, 14, 12, 16, 13, 18, 15, 17, 14, 12], confirmed: [7, 8, 7, 11, 10, 13, 11, 15, 12, 14, 12, 10], labels: ["14 авг", "15 авг", "16 авг", "17 авг", "18 авг", "19 авг"] },
  "30 дней": { opened: [12, 18, 15, 22, 19, 25, 21, 28, 24, 31, 27, 26], confirmed: [9, 14, 12, 17, 15, 20, 18, 23, 20, 25, 22, 21], labels: ["1 авг", "6 авг", "11 авг", "16 авг", "21 авг", "26 авг"] },
} as const;

const analyticsSummary = {
  "24 часа": { prevented: "3", detection: "02:13", sla: "94.2%", forecast: "3", trend: "−18%" },
  "7 дней": { prevented: "17", detection: "02:41", sla: "92.8%", forecast: "8", trend: "−12%" },
  "30 дней": { prevented: "64", detection: "03:08", sla: "90.6%", forecast: "14", trend: "−9%" },
} as const;

const districtPerformance = [
  { name: "Алматы", incidents: 18, response: "11 мин", sla: 96, tone: "red" },
  { name: "Сарыарқа", incidents: 14, response: "14 мин", sla: 91, tone: "amber" },
  { name: "Байқоңыр", incidents: 9, response: "9 мин", sla: 98, tone: "cyan" },
  { name: "Есиль", incidents: 7, response: "12 мин", sla: 94, tone: "cyan" },
  { name: "Нұра", incidents: 5, response: "16 мин", sla: 88, tone: "amber" },
];

const sourceQuality = [
  { name: "SCADA", coverage: 99.7, latency: "24 сек", confidence: 98 },
  { name: "109", coverage: 96.2, latency: "1 мин", confidence: 91 },
  { name: "e‑Өтініш", coverage: 94.8, latency: "3 мин", confidence: 88 },
  { name: "GIS", coverage: 98.4, latency: "18 мин", confidence: 95 },
];

type ModuleViewProps = {
  name: string;
  activeIncident: boolean;
  locale: Locale;
  theme: ThemeMode;
  onLocale: (locale: Locale) => void;
  onTheme: (theme: ThemeMode) => void;
  onNavigate: (name: string) => void;
  onNotify: (message: string) => void;
};

function ModuleHeading({ index, title, subtitle, badge }: { index: string; title: string; subtitle: string; badge?: string }) {
  return <div className="panel-head module-heading"><div><span>{index}</span><div><h2>{title}</h2><p>{subtitle}</p></div></div>{badge && <b>{badge}</b>}</div>;
}

function AnalyticsTrendChart({ range }: { range: keyof typeof analyticsSeries }) {
  const series = analyticsSeries[range];
  const values = [...series.opened, ...series.confirmed];
  const max = Math.max(...values) + 3;
  const width = 760;
  const height = 250;
  const left = 38;
  const right = 16;
  const top = 22;
  const bottom = 38;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const points = (items: readonly number[]) => items.map((value, index) => {
    const x = left + (index / (items.length - 1)) * chartWidth;
    const y = top + chartHeight - (value / max) * chartHeight;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const openedPoints = points(series.opened);
  const confirmedPoints = points(series.confirmed);

  return <div className="analytics-chart-wrap">
    <div className="analytics-chart-legend"><span><i className="opened" /> Обнаружено</span><span><i className="confirmed" /> Подтверждено</span><b>{range}</b></div>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Динамика инцидентов за ${range}`}>
      <defs>
        <linearGradient id="analyticsArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#28d7c5" stopOpacity=".28" /><stop offset="1" stopColor="#28d7c5" stopOpacity="0" /></linearGradient>
      </defs>
      {[0, .25, .5, .75, 1].map((ratio) => {
        const y = top + chartHeight * ratio;
        return <g key={ratio}><line x1={left} x2={width - right} y1={y} y2={y} className="analytics-grid-line" /><text x="6" y={y + 4} className="analytics-axis-label">{Math.round(max * (1 - ratio))}</text></g>;
      })}
      <polygon points={`${openedPoints} ${width - right},${top + chartHeight} ${left},${top + chartHeight}`} fill="url(#analyticsArea)" />
      <polyline points={openedPoints} className="analytics-line analytics-opened" />
      <polyline points={confirmedPoints} className="analytics-line analytics-confirmed" />
      {series.opened.map((value, index) => {
        const [x, y] = openedPoints.split(" ")[index].split(",");
        return <circle key={`${value}-${index}`} cx={x} cy={y} r="4" className="analytics-point"><title>{value} обнаружено</title></circle>;
      })}
      {series.labels.map((label, index) => <text key={label} x={left + (index / (series.labels.length - 1)) * chartWidth} y={height - 9} textAnchor={index === 0 ? "start" : index === series.labels.length - 1 ? "end" : "middle"} className="analytics-axis-label">{label}</text>)}
    </svg>
  </div>;
}

function ModuleView({ name, activeIncident, locale, theme, onLocale, onTheme, onNavigate, onNotify }: ModuleViewProps) {
  const [analyticsRange, setAnalyticsRange] = useState<keyof typeof analyticsSeries>("7 дней");
  const [analyticsDistrict, setAnalyticsDistrict] = useState("Все районы");
  const [incidentFilter, setIncidentFilter] = useState("Все");
  const [incidentQuery, setIncidentQuery] = useState("");
  const [selectedIncident, setSelectedIncident] = useState(incidentRows[0].id);
  const [selectedAsset, setSelectedAsset] = useState("WM-042");
  const [mapLayer, setMapLayer] = useState<MapLayer>("network");
  const [mapUtility, setMapUtility] = useState<UtilityFilter>("all");
  const [mapZoom, setMapZoom] = useState(1);
  const [mapPitch, setMapPitch] = useState(46);
  const [mapYaw, setMapYaw] = useState(-3);
  const [telemetryRange, setTelemetryRange] = useState("15 мин");
  const [selectedAudit, setSelectedAudit] = useState(0);
  const [gisFile, setGisFile] = useState<string | null>(null);
  const [gisResult, setGisResult] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [compactMode, setCompactMode] = useState(false);
  const [operations, setOperations] = useState<OperationsSnapshot>(() => getDemoOperationsSnapshot());
  const [operationsStatus, setOperationsStatus] = useState<"loading" | "syncing" | "live" | "demo" | "error">("loading");
  const [selectedOperationEvent, setSelectedOperationEvent] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!new Set(["Источники данных", "Интеграции", "Аудит решений"]).has(name)) return;
    let mounted = true;
    const load = async () => {
      try {
        const snapshot = await requestOperationsSnapshot();
        if (!mounted) return;
        setOperations(snapshot);
        setOperationsStatus(snapshot.dataMode === "live" ? "live" : "demo");
      } catch {
        if (mounted) setOperationsStatus("error");
      }
    };
    void load();
    const intervalId = autoRefresh ? window.setInterval(load, 30_000) : null;
    return () => {
      mounted = false;
      if (intervalId !== null) window.clearInterval(intervalId);
    };
  }, [autoRefresh, name]);

  async function refreshOperations() {
    setOperationsStatus("syncing");
    try {
      const snapshot = await requestOperationsSnapshot();
      setOperations(snapshot);
      setOperationsStatus(snapshot.dataMode === "live" ? "live" : "demo");
      onNotify(snapshot.dataMode === "live"
        ? `Получен живой срез: ${snapshot.summary.accepted24h} событий за 24 часа`
        : "Контур доступен, показан детерминированный демо-поток");
    } catch {
      setOperationsStatus("error");
      onNotify("Не удалось обновить контур данных — сохранён последний срез");
    }
  }

  function downloadOperationEvent(event: OperationsSnapshot["events"][number]) {
    const content = JSON.stringify(event, null, 2);
    const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `infra-signal-event-${event.source}-${event.externalId.replaceAll(/[^A-Za-z0-9._-]/g, "-")}.json`;
    link.click();
    URL.revokeObjectURL(url);
    onNotify(`Событие ${event.externalId} экспортировано с контрольной суммой`);
  }

  function selectGisFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const supported = /\.(geojson|json|csv)$/i.test(file.name);
    if (!supported) {
      setGisFile(null);
      setGisResult(null);
      onNotify("Поддерживаются файлы GeoJSON, JSON и CSV");
      event.target.value = "";
      return;
    }
    setGisFile(file.name);
    setGisResult(null);
    onNotify(`Файл ${file.name} готов к безопасной проверке`);
  }

  function runGisImport(mode: "dry" | "apply") {
    if (!gisFile) {
      fileInput.current?.click();
      return;
    }
    const result = mode === "dry"
      ? "Проверка завершена: 12 объектов валидны, 0 ошибок, изменений нет"
      : "Импорт завершён: создано 8, обновлено 4, пропущено 0";
    setGisResult(result);
    onNotify(result);
  }

  function downloadExample() {
    const example = JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [71.43, 51.13] }, properties: { asset_id: "WM-042", name: "Магистральный водопровод №4", asset_type: "water_main", criticality: 86 } }] }, null, 2);
    const url = URL.createObjectURL(new Blob([example], { type: "application/geo+json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "infra-signal-example.geojson";
    link.click();
    URL.revokeObjectURL(url);
    onNotify("Пример GeoJSON скачан");
  }

  function downloadAnalytics() {
    const rows = [
      ["Период", analyticsRange],
      ["Район", analyticsDistrict],
      ["Предотвращено аварий", analyticsSummary[analyticsRange].prevented],
      ["Медиана обнаружения", analyticsSummary[analyticsRange].detection],
      ["SLA реагирования", analyticsSummary[analyticsRange].sla],
      ["Объекты прогноза", analyticsSummary[analyticsRange].forecast],
      [],
      ["Район", "Инциденты", "Среднее реагирование", "SLA"],
      ...districtPerformance.map((district) => [district.name, district.incidents, district.response, `${district.sla}%`]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `infra-signal-analytics-${analyticsRange.replaceAll(" ", "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    onNotify("Аналитический отчёт выгружен в CSV");
  }

  if (name === "Аналитика") {
    const summary = analyticsSummary[analyticsRange];
    const selectedDistrict = districtPerformance.find((district) => district.name === analyticsDistrict);
    const districtFactor = selectedDistrict ? selectedDistrict.incidents / 18 : 1;
    const prevented = selectedDistrict ? Math.max(1, Math.round(Number(summary.prevented) * districtFactor)) : summary.prevented;
    const forecastItems = [
      { id: "WM-042", title: "Магистральный водопровод №4", risk: 87, delta: "+18%", window: "6–12 часов", tone: "red" },
      { id: "PS-104", title: "Насосная станция №12", risk: 72, delta: "+11%", window: "12–24 часа", tone: "amber" },
      { id: "HS-011", title: "Тепловой пункт №11", risk: 61, delta: "+8%", window: "24–48 часов", tone: "amber" },
    ];
    return <section className="module-layout analytics-module">
      <div className="module-toolbar panel analytics-toolbar">
        <div className="filter-buttons">{(["24 часа", "7 дней", "30 дней"] as const).map((range) => <button key={range} className={analyticsRange === range ? "selected" : ""} onClick={() => setAnalyticsRange(range)}>{range}</button>)}</div>
        <label className="select-box">Район<select value={analyticsDistrict} onChange={(event) => setAnalyticsDistrict(event.target.value)}><option>Все районы</option>{districtPerformance.map((district) => <option key={district.name}>{district.name}</option>)}</select></label>
        <button className="secondary-module-action analytics-export" onClick={downloadAnalytics}>↓ Экспорт CSV</button>
      </div>

      <div className="analytics-kpi-grid">
        <article className="panel analytics-kpi"><div><span>Предотвращено аварий</span><MiniIcon tone="cyan">✓</MiniIcon></div><strong>{prevented}</strong><small><b className="text-green">↑ 21%</b> к предыдущему периоду</small></article>
        <article className="panel analytics-kpi"><div><span>Медиана обнаружения</span><MiniIcon tone="cyan">◷</MiniIcon></div><strong>{summary.detection}</strong><small><b className="text-green">{summary.trend}</b> быстрее базовой линии</small></article>
        <article className="panel analytics-kpi"><div><span>SLA реагирования</span><MiniIcon tone="amber">◈</MiniIcon></div><strong>{selectedDistrict ? `${selectedDistrict.sla}%` : summary.sla}</strong><small><b className="text-green">+3.6 п.п.</b> за текущий месяц</small></article>
        <article className="panel analytics-kpi"><div><span>Высокий риск, 48 часов</span><MiniIcon tone="red">▲</MiniIcon></div><strong>{selectedDistrict ? Math.max(1, Math.ceil(Number(summary.forecast) * districtFactor)) : summary.forecast}</strong><small><b className="text-red">требуют внимания</b> до начала смены</small></article>
      </div>

      <div className="analytics-primary-grid">
        <article className="panel analytics-trend-panel"><ModuleHeading index="01" title="Динамика инцидентов" subtitle={`Обнаружение и подтверждение · ${analyticsDistrict}`} badge="LIVE MODEL" /><AnalyticsTrendChart range={analyticsRange} /></article>
        <aside className="panel analytics-forecast"><ModuleHeading index="02" title="Прогноз риска" subtitle="Упреждающий горизонт 48 часов" badge="AI + RULES" /><div className="forecast-list">{forecastItems.map((item) => <button key={item.id} onClick={() => { setSelectedAsset(item.id); onNavigate("Карта объектов"); }}><span className={`forecast-score ${item.tone}`}>{item.risk}</span><div><b>{item.id}</b><p>{item.title}</p><small>{item.window} · <em>{item.delta}</em></small></div><strong>→</strong></button>)}</div><div className="analytics-insight"><span>◇</span><div><small>ОБЪЯСНЕНИЕ МОДЕЛИ</small><p>Рост риска WM‑042 связан с падением давления, возрастом участка и двумя обращениями в радиусе 640 м.</p></div></div><button className="forecast-action" onClick={() => onNavigate("Инциденты")}>Открыть приоритетную очередь →</button></aside>
      </div>

      <div className="analytics-secondary-grid">
        <article className="panel district-panel"><ModuleHeading index="03" title="Эффективность по районам" subtitle="Нагрузка и соблюдение SLA" badge="5 DISTRICTS" /><div className="district-bars">{districtPerformance.map((district) => <button key={district.name} className={analyticsDistrict === district.name ? "selected" : ""} onClick={() => setAnalyticsDistrict(analyticsDistrict === district.name ? "Все районы" : district.name)}><div><b>{district.name}</b><small>{district.incidents} инцидентов · {district.response}</small></div><span><i className={district.tone} style={{ width: `${district.sla}%` }} /></span><strong>{district.sla}%</strong></button>)}</div></article>

        <article className="panel severity-panel"><ModuleHeading index="04" title="Структура риска" subtitle="53 инцидента за период" /><div className="severity-content"><div className="severity-donut"><div><strong>53</strong><small>ВСЕГО</small></div></div><div className="severity-legend"><p><i className="critical" /><span>Критический</span><b>12 · 23%</b></p><p><i className="warning" /><span>Средний</span><b>21 · 40%</b></p><p><i className="normal" /><span>Низкий</span><b>20 · 37%</b></p></div></div></article>

        <article className="panel quality-panel"><ModuleHeading index="05" title="Качество источников" subtitle="Полнота, задержка и доверие" badge="4 SOURCES" /><div className="quality-list">{sourceQuality.map((source) => <button key={source.name} onClick={() => onNavigate("Источники данных")}><div><b>{source.name}</b><small>{source.latency}</small></div><span><i style={{ width: `${source.coverage}%` }} /></span><strong>{source.coverage}%</strong><em>{source.confidence}</em></button>)}</div></article>
      </div>
    </section>;
  }

  if (name === "Инциденты") {
    const normalizedQuery = incidentQuery.trim().toLocaleLowerCase("ru-RU");
    const shown = incidentRows.filter((row) => {
      const matchesFilter = incidentFilter === "Все" || (incidentFilter === "Критические" ? row.risk >= 80 : row.status === "Наблюдение");
      const matchesQuery = !normalizedQuery || `${row.id} ${row.title} ${row.district} ${row.status}`.toLocaleLowerCase("ru-RU").includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
    const current = incidentRows.find((row) => row.id === selectedIncident) ?? incidentRows[0];
    return <section className="module-layout incidents-module">
      <div className="module-toolbar panel"><div className="filter-buttons">{["Все", "Критические", "Наблюдение"].map((filter) => <button key={filter} className={incidentFilter === filter ? "selected" : ""} onClick={() => setIncidentFilter(filter)}>{filter}</button>)}</div><label className="search-box">⌕<input aria-label="Поиск инцидентов" placeholder="Поиск по ID, объекту или району" value={incidentQuery} onChange={(event) => setIncidentQuery(event.target.value)} />{incidentQuery && <button type="button" onClick={() => setIncidentQuery("")} aria-label="Очистить поиск">×</button>}</label><span>{shown.length} {shown.length === 1 ? "карточка" : "карточки"}</span></div>
      <div className="module-split"><article className="panel"><ModuleHeading index="01" title="Реестр инцидентов" subtitle="Приоритетная очередь диспетчера" badge="LIVE" /><div className="catalog-list">{shown.length ? shown.map((row) => <button key={row.id} className={selectedIncident === row.id ? "selected" : ""} onClick={() => setSelectedIncident(row.id)}><MiniIcon tone={row.tone}>{row.tone === "red" ? "▲" : "⌁"}</MiniIcon><span><small>{row.id} · район {row.district}</small><b>{row.title}</b><em>{row.status}</em></span><strong>{row.risk}</strong></button>) : <div className="catalog-empty"><span>⌕</span><b>Инциденты не найдены</b><p>Измените фильтр или поисковый запрос.</p><button type="button" onClick={() => { setIncidentFilter("Все"); setIncidentQuery(""); }}>Сбросить фильтры</button></div>}</div></article>
      <aside className="panel module-detail"><ModuleHeading index="02" title="Карточка решения" subtitle="Доказательства и действия" badge={current.id} /><div className="detail-hero"><span className={`risk-number risk-${current.tone}`}>{current.risk}</span><div><small>ОЦЕНКА РИСКА</small><h2>{current.title}</h2><p>Корреляция независимых сигналов: 94%</p></div></div><div className="evidence-summary"><b>3 подтверждения</b><span>SCADA · 109 · e‑Өтініш</span></div><button className="primary-module-action" onClick={() => onNotify("Инцидент принят в работу диспетчером")}>✓ Принять в работу</button><button className="secondary-module-action" onClick={() => onNotify("Карточка экспортирована в журнал смены")}>↓ Экспортировать карточку</button></aside></div>
    </section>;
  }

  if (name === "Карта объектов") {
    const current = assets.find((asset) => asset.id === selectedAsset) ?? assets[0];
    const visibleAssets = mapUtility === "all" ? assets : assets.filter((asset) => asset.utilityKey === mapUtility);
    const layerBadge = mapLayer === "real" ? "OSM · ASTANA · LIVE" : mapLayer === "network" ? mapUtility === "all" ? "3 ПОТОКА · LIVE" : `${current.utility.toUpperCase()} · LIVE` : mapLayer === "risk" ? "РИСК · 48 Ч" : mapLayer === "city3d" ? `3D · ${mapPitch}° / ${mapYaw > 0 ? "+" : ""}${mapYaw}°` : "ОБРАЩЕНИЯ · LIVE";
    const mapHeading = mapLayer === "real"
      ? ["Реальная карта Астаны", "OpenStreetMap · демонстрационные инженерные контуры и адаптеры"]
      : mapLayer === "city3d"
      ? ["3D цифровой двойник", "Объёмная модель кварталов, сетей и зоны воздействия"]
      : ["Живые потоки инженерных сетей", "Импульсы — электро · медленное движение — вода · непрерывное — газ"];
    const chooseUtility = (utility: UtilityFilter) => {
      setMapUtility(utility);
      if (utility === "electricity") setSelectedAsset("EL-016");
      if (utility === "water") setSelectedAsset("WM-042");
      if (utility === "gas") setSelectedAsset("GS-009");
    };
    return <section className="module-layout map-module">
      <div className="module-toolbar panel map-module-toolbar">
        <div className="filter-buttons map-layer-switcher">{([['real', 'Астана'], ['network', 'Потоки'], ['risk', 'Тепловая карта'], ['reports', 'Обращения'], ['city3d', '3D-модель']] as const).map(([value, label]) => <button key={value} className={mapLayer === value ? "selected" : ""} onClick={() => { setMapLayer(value); if (value !== "network" && value !== "real") setMapUtility("all"); }}>{value === "real" ? "⌖" : value === "network" ? "⌁" : value === "risk" ? "◉" : value === "city3d" ? "◇" : "◎"} {label}</button>)}</div>
        {(mapLayer === "network" || mapLayer === "real") && <div className="utility-flow-switcher" aria-label="Фильтр инженерных потоков">{([['all', 'Все'], ['electricity', 'Электро'], ['water', 'Вода'], ['gas', 'Газ']] as const).map(([value, label]) => <button key={value} className={`${mapUtility === value ? "selected" : ""} utility-${value}`} onClick={() => chooseUtility(value)}>{value === "electricity" ? "ϟ" : value === "water" ? "≈" : value === "gas" ? "◌" : "◫"}<span>{label}</span></button>)}</div>}
        <div className="map-focus"><span>В ФОКУСЕ</span><b>{current.id}</b><small>{current.coordinates}</small></div>
        {mapLayer !== "real" && <div className="map-zoom-controls" aria-label="Масштаб карты">
          <button type="button" disabled={mapZoom <= 1} onClick={() => setMapZoom((value) => Math.max(1, Number((value - .1).toFixed(1))))} aria-label="Уменьшить масштаб">−</button>
          <span>{Math.round(mapZoom * 100)}%</span>
          <button type="button" disabled={mapZoom >= 1.3} onClick={() => setMapZoom((value) => Math.min(1.3, Number((value + .1).toFixed(1))))} aria-label="Увеличить масштаб">+</button>
          <button className="map-reset" type="button" onClick={() => setMapZoom(1)}>Сбросить</button>
        </div>}
        {mapLayer === "city3d" && <div className="map-camera-cluster"><div className="map-pitch-controls" aria-label="Угол наклона 3D-карты"><button type="button" disabled={mapPitch <= 34} onClick={() => setMapPitch((value) => Math.max(34, value - 4))} aria-label="Уменьшить наклон">−</button><span><small>НАКЛОН</small>{mapPitch}°</span><button type="button" disabled={mapPitch >= 58} onClick={() => setMapPitch((value) => Math.min(58, value + 4))} aria-label="Увеличить наклон">+</button></div><div className="map-pitch-controls" aria-label="Поворот 3D-карты"><button type="button" disabled={mapYaw <= -12} onClick={() => setMapYaw((value) => Math.max(-12, value - 3))} aria-label="Повернуть влево">↶</button><span><small>АЗИМУТ</small>{mapYaw > 0 ? "+" : ""}{mapYaw}°</span><button type="button" disabled={mapYaw >= 12} onClick={() => setMapYaw((value) => Math.min(12, value + 3))} aria-label="Повернуть вправо">↷</button></div></div>}
      </div>
      <div className="module-split map-split">
        <article className="panel map-module-panel">
          <ModuleHeading index="01" title={mapHeading[0]} subtitle={mapHeading[1]} badge={layerBadge} />
          <ExpandMap location={`${current.id} · ${current.name}`} coordinates={current.coordinates} stableCanvas={mapLayer === "real"}>
            {mapLayer === "real" ? <RealAstanaMap active={activeIncident} selectedAssetId={selectedAsset} onSelectAsset={setSelectedAsset} utilityFilter={mapUtility} locale={locale} /> : <NetworkMap active={activeIncident} detecting={false} selectedAssetId={selectedAsset} onSelectAsset={setSelectedAsset} layer={mapLayer} utilityFilter={mapUtility} zoom={mapZoom} pitch={mapPitch} yaw={mapYaw} />}
          </ExpandMap>
        </article>
        <aside className="panel asset-browser">
          <ModuleHeading index="02" title="Объекты" subtitle={`${visibleAssets.length} объектов в текущем фильтре`} badge="РЕЕСТР" />
          <div className="asset-browser-list">{visibleAssets.map((asset) => <button key={asset.id} className={selectedAsset === asset.id ? "selected" : ""} onClick={() => setSelectedAsset(asset.id)}><MiniIcon tone={asset.risk > 70 ? "red" : asset.risk > 40 ? "amber" : "cyan"}>{asset.utilityKey === "electricity" ? "ϟ" : asset.utilityKey === "gas" ? "◌" : asset.utilityKey === "water" ? "≈" : "⌁"}</MiniIcon><span><b>{asset.id} · {asset.utility}</b><small>{asset.name}</small></span><em>{asset.risk}</em></button>)}</div>
          <div className="asset-inspector"><small>{current.type} · район {current.district}</small><h2>{current.name}</h2><dl><div><dt>Код</dt><dd>{current.id}</dd></div><div><dt>Координаты</dt><dd>{current.coordinates}</dd></div><div><dt>Характер потока</dt><dd>{current.flowSignature}</dd></div><div><dt>Статус</dt><dd className={current.state === "Критично" ? "text-red" : current.state === "Отклонение" ? "text-amber" : "text-green"}>{current.state}</dd></div><div><dt>Критичность</dt><dd>{current.risk}/100</dd></div></dl><button className="primary-module-action" onClick={() => onNavigate("Телеметрия")}>Открыть телеметрию →</button></div>
        </aside>
      </div>
    </section>;
  }

  if (name === "Телеметрия") {
    const profile = telemetryProfiles[selectedAsset] ?? telemetryProfiles["WM-042"];
    const selectedObject = assets.find((asset) => asset.id === selectedAsset) ?? assets[0];
    const effectiveStatus = selectedAsset === "WM-042" && !activeIncident ? "normal" : profile.status;
    const effectiveValue = selectedAsset === "WM-042" && !activeIncident ? "4.2" : profile.value;
    const effectiveTrend = selectedAsset === "WM-042" && !activeIncident ? "● стабильно" : profile.trend;
    return <section className="module-layout telemetry-module"><div className="module-toolbar panel"><div className="filter-buttons">{["15 мин", "1 час", "24 часа"].map((range) => <button key={range} className={telemetryRange === range ? "selected" : ""} onClick={() => setTelemetryRange(range)}>{range}</button>)}</div><label className="select-box">Объект<select value={selectedAsset} onChange={(event) => setSelectedAsset(event.target.value)}>{assets.map((asset) => <option key={asset.id}>{asset.id} · {asset.utility}</option>)}</select></label><span><i className="live-dot" /> {selectedObject.utility.toLowerCase()} · поток активен</span></div><div className="telemetry-grid"><article className="panel telemetry-primary"><ModuleHeading index="01" title={`${profile.metric} · ${selectedAsset}`} subtitle={`${selectedObject.name} · ${telemetryRange}`} badge={profile.unit.toUpperCase()} /><SignalChart status={effectiveStatus} metric={profile.metric} value={effectiveValue} unit={profile.unit} trend={effectiveTrend} /></article><article className="panel metric-panel"><ModuleHeading index="02" title="Текущие показатели" subtitle="Последний подтверждённый пакет" /><div className="metric-list">{profile.metrics.map((metric) => <div key={metric.label}><span>{metric.label}</span><b className={metric.tone === "red" ? "text-red" : metric.tone === "amber" ? "text-amber" : metric.tone === "green" ? "text-green" : ""}>{metric.value}</b><small>{metric.detail}</small></div>)}</div></article></div><article className="panel"><ModuleHeading index="03" title="Последние измерения" subtitle="Детерминированный журнал входящих значений" badge="4 ROWS" /><div className="data-table"><div className="table-row table-head"><span>Время</span><span>Объект</span><span>Метрика</span><span>Значение</span><span>Качество</span></div>{["10:45:00", "10:44:30", "10:44:00", "10:43:30"].map((time, index) => <button className="table-row" key={time} onClick={() => onNotify(`Пакет ${time} открыт · ${profile.metricKey}`)}><span>{time}</span><span>{selectedAsset}</span><span>{profile.metricKey}</span><span>{profile.samples[index]} {profile.unit}</span><span className="text-green">VALID</span></button>)}</div></article></section>;
  }

  if (name === "Источники данных") {
    const adapterBySource = new Map(operations.adapters.map((adapter) => [adapter.source, adapter]));
    const currentEvent = operations.events.find((event) => event.id === selectedOperationEvent) ?? operations.events[0] ?? null;
    const modeLabel = operations.dataMode === "live" ? "LIVE · D1" : operations.storage === "d1" ? "D1 READY · DEMO" : "DEMO FALLBACK";
    return <section className="module-layout sources-module">
      <article className={`panel operations-data-strip ops-${operationsStatus}`}>
        <div className="operations-mode"><span><i />{modeLabel}</span><b>{operations.dataMode === "live" ? "Рабочий контур данных" : "Безопасный демонстрационный срез"}</b><small>{operations.ingestReady ? "HTTPS ingest защищён серверным ключом" : "HTTPS ingest заблокирован до установки серверного ключа"}</small></div>
        <div className="operations-counters"><span><small>ПРИНЯТО · 24 Ч</small><b>{operations.summary.accepted24h.toLocaleString("ru-RU")}</b></span><span><small>ДЕДУПЛИЦИРОВАНО</small><b>{operations.summary.duplicates24h}</b></span><span><small>АДАПТЕРЫ</small><b>{operations.summary.online}/{operations.summary.total}</b></span></div>
        <button className="secondary-module-action" onClick={refreshOperations} disabled={operationsStatus === "syncing"}>{operationsStatus === "syncing" ? "Синхронизация…" : "↻ Обновить срез"}</button>
      </article>
      <div className="source-card-grid">{adapterCatalog.map((catalog) => {
        const state = adapterBySource.get(catalog.source);
        const status = state?.status ?? "offline";
        return <article className={`panel source-card source-status-${status}`} key={catalog.source}>
          <div className="source-card-top"><MiniIcon tone={sourceTone[catalog.source]}>{sourceIcons[catalog.source]}</MiniIcon><span className={`adapter-state-${status}`}><i /> {adapterStatusLabel(status)}</span></div>
          <h2>{catalog.shortTitle}</h2><p>{catalog.description}</p>
          <dl><div><dt>Последний пакет</dt><dd>{formatFreshness(state?.lastEventAt ?? null, operations.generatedAt)}</dd></div><div><dt>Транспорт</dt><dd>{formatLatency(state?.latencyMs ?? 0)}</dd></div><div><dt>За 24 часа</dt><dd>{(state?.received24h ?? 0).toLocaleString("ru-RU")}</dd></div><div><dt>Успешность</dt><dd>{(state?.successRate ?? 0).toFixed(1)}%</dd></div></dl>
          <button onClick={refreshOperations}>Проверить контур →</button>
        </article>;
      })}</div>
      <div className="operations-journal-grid">
        <article className="panel"><ModuleHeading index="01" title="Нормализованный поток" subtitle="Единый конверт · валидация · дедупликация" badge={`${operations.events.length} EVENTS`} /><div className="report-feed operations-feed">{operations.events.map((event) => <button className={currentEvent?.id === event.id ? "selected" : ""} key={event.id} onClick={() => setSelectedOperationEvent(event.id)}><time>{formatEventTime(event.occurredAt)}</time><span className={`feed-dot ${sourceEventTone[event.source]}`} /><div><b>{adapterCatalog.find((adapter) => adapter.source === event.source)?.shortTitle} · {eventTypeLabels[event.eventType]}</b><p>{event.summary}</p><small>{event.assetId ?? "без объекта"} · {event.externalId}</small></div><strong className={event.deliveryCount > 1 ? "dedup" : "valid"}>{event.deliveryCount > 1 ? `DEDUP ×${event.deliveryCount}` : "VALID →"}</strong></button>)}</div></article>
        <aside className="panel operation-event-detail">{currentEvent ? <><ModuleHeading index="02" title="Конверт события" subtitle="Нормализованные поля и исходная нагрузка" badge={currentEvent.quality.toUpperCase()} /><div className="operation-event-body"><div className="event-identity"><MiniIcon tone={sourceTone[currentEvent.source]}>{sourceIcons[currentEvent.source]}</MiniIcon><div><small>{currentEvent.source.toUpperCase()} · {currentEvent.eventType}</small><h2>{currentEvent.summary}</h2><p>{currentEvent.externalId}</p></div></div><dl><div><dt>Объект</dt><dd>{currentEvent.assetId ?? "—"}</dd></div><div><dt>Получено</dt><dd>{formatEventTime(currentEvent.receivedAt)} UTC+5</dd></div><div><dt>Доставок</dt><dd>{currentEvent.deliveryCount}</dd></div><div><dt>Качество</dt><dd className={currentEvent.quality === "valid" ? "text-green" : "text-amber"}>{currentEvent.quality.toUpperCase()}</dd></div><div><dt>SHA‑256</dt><dd title={currentEvent.checksum}>{currentEvent.checksum.slice(0, 12)}…</dd></div></dl><pre>{JSON.stringify(currentEvent.payload, null, 2)}</pre></div></> : <div className="operation-event-empty">Событий пока нет</div>}</aside>
      </div>
    </section>;
  }

  if (name === "Инфраструктура") {
    return <section className="module-layout infrastructure-module"><article className="panel gis-panel"><ModuleHeading index="01" title="Безопасный GIS‑импорт" subtitle="GeoJSON / JSON / CSV · dry‑run перед записью" badge="DEMO" /><div className="gis-body"><input ref={fileInput} className="hidden-input" type="file" accept=".geojson,.json,.csv,application/geo+json,application/json,text/csv" onChange={selectGisFile} /><div className="gis-drop"><MiniIcon tone="cyan">⇧</MiniIcon><div><b>{gisFile ?? "Выберите файл инфраструктуры"}</b><p>Координаты WGS84, обязательные поля asset_id и name</p></div><button onClick={() => fileInput.current?.click()}>Выбрать файл</button></div><div className="gis-actions"><button className="secondary-module-action" onClick={downloadExample}>↓ Скачать пример</button><button className="secondary-module-action" onClick={() => runGisImport("dry")}>✓ Проверить без записи</button><button className="primary-module-action" onClick={() => runGisImport("apply")}>Импортировать</button></div>{gisResult && <div className="import-result"><span>✓</span><div><b>{gisResult}</b><small>Транзакционная запись · дубликаты определяются по asset_id</small></div></div>}</div></article><article className="panel"><ModuleHeading index="02" title="Реестр объектов" subtitle="Актуальные паспорта инфраструктуры" badge={`${assets.length} ASSETS`} /><div className="data-table asset-table"><div className="table-row table-head"><span>Объект</span><span>Тип</span><span>Район</span><span>Статус</span><span>Риск</span></div>{assets.map((asset) => <button className="table-row" key={asset.id} onClick={() => { setSelectedAsset(asset.id); onNavigate("Карта объектов"); }}><span><b>{asset.id}</b><small>{asset.name}</small></span><span>{asset.type}</span><span>{asset.district}</span><span>{asset.state}</span><span>{asset.risk}</span></button>)}</div></article></section>;
  }

  if (name === "Интеграции") {
    const adapterBySource = new Map(operations.adapters.map((adapter) => [adapter.source, adapter]));
    return <section className="module-layout integrations-module">
      <article className="panel integration-summary"><div><MiniIcon tone={operations.summary.online === operations.summary.total ? "cyan" : "amber"}>{operations.summary.online === operations.summary.total ? "✓" : "!"}</MiniIcon><span><b>{operations.summary.online} из {operations.summary.total} адаптеров принимают данные</b><small>{operations.dataMode === "live" ? `D1 · ${operations.summary.accepted24h.toLocaleString("ru-RU")} нормализованных событий за 24 часа` : "Показан контролируемый fallback до первого реального пакета"}</small></span></div><button className="secondary-module-action" onClick={refreshOperations} disabled={operationsStatus === "syncing"}>{operationsStatus === "syncing" ? "Проверка…" : "↻ Обновить статусы"}</button></article>
      <div className="integration-grid">{adapterCatalog.map((catalog) => {
        const state = adapterBySource.get(catalog.source);
        const status = state?.status ?? "offline";
        return <article className={`panel integration-card integration-${status}`} key={catalog.source}><div className="integration-card-top"><MiniIcon tone={status === "online" ? "cyan" : "amber"}>⇄</MiniIcon><span className={status === "online" ? "state-green" : "state-amber"}>{adapterStatusLabel(status)}</span></div><h2>{catalog.title}</h2><p>{catalog.transport}</p><small>{formatFreshness(state?.lastEventAt ?? null, operations.generatedAt)} · {formatLatency(state?.latencyMs ?? 0)} · {(state?.successRate ?? 0).toFixed(1)}%</small><button onClick={refreshOperations}>Запросить heartbeat →</button></article>;
      })}<article className="panel integration-card integration-safe"><div className="integration-card-top"><MiniIcon tone="amber">◇</MiniIcon><span className="state-amber">SAFE MODE</span></div><h2>Local AI</h2><p>Ollama API · изолированный контур</p><small>При недоступности модели действуют детерминированные правила. Автоматических управляющих команд нет.</small><button onClick={() => onNotify("Local AI: safe mode подтверждён, решения требуют диспетчера")}>Проверить ограничения →</button></article></div>
      <div className="adapter-contract-grid"><div className="trust-note"><MiniIcon tone="cyan">01</MiniIcon><div><b>Шлюз на стороне источника</b><p>MQTT, OPC UA и ведомственные API завершаются во внешнем адаптере. В облако передаётся только HTTPS-конверт.</p></div></div><div className="trust-note"><MiniIcon tone="cyan">02</MiniIcon><div><b>Валидация и дедупликация</b><p>Проверяются схема, время, координаты и размер. Пара source + external_id обеспечивает идемпотентность.</p></div></div><div className="trust-note"><MiniIcon tone="amber">03</MiniIcon><div><b>Человек принимает решение</b><p>Контур данных не управляет задвижками, насосами или выключателями. Любое действие подтверждает диспетчер.</p></div></div></div>
    </section>;
  }

  if (name === "Аудит решений") {
    const auditEvents = operations.events.slice(0, 12);
    const current = auditEvents[Math.min(selectedAudit, Math.max(0, auditEvents.length - 1))] ?? null;
    return <section className="module-layout audit-module"><div className="module-split"><article className="panel"><ModuleHeading index="01" title="Журнал событий" subtitle="Прослеживаемая цепочка приёма и нормализации" badge={operations.dataMode === "live" ? "D1 · UTC+5" : "DEMO · UTC+5"} /><div className="audit-list">{auditEvents.map((event, index) => <button key={event.id} className={selectedAudit === index ? "selected" : ""} onClick={() => setSelectedAudit(index)}><span className={`timeline-dot ${sourceEventTone[event.source]}`}>•</span><div><b>{eventTypeLabels[event.eventType]}</b><p>{event.summary}</p><small>{event.source} · {event.externalId}</small></div><time>{formatEventTime(event.occurredAt)}</time></button>)}</div></article><aside className="panel audit-detail">{current ? <><MiniIcon tone={current.quality === "valid" ? "cyan" : "amber"}>✓</MiniIcon><small>СОБЫТИЕ ПРОВЕРЕНО</small><h2>{current.summary}</h2><p>{current.externalId}</p><dl><div><dt>Время</dt><dd>{formatEventTime(current.occurredAt)} UTC+5</dd></div><div><dt>Инициатор</dt><dd>adapter-{current.source}</dd></div><div><dt>Объект</dt><dd>{current.assetId ?? "—"}</dd></div><div><dt>Trace ID</dt><dd>{current.checksum.slice(0, 12)}</dd></div><div><dt>Целостность</dt><dd className="text-green">SHA‑256 OK</dd></div><div><dt>Доставок</dt><dd>{current.deliveryCount}{current.deliveryCount > 1 ? " · DEDUP" : ""}</dd></div></dl><button className="secondary-module-action" onClick={() => downloadOperationEvent(current)}>↓ Экспортировать JSON</button></> : <div className="operation-event-empty">Журнал пока пуст</div>}</aside></div></section>;
  }

  return <section className="module-layout settings-module"><div className="settings-grid"><article className="panel settings-panel"><ModuleHeading index="01" title="Интерфейс" subtitle="Настройки сохраняются в этом браузере" /><div className="settings-section"><h3>Цветовая тема</h3><div className="theme-choices"><button className={theme === "dark" ? "selected" : ""} onClick={() => onTheme("dark")}><span>☾</span><div><b>Ночная</b><small>Для диспетчерской смены</small></div><em>{theme === "dark" ? "✓" : ""}</em></button><button className={theme === "light" ? "selected" : ""} onClick={() => onTheme("light")}><span>☀</span><div><b>Дневная</b><small>Для яркого помещения</small></div><em>{theme === "light" ? "✓" : ""}</em></button></div></div><div className="settings-section"><h3>Язык интерфейса</h3><div className="language-choices"><button className={locale === "ru" ? "selected" : ""} onClick={() => onLocale("ru")}>RU · Русский</button><button className={locale === "kz" ? "selected" : ""} onClick={() => onLocale("kz")}>KZ · Қазақша</button></div></div><div className="settings-section"><h3>Рабочее место</h3><label className="setting-row"><span><b>Автообновление</b><small>Запрашивать новые данные каждые 30 секунд</small></span><button className={`toggle ${autoRefresh ? "on" : ""}`} onClick={() => setAutoRefresh(!autoRefresh)} aria-label="Автообновление"><i /></button></label><label className="setting-row"><span><b>Компактный режим</b><small>Показывать больше строк в таблицах</small></span><button className={`toggle ${compactMode ? "on" : ""}`} onClick={() => setCompactMode(!compactMode)} aria-label="Компактный режим"><i /></button></label></div></article><aside className="panel settings-summary"><MiniIcon tone="cyan">AD</MiniIcon><h2>Рабочее место диспетчера</h2><p>Все параметры применяются сразу. Управляющие действия по‑прежнему требуют подтверждения оператора.</p><dl><div><dt>Тема</dt><dd>{theme === "dark" ? "Ночная" : "Дневная"}</dd></div><div><dt>Язык</dt><dd>{locale.toUpperCase()}</dd></div><div><dt>Обновление</dt><dd>{autoRefresh ? "Включено" : "Выключено"}</dd></div><div><dt>Плотность</dt><dd>{compactMode ? "Компактная" : "Обычная"}</dd></div></dl><button className="secondary-module-action" onClick={() => { setAutoRefresh(true); setCompactMode(false); onTheme("dark"); onLocale("ru"); onNotify("Настройки рабочего места сброшены"); }}>↻ Сбросить настройки</button></aside></div></section>;
}

export default function Home() {
  const [locale, setLocale] = useState<Locale>("ru");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [stage, setStage] = useState<DemoStage>("incident");
  const [dashboardMapMode, setDashboardMapMode] = useState<DashboardMapMode>("real");
  const [dashboardPitch, setDashboardPitch] = useState(48);
  const [dashboardYaw, setDashboardYaw] = useState(-3);
  const [incidentMoment, setIncidentMoment] = useState(3);
  const [twinLayers, setTwinLayers] = useState<TwinLayerState>({ buildings: true, flows: true, sensors: true, impact: true });
  const [dashboardUtility, setDashboardUtility] = useState<UtilityFilter>("all");
  const [dashboardSelectedAsset, setDashboardSelectedAsset] = useState("WM-042");
  const [compareMode, setCompareMode] = useState(false);
  const [comparePosition, setComparePosition] = useState(50);
  const [activeNav, setActiveNav] = useState("Центр управления");
  const [toast, setToast] = useState<string | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [operatorOpen, setOperatorOpen] = useState(false);
  const t = copy[locale];
  const active = stage === "incident" || stage === "assigned";
  const detecting = stage === "detecting";
  const kpis = useMemo(() => ({ open: active ? "04" : "03", confirmed: active ? "03" : "02", critical: active ? "01" : "00", signals: active ? "1 284" : "1 281" }), [active]);
  const [moduleTitle, moduleSubtitle] = activeNav === "Центр управления" ? [t.command, t.subtitle] : (moduleCopy[activeNav] ?? moduleCopy["Центр управления"]);
  const dashboardMapModes: Array<[DashboardMapMode, string, string]> = locale === "ru"
    ? [["real", "⌖", "Астана"], ["flow", "≈", "Потоки"], ["telemetry", "⌁", "Датчики"], ["impact", "◎", "Риск"], ["city3d", "◇", "3D"]]
    : [["real", "⌖", "Астана"], ["flow", "≈", "Ағындар"], ["telemetry", "⌁", "Датчиктер"], ["impact", "◎", "Тәуекел"], ["city3d", "◇", "3D"]];
  const twinLayerLabels: Array<[TwinLayer, string, string]> = locale === "ru"
    ? [["buildings", "▥", "Здания"], ["flows", "≈", "Сети"], ["sensors", "⌁", "Датчики"], ["impact", "◎", "Воздействие"]]
    : [["buildings", "▥", "Ғимараттар"], ["flows", "≈", "Желілер"], ["sensors", "⌁", "Датчиктер"], ["impact", "◎", "Әсер"]];
  const incidentPlayback = locale === "ru"
    ? [
        { time: "10:42:11", title: "SCADA", detail: "Давление −31% за 8 минут", tone: "red" },
        { time: "10:43:02", title: "109", detail: "Вода на проезжей части", tone: "cyan" },
        { time: "10:44:18", title: "e‑Өтініш", detail: "Фото и координаты совпали", tone: "cyan" },
        { time: "10:44:24", title: "ИИ-корреляция", detail: "3 сигнала · уверенность 94%", tone: "amber" },
      ]
    : [
        { time: "10:42:11", title: "SCADA", detail: "Қысым 8 минутта −31%", tone: "red" },
        { time: "10:43:02", title: "109", detail: "Жолдағы су туралы қоңырау", tone: "cyan" },
        { time: "10:44:18", title: "e‑Өтініш", detail: "Фото мен координаттар сәйкес", tone: "cyan" },
        { time: "10:44:24", title: "ЖИ корреляциясы", detail: "3 сигнал · сенімділік 94%", tone: "amber" },
      ];
  const selectedMoment = incidentPlayback[incidentMoment];
  const selectedTwinAsset = assets.find((asset) => asset.id === dashboardSelectedAsset) ?? assets[0];
  const dashboardUtilityOptions: Array<[UtilityFilter, string, string, string]> = locale === "ru"
    ? [["all", "◫", "Все сети", "3 потока"], ["electricity", "ϟ", "Электро", "импульс"], ["water", "≈", "Вода", "медленно"], ["gas", "◌", "Газ", "непрерывно"]]
    : [["all", "◫", "Барлық желі", "3 ағын"], ["electricity", "ϟ", "Электр", "импульс"], ["water", "≈", "Су", "баяу"], ["gas", "◌", "Газ", "үздіксіз"]];

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("infra-signal-theme");
    const nextTheme = storedTheme === "light" || storedTheme === "dark" ? storedTheme : (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    const storedLocale = window.localStorage.getItem("infra-signal-locale");
    const storedModule = window.localStorage.getItem("infra-signal-module");
    const moduleNames = navGroups.flatMap((group) => group.items.map(([, label]) => label));
    const frame = window.requestAnimationFrame(() => {
      setTheme(nextTheme);
      if (storedLocale === "kz") setLocale("kz");
      if (storedModule && moduleNames.includes(storedModule)) setActiveNav(storedModule);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem("infra-signal-theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = locale === "kz" ? "kk" : "ru";
    window.localStorage.setItem("infra-signal-locale", locale);
  }, [locale]);

  function flash(message: string) { setToast(message); window.setTimeout(() => setToast(null), 2800); }
  function runScenario() {
    setStage("detecting"); flash(locale === "ru" ? "Получен новый поток телеметрии" : "Жаңа телеметрия ағыны алынды");
    window.setTimeout(() => { setStage("incident"); flash(locale === "ru" ? "Инцидент подтверждён тремя источниками" : "Оқиға үш дереккөзбен расталды"); }, 1500);
  }
  function resetScenario() { setStage("watch"); flash(locale === "ru" ? "Система переведена в режим наблюдения" : "Жүйе бақылау режиміне ауысты"); }
  function assignCrew() { setStage("assigned"); flash(locale === "ru" ? "Бригада №7 получила маршрут и регламент" : "№7 бригада маршрут пен регламентті алды"); }
  function navigate(name: string) {
    setActiveNav(name);
    setNotificationsOpen(false);
    setOperatorOpen(false);
    window.localStorage.setItem("infra-signal-module", name);
  }
  function toggleTwinLayer(layer: TwinLayer) {
    setTwinLayers((current) => ({ ...current, [layer]: !current[layer] }));
  }
  function resetTwinView() {
    setDashboardPitch(48);
    setDashboardYaw(-3);
    setTwinLayers({ buildings: true, flows: true, sensors: true, impact: true });
    setDashboardUtility("all");
    setCompareMode(false);
    flash(locale === "ru" ? "3D-ракурс и слои восстановлены" : "3D көрінісі мен қабаттар қалпына келтірілді");
  }
  function advanceIncidentPlayback() {
    setDashboardMapMode("city3d");
    setIncidentMoment((current) => current >= incidentPlayback.length - 1 ? 0 : current + 1);
  }
  function chooseDashboardUtility(utility: UtilityFilter) {
    setDashboardUtility(utility);
    if (utility === "electricity") setDashboardSelectedAsset("EL-016");
    if (utility === "water") setDashboardSelectedAsset("WM-042");
    if (utility === "gas") setDashboardSelectedAsset("GS-009");
  }
  function cycleDashboardAsset() {
    const currentIndex = assets.findIndex((asset) => asset.id === dashboardSelectedAsset);
    const next = assets[(currentIndex + 1) % assets.length];
    setDashboardUtility("all");
    setDashboardSelectedAsset(next.id);
  }
  function toggleComparison() {
    setDashboardMapMode("city3d");
    setCompareMode((current) => !current);
    setComparePosition(50);
  }

  return (
    <main className="site-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">≈</span><div><strong>INFRA<span>SIGNAL</span></strong><small>AI EARLY WARNING</small></div></div>
        <nav>{navGroups.map((group) => <div className="nav-group" key={group.label}><small>{group.label}</small>{group.items.map(([icon, label]) => <button key={label} className={activeNav === label ? "active" : ""} onClick={() => navigate(label)}><b>{icon}</b><span>{label}</span>{label === "Инциденты" && <i>{kpis.open}</i>}</button>)}</div>)}</nav>
        <div className="system-health"><span className="signal"><i /><i /><i /></span><div><b>Система активна</b><small>5 источников · online</small></div><em /></div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="topbar-copy">
            <div className="breadcrumbs">SMART CITY <span>/</span> INFRA SIGNAL <span>/</span> {activeNav.toUpperCase()}</div>
            <div className="page-title-row"><h1>{moduleTitle}</h1><span className="workspace-state"><i /> LIVE WORKSPACE</span></div>
            <p>{moduleSubtitle}</p>
          </div>
          <div className="top-actions"><span className="safe-mode"><i /> HUMAN-IN-THE-LOOP</span><button className="theme-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={theme === "dark" ? "Включить дневную тему" : "Включить ночную тему"}>{theme === "dark" ? "☀" : "☾"}</button><button className="language" onClick={() => setLocale(locale === "ru" ? "kz" : "ru")} aria-label="Сменить язык">◎ {locale.toUpperCase()}</button><div className="popover-anchor"><button className="bell" onClick={() => { setNotificationsOpen(!notificationsOpen); setOperatorOpen(false); }} aria-label="Уведомления" aria-expanded={notificationsOpen}>♢<i /></button>{notificationsOpen && <div className="top-menu notifications-menu"><div><b>Уведомления</b><button onClick={() => { setNotificationsOpen(false); flash("Все уведомления прочитаны"); }}>Прочитать все</button></div>{timeline.slice(-3).reverse().map(([time, title, detail]) => <button key={time} onClick={() => navigate("Аудит решений")}><span>•</span><p><b>{title}</b><small>{detail} · {time}</small></p></button>)}</div>}</div><div className="popover-anchor"><button className="operator" onClick={() => { setOperatorOpen(!operatorOpen); setNotificationsOpen(false); }} aria-expanded={operatorOpen}><span>AD</span><div><b>Диспетчер</b><small>Смена 04</small></div><em>⌄</em></button>{operatorOpen && <div className="top-menu operator-menu"><div className="operator-card"><span>AD</span><p><b>Адиль · Диспетчер</b><small>Смена активна · UTC+5</small></p></div><button onClick={() => navigate("Настройки")}>⚙ Настройки рабочего места</button><button onClick={() => navigate("Аудит решений")}>✓ Мои действия в аудите</button></div>}</div></div>
        </header>
        <div className="mobile-brand"><span className="brand-mark">≈</span><b>INFRA<span>SIGNAL</span></b><button className="theme-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? "☀" : "☾"}</button><button className="language" onClick={() => setLocale(locale === "ru" ? "kz" : "ru")}>{locale.toUpperCase()}</button></div>
        <div className="mobile-modules" aria-label="Модули">{navGroups.flatMap((group) => group.items).map(([icon, label]) => <button key={label} className={activeNav === label ? "active" : ""} onClick={() => navigate(label)}><span>{icon}</span>{label}</button>)}</div>

        <section className="control-bar"><div className="source-list"><button onClick={() => navigate("Телеметрия")}><i />SCADA <b>ONLINE</b></button><button onClick={() => navigate("Источники данных")}><i />109 <b>ADAPTER</b></button><button onClick={() => navigate("Источники данных")}><i />e‑Өтініш <b>ADAPTER</b></button><button onClick={() => navigate("Инфраструктура")}><i />GIS <b>4 ASSETS</b></button><button onClick={() => navigate("Интеграции")}><i className="amber" />LOCAL AI <b>SAFE MODE</b></button></div><div className="demo-actions"><span className="demo-label">{t.demo}</span><button className="reset" onClick={resetScenario}>↻ {t.reset}</button><button className="run" onClick={() => { navigate("Центр управления"); runScenario(); }} disabled={detecting}>{detecting ? <><i className="loader" />{t.analyzing}</> : <>▶ {active ? t.replay : t.run}</>}</button></div></section>

        {activeNav === "Центр управления" ? <>
        <section className="kpi-grid"><Kpi label={t.open} value={kpis.open} trend="за текущую смену" tone="amber" icon="!" /><Kpi label={t.confirmed} value={kpis.confirmed} trend="cross-source correlation" tone="cyan" icon="✓" /><Kpi label={t.critical} value={kpis.critical} trend={active ? "требует решения" : "нет активных"} tone="red" icon="▲" /><Kpi label={t.signals} value={kpis.signals} trend="confidence 94%" tone="neutral" icon="⌁" /></section>

        <section className="scenario-strip" aria-label="Этапы обработки инцидента">
          <div className={stage !== "watch" ? "complete" : "active"}><span>{stage !== "watch" ? "✓" : "01"}</span><p><b>{t.signalStage}</b><small>SCADA · 109 · e‑Өтініш</small></p></div>
          <i />
          <div className={active ? "complete" : detecting ? "active" : ""}><span>{active ? "✓" : "02"}</span><p><b>{t.correlationStage}</b><small>{detecting ? t.analyzing : "3 independent signals"}</small></p></div>
          <i />
          <div className={stage === "assigned" ? "complete" : active ? "active" : ""}><span>{stage === "assigned" ? "✓" : "03"}</span><p><b>{t.actionStage}</b><small>human approval required</small></p></div>
          <strong>{active ? "02:13" : "—"}<small>TIME TO DETECT</small></strong>
        </section>

        <section className="operations">
          <div className="operations-main">
            <article className="panel map-panel command-center-map">
              <div className="panel-head"><div><span>01</span><div><h2>{t.map}</h2><p>{locale === "ru" ? "Живой цифровой двойник: сети, датчики, воздействие и решение" : "Тікелей цифрлық егіз: желілер, датчиктер, әсер және шешім"}</p></div></div><b><i /> DIGITAL TWIN · LIVE</b></div>
              <div className="map-command-bar">
                <div className="dashboard-map-switcher" role="group" aria-label={locale === "ru" ? "Вариант отображения карты" : "Карта көрінісі"}>{dashboardMapModes.map(([mode, icon, label]) => <button key={mode} className={dashboardMapMode === mode ? "selected" : ""} onClick={() => { setDashboardMapMode(mode); if (mode !== "city3d") setCompareMode(false); }} aria-pressed={dashboardMapMode === mode}><span>{icon}</span>{label}</button>)}</div>
                <div className="map-command-meta"><span className="map-data-freshness"><i /> SCADA · {locale === "ru" ? "обновлено 2 сек назад" : "2 сек бұрын жаңартылды"}</span><span className="map-quality-badge">VALID · 99.7%</span></div>
              </div>
              <div className="twin-network-bar">
                <div className="twin-utility-filter" role="group" aria-label={locale === "ru" ? "Фильтр инженерных сетей" : "Инженерлік желілер сүзгісі"}><small>{locale === "ru" ? "ПОТОКИ" : "АҒЫНДАР"}</small>{dashboardUtilityOptions.map(([utility, icon, label, signature]) => <button type="button" key={utility} className={`${dashboardUtility === utility ? "selected" : ""} utility-${utility}`} onClick={() => chooseDashboardUtility(utility)} aria-pressed={dashboardUtility === utility}><span>{icon}</span><p><b>{label}</b><em>{signature}</em></p></button>)}</div>
                <button type="button" className={`twin-compare-toggle ${compareMode ? "selected" : ""}`} onClick={toggleComparison} aria-pressed={compareMode}><span>◐</span><p><b>{locale === "ru" ? "Норма ↔ авария" : "Қалыпты ↔ апат"}</b><small>{compareMode ? (locale === "ru" ? "режим включён" : "режим қосылды") : (locale === "ru" ? "сравнить состояние" : "күйді салыстыру")}</small></p></button>
              </div>
              {dashboardMapMode === "city3d" && <div className="twin-control-deck">
                <div className="twin-layer-controls" role="group" aria-label={locale === "ru" ? "Слои цифрового двойника" : "Цифрлық егіз қабаттары"}><small>{locale === "ru" ? "СЛОИ" : "ҚАБАТТАР"}</small>{twinLayerLabels.map(([layer, icon, label]) => <button type="button" key={layer} className={twinLayers[layer] ? "selected" : ""} onClick={() => toggleTwinLayer(layer)} aria-pressed={twinLayers[layer]}><span>{icon}</span>{label}</button>)}</div>
                <div className="twin-camera-controls">
                  <div className="map-pitch-controls compact" aria-label={locale === "ru" ? "Угол наклона 3D-карты" : "3D-карта бұрышы"}><button type="button" disabled={dashboardPitch <= 34} onClick={() => setDashboardPitch((value) => Math.max(34, value - 4))} aria-label={locale === "ru" ? "Уменьшить наклон" : "Көлбеуді азайту"}>−</button><span><small>{locale === "ru" ? "НАКЛОН" : "БҰРЫШ"}</small>{dashboardPitch}°</span><button type="button" disabled={dashboardPitch >= 58} onClick={() => setDashboardPitch((value) => Math.min(58, value + 4))} aria-label={locale === "ru" ? "Увеличить наклон" : "Көлбеуді арттыру"}>+</button></div>
                  <div className="map-pitch-controls compact" aria-label={locale === "ru" ? "Поворот 3D-карты" : "3D-картаны бұру"}><button type="button" disabled={dashboardYaw <= -12} onClick={() => setDashboardYaw((value) => Math.max(-12, value - 3))} aria-label={locale === "ru" ? "Повернуть влево" : "Солға бұру"}>↶</button><span><small>{locale === "ru" ? "АЗИМУТ" : "АЗИМУТ"}</small>{dashboardYaw > 0 ? "+" : ""}{dashboardYaw}°</span><button type="button" disabled={dashboardYaw >= 12} onClick={() => setDashboardYaw((value) => Math.min(12, value + 3))} aria-label={locale === "ru" ? "Повернуть вправо" : "Оңға бұру"}>↷</button></div>
                  <button type="button" className="twin-view-reset" onClick={resetTwinView}>↺ <span>{locale === "ru" ? "Сбросить вид" : "Көріністі қалпына келтіру"}</span></button>
                </div>
              </div>}
              <div className="map-intel-strip" aria-label={locale === "ru" ? "Ключевые показатели участка" : "Учаскенің негізгі көрсеткіштері"}>
                <div><small>{locale === "ru" ? "ДАВЛЕНИЕ" : "ҚЫСЫМ"}</small><span><b>2.8</b> bar</span><em className="text-red">−31%</em></div>
                <div><small>{locale === "ru" ? "РАСХОД" : "ШЫҒЫН"}</small><span><b>128</b> м³/ч</span><em className="text-amber">+18%</em></div>
                <div><small>{locale === "ru" ? "ДОСТОВЕРНОСТЬ" : "СЕНІМДІЛІК"}</small><span><b>94</b>%</span><em className="text-green">{locale === "ru" ? "3 источника" : "3 дереккөз"}</em></div>
                <div><small>{locale === "ru" ? "ЗОНА ВЛИЯНИЯ" : "ӘСЕР АЙМАҒЫ"}</small><span><b>640</b> м</span><em>{locale === "ru" ? "12 объектов" : "12 нысан"}</em></div>
              </div>
              <div className={`digital-twin-stage twin-stage-${dashboardMapMode} ${compareMode && dashboardMapMode === "city3d" ? "compare-active" : ""}`}>
                {dashboardMapMode === "real" ? <RealAstanaMap active={active} selectedAssetId={dashboardSelectedAsset} onSelectAsset={setDashboardSelectedAsset} utilityFilter={dashboardUtility} locale={locale} /> : compareMode ? <>
                  <div className="twin-compare-layer twin-compare-baseline"><NetworkMap active={false} detecting={false} selectedAssetId={dashboardSelectedAsset} onSelectAsset={setDashboardSelectedAsset} utilityFilter={dashboardUtility} context="dashboard" dashboardMode="city3d" pitch={dashboardPitch} yaw={dashboardYaw} showBuildings={twinLayers.buildings} showFlows={twinLayers.flows} showSensors={twinLayers.sensors} showImpact={false} incidentMoment={0} showChrome={false} locale={locale} /></div>
                  <div className="twin-compare-layer twin-compare-incident" style={{ clipPath: `inset(0 0 0 ${comparePosition}%)` }}><NetworkMap active detecting={false} selectedAssetId={dashboardSelectedAsset} onSelectAsset={setDashboardSelectedAsset} utilityFilter={dashboardUtility} context="dashboard" dashboardMode="city3d" pitch={dashboardPitch} yaw={dashboardYaw} showBuildings={twinLayers.buildings} showFlows={twinLayers.flows} showSensors={twinLayers.sensors} showImpact={twinLayers.impact} incidentMoment={3} showChrome={false} locale={locale} /></div>
                  <div className="twin-compare-label twin-compare-label-before"><i />{locale === "ru" ? "НОРМА · 10:34" : "ҚАЛЫПТЫ · 10:34"}</div><div className="twin-compare-label twin-compare-label-after"><i />{locale === "ru" ? "АВАРИЯ · 10:44" : "АПАТ · 10:44"}</div>
                  <div className="twin-compare-divider" style={{ left: `${comparePosition}%` }}><span>◀</span><i /><span>▶</span></div>
                  <input className="twin-compare-range" type="range" min="10" max="90" value={comparePosition} onChange={(event) => setComparePosition(Number(event.target.value))} aria-label={locale === "ru" ? "Граница сравнения нормы и аварии" : "Қалыпты және апат салыстыру шекарасы"} />
                </> : <NetworkMap active={active} detecting={detecting} selectedAssetId={dashboardSelectedAsset} onSelectAsset={setDashboardSelectedAsset} utilityFilter={dashboardUtility} context="dashboard" dashboardMode={dashboardMapMode} pitch={dashboardPitch} yaw={dashboardYaw} showBuildings={dashboardMapMode !== "city3d" || twinLayers.buildings} showFlows={dashboardMapMode !== "city3d" || twinLayers.flows} showSensors={dashboardMapMode !== "city3d" || twinLayers.sensors} showImpact={dashboardMapMode !== "city3d" || twinLayers.impact} incidentMoment={incidentMoment} showAssetCard={false} locale={locale} />}
                {dashboardMapMode === "city3d" && !compareMode && <aside className="twin-source-hud" aria-label={locale === "ru" ? "Источники цифрового двойника" : "Цифрлық егіздің дереккөздері"}>
                  <div className="twin-hud-title"><span><i /> DATA FUSION</span><b>4 FEEDS</b></div>
                  <button type="button" onClick={() => setDashboardMapMode("telemetry")}><span><i className="source-scada" />SCADA</span><b>2.8 bar</b><small>24 сек · 99.7%</small></button>
                  <button type="button" onClick={() => setDashboardMapMode("impact")}><span><i />109</span><b>1 {locale === "ru" ? "звонок" : "қоңырау"}</b><small>10:43 · 96.2%</small></button>
                  <button type="button" onClick={() => setDashboardMapMode("impact")}><span><i />e‑Өтініш</span><b>1 {locale === "ru" ? "обращение" : "өтініш"}</b><small>10:44 · 94.8%</small></button>
                  <button type="button" onClick={() => flash(locale === "ru" ? "Геометрия GIS актуальна на 10:27" : "GIS геометриясы 10:27-де өзекті")}><span><i className="source-gis" />GIS</span><b>12 {locale === "ru" ? "объектов" : "нысан"}</b><small>18 мин · 98.4%</small></button>
                  <button type="button" className="twin-model-explain" onClick={() => navigate("Аналитика")}><span>◇ {locale === "ru" ? "ПОЧЕМУ 94%" : "НЕГЕ 94%"}</span><p>{locale === "ru" ? "Падение давления + 2 независимых обращения в радиусе 640 м" : "Қысымның төмендеуі + 640 м радиустағы 2 тәуелсіз өтініш"}</p><strong>{locale === "ru" ? "Открыть аналитику" : "Аналитиканы ашу"} →</strong></button>
                </aside>}
                {dashboardMapMode === "city3d" && !compareMode && <div className="twin-compass" aria-hidden="true"><span>N</span><i /><b>{dashboardYaw > 0 ? "+" : ""}{dashboardYaw}°</b></div>}
              </div>
              <div className="twin-object-inspector" aria-live="polite">
                <span className={`twin-object-icon utility-${selectedTwinAsset.utilityKey}`}>{selectedTwinAsset.utilityKey === "electricity" ? "ϟ" : selectedTwinAsset.utilityKey === "gas" ? "◌" : selectedTwinAsset.utilityKey === "water" ? "≈" : "⌁"}</span>
                <div className="twin-object-title"><small>{locale === "ru" ? "ВЫБРАННЫЙ ОБЪЕКТ" : "ТАҢДАЛҒАН НЫСАН"} · {selectedTwinAsset.id}</small><b>{selectedTwinAsset.name}</b><span>{selectedTwinAsset.type} · {locale === "ru" ? "район" : "аудан"} {selectedTwinAsset.district}</span></div>
                <dl><div><dt>{locale === "ru" ? "ПОТОК" : "АҒЫН"}</dt><dd>{selectedTwinAsset.flowSignature}</dd></div><div><dt>{locale === "ru" ? "СОСТОЯНИЕ" : "КҮЙІ"}</dt><dd className={selectedTwinAsset.state === "Критично" ? "text-red" : selectedTwinAsset.state === "Отклонение" ? "text-amber" : "text-green"}>{selectedTwinAsset.state}</dd></div><div><dt>{locale === "ru" ? "РИСК" : "ТӘУЕКЕЛ"}</dt><dd>{selectedTwinAsset.risk}/100</dd></div><div><dt>WGS84</dt><dd>{selectedTwinAsset.coordinates}</dd></div></dl>
                <div className="twin-object-actions"><button type="button" onClick={cycleDashboardAsset} aria-label={locale === "ru" ? "Следующий объект" : "Келесі нысан"}>↻ <span>{locale === "ru" ? "Следующий" : "Келесі"}</span></button><button type="button" onClick={() => { if (selectedTwinAsset.utilityKey === "electricity" || selectedTwinAsset.utilityKey === "water" || selectedTwinAsset.utilityKey === "gas") chooseDashboardUtility(selectedTwinAsset.utilityKey); else setDashboardUtility("all"); flash(locale === "ru" ? `Сеть ${selectedTwinAsset.utility} изолирована на карте` : `${selectedTwinAsset.utility} желісі картада оқшауланды`); }}>⌖ <span>{locale === "ru" ? "Изолировать" : "Оқшаулау"}</span></button><button type="button" className="primary" onClick={() => navigate("Телеметрия")}>⌁ <span>{locale === "ru" ? "Телеметрия" : "Телеметрия"}</span></button></div>
              </div>
              <div className="twin-briefing" aria-label={locale === "ru" ? "Оперативная сводка" : "Жедел мәлімет"}>
                <button type="button" onClick={() => setDashboardMapMode("impact")}><span className="briefing-icon red">◎</span><p><small>{locale === "ru" ? "ВОЗДЕЙСТВИЕ" : "ӘСЕР"}</small><b>4 {locale === "ru" ? "жилых квартала" : "тұрғын квартал"}</b><em>2 {locale === "ru" ? "соцобъекта" : "әлеуметтік нысан"} · 1 {locale === "ru" ? "участок дороги" : "жол бөлігі"}</em></p><strong>→</strong></button>
                <button type="button" onClick={assignCrew} disabled={stage === "assigned"}><span className="briefing-icon cyan">↗</span><p><small>{locale === "ru" ? "РЕАГИРОВАНИЕ" : "ӘРЕКЕТ"}</small><b>{locale === "ru" ? "Бригада №7" : "№7 бригада"}</b><em>{stage === "assigned" ? (locale === "ru" ? "маршрут принят" : "маршрут қабылданды") : `ETA 12 ${locale === "ru" ? "мин" : "мин"} · ${locale === "ru" ? "свободна" : "бос"}`}</em></p><strong>{stage === "assigned" ? "✓" : "→"}</strong></button>
                <button type="button" onClick={() => navigate("Источники данных")}><span className="briefing-icon green">✓</span><p><small>{locale === "ru" ? "КАЧЕСТВО ДАННЫХ" : "ДЕРЕК САПАСЫ"}</small><b>99.7% VALID</b><em>{locale === "ru" ? "0 потерянных пакетов" : "0 жоғалған пакет"}</em></p><strong>→</strong></button>
              </div>
              <div className="incident-playback">
                <div className="playback-summary"><button type="button" className="playback-play" onClick={advanceIncidentPlayback} aria-label={locale === "ru" ? "Следующий момент инцидента" : "Оқиғаның келесі сәті"}>{incidentMoment >= incidentPlayback.length - 1 ? "↺" : "▶"}</button><div><small>{locale === "ru" ? "ВОСПРОИЗВЕДЕНИЕ ИНЦИДЕНТА" : "ОҚИҒАНЫ ОЙНАТУ"} · {incidentMoment + 1}/4</small><b>{selectedMoment.title}</b><span>{selectedMoment.detail}</span></div><time>{selectedMoment.time}</time></div>
                <div className="playback-track" role="group" aria-label={locale === "ru" ? "Хронология сигнала" : "Сигнал хронологиясы"}>{incidentPlayback.map((event, index) => <button type="button" key={event.time} className={`${index === incidentMoment ? "selected" : ""} ${index < incidentMoment ? "complete" : ""}`} onClick={() => { setIncidentMoment(index); setDashboardMapMode("city3d"); }} aria-pressed={index === incidentMoment}><i className={event.tone} /><span><b>{event.time}</b><small>{event.title}</small></span></button>)}</div>
              </div>
            </article>
            <div className="lower-grid">
              <article className="panel chart-panel"><div className="panel-head compact"><div><span>02</span><div><h2>{t.telemetry}</h2><p>WM-042 · последние 15 минут</p></div></div><b>BAR</b></div><SignalChart status={active ? "danger" : "normal"} metric="Давление" value={active ? "2.8" : "4.2"} unit="bar" trend={active ? "↓ 31%" : "● стабильно"} /></article>
              <article className="panel queue-panel"><div className="panel-head compact"><div><span>03</span><div><h2>{t.incidents}</h2><p>Единые карточки вместо дублей</p></div></div><b>{active ? "4" : "3"}</b></div><div className="queue-list">{active && <button className="queue-item selected" onClick={() => navigate("Инциденты")}><MiniIcon tone="red">≈</MiniIcon><span><b>Падение давления · WM-042</b><small>район Алматы · 2 мин назад</small></span><strong>87</strong></button>}<button className="queue-item" onClick={() => navigate("Инциденты")}><MiniIcon tone="amber">⌁</MiniIcon><span><b>Нестабильный расход · PS-104</b><small>район Сарыарқа · 21 мин</small></span><strong>54</strong></button><button className="queue-item" onClick={() => navigate("Инциденты")}><MiniIcon tone="cyan">◉</MiniIcon><span><b>Сигнал датчика · HS-011</b><small>район Байқоңыр · 36 мин</small></span><strong>31</strong></button></div></article>
            </div>
            <article className="panel timeline-panel"><div className="panel-head compact"><div><span>04</span><div><h2>{t.timeline}</h2><p>Аудитируемая цепочка принятия решения</p></div></div><b>UTC+5</b></div><div className="timeline">{active ? timeline.map(([time, title, detail, tone]) => <div className="timeline-row" key={time}><span className={`timeline-dot ${tone}`}>•</span><div><b>{title}</b><p>{detail}</p></div><time>{time}</time></div>) : <div className="timeline-empty"><span>◎</span><b>{t.noIncident}</b><p>Система продолжает анализировать телеметрию и обращения.</p></div>}</div></article>
          </div>

          <aside className={`incident-panel ${active ? "" : "empty"}`}>
            {active ? <>
              <div className="incident-title"><MiniIcon tone="red">▲</MiniIcon><div><small>INC-2026-0819 · <b>{stage === "assigned" ? "БРИГАДА НАЗНАЧЕНА" : "НОВЫЙ"}</b></small><h2>Вероятная утечка воды</h2><p>⌖ Магистральный водопровод №4</p></div></div>
              <div className="risk-box"><div className="risk-gauge" style={{ "--risk": "313deg" } as CSSProperties}><span><b>87</b><small>/100</small></span></div><div><p><span>{t.risk}</span><b className="text-red">КРИТИЧЕСКИЙ</b></p><p><span>{t.confidence}</span><b>94%</b></p><p><span>Зона влияния</span><b>640 м</b></p></div></div>
              <div className="cause"><small>◇ {t.cause}</small><p>Разгерметизация участка между камерами WM‑042 и VM‑207.</p><span>✓ Вывод основан на 3 независимых сигналах</span></div>
              <div className="detail-block"><div className="detail-title"><h3>{t.evidence}</h3><span>3</span></div><div className="evidence"><article><MiniIcon tone="red">⌁</MiniIcon><div><b>Телеметрия SCADA</b><p>Давление 4.1 → 2.8 bar за 8 минут</p><small>10:42 · вес 42%</small></div><em>✓</em></article><article><MiniIcon tone="cyan">◉</MiniIcon><div><b>Звонок 109</b><p>«Вода выходит на дорогу возле дома 17»</p><small>10:43 · вес 31%</small></div><em>✓</em></article><article><MiniIcon tone="cyan">▣</MiniIcon><div><b>Обращение e‑Өтініш</b><p>Фото и координаты совпали с аварийной зоной</p><small>10:44 · вес 27%</small></div><em>✓</em></article></div></div>
              <div className="detail-block"><div className="detail-title"><h3>{t.response}</h3><span>RAG · 3</span></div><ol className="recommendations">{recommendations.map(([n, text, source]) => <li key={n}><span>{n}</span><div><p>{text}</p><small>{source}</small></div></li>)}</ol></div>
              <div className="crew"><MiniIcon tone="cyan">↗</MiniIcon><div><small>Рекомендованная бригада</small><b>Аварийная бригада №7</b><span>12 мин · свободна · +7 701 000 07 07</span></div><strong>→</strong></div>
              <div className="human-gate">✓ {t.human}</div><button className={`assign ${stage === "assigned" ? "done" : ""}`} onClick={assignCrew} disabled={stage === "assigned"}>{stage === "assigned" ? <>✓ {t.assigned}</> : <>↗ {t.assign}</>}</button>
            </> : <div className="empty-incident"><div>◎</div><h2>{detecting ? t.analyzing : t.noIncident}</h2><p>ИИ объединит телеметрию и обращения, но решение останется за диспетчером.</p></div>}
          </aside>
        </section>

        </> : <ModuleView name={activeNav} activeIncident={active} locale={locale} theme={theme} onLocale={setLocale} onTheme={setTheme} onNavigate={navigate} onNotify={flash} />}

        <footer><span>{t.demo}</span><p>INFRA-SIGNAL не выполняет управляющие действия автоматически. Все сценарии требуют подтверждения оператора.</p><b>v0.2 · PILOT READY</b></footer>
      </section>
      {toast && <div className="toast" role="status" aria-live="polite"><span>✓</span><p>{toast}</p></div>}
    </main>
  );
}
