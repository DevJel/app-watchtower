# Product requirements

## Intended operator
One owner monitoring applications they control. Multi-user organizations are out of initial scope.

## P0 — monitoring vertical slice
- Register owned apps and approved public HTTPS endpoints.
- Owner authentication and app-scoped ingestion credentials.
- Scheduled status/latency checks and expected-status assertions.
- Explicit HEALTHY / FAILING / UNKNOWN health states.
- Configurable failure/recovery thresholds and one active incident per monitor.
- Alert on incident open/recovery, with deduplication and delivery history.
- Probe/scheduler health visibility and independent external monitoring.

## P1 — integrations and operations
- Signed GitHub webhook ingestion for selected repositories.
- Workflow failure/deployment context and source references.
- Heartbeat ingestion and missed-heartbeat alerts.
- Maintenance windows, audit events, retention, export/restore runbooks.

## P2 — optional AI and evidence
- AI request metadata without prompt/response capture by default.
- Advisory incident summaries with source events, budget limits, and manual review.
- Evidence manifests and owner/reviewer workflow after ISO scope confirmation.

## Sizing inputs
Before implementation record number of apps, monitors per app, interval, expected event rate, payload cap, retention, acceptable detection delay, alert destination, and monthly spend limit. Do not extrapolate capacity or SLA from this document.

## Exclusions
No autonomous remediation, shell access, arbitrary scanning, enterprise compliance suite, general log lake, or billing system.

## Requested dashboard UI
See [ui-dashboard.md](ui-dashboard.md) for the full spec: light default, top-header dark-mode switch, persisted theme, screenshot-inspired operational panel grid, live/freshness status, consistent filters/time controls, health and performance panels, incidents, GitHub/AI integration states, and a safe searchable event table. UI completion includes desktop/mobile, both themes, accessibility, reconnection, stale/error states, and real-data verification. This is a specification, not implemented functionality.
