# App Watchtower

A private, Cloudflare-ready application monitoring dashboard with a working telemetry API.

**Implemented:** React/TypeScript dashboard, light-first theme with a persistent top-bar dark switch, application/environment/severity filters, time windows, API polling and stale/error states, request/latency charts, reported-check health timelines, incident acknowledgement, event detail dialogs, pagination, safe CSV export, application registration, and scoped event ingestion backed by D1.

**Not deployed.** Production authentication, real D1 binding, and application instrumentation must be configured. Independent endpoint probes, alert delivery, SSE, GitHub App webhooks, AI diagnosis, and ISO evidence workflows are not implemented. GitHub/AI cards display supplied telemetry metadata only. This is not a complete production monitoring or compliance product.

The user's `ISO` coding-guideline repository is still inaccessible/unidentified; conformity to those guidelines is **not claimed**. See [AGENTS.md](AGENTS.md).

## Quick start: dashboard demo

Requires **Node.js 24+**.

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5173/?demo=1` for clearly labeled synthetic data. Without `?demo=1`, the dashboard uses the real API and never silently substitutes demo values.

## Local working API + D1

```sh
npm ci
npm run build
cp .dev.vars.example .dev.vars
npm run db:local
npm run dev:api
# In a second terminal:
npm run dev
```

Open `http://127.0.0.1:5173/`. Click **Add application**, then copy the one-time ingestion credential into your application's server-side secret store. `.dev.vars` is ignored by Git. The development auth bypass requires all three: a loopback request hostname, `ENVIRONMENT=development`, and `ALLOW_DEV_AUTH=true`. Do not use a development tunnel or expose this local service to other machines.

Send telemetry from your application server:

```sh
# WATCHTOWER_INGEST_TOKEN must be read from a server-side secret store.
curl http://127.0.0.1:8787/v1/ingest/events \
  -H "Authorization: Bearer $WATCHTOWER_INGEST_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"events":[{"eventId":"check-unique-id","occurredAt":"REPLACE_WITH_CURRENT_UTC_ISO_TIMESTAMP","type":"check","severity":"info","statusCode":200,"latencyMs":42,"message":"Reported health check passed"}]}'
```

Use a new `eventId` for each observation and an actual ISO UTC timestamp. Allowed types: `check`, `heartbeat`, `request`, `github`, `ai`, `custom`. Heartbeats are recorded events, **not** an implemented missed-heartbeat alert. Request charts use only `request` events; reported `check` events determine current health. See [API contracts](docs/api.md).

## Verification

```sh
npm run check
npm test
npm run test:integration
npx playwright install chromium
npm run test:e2e
# With the local API running, also exercise application creation and ingestion:
LIVE_API_TEST=1 npm run test:e2e
npm audit
```

For an existing Chromium installation, set `CHROMIUM_PATH=/path/to/chromium`. CI runs type checks, unit/integration tests, production build, and browser/accessibility tests. Browser tests use synthetic data unless explicitly running the local API test.

## Cloudflare deployment — manual setup required

1. Create a **staging** D1 database: `npx wrangler d1 create watchtower`. Replace the placeholder `database_id` in `wrangler.jsonc`; use distinct bindings/resources for production.
2. Apply migrations: `npx wrangler d1 migrations apply watchtower --remote`. Review backup/recovery and retention before production use.
3. Configure Cloudflare Access for the owner-facing hostname/routes. Restrict the Access application policy to approved operators. Set `ACCESS_ISSUER` to `https://YOUR_TEAM.cloudflareaccess.com` and `ACCESS_AUD` to the Access application audience using `npx wrangler secret put NAME`.
4. If ingestion shares that hostname, give `/v1/ingest/*` a separate Access bypass policy **only for that path**, so server-side app credentials can reach the Worker. The Worker still authenticates every ingestion request with its hashed application credential. Never bypass owner API routes.
5. Keep `ENVIRONMENT=production`. Never deploy `ALLOW_DEV_AUTH=true`; no local development values are required in production.
6. Build/deploy manually with `npm run deploy`, then verify Access denial, app-scoped ingestion, real data, stale state, and incident behavior. This repository does not auto-deploy or provision resources on push.
7. Before production: configure edge rate limits, credential rotation/revocation procedures, tested recovery, alert integrations if needed, and review the pending ISO coding rules.

## Data and security boundaries

- JWT issuer/audience/signature verification via JOSE; production fails closed if Access is unconfigured.
- Per-app random ingestion credentials, stored as SHA-256 hashes; schema allowlists, body/batch bounds, timestamp validation, duplicate-event constraints, and common secret-pattern redaction.
- Known redaction patterns are not a guarantee of removing all PII or secrets. Send only sanitized metadata. Prompts/responses and arbitrary payload attributes are rejected.
- Incidents open after 3 consecutive fresh reported check failures and resolve after 2 successes. Fresh sequence evaluation uses atomic D1 write predicates. No notification service is connected.
- Health becomes unknown after 5 minutes without a recent check. Check timelines are sampled states, not an uptime percentage or independent measurement.
- Dashboard metrics are bounded to the latest 5,000 matching events, with visible coverage warnings. Table pagination is cursor-based; CSV exports **loaded events only**, not the entire matching dataset.
- Telemetry retention is 30 days via a daily scheduled cleanup. Incident/audit retention is separate and requires policy approval. There is no immutable evidence store or ISO certification claim.

## Project map

- `src/` — dashboard and explicitly marked demo fixtures
- `shared/` — typed contracts, metrics, CSV safety, redaction
- `worker/` — authenticated snapshot/events, ingestion, application and incident APIs
- `migrations/` — D1 schema
- `tests/` — unit, local-D1 integration, browser and accessibility tests
- [Implementation status](docs/implementation.md)
- [Architecture](docs/architecture.md) · [UI specification](docs/ui-dashboard.md) · [Roadmap](docs/roadmap.md) · [Security](docs/security.md)
