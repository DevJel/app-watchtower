# Initial implementation status

## Working in the repository
- Responsive React/TypeScript dashboard, light by default; persistent top-bar light/dark control.
- Explicit demo mode and a separate real-API mode; failures do not manufacture production data.
- App/environment/severity/search filters, preset and custom windows, explicit timezone.
- Real API polling every 15 seconds while visible; pause/resume, retry on refresh, and stale/error indication. Snapshot state is retained on refresh failure. Reviewing older pages or event details pauses automatic refresh.
- Request counts, error-rate denominators, recorded-sample p95, observed timeline charts with exact-data tables, current reported-check health, and sampled status timeline.
- Incident list and working acknowledgement; server detection from reported checks (3 failures / 2 recoveries), duplicate handling and audit records.
- Sanitized event table, safe details, loaded-record sorting/pagination, cursor retrieval of older records, and CSV formula neutralization. Export means loaded records only.
- Registration with one-time app ingestion credential, SHA-256 token hashes, bounded schema-validated event ingestion into D1.
- Production Cloudflare Access JWT verification and strict local-only opt-in development auth. Actual Access policy/bindings still need setup.
- AI/GitHub telemetry metadata cards with explicit not-connected/metadata-only boundaries.
- Versioned D1 migration, Worker assets config, manual deployment instructions, CI and automated tests.

## Not implemented / not connected
Independent endpoint probes/scheduler, missed-heartbeat detection, alert delivery, queues/dead-letter processing, SSE, a GitHub App/webhook receiver, AI incident summaries, control mapping/evidence exports, multi-user roles, monitor configuration UI, and managed app credential rotation/deletion UI. The database and Access application have not been provisioned in the user's Cloudflare account. No production deployment or actual monitored app connection was performed.

The larger architecture remains a roadmap; this initial slice deliberately uses one Worker/package rather than prematurely splitting services. It is an early implementation, not a fully hardened production release.

## Guideline dependency
The ISO repository's exact URL and rule files are still required. No ISO-guideline conformance or ISO 27001 certification is claimed.

## Verification
See README commands and tests. Dependencies are lockfile-pinned. The local integration harness uses the same Miniflare 5 beta generation as pinned Wrangler, through its exported v4-options adapter. An undici 7.30.1 override addresses the advisories reported for the upstream transitive version; keep runtime tests when upgrading.

## Operational release gates
Before public/production deployment: confirm Access policy scope and ingestion-path exception, provision isolated staging/production D1, set edge rate limits and budgets, establish credential revocation/rotation, test export/restore, review incident/audit retention and sensitive-data handling, review the missing ISO rules, and perform an authenticated staging smoke test. Do not turn on logging of credentials or raw payloads.
