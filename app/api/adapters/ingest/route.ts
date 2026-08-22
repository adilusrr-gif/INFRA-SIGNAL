import {
  adapterCatalog,
  type AdapterSource,
  type OperationEventType,
} from "@/lib/operations-contract";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 128_000;
const MAX_BATCH_SIZE = 100;
const MAX_EVENT_AGE_MS = 90 * 24 * 60 * 60 * 1_000;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1_000;
const sourceNames = new Set<AdapterSource>(adapterCatalog.map((adapter) => adapter.source));
const eventTypes = new Set<OperationEventType>(["telemetry", "citizen_report", "gis_update", "adapter_health"]);

type RawEnvelope = {
  source?: unknown;
  external_id?: unknown;
  externalId?: unknown;
  occurred_at?: unknown;
  occurredAt?: unknown;
  asset_id?: unknown;
  assetId?: unknown;
  event_type?: unknown;
  eventType?: unknown;
  summary?: unknown;
  payload?: unknown;
};

type NormalizedEnvelope = {
  source: AdapterSource;
  externalId: string;
  eventType: OperationEventType;
  assetId: string | null;
  occurredAt: string;
  receivedAt: string;
  payload: Record<string, unknown>;
  payloadJson: string;
  checksum: string;
  quality: "valid" | "warning";
  summary: string;
};

