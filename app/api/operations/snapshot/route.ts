import {
  adapterCatalog,
  getDemoOperationsSnapshot,
  type AdapterSource,
  type AdapterStatus,
  type NormalizedOperationEvent,
  type OperationEventType,
  type OperationsSnapshot,
} from "@/lib/operations-contract";

export const dynamic = "force-dynamic";

type AdapterStateRow = {
  source: string;
  label: string;
  transport: string;
  status: string;
  last_event_at: string | null;
  latency_ms: number;
  success_rate: number;
  consecutive_errors: number;
};

type EventRow = {
  id: number;
  source: string;
  external_id: string;
  event_type: string;
  asset_id: string | null;
  occurred_at: string;
  received_at: string;
  payload_json: string;
  checksum: string;
  quality: string;
  summary: string;
  delivery_count: number;
};

type TelemetryRow = {
  asset_id: string;
  metric: string;
  value: number;
  unit: string;
  quality: number;
  occurred_at: string;
  source: string;
};

type CountRow = { source: string; received_24h: number };
type SummaryRow = {
  accepted_24h: number;
  duplicates_24h: number;
  last_ingest_at: string | null;
};

const sources = new Set<AdapterSource>(adapterCatalog.map((adapter) => adapter.source));
const eventTypes = new Set<OperationEventType>(["telemetry", "citizen_report", "gis_update", "adapter_health"]);

function isAdapterSource(value: string): value is AdapterSource {
  return sources.has(value as AdapterSource);
}

function isEventType(value: string): value is OperationEventType {
  return eventTypes.has(value as OperationEventType);
}

function normalizeStatus(value: string): AdapterStatus {
  return value === "online" || value === "degraded" || value === "offline" ? value : "offline";
}

function normalizeDate(value: string | null): string | null {
  if (!value) return null;
  const withTimezone = value.includes("T") || /Z$|[+-]\d\d:\d\d$/.test(value)
    ? value
    : `${value.replace(" ", "T")}Z`;
  const parsed = new Date(withTimezone);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function parsePayload(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function response(snapshot: OperationsSnapshot, mode: "live" | "demo") {
  return Response.json(snapshot, {
    headers: {
      "cache-control": "no-store, max-age=0",
      "x-infra-data-mode": mode,
    },
  });
}

export async function createOperationsSnapshotResponse(database?: D1Database, configured = false) {
  const demo = getDemoOperationsSnapshot();
  if (!database) return response({ ...demo, ingestReady: configured }, "demo");

  try {
    const [stateResult, eventResult, telemetryResult, countResult, summaryResult] = await database.batch([
      database.prepare(`
        SELECT source, label, transport, status, last_event_at, latency_ms,
               success_rate, consecutive_errors
        FROM adapter_state
        ORDER BY source
      `),
      database.prepare(`
        SELECT id, source, external_id, event_type, asset_id, occurred_at,
               received_at, payload_json, checksum, quality, summary, delivery_count
        FROM adapter_events
        ORDER BY occurred_at DESC, id DESC
        LIMIT 24
      `),
      database.prepare(`
        SELECT asset_id, metric, value, unit, quality, occurred_at, source
        FROM telemetry_latest
        ORDER BY occurred_at DESC
        LIMIT 32
      `),
      database.prepare(`
        SELECT source, COUNT(*) AS received_24h
        FROM adapter_events
        WHERE received_at >= datetime('now', '-24 hours')
        GROUP BY source
      `),
      database.prepare(`
        SELECT COUNT(*) AS accepted_24h,
               COALESCE(SUM(delivery_count - 1), 0) AS duplicates_24h,
               MAX(received_at) AS last_ingest_at
        FROM adapter_events
        WHERE received_at >= datetime('now', '-24 hours')
      `),
    ]);

    const stateRows = stateResult.results as unknown as AdapterStateRow[];
    const eventRows = eventResult.results as unknown as EventRow[];
    const telemetryRows = telemetryResult.results as unknown as TelemetryRow[];
    const countRows = countResult.results as unknown as CountRow[];
    const summaryRow = (summaryResult.results as unknown as SummaryRow[])[0];

    if (stateRows.length === 0 && eventRows.length === 0) {
      return response({ ...demo, storage: "d1", ingestReady: configured }, "demo");
    }

    const stateBySource = new Map(stateRows.filter((row) => isAdapterSource(row.source)).map((row) => [row.source, row]));
    const countBySource = new Map(countRows.filter((row) => isAdapterSource(row.source)).map((row) => [row.source, Number(row.received_24h)]));
    const adapters = adapterCatalog.map((adapter) => {
      const stored = stateBySource.get(adapter.source);
      return {
        source: adapter.source,
        label: stored?.label ?? adapter.title,
        transport: stored?.transport ?? adapter.transport,
        status: stored ? normalizeStatus(stored.status) : "offline" as const,
        lastEventAt: normalizeDate(stored?.last_event_at ?? null),
        latencyMs: Number(stored?.latency_ms ?? 0),
        successRate: Number(stored?.success_rate ?? 0),
        consecutiveErrors: Number(stored?.consecutive_errors ?? 0),
        received24h: countBySource.get(adapter.source) ?? 0,
      };
    });

    const events: NormalizedOperationEvent[] = eventRows.flatMap((row) => {
      if (!isAdapterSource(row.source) || !isEventType(row.event_type)) return [];
      return [{
        id: String(row.id),
        source: row.source,
        externalId: row.external_id,
        eventType: row.event_type,
        assetId: row.asset_id,
        occurredAt: normalizeDate(row.occurred_at) ?? row.occurred_at,
        receivedAt: normalizeDate(row.received_at) ?? row.received_at,
        checksum: row.checksum,
        deliveryCount: Number(row.delivery_count),
        quality: row.quality === "warning" || row.quality === "rejected" ? row.quality : "valid",
        summary: row.summary,
        payload: parsePayload(row.payload_json),
      }];
    });

    const telemetry = telemetryRows.flatMap((row) => {
      if (!isAdapterSource(row.source)) return [];
      return [{
        assetId: row.asset_id,
        metric: row.metric,
        value: Number(row.value),
        unit: row.unit,
        quality: Number(row.quality),
        occurredAt: normalizeDate(row.occurred_at) ?? row.occurred_at,
        source: row.source,
      }];
    });
    const online = adapters.filter((adapter) => adapter.status === "online").length;

    const snapshot: OperationsSnapshot = {
      generatedAt: new Date().toISOString(),
      dataMode: "live",
      storage: "d1",
      ingestReady: configured,
      adapters,
      events,
      telemetry,
      summary: {
        accepted24h: Number(summaryRow?.accepted_24h ?? 0),
        duplicates24h: Number(summaryRow?.duplicates_24h ?? 0),
        online,
        total: adapters.length,
        lastIngestAt: normalizeDate(summaryRow?.last_ingest_at ?? null),
      },
    };

    return response(snapshot, "live");
  } catch {
    return response({ ...demo, ingestReady: configured }, "demo");
  }
}

export async function GET() {
  return createOperationsSnapshotResponse();
}
