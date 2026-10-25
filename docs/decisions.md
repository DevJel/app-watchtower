# Architecture decision log

| ID | Status | Decision / reason |
| --- | --- | --- |
| ADR-001 | Proposed | Cloudflare-first TypeScript stack for a small owner-operated control panel |
| ADR-002 | Proposed | Single owner initially; avoid speculative multitenancy |
| ADR-003 | Proposed | Deterministic incident rules; AI advisory only |
| ADR-004 | Proposed | GitHub App instead of a broad personal token |
| ADR-005 | Proposed | Queue work and enforce application-level idempotency |
| ADR-006 | Pending | User MCP-specific coding guidelines and required tooling |
| ADR-007 | Pending | ISO 27001 scope, evidence requirements, and retention |
| ADR-008 | Initial default | Private repository created at DevJel/app-watchtower; owner may request a different name or organization |
| ADR-009 | Pending | Secure probe egress strategy; restrict to fixed reviewed domains until proven |
| ADR-010 | Pending | App count, check intervals, event volume, alert provider, budget |
| ADR-011 | Pending | One deployment path: GitHub Actions OR Cloudflare Git integration |

Each accepted decision should record date, owner, alternatives, consequences, and verification evidence. None of these proposals represent a user-approved production configuration yet.

## Implementation decisions
- ADR-012: Implement the initial vertical slice as one TypeScript package/Worker with React/Vite static assets, D1 ingestion/snapshots and reported-check incidents. Defer service splitting, queues and independent probes until needed.
- ADR-013: Use authenticated polling first, not SSE; preserve truthful freshness and missing-data states.
- ADR-014: Implement on the user's explicit subsequent request while ISO source rules remain unavailable. Do not claim guideline conformity; reconcile when the exact repository/version is supplied.
- ADR-015: No automatic production deployment. Cloudflare resources, Access policy, rate limits and recovery remain release gates.
