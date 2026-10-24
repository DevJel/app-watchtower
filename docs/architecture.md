## Project status
**Project:** App Watchtower. Private planning repository: [DevJel/app-watchtower](https://github.com/DevJel/app-watchtower). This is not a running application. No Cloudflare resource, deployment, or application credential has been created.

**Purpose:** A private control panel for monitoring your applications, APIs, GitHub delivery events, and AI-backed features.

**Pending confirmation:** Your MCP-specific coding guidelines have not been supplied. ISO 27001 evidence support is a provisional interpretation of your request, not a confirmed certification scope. Start single-owner; add team access only when needed.

## Recommended architecture
Use a small TypeScript monorepo with React/Vite for the dashboard and Cloudflare Workers for APIs and background processing. Hono is a proposed routing library, subject to your coding guidelines.

```text
Owner → Cloudflare Access → Dashboard + API Worker → D1
Applications → authenticated event ingestion → Queue → Processor → D1
Cron scheduler → Check Queue → Probe Worker → Results → Incident rules
GitHub App → signed webhooks → Webhook Worker → Queue → Processor
Incident transition → Notification Queue → Email/webhook adapter
Sanitized incident context → optional AI adapter → reviewed summary
Periodic export → R2 evidence archive
Independent external monitor → checks Watchtower itself
```

### Components
| Component | Responsibility | Initial choice |
| --- | --- | --- |
| Dashboard | Application inventory, health, incidents, settings | React + TypeScript; Worker static assets |
| API | Authenticated CRUD, queries, ingestion | Cloudflare Workers; proposed Hono |
| Scheduler | Find due monitors; enqueue bounded work | Worker Cron Trigger |
| Probe workers | Bounded HTTP checks, timeout handling | Queue-consuming Workers |
| Database | Configuration, recent results, incidents, event deduplication | D1; explicit migrations |
| Async work | Probes, ingestion processing, notifications | Cloudflare Queues; dead-letter handling |
| Archive | Exports and evidence manifests | R2 in a later phase |
| Owner authentication | Private dashboard and API boundary | Cloudflare Access; verified identity |
| GitHub integration | Selected repository workflow/deployment events | Least-privilege GitHub App |
| AI | Advisory incident summaries | Provider adapter; disabled by default |

Separate staging and production environments, bindings, databases, queues, and secrets. Confirm current account quotas and pricing before implementation; this plan makes no scale or free-tier guarantee.

## Core workflows
### 1. API and uptime checks
Register an owned application and verified endpoint. Every minute, a scheduler discovers monitors whose next check is due, then enqueues jobs. Each job has a unique monitor/time-slot ID. A probe performs a bounded request, records status and latency, and feeds deterministic incident rules.

Start with five-minute intervals, configurable timeout, expected status codes, and an optional small JSON assertion. Do not claim geographically independent checks: an edge-hosted Worker is not a multi-region synthetic monitoring service. Add independent regional probes only if required.

### 2. Application events and heartbeat monitoring
Applications send a documented event envelope or heartbeat using a per-application, scoped credential. Apply request size limits, schema validation, quotas, event deduplication, timestamp checks, and secret redaction. MVP events are structured metadata, not arbitrary log dumps or a full observability replacement.

### 3. GitHub monitoring
Use a GitHub App installed only on selected repositories. Verify the HMAC SHA-256 signature over the raw webhook body before parsing or queuing. Deduplicate GitHub delivery IDs. Track only the event types needed for workflow failures, deployments, and release context; confirm event-specific permissions during implementation.

Deploying Watchtower from GitHub and monitoring GitHub repositories are separate integrations. Choose one production deployment path: GitHub Actions with a protected environment, or Cloudflare Git integration. Do not enable both for the same production branch.

### 4. Incident and alert lifecycle
Use states OPEN → ACKNOWLEDGED → RESOLVED. A proposal for initial rules is three consecutive failed checks to open an incident and two successes to resolve it. Make thresholds configurable. Use a unique active-incident constraint, atomic state transitions, delivery idempotency keys, cooldowns, maintenance windows, and notification retries. Alert only on meaningful transitions.

A missing probe result is UNKNOWN, not a successful check. Use scheduled heartbeat checks and an independent external monitor to detect failure of Watchtower itself.

### 5. AI-assisted monitoring
Keep incident detection deterministic. An optional AI service summarizes sanitized evidence, proposes likely causes, and drafts remediation steps. Display source event IDs and uncertainty. AI cannot deploy, alter monitors, close incidents, or run tools in the MVP.

If monitoring AI requests in your other apps, accept metadata such as provider, model, duration, status, tokens, and supplied usage cost. Never invent costs without a pricing/version basis. Prompts and responses are excluded by default. Treat application logs, webhook text, and model outputs as untrusted input.

### 6. ISO-related evidence
Later, capture change history, access reviews, incident timelines, deployment references, and evidence exports. Each evidence record needs an owner, source, collected-at timestamp, checksum, review status, and a link to the related policy/control once the intended ISO scope is confirmed.

This supports evidence collection; it does not establish ISO 27001 compliance or certification. A database audit trail is not inherently immutable. Hashes help detect changes only relative to a trusted baseline; stronger preservation requires independently controlled retention and storage policies.

## Minimum feature set
**MVP:** owner login; application inventory; public HTTPS endpoint checks; heartbeat detection; health overview; incident history; email or signed-webhook alerts; GitHub workflow/deployment event history; sanitized audit events; monitor-the-monitor checks; documented deployment and recovery.

**Next:** AI request metadata, advisory incident summaries, maintenance windows, evidence exports, retention automation, role-based access if team members are added.

**Not initially:** autonomous remediation, remote shell access, arbitrary network scanning, billing, full-text centralized logging, multi-region SLA claims, or a complete ISO compliance suite.

## Live dashboard UI — requested addition

Use the attached screenshot as a panel-layout reference, adapted to application monitoring rather than TV events. **Light mode is the default**, with a clearly labeled **Light / Dark switch in the top-right header** and a persisted preference.

### Dashboard features
- Global application/environment/status filters, search, time presets, absolute ranges, timezone, and clear-filter controls.
- Truthful live/polling/reconnecting/paused/offline status, last successful update, manual refresh, and explicit stale/unknown states.
- Application health matrix; latency history; traffic/error panels; failure distribution; availability timeline; incidents and alert delivery status.
- GitHub workflow/deployment activity and optional AI usage/advisory summaries, with not-connected states until integrations exist.
- Full-width searchable, sortable, cursor-paginated event table with safe detail views and bounded filtered exports.
- Responsive desktop/tablet/mobile layouts, accessible chart alternatives, keyboard controls, and loading/empty/error/partial-data states in both themes.

### Live-data rules
Prefer authenticated SSE notifications when implemented, with a polling fallback proposed at 15 seconds while visible. Refresh frequency is separate from the initial five-minute probe interval. Preserve old results with a stale warning when refresh fails; missing measurements are never treated as healthy or zero. Filters and selected time ranges must reconcile across panels, drills, and exports. Demo values, if used later, must be prominently labeled and never presented as live production data.

### Completion gates
Both themes, theme persistence, ~390px mobile layout, keyboard navigation, reconnect/duplicate/cursor-gap handling, stale state, redaction, authorization, and consistent filtered totals must be tested. No unsupported actions or fabricated geographic measurements.

**Implementation status:** specification added only; no dashboard code or live telemetry is implemented yet. The full build specification is in [docs/ui-dashboard.md](https://github.com/DevJel/app-watchtower/blob/main/docs/ui-dashboard.md).

**Coding-guideline dependency:** the user identified an `ISO` repository, but it was not located with current GitHub access. The exact owner/repository link and applicable guideline files are required before coding. Its name is not evidence of ISO certification scope.

## Repository blueprint
```text
app-watchtower/
  README.md
  AGENTS.md                    # User MCP coding guidelines: pending
  CONTRIBUTING.md
  SECURITY.md
  .env.example
  .github/ISSUE_TEMPLATE/
  docs/
    architecture.md
    requirements.md
    ui-dashboard.md
    api.md
    data-model.md
    security.md
    roadmap.md
    decisions.md
    references.md
  apps/web/                    # Proposed; not implemented
  workers/api/                 # Proposed; not implemented
  workers/scheduler/           # Proposed; not implemented
  workers/probe/               # Proposed; not implemented
  workers/processor/           # Proposed; not implemented
  packages/contracts/          # Proposed shared schemas
  migrations/                  # Proposed D1 migrations
  tests/                       # Proposed unit/integration/security tests
```

The initial package contains documentation and templates only. Source directories shown as proposed are not implemented. Add runtime code after the coding guidelines are supplied and reviewed.

## Security requirements before deployment
- Authenticate at the origin boundary; validate Cloudflare Access tokens or equivalent trusted identity. Do not trust a client-supplied email header.
- Restrict outbound checks to approved, ownership-verified HTTPS targets. For MVP reject user-controlled ports, credentials in URLs, arbitrary headers, and redirects. Block private, loopback, link-local, and metadata destinations. DNS rebinding is a design gate: if a vetted egress mechanism cannot safely enforce destination restrictions, allow only a manually reviewed fixed domain list and do not offer arbitrary target onboarding.
- Keep app ingestion keys scoped and revocable; store a verification hash for incoming tokens. Encrypt secrets that must later be recovered, such as integration credentials, using managed secrets/key separation. Never put credentials in Git or browser bundles.
- Validate webhook signatures, schemas, timestamps, and body limits. Design for queue redelivery, out-of-order events, and duplicate notifications.
- No sensitive request bodies in logs, AI context, or evidence exports. Define explicit data retention and purge behavior.
- Protect production releases with human approval and least-privilege deploy credentials. Require security checks and tested migrations before release.

## Initial delivery sequence
1. **Foundation:** incorporate your coding guidelines; confirm owner, repo name, ISO scope, app count, monitoring intervals, and alert destination. Write contracts and threat model first.
2. **Vertical slice:** authentication → create one application → schedule a safe probe → store result → show health → open and resolve an incident.
3. **Operational reliability:** idempotent alerts, retries/dead letters, heartbeat detection, external monitoring, retention, tested restore and rollback procedures.
4. **GitHub:** signed webhook ingestion, delivery deduplication, selected repository workflow/deployment views.
5. **Optional AI and evidence:** redacted summaries and request metadata, then export/review workflows after ISO scope confirmation.

## MVP acceptance gates
- Unauthorized users cannot read or mutate data; two applications cannot use each other's ingestion credentials.
- A known failing test endpoint opens one incident after its threshold; recovery resolves it once.
- Duplicate jobs and webhook deliveries do not duplicate incidents or alerts.
- Spoofed signatures, unsafe targets, redirects, oversized requests, and invalid schemas are rejected.
- Queue failures, scheduler gaps, and missing results are visible; an external monitor alerts when Watchtower is unavailable.
- No credentials, tokens, prompts, or sensitive payloads appear in test logs or AI inputs.
- Staging-to-production deployment, rollback, database export/restore, and retention deletion are exercised.

## Inputs still needed
- Paste or link your MCP-specific coding guidelines.
- The private repository was created under `DevJel` as `app-watchtower`; confirm if you prefer a different owner or name.
- Cloudflare access will be needed when implementing deployment; no Cloudflare resources have been provisioned.
- Confirm whether ISO 27001 is intended and list the first applications/endpoints to monitor.
