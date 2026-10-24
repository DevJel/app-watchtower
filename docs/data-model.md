# Proposed data model

Not executable SQL. Implement versioned migrations and test them against D1 before release.

| Entity | Key fields and constraints |
| --- | --- |
| applications | id, name, environment, createdAt, disabledAt |
| app_credentials | id, applicationId, tokenHash, scope, expiresAt, revokedAt; never raw ingestion token |
| monitors | id, applicationId, approvedTarget, method, interval, timeout, expectedStatus, nextCheckAt, enabled |
| probe_jobs | jobId UNIQUE (monitor + scheduled slot), monitorId, scheduledAt, lease/status |
| check_results | id, jobId UNIQUE, monitorId, checkedAt, durationMs, outcome, statusCode, sanitizedError |
| incidents | id, monitorId, state, openedAt, acknowledgedAt, resolvedAt; unique active incident per monitor |
| incident_events | id, incidentId, transition, sourceResultId, occurredAt |
| github_installations | installationId, selectedRepository references; avoid durable installation tokens |
| webhook_deliveries | provider + deliveryId UNIQUE, receivedAt, processedAt, status |
| app_events | applicationId + eventId UNIQUE, occurredAt, receivedAt, type, allowlisted attributes |
| heartbeats | applicationId, heartbeatKey, lastReceivedAt, expectedInterval |
| notification_deliveries | incident transition + channel UNIQUE, attemptCount, nextRetryAt, status |
| audit_events | actor, action, object reference, timestamp, requestId, redacted change metadata |
| evidence_exports | id, owner, source range, object key, checksum, collectedAt, reviewStatus |

## Consistency
Use database constraints and atomic updates/transactions where supported and tested. Queue delivery is not assumed exactly-once. App-scoping must be enforced in every query, not only in the UI. Use UTC timestamps and explicit schema versions.

## Proposed retention — approval required
Keep raw check results 30 days, incident/notification history 90 days, and audit/evidence retention separately approved for the intended purpose. These are starting proposals, not ISO requirements. Store no raw prompts/responses by default. Deletion must cover database rows, archives, and configured backups according to a documented policy.

## Scaling trigger
Measure write volume, query patterns, storage, and retention before choosing rollups or an external analytics store. Do not add infrastructure speculatively.
