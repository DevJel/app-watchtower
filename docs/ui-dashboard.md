# Live monitoring dashboard specification

## Status and guideline source
Requested addition to App Watchtower, based on the user's attached panel-based monitoring dashboard reference. This document is a build specification, not an implemented dashboard.

The user identified an `ISO` repository as the coding-guideline source. Searches with current GitHub access did not locate that repository, and `DevJel/ISO` was not accessible. Obtain the exact owner/repository URL and applicable guideline paths/version before runtime implementation. Do not infer that this repository name means ISO certification.

## Visual direction
Preserve the reference's operational density: global search and time controls above a panel grid, with a full-width event table below. Replace TV-program metrics with application health, API performance, incidents, deployments, and AI usage. Do not copy the reference's unrelated map, tag cloud, or pie chart merely for resemblance.

- Light is the default theme: white canvas, soft neutral surfaces, restrained borders, blue interaction accent.
- A clearly labeled Light / Dark switch sits in the top-right header; keyboard-operable, with visible focus and announced state.
- Persist the explicit preference locally; handle unavailable browser storage without breaking the dashboard. Share semantic color meaning between themes, not mechanically inverted colors.
- Healthy, failing, degraded, unknown, stale, and paused must have text labels/icons in addition to color.
- Responsive grid: desktop multi-panel view, tablet two-column where practical, mobile one-column with the same essential information. Dense tables scroll within their own region, never the whole page.
- Use a readable system font, adequate chart labels, 44px minimum control targets, and WCAG AA contrast in both themes. Respect reduced motion.

## Layout and necessary features
### Header
Watchtower name, environment, live connection status, last successful update, manual Refresh, pause/resume auto-refresh, and the Light / Dark theme switch. Do not display a fake connected badge.

### Global query bar
Application selector, environment selector, severity/status filter, text search, clear filters, and active-filter indicators. Start with a structured search UI; an advanced query language is optional, not a prerequisite.

Time presets: 5m, 15m, 1h, 6h, 12h, 24h, and 7d, plus an absolute date range and explicit timezone. Validate date order and range limits. The selected window applies consistently to relevant panels and table queries; point-in-time health is explicitly labeled as current state, not a window aggregate.

### Summary row
Configured applications and monitors, current failing/unknown monitor counts, open incidents, and last completed check. Window aggregates can include request count, error rate with request denominator, and p95 latency with sample coverage. Distinguish current gauges from windowed metrics and unavailable data from zero.

### Panel grid
1. **Application health:** compact service matrix/list with app, environment, status, latest check, latency, and active incident link. Click opens a detail view.
2. **Latency history:** p50/p95/p99 in milliseconds only where raw samples or a valid mergeable histogram exist. Missing intervals remain gaps; never average percentiles or interpolate missing observations as measured data.
3. **Traffic and errors:** request counts and error-rate history in separately labeled panels/scales. If only synthetic probes are connected, label them probe results, not real application traffic.
4. **Failure distribution:** errors by application, endpoint, or normalized error category with drill-down into the same filtered event population.
5. **Monitor timeline:** status/availability heatmap with textual legend and an accessible table alternative. Show maintenance and unknown periods distinctly.
6. **Incidents and alerts:** open/acknowledged/resolved state, severity, duration, source evidence, alert delivery status, and acknowledgement action when authorized. Do not offer unsupported production actions.
7. **GitHub delivery activity:** selected repository workflow failures, deployment state, timestamps, and source links. Show not-connected/insufficient-permission states explicitly.
8. **AI monitoring:** provider/model, latency, errors, token usage, and costs only when supplied or calculable from a versioned pricing basis. No prompt/response content by default. Advisory incident summaries are opt-in, source-linked, and never auto-execute remediation.

Do not show a region map unless a real geographic data source exists; Cloudflare hosting alone is not proof of globally distributed measurements.

