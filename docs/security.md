# Threat model and release gates

## Trust boundaries
Browser ↔ authenticated API; monitored target ↔ probe; application ↔ event ingestion; GitHub ↔ webhook; queue ↔ consumer; sanitized evidence ↔ AI provider; CI ↔ production environment.

| Threat | Required control / test |
| --- | --- |
| SSRF and DNS rebinding | Ownership verification, fixed reviewed target allowlist, HTTPS only, redirect rejection, internal-IP restrictions; arbitrary URLs remain blocked until vetted egress enforcement is proven |
| Spoofed GitHub deliveries | HMAC SHA-256 of raw bytes, constant-time comparison, body limits, unique delivery ID |
| Credential theft | Least privilege, separate staging/prod secrets, revocation/rotation, no browser exposure |
| Duplicate/out-of-order events | Unique IDs, atomic incident transitions, consumer idempotency, delivery ordering rules |
| Data leakage into logs/AI | Allowlisted fields, redaction tests, no prompt/response capture by default, explicit AI opt-in |
| Prompt injection through telemetry | Treat telemetry as data; no AI tool access or action execution; reviewed advisory output |
| Alert flooding | State-transition alerts, cooldowns, quotas, maintenance windows, bounded retries |
| Monitor outage hidden as app health | UNKNOWN state on missing data, scheduler heartbeat, independent external monitor |
| Supply-chain or CI compromise | Reviewed dependencies, pinned CI action revisions when workflows are added, protected production environment, least-privilege deployment identity |
| Misleading compliance/audit claims | No certification claim; separate evidence collection from control effectiveness and independent review |

## Operational gates
Test secret redaction; unauthorized reads/writes; app credential isolation; replay/duplicate deliveries; timeouts; unsafe destinations; partial queue/database failures; migration rollback; database export/restore; alert provider failure; retention deletion.

Configure a private security contact before launch. Owner must approve data residency, AI vendor use, retention, and alert content.
