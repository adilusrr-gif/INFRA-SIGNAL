# MVP and pilot backlog

## Done in the current vertical slice

- Deterministic telemetry anomaly detection.
- RU/KZ report analysis with local Ollama as an optional enhancement.
- Geo/time/asset correlation into one incident.
- Explainable risk, confidence and evidence metadata.
- Cited local playbook retrieval and human approval gate.
- Crew recommendation and dispatcher-controlled status transitions.
- Callcentrai and KENCE adapter boundaries.
- Responsive dispatcher UI and repeatable water-leak scenario.
- Unit tests, container definitions and CI workflow.

## Next 72 hours

1. Reconcile the Callcentrai transcription adapter against the deployed voice API.
2. Run the complete Docker build and browser smoke test on a machine with registry access.
3. Replace the synthetic playbook with an approved, non-sensitive utility procedure.
4. Record a three-minute RU demo and capture the pilot KPI baseline sheet.
5. Select the final product name after trademark/domain and accelerator-entry checks.

## Before a real 30-day pilot

- PostgreSQL/PostGIS persistence, migrations and idempotency keys.
- Identity, dispatcher/administrator RBAC and immutable decision audit.
- Connector authentication, TLS, allow-listed egress and secret rotation.
- Historical replay against labelled incidents and threshold calibration.
- Data retention, consent/redaction for voice and citizen-report fields.
- Monitoring for connector lag, model availability, drift and false positives.
- Load and failure testing, backups and an operator runbook.

## Explicit gates

| Gate | Exit criterion |
|---|---|
| Demo-ready | Core tests green; UI scenario completes without external AI |
| Integration-ready | Real adapter fixtures pass without production credentials in CI |
| Pilot-ready | Security/RBAC/persistence complete; utility signs data and procedure scope |
| Production-ready | Measured accuracy/SLA, disaster recovery and operational ownership agreed |
