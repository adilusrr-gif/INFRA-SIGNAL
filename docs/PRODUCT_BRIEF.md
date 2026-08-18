# Product brief: municipal incident early warning

## The pain

Utility dispatchers see fragments of the same event in different systems:
SCADA deviations, 109 calls, web forms, e-Өтініш messages and maintenance
documents. Humans must manually decide whether those fragments are duplicates,
where the fault is and which procedure applies. That costs the most important
minutes before an incident becomes visible and actionable.

The narrow MVP problem is: **detect a probable water-network incident before
the dispatcher has manually assembled the evidence**.

## The solution

An integration intelligence layer that:

1. detects a robust deviation in infrastructure telemetry;
2. classifies Russian and Kazakh reports locally;
3. links signals by time, location and infrastructure type;
4. produces one incident card with confidence, evidence and probable cause;
5. retrieves response steps with document and section references;
6. recommends an available specialised crew;
7. waits for a dispatcher to confirm every operational action.

The first wedge is water leakage and low pressure. Heating, power and sewer
events already exist in the domain model but are not claimed as pilot-ready.

## Who uses it

- Primary user: municipal or utility dispatcher.
- Operational buyer: water utility or city situational centre.
- Data partners: SCADA/IoT owner, 109 service, e-Өтініш integration owner.
- Affected citizen: receives a faster, less fragmented response.

## Why AI is justified

AI handles language variation, short noisy messages and unstructured operating
documents. It does not calculate sensor anomalies or execute control commands.
Risk scoring remains deterministic and auditable; local AI is an enhancement
with a safe rules-based fallback.

## Demo acceptance criteria

- A normal pressure series creates no incident.
- A large pressure drop creates a telemetry signal.
- RU and KZ reports from the same zone join that incident instead of duplicating it.
- The card shows every source, its time, correlation confidence and risk score.
- Recommendations include a source and section.
- A crew is not assigned until the dispatcher clicks confirmation.
- The demo works with Ollama, KENCE and Callcentrai all disconnected.

## Pilot metrics

Baselines must be measured with the utility rather than invented. The pilot will
compare:

- median time from first machine/citizen signal to dispatcher-visible incident;
- share of duplicate reports merged correctly;
- false-positive rate and dispatcher rejection rate;
- time from confirmation to crew assignment;
- percentage of recommendations with a traceable procedure source;
- RU/KZ classification accuracy on an agreed labelled sample.

## What this MVP is not

- It is not a new citizen complaints portal.
- It is not a SCADA replacement or industrial controller.
- It does not autonomously close valves, switch feeders or dispatch crews.
- It does not claim predictive maintenance from synthetic demo data.
- It remains deployable without external AI or voice services.
