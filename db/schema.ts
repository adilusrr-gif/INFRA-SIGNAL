import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const adapterEvents = sqliteTable("adapter_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  source: text("source").notNull(),
  externalId: text("external_id").notNull(),
  eventType: text("event_type").notNull(),
  assetId: text("asset_id"),
  occurredAt: text("occurred_at").notNull(),
  receivedAt: text("received_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  payloadJson: text("payload_json").notNull(),
  checksum: text("checksum").notNull(),
  quality: text("quality").notNull().default("valid"),
  summary: text("summary").notNull(),
  deliveryCount: integer("delivery_count").notNull().default(1),
}, (table) => [
  uniqueIndex("adapter_events_source_external_id_uq").on(table.source, table.externalId),
  index("adapter_events_received_at_idx").on(table.receivedAt),
  index("adapter_events_asset_occurred_idx").on(table.assetId, table.occurredAt),
]);

export const adapterState = sqliteTable("adapter_state", {
  source: text("source").primaryKey(),
  label: text("label").notNull(),
  transport: text("transport").notNull(),
  status: text("status").notNull().default("offline"),
  lastEventAt: text("last_event_at"),
  latencyMs: integer("latency_ms").notNull().default(0),
  successRate: real("success_rate").notNull().default(100),
  consecutiveErrors: integer("consecutive_errors").notNull().default(0),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const telemetryLatest = sqliteTable("telemetry_latest", {
  assetId: text("asset_id").notNull(),
  metric: text("metric").notNull(),
  value: real("value").notNull(),
  unit: text("unit").notNull(),
  quality: real("quality").notNull().default(100),
  occurredAt: text("occurred_at").notNull(),
  source: text("source").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  primaryKey({ columns: [table.assetId, table.metric] }),
  index("telemetry_latest_occurred_at_idx").on(table.occurredAt),
]);