### Full-width live event table
Columns: timestamp, application, environment, source/type, severity, safe message, duration where applicable, and correlation/event ID. Support sorting, cursor pagination, page size, search, drill-down detail, copy-safe event ID, and a bounded export of the same filtered population. Live inserts must not move keyboard focus or unexpectedly jump the scroll position; show a New events indicator while the user is reviewing older rows.

Export must exclude credentials and sensitive payloads, enforce authorization/limits, and neutralize spreadsheet formula injection if CSV is supported. Detail views contain only allowlisted fields and use escaped text, never raw HTML from telemetry.

## Live data behavior
- Prefer an authenticated Server-Sent Events stream for update notifications after the backend supports it; start with a documented polling adapter if simpler.
- Polling fallback proposal: every 15 seconds while visible, with backoff/jitter on failure. Dashboard refresh frequency is not probe frequency: initial probes remain five-minute checks unless configured otherwise.
- The API exposes server time, data-as-of time, last successful check, coverage, and freshness/stale thresholds. A live connection badge does not imply fresh application measurements.
- Label CONNECTING, STREAMING or POLLING, PAUSED, RECONNECTING, OFFLINE, and STALE truthfully. Use UNKNOWN when measurements are missing.
- Apply scope authorization to the stream and every API query. Do not put access tokens in stream URLs; use an approved same-origin authenticated channel.
- Resume from an event cursor where supported; deduplicate IDs and refetch after an unfillable gap. Use bounded buffers, pagination, backpressure, and abort superseded requests.
- Pause background refresh when the tab is hidden; refresh on return. A fixed historical range must not slide forward; new-event notices outside that range must be distinguished.
- A failed refresh preserves the last successful snapshot with a visible stale/error banner. Empty results, loading, unauthorized, rate-limited, integration-disabled, and partial-data states have explicit UI treatment.
- Any fixture/demo mode must display DEMO DATA prominently and never call itself live. No invented production values.

## Supporting API additions (proposed)
- GET /v1/dashboard/snapshot: consistent filtered snapshot with computedAt, source freshness, coverage, active filters, and partial-data warnings.
- GET /v1/events: cursor-paginated sanitized events with validated sort/filter parameters.
- GET /v1/events/{id}: authorized, redacted event detail.
- GET /v1/stream: optional scoped SSE notifications with event IDs, heartbeat, and reconnect semantics.
- POST /v1/exports: bounded, authorized export of a fixed filter/window snapshot; optional async processing.

These are design additions, not functioning endpoints. Use UTC transport timestamps, explicit display timezone, stable ordering, input validation, and bounded query windows.

## Completion and test gates
- Light is the first-load default; the top switch updates every panel and persists on reload in both modes.
- Desktop and ~390px mobile layouts have no page overflow, overlapping controls, or hidden critical status.
- Keyboard-only users can filter, switch theme, pause/resume, navigate events, and open/close details; focus returns predictably. Charts have exact accessible equivalents.
- All relevant panels, counts, drills, and exports reconcile to the same filter/time population; unavailable metrics are not zero.
- Verify streaming/polling reconnect, expired authentication, duplicate events, cursor gaps, slow responses, empty results, partial integrations, hidden-tab return, and stale-state transitions.
- Test hostile event text for XSS, malformed search, export formula injection, unauthorized scopes, and redaction failures.
- No mock data passes as production; no button implies an operation that has no backend. Build, type checks, automated tests, accessibility review, and light/dark/mobile visual inspection must pass before claiming implementation complete.

## Delivery order
1. Obtain and record ISO-repository coding guidelines.
2. Build the responsive light/dark shell and accessible loading/empty/error states.
3. Connect a real snapshot endpoint and health/event table, then implement polling and freshness states.
4. Add incident drill-down, scoped filters, and working acknowledgement API.
5. Add charts from real typed data and accessible alternatives; GitHub/AI panels remain clearly unconnected until wired.
6. Add SSE if justified, bounded exports, and complete the test gates. Production deployment remains a separate approval and setup step.
