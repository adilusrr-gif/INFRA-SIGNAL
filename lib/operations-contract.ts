export const adapterCatalog = [
  {
    source: "scada",
    shortTitle: "SCADA",
    title: "SCADA Gateway",
    transport: "MQTT / OPC UA → HTTPS",
    description: "Телеметрия давления, расхода, температуры и состояния оборудования",
  },
  {
    source: "109",
    shortTitle: "109",
    title: "Городская служба 109",
    transport: "Подписанный webhook → HTTPS",
    description: "Звонки жителей, координаты и карточки операторов",
  },
  {
    source: "eotinish",
    shortTitle: "e‑Өтініш",
    title: "e‑Өтініш",
    transport: "REST polling → HTTPS",
    description: "Обращения, вложения и географическая привязка",
  },
  {
    source: "gis",
    shortTitle: "GIS",
    title: "GIS Registry",
    transport: "Версионный пакет → HTTPS",
    description: "Паспорта, геометрия и связи объектов инфраструктуры",
  },
] as const;

export type AdapterSource = (typeof adapterCatalog)[number]["source"];
export type AdapterStatus = "online" | "degraded" | "offline";
export type OperationEventType =
  | "telemetry"
  | "citizen_report"
  | "gis_update"
  | "adapter_health";

export type AdapterOperationalState = {
  source: AdapterSource;
  label: string;
  transport: string;
  status: AdapterStatus;
  lastEventAt: string | null;
  latencyMs: number;
  successRate: number;
  consecutiveErrors: number;
  received24h: number;
};

export type NormalizedOperationEvent = {
  id: string;
  source: AdapterSource;
  externalId: string;
  eventType: OperationEventType;
  assetId: string | null;
  occurredAt: string;
  receivedAt: string;
  checksum: string;
  deliveryCount: number;
  quality: "valid" | "warning" | "rejected";
  summary: string;
  payload: Record<string, unknown>;
};

export type LatestTelemetry = {
  assetId: string;
  metric: string;
  value: number;
  unit: string;
  quality: number;
  occurredAt: string;
  source: AdapterSource;
};

export type OperationsSnapshot = {
  generatedAt: string;
  dataMode: "live" | "demo";
  storage: "d1" | "fallback";
  ingestReady: boolean;
  adapters: AdapterOperationalState[];
  events: NormalizedOperationEvent[];
  telemetry: LatestTelemetry[];
  summary: {
    accepted24h: number;
    duplicates24h: number;
    online: number;
    total: number;
    lastIngestAt: string | null;
  };
};

function secondsAgo(now: Date, seconds: number) {
  return new Date(now.getTime() - seconds * 1_000).toISOString();
}

export function getDemoOperationsSnapshot(now = new Date()): OperationsSnapshot {
  const generatedAt = now.toISOString();
  const events: NormalizedOperationEvent[] = [
    {
      id: "demo-scada-0819",
      source: "scada",
      externalId: "scada-wm042-20260819T104211",
      eventType: "telemetry",
      assetId: "WM-042",
      occurredAt: secondsAgo(now, 24),
      receivedAt: secondsAgo(now, 23),
      checksum: "7b10e9461a2574c89443fb5bcb6f3801bb501ac38490455d25b4cf86b49bb962",
      deliveryCount: 1,
      quality: "valid",
      summary: "Давление 4.1 → 2.8 bar за 8 минут",
      payload: { metric: "pressure", value: 2.8, unit: "bar", quality: 99.7, deltaPercent: -31 },
    },
    {
      id: "demo-109-1942",
      source: "109",
      externalId: "109-call-1942",
      eventType: "citizen_report",
      assetId: "WM-042",
      occurredAt: secondsAgo(now, 62),
      receivedAt: secondsAgo(now, 58),
      checksum: "33f3b71de665abf6ef77cb839b899d90f05e7b3aeea44c9b21c668f882725571",
      deliveryCount: 1,
      quality: "valid",
      summary: "Вода выходит на дорогу возле дома 17",
      payload: { channel: "call", district: "Алматы", latitude: 51.1218, longitude: 71.4924 },
    },
    {
      id: "demo-eotinish-62031",
      source: "eotinish",
      externalId: "eotinish-62031",
      eventType: "citizen_report",
      assetId: "WM-042",
      occurredAt: secondsAgo(now, 108),
      receivedAt: secondsAgo(now, 101),
      checksum: "a86a7a3c547b7a2d95b6ec2c6ab98a758b390f642a508e6bfe75d98815569d1b",
      deliveryCount: 2,
      quality: "valid",
      summary: "Фото и координаты совпали с аварийной зоной",
      payload: { attachments: 1, district: "Алматы", radiusMatchMeters: 84 },
    },
    {
      id: "demo-gis-4407",
      source: "gis",
      externalId: "gis-release-4407",
      eventType: "gis_update",
      assetId: "PS-104",
      occurredAt: secondsAgo(now, 18 * 60),
      receivedAt: secondsAgo(now, 18 * 60 - 3),
      checksum: "3dd655c15a31e13c0b126b2a2ca81df2809933e82425f8792e54e0a07f45a270",
      deliveryCount: 1,
      quality: "valid",
      summary: "Паспорт насосной станции синхронизирован",
      payload: { revision: 4407, geometry: "LineString", changedFields: 3 },
    },
  ];

  const adapterTimes: Record<AdapterSource, number> = {
    scada: 24,
    "109": 62,
    eotinish: 108,
    gis: 18 * 60,
  };
  const adapterCounts: Record<AdapterSource, number> = {
    scada: 1128,
    "109": 93,
    eotinish: 41,
    gis: 126,
  };
  const adapterLatency: Record<AdapterSource, number> = {
    scada: 820,
    "109": 1_420,
    eotinish: 3_800,
    gis: 12_400,
  };

  return {
    generatedAt,
    dataMode: "demo",
    storage: "fallback",
    ingestReady: false,
    adapters: adapterCatalog.map((adapter) => ({
      source: adapter.source,
      label: adapter.title,
      transport: adapter.transport,
      status: "online",
      lastEventAt: secondsAgo(now, adapterTimes[adapter.source]),
      latencyMs: adapterLatency[adapter.source],
      successRate: adapter.source === "eotinish" ? 99.2 : 99.8,
      consecutiveErrors: 0,
      received24h: adapterCounts[adapter.source],
    })),
    events,
    telemetry: [
      { assetId: "WM-042", metric: "pressure", value: 2.8, unit: "bar", quality: 99.7, occurredAt: events[0].occurredAt, source: "scada" },
      { assetId: "EL-016", metric: "voltage", value: 32.4, unit: "kV", quality: 99.9, occurredAt: secondsAgo(now, 31), source: "scada" },
      { assetId: "GS-009", metric: "gas_pressure", value: 0.62, unit: "MPa", quality: 99.9, occurredAt: secondsAgo(now, 38), source: "scada" },
    ],
    summary: {
      accepted24h: 1_388,
      duplicates24h: 17,
      online: 4,
      total: 4,
      lastIngestAt: events[0].receivedAt,
    },
  };
}
