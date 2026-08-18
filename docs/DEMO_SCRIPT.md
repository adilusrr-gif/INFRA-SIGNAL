# Three-minute demo script

## Setup

Open the dashboard at `http://localhost:8088`. Keep Ollama and both external
adapters disabled to prove the core works locally and deterministically.

## 0:00–0:30 — the operational pain

“A dispatcher currently sees a pressure deviation in one system and several RU
or KZ complaints in other systems. The same accident looks like unrelated
signals. We turn them into one decision-ready incident.”

Show the empty map, three infrastructure assets and zero active incidents.

## 0:30–1:20 — run the scenario

Click **Запустить аварию**. Explain the sequence visible in the timeline:

1. twelve normal pressure readings establish a baseline;
2. pressure drops from about 4.2 to 3.6, 2.7 and 1.9 bar;
3. a Russian low-pressure report arrives;
4. a Kazakh 109 transcript reports a burst pipe;
5. an e-Өтініш report confirms flooding in the same area.

## 1:20–2:15 — show explainability

Open the incident card. Point to:

- one incident instead of four separate tickets;
- critical risk and cross-source confidence;
- telemetry, voice transcript and citizen reports as independent evidence;
- the distance from each report to the linked infrastructure object;
- the probable cause written as a hypothesis, not a fact;
- response steps with a named playbook and section.

## 2:15–2:45 — human control

Show the recommended water crew. Emphasise that the system has not dispatched
it. Click **Подтвердить бригаду**, then **Принять в работу**. The timeline records
both operator actions.

## 2:45–3:00 — pilot ask

“For a 30-day pilot we need an anonymised telemetry export for one water zone,
historical incident labels, one dispatcher and the local procedures. We will
measure lead time and false positives against the existing process.”

## Recovery

If any external AI or adapter is unavailable, keep presenting: the demo uses the
safe deterministic classifier and bundled playbooks. Click **Сбросить** to return
to the initial state.
