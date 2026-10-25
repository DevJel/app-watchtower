# Implemented API (v0.1)

Responses are JSON with no-store caching. Owner routes require a verified Cloudflare Access JWT; explicit loopback development mode is the only bypass. Browser writes require `X-Watchtower-Request: 1`; cross-origin writes are rejected. No permissive CORS is provided.

| Method / path | Auth | Behavior |
| --- | --- | --- |
| GET /healthz | Public | Minimal process liveness, not dependency readiness |
| GET /v1/dashboard/snapshot | Owner | Filtered snapshot, application current state, incidents, metrics/buckets and first 50 events |
| GET /v1/events | Owner | Next 50 sanitized events; validated cursor and snapshot receive-time cutoff |
| POST /v1/applications | Owner | `name`, `environment`; returns app ID and one-time scoped ingestion token |
| POST /v1/ingest/events | App Bearer credential | Validates/inserts up to 100 events; ignores duplicate app/event IDs; evaluates reported-check incident transitions |
| POST /v1/incidents/{id}/acknowledgements | Owner | Acknowledges an open incident with an audit record; returns 409 if not open |

## Filters
`from`/`to` are UTC ISO timestamps; positive window up to 7 days. Optional `app`, `environment`, `severity` (`info`, `warning`, `error`) and literal text `q`. Cursor responses preserve a receive-time cutoff. Sort order is occurred timestamp + unique record ID descending. Dashboard metrics use at most the newest 5,000 matching events and expose matched/sample coverage. Current application health is app/environment scoped and deliberately independent of the historical time or severity query; incident cards are scoped by app/environment and overlap with the time window, not the event search string/severity.

## Event batch
Top-level body: `{ "events": [...] }`, maximum 64 KiB. Each event allows ONLY:

- `eventId`: nonempty `[A-Za-z0-9_.:-]`, at most 128 characters; unique per application.
- `occurredAt`: valid timestamp, at most 7 days old or 5 minutes ahead; stored as normalized UTC.
- `type`: `check`, `heartbeat`, `request`, `github`, `ai`, `custom`.
- `severity`: `info`, `warning`, `error`.
- `message`: sanitized metadata string, maximum 500 characters; common credential patterns are redacted, but caller must exclude sensitive data.
- Optional finite nonnegative `latencyMs` (up to 3,600,000), integer `statusCode` (100–599), `provider` (60 chars), `model` (100 chars), integer `tokens` (up to 1 billion), `costUsd` (up to 1 million).

A `check` must contain an HTTP status or an explicit `error` severity (e.g. timeout). No prompts, responses, arbitrary attributes, app ID override, or URLs are accepted. The Bearer credential determines the application. AI costs are supplied metadata, not invented from model names. Heartbeats are stored but missed-heartbeat detection is not implemented.

Ingestion returns 202 with the submitted count; this is **not** an inserted-unique count because duplicates are ignored. Incidents evaluate the last 3/2 chronological checks, requiring each to be fresh within 15 minutes. Current health becomes unknown after 5 minutes without a recent check.

## Errors
Structured `{ error, requestId }` for known HTTP failures; no internal stack traces or sensitive content. Production without Access configuration returns 503; missing/invalid JWT returns 401. Invalid input returns 400, missing write guard 403, large body 413, wrong media type 415, unknown route 404.

## Proposed, not implemented
SSE, exports API, monitor CRUD/probes, readiness checks, automated credential rotations, GitHub App webhooks, notification APIs, and AI summary requests remain roadmap items. CSV export is currently browser-side and explicitly limited to loaded event records.
