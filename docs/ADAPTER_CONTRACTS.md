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

`GET /api/v1/health` reports whether Callcentrai and KENCE are configured, but
never returns URLs, tokens or session identifiers.
