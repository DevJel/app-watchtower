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
