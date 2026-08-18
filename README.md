# INFRA SIGNAL

Clean-room MVP of a local AI early-warning layer for municipal utility incidents.
The product correlates telemetry anomalies, bilingual citizen reports and
operational playbooks into one explainable incident for a dispatcher.

`INFRA SIGNAL` is the working product name. The MVP is maintained as a
standalone service and connects to document and voice systems only through
optional adapters.

## Demonstrated outcome

The bundled scenario simulates a water-main pressure drop followed by Russian
and Kazakh reports. The system:

1. detects the deterministic telemetry anomaly;
2. links reports to the nearest compatible infrastructure asset;
3. correlates all evidence into one incident;
4. calculates risk and confidence;
5. retrieves cited response steps from a local playbook;
6. recommends a crew and exposes the result in a dispatcher dashboard.

## Current milestone

- Domain model for assets, telemetry, reports, incidents, evidence and crews.
- Deterministic robust anomaly detection; no LLM is trusted with sensor math.
- RU/KZ report classification with an optional local Ollama enhancement.
- Cross-source incident correlation and explainable risk scoring.
- Local playbook retrieval with source citations.
- Optional, isolated adapters for Callcentrai transcription and a KENCE document session.
- Standalone FastAPI API and React dispatcher UI.
- Reproducible leak demo and standard-library unit tests.

## Run the verified core

The domain tests use only the Python standard library:

```bash
make verify
```

## Run the full application

```bash
cp .env.example .env
docker compose up --build
```

Open <http://localhost:8088>. API documentation is available at
<http://localhost:8080/docs>.

## Repository layout

```text
backend/
  app/core/       domain entities and settings
  app/services/   analysis, correlation, playbooks and simulation
  app/api/        HTTP schemas and routes
  tests/          deterministic core tests
frontend/
  src/            dispatcher dashboard
docs/             product, architecture and demo notes
```

## Product and pilot notes

- [Product brief](docs/PRODUCT_BRIEF.md)
- [Architecture and decision boundaries](docs/ARCHITECTURE.md)
- [Three-minute demo script](docs/DEMO_SCRIPT.md)
- [Adapter contracts](docs/ADAPTER_CONTRACTS.md)
- [MVP backlog](docs/MVP_BACKLOG.md)

The name remains subject to trademark and domain checks before commercial use.

## Scope boundary

This milestone is a demonstration MVP, not a production SCADA controller. It
never writes directly to industrial equipment. Any future control action must
pass a human approval gate and a utility-specific integration adapter.
