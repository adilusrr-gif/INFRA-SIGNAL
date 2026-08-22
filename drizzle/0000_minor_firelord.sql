CREATE TABLE `adapter_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`external_id` text NOT NULL,
	`event_type` text NOT NULL,
	`asset_id` text,
	`occurred_at` text NOT NULL,
	`received_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`payload_json` text NOT NULL,
	`checksum` text NOT NULL,
	`quality` text DEFAULT 'valid' NOT NULL,
	`summary` text NOT NULL,
	`delivery_count` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `adapter_events_source_external_id_uq` ON `adapter_events` (`source`,`external_id`);--> statement-breakpoint
CREATE INDEX `adapter_events_received_at_idx` ON `adapter_events` (`received_at`);--> statement-breakpoint
CREATE INDEX `adapter_events_asset_occurred_idx` ON `adapter_events` (`asset_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `adapter_state` (
	`source` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`transport` text NOT NULL,
	`status` text DEFAULT 'offline' NOT NULL,
	`last_event_at` text,
	`latency_ms` integer DEFAULT 0 NOT NULL,
	`success_rate` real DEFAULT 100 NOT NULL,
	`consecutive_errors` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `telemetry_latest` (
	`asset_id` text NOT NULL,
	`metric` text NOT NULL,
	`value` real NOT NULL,
	`unit` text NOT NULL,
	`quality` real DEFAULT 100 NOT NULL,
	`occurred_at` text NOT NULL,
	`source` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`asset_id`, `metric`)
);
--> statement-breakpoint
CREATE INDEX `telemetry_latest_occurred_at_idx` ON `telemetry_latest` (`occurred_at`);