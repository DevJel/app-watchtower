# Proposed API contracts

All routes are versioned under /v1. Schemas and OpenAPI must be finalized before implementation. This is a proposal, not a working endpoint catalog.

| Method / path | Authentication | Purpose |
| --- | --- | --- |
| GET /healthz | Public; minimal response | Liveness only; no configuration or dependency details |
| GET /v1/readiness | Owner/operator | Dependency and scheduler readiness |
| GET, POST /v1/applications | Verified owner | List/create applications |
| GET, PATCH /v1/applications/{id} | Verified owner | View/edit application |
| POST /v1/applications/{id}/credential-rotations | Verified owner | Issue replacement ingestion credential; show once |
| GET, POST /v1/monitors | Verified owner | List/create validated monitors |
| PATCH /v1/monitors/{id} | Verified owner | Update a monitor and revalidate target |
| POST /v1/ingest/events | Scoped app credential | Submit bounded structured event batch |
| POST /v1/ingest/heartbeat | Scoped app credential | Record app heartbeat |
| POST /v1/webhooks/github | GitHub HMAC signature | Verify raw body, deduplicate, enqueue |
| GET /v1/incidents | Verified owner | Cursor-paginated incident history |
| POST /v1/incidents/{id}/acknowledgements | Verified owner | Acknowledge an open incident |
| POST /v1/incidents/{id}/summary-requests | Verified owner | Optional advisory AI request |

## Event envelope
Required proposed fields: schemaVersion, eventId, applicationId, occurredAt (UTC), type, and bounded attributes. The app credential must match applicationId. The server assigns receivedAt. Types and attribute allowlists must be explicitly enumerated in implementation.

## Semantics
- JSON only except raw webhook verification; cap request size and batch count.
- Cursor pagination; stable ordering by timestamp and unique ID.
- Errors expose a code and requestId, never a stack trace or secret.
- Validate timestamp skew and retain delivery/event deduplication records for an explicit retry window.
- Rate limit by app/owner, not solely client IP.
- Never include probe Authorization headers, raw webhook secrets, or model prompts in API responses.