function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return Response.json({ error: { code, message, details } }, { status });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sameSecret(left: string, right: string) {
  const [leftHash, rightHash] = await Promise.all([sha256(left), sha256(right)]);
  let difference = leftHash.length ^ rightHash.length;
  const length = Math.max(leftHash.length, rightHash.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (leftHash.charCodeAt(index) || 0) ^ (rightHash.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function requestSecret(request: Request) {
  const direct = request.headers.get("x-infra-adapter-key")?.trim();
  if (direct) return direct;
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  return authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
}

function textField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function defaultSummary(eventType: OperationEventType, payload: Record<string, unknown>) {
  if (eventType === "telemetry") {
    return `${textField(payload.metric) || "telemetry"}: ${String(payload.value ?? "—")} ${textField(payload.unit)}`.trim();
  }
  if (eventType === "citizen_report") return textField(payload.message) || "Получено обращение жителя";
  if (eventType === "gis_update") return "Получено обновление GIS-реестра";
  return "Получен heartbeat адаптера";
}

function validateCoordinates(payload: Record<string, unknown>) {
  const latitude = payload.latitude;
  const longitude = payload.longitude;
  if (latitude === undefined && longitude === undefined) return null;
  if (typeof latitude !== "number" || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return "payload.latitude must be a finite number between -90 and 90";
  }
  if (typeof longitude !== "number" || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return "payload.longitude must be a finite number between -180 and 180";
  }
  return null;
}

async function normalizeEnvelope(raw: unknown, index: number, receivedAt: string): Promise<{ event?: NormalizedEnvelope; errors: string[] }> {
  const prefix = `events[${index}]`;
  if (!isObject(raw)) return { errors: [`${prefix} must be an object`] };
  const input = raw as RawEnvelope;
  const errors: string[] = [];

  const sourceValue = textField(input.source);
  const source = sourceNames.has(sourceValue as AdapterSource) ? sourceValue as AdapterSource : null;
  if (!source) errors.push(`${prefix}.source must be one of scada, 109, eotinish, gis`);

  const externalId = textField(input.external_id ?? input.externalId);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{2,127}$/.test(externalId)) {
    errors.push(`${prefix}.external_id must be 3–128 safe identifier characters`);
  }

  const eventTypeValue = textField(input.event_type ?? input.eventType);
  const eventType = eventTypes.has(eventTypeValue as OperationEventType) ? eventTypeValue as OperationEventType : null;
  if (!eventType) errors.push(`${prefix}.event_type is unsupported`);

  const occurredValue = textField(input.occurred_at ?? input.occurredAt);
  const occurredDate = new Date(occurredValue);
  const occurredMs = occurredDate.getTime();
  const receivedMs = new Date(receivedAt).getTime();
  if (!occurredValue || Number.isNaN(occurredMs)) {
    errors.push(`${prefix}.occurred_at must be a valid ISO-8601 timestamp`);
  } else if (occurredMs > receivedMs + MAX_CLOCK_SKEW_MS) {
    errors.push(`${prefix}.occurred_at is more than 5 minutes in the future`);
  } else if (occurredMs < receivedMs - MAX_EVENT_AGE_MS) {
    errors.push(`${prefix}.occurred_at is older than 90 days`);
  }

  const assetValue = input.asset_id ?? input.assetId;
  const assetId = assetValue === undefined || assetValue === null ? null : textField(assetValue);
  if (assetId !== null && !/^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$/.test(assetId)) {
    errors.push(`${prefix}.asset_id must be 2–64 safe identifier characters`);
  }

  const payload = isObject(input.payload) ? input.payload : null;
  if (!payload) errors.push(`${prefix}.payload must be an object`);
  const payloadJson = payload ? JSON.stringify(payload) : "{}";
  if (payloadJson.length > 64_000) errors.push(`${prefix}.payload exceeds 64 KB`);

  if (payload && eventType === "telemetry") {
    if (!textField(payload.metric)) errors.push(`${prefix}.payload.metric is required for telemetry`);
    if (typeof payload.value !== "number" || !Number.isFinite(payload.value)) errors.push(`${prefix}.payload.value must be finite for telemetry`);
    if (!textField(payload.unit)) errors.push(`${prefix}.payload.unit is required for telemetry`);
  }
  if (payload) {
    const coordinateError = validateCoordinates(payload);
    if (coordinateError) errors.push(`${prefix}.${coordinateError}`);
  }

  const summary = textField(input.summary) || (eventType && payload ? defaultSummary(eventType, payload) : "");
  if (summary.length > 240) errors.push(`${prefix}.summary exceeds 240 characters`);

  if (errors.length || !source || !eventType || !payload || Number.isNaN(occurredMs)) return { errors };
  const occurredAt = occurredDate.toISOString();
  const qualityNumber = typeof payload.quality === "number" ? payload.quality : 100;
  const quality = qualityNumber < 90 ? "warning" as const : "valid" as const;
  const checksum = await sha256(canonicalJson({ source, externalId, eventType, assetId, occurredAt, payload }));

  return {
    errors: [],
    event: { source, externalId, eventType, assetId, occurredAt, receivedAt, payload, payloadJson, checksum, quality, summary },
  };
}

export async function handleAdapterIngest(request: Request, database?: D1Database, secret?: string) {
  const expectedSecret = typeof secret === "string" && secret.length >= 24 ? secret : null;
  if (!expectedSecret) {
    return errorResponse(503, "INGEST_NOT_CONFIGURED", "Ingest is locked until INFRA_ADAPTER_KEY is configured on the server.");
  }
  const suppliedSecret = requestSecret(request);
  if (!suppliedSecret || !(await sameSecret(suppliedSecret, expectedSecret))) {
    return errorResponse(401, "INVALID_ADAPTER_KEY", "A valid adapter key is required.");
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    return errorResponse(415, "UNSUPPORTED_MEDIA_TYPE", "Use application/json.");
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return errorResponse(413, "PAYLOAD_TOO_LARGE", `Request body exceeds ${MAX_BODY_BYTES} bytes.`);
  }

  let body: unknown;
  try {
    const rawText = await request.text();
    if (new TextEncoder().encode(rawText).byteLength > MAX_BODY_BYTES) {
      return errorResponse(413, "PAYLOAD_TOO_LARGE", `Request body exceeds ${MAX_BODY_BYTES} bytes.`);
    }
    body = JSON.parse(rawText) as unknown;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body is not valid JSON.");
  }

  const candidates = isObject(body) && Array.isArray(body.events) ? body.events : [body];
  if (candidates.length === 0 || candidates.length > MAX_BATCH_SIZE) {
    return errorResponse(422, "INVALID_BATCH_SIZE", `Batch must contain 1–${MAX_BATCH_SIZE} events.`);
  }

  const receivedAt = new Date().toISOString();
  const normalized = await Promise.all(candidates.map((candidate, index) => normalizeEnvelope(candidate, index, receivedAt)));
  const validationErrors = normalized.flatMap((result) => result.errors);
  if (validationErrors.length) {
    return errorResponse(422, "VALIDATION_FAILED", "No events were written.", validationErrors.slice(0, 30));
  }
  const events = normalized.flatMap((result) => result.event ? [result.event] : []);
  if (!database) {
    return errorResponse(503, "STORAGE_UNAVAILABLE", "Persistent storage is temporarily unavailable.");
  }

  try {
    const insertResults = await database.batch(events.map((event) => database.prepare(`
      INSERT INTO adapter_events (
        source, external_id, event_type, asset_id, occurred_at, received_at,
        payload_json, checksum, quality, summary, delivery_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT(source, external_id) DO NOTHING
      RETURNING id
    `).bind(
      event.source,
      event.externalId,
      event.eventType,
      event.assetId,
      event.occurredAt,
      event.receivedAt,
      event.payloadJson,
      event.checksum,
      event.quality,
      event.summary,
    )));

    const accepted = events.filter((_, index) => insertResults[index].results.length > 0);
    const duplicates = events.filter((_, index) => insertResults[index].results.length === 0);

    if (duplicates.length) {
      await database.batch(duplicates.map((event) => database.prepare(`
        UPDATE adapter_events
        SET delivery_count = delivery_count + 1
        WHERE source = ? AND external_id = ?
      `).bind(event.source, event.externalId)));
    }

    const newestBySource = new Map<AdapterSource, NormalizedEnvelope>();
    for (const event of events) {
      const current = newestBySource.get(event.source);
      if (!current || event.occurredAt > current.occurredAt) newestBySource.set(event.source, event);
    }
    const stateStatements = Array.from(newestBySource.values()).map((event) => {
      const catalog = adapterCatalog.find((item) => item.source === event.source)!;
      const latencyMs = Math.max(0, new Date(event.receivedAt).getTime() - new Date(event.occurredAt).getTime());
      const degradedAfterMs: Record<AdapterSource, number> = { scada: 120_000, "109": 300_000, eotinish: 900_000, gis: 3_600_000 };
      const status = latencyMs > degradedAfterMs[event.source] ? "degraded" : "online";
      return database.prepare(`
        INSERT INTO adapter_state (
          source, label, transport, status, last_event_at, latency_ms,
          success_rate, consecutive_errors, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 100, 0, ?)
        ON CONFLICT(source) DO UPDATE SET
          label = excluded.label,
          transport = excluded.transport,
          status = excluded.status,
          last_event_at = excluded.last_event_at,
          latency_ms = excluded.latency_ms,
          success_rate = excluded.success_rate,
          consecutive_errors = 0,
          updated_at = excluded.updated_at
      `).bind(event.source, catalog.title, catalog.transport, status, event.occurredAt, latencyMs, receivedAt);
    });

    const telemetryStatements = accepted.flatMap((event) => {
      if (event.eventType !== "telemetry" || !event.assetId) return [];
      const metric = textField(event.payload.metric);
      const unit = textField(event.payload.unit);
      const value = event.payload.value;
      if (!metric || !unit || typeof value !== "number") return [];
      const quality = typeof event.payload.quality === "number" ? event.payload.quality : 100;
      return [database.prepare(`
        INSERT INTO telemetry_latest (
          asset_id, metric, value, unit, quality, occurred_at, source, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(asset_id, metric) DO UPDATE SET
          value = excluded.value,
          unit = excluded.unit,
          quality = excluded.quality,
          occurred_at = excluded.occurred_at,
          source = excluded.source,
          updated_at = excluded.updated_at
        WHERE excluded.occurred_at >= telemetry_latest.occurred_at
      `).bind(event.assetId, metric, value, unit, quality, event.occurredAt, event.source, receivedAt)];
    });

    const followupStatements = [...stateStatements, ...telemetryStatements];
    if (followupStatements.length) await database.batch(followupStatements);

    return Response.json({
      receivedAt,
      accepted: accepted.length,
      duplicates: duplicates.length,
      rejected: 0,
      results: events.map((event, index) => ({
        source: event.source,
        externalId: event.externalId,
        status: insertResults[index].results.length > 0 ? "accepted" : "duplicate",
        checksum: event.checksum,
      })),
    }, { status: 202, headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database write failed";
    return errorResponse(503, "STORAGE_UNAVAILABLE", message.includes("no such table")
      ? "Storage schema is not ready. Deploy the generated D1 migration before ingesting events."
      : "Persistent storage is temporarily unavailable.");
  }
}

export async function POST(request: Request) {
  return handleAdapterIngest(request);
}
