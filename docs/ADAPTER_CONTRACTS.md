# Adapter contracts

All endpoints below belong to Infra Incident AI unless explicitly marked. The
core can run with every adapter disabled.

## SCADA or telemetry push

`POST /api/v1/telemetry`

```json
{
  "asset_id": "asset_water_042",
  "metric": "pressure",
  "value": 2.74,
  "unit": "bar",
  "captured_at": "2026-08-18T08:15:00Z",
  "source": "scada_gateway"
}
```

For a pilot, the gateway must map the utility asset identifier to the registered
asset. Duplicate delivery and signed-source handling belong in the durable
repository milestone.

## Citizen or operator report

`POST /api/v1/reports`

```json
{
  "text": "Абай көшесінде су ағып жатыр",
  "channel": "eotinish",
  "latitude": 53.2872,
  "longitude": 69.3892,
  "address": "Абай көшесі, 76",
  "source_reference": "EOT-2026-42"
}
```

## GIS asset registry

`POST /api/v1/integrations/gis/import` accepts a multipart `file` containing
CSV or GeoJSON and an optional `dry_run` form field. Dry-run is enabled by
default and validates the complete file without modifying the asset registry.

Required asset fields are `external_id`, `name`, `asset_type`, `latitude`,
`longitude`, `commissioned_year` and `district`. Optional fields are
`criticality` (default `50`) and `state` (default `normal`). Supported asset
types are `water_main`, `heating_main`, `electric_substation` and
`sewer_collector`.

For CSV, additional columns prefixed with `property.` are retained as asset
metadata. For GeoJSON, each item must be a Point feature; coordinates supply
longitude and latitude, while all fields above are read from `properties`.
Unknown GeoJSON properties are retained as metadata.

```bash
# Validate only
curl -X POST http://localhost:8080/api/v1/integrations/gis/import \
  -F "file=@examples/gis/assets.csv" \
  -F "dry_run=true"

# Apply after a successful validation
curl -X POST http://localhost:8080/api/v1/integrations/gis/import \
  -F "file=@examples/gis/assets.csv" \
  -F "dry_run=false"
```

The import is atomic: one invalid row rejects the entire file. Applying a valid
file creates or updates assets by utility-owned `external_id` and preserves the
internal ID of an existing asset. Replaying an unchanged file is idempotent.
The API limits each request to 5 MB and 5,000 assets. Production deployment must
restrict this endpoint to authorised registry administrators and record the
operator identity in a durable audit log.

## Callcentrai

The proposed boundary is `POST {CALLCENTER_BASE_URL}/api/v1/transcribe` with a
multipart `audio` field and optional `language_hint`. A bearer token is sent when
configured. Expected response:

```json
{
  "text": "...",
  "language": "kz",
  "confidence": 0.94,
  "engine": "callcentrai"
}
```

Validate this proposed contract against the deployed voice API before integration
testing. Text transcripts can already be pushed directly to
`POST /api/v1/reports/voice-transcript`.

## KENCE

The adapter matches the inspected KENCE `master` contract:
`POST {KENCE_BASE_URL}/api/chat` with bearer authentication.

```json
{
  "session_id": "preloaded-utility-playbook-session",
  "question": "Какие шаги требует регламент при падении давления?",
  "language": "ru"
}
```

KENCE returns `answer` and `session_id`. Configure `KENCE_BASE_URL`,
`KENCE_API_TOKEN` and `KENCE_SESSION_ID`, then call
`POST /api/v1/guidance/kence`. Its answer is advisory only and does not enter the
deterministic incident score or trigger an action.

## Operational status

`GET /api/v1/health` reports whether Callcentrai and KENCE are configured and
lists the locally available GIS import formats, but never returns URLs, tokens
or session identifiers.
