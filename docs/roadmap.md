# Delivery roadmap

No deadlines or estimates are committed.

1. Supply user MCP coding rules; choose owner/repo/privacy; approve stack and security boundaries.
2. Private GitHub repo created at DevJel/app-watchtower. Next: branch protections, issue tracking, and staging configuration.
3. Implement and test login + application CRUD + one scheduled probe + health display.
4. Add incident transitions and deduplicated alerts; test queue failure and recovery.
5. Add external self-monitoring, retention, backup/restore and rollback runbooks.
6. Add GitHub App with minimal permissions and signed webhook tests.
7. Add heartbeat/event ingestion; then optional AI metadata and advisory summaries.
8. Confirm ISO scope before introducing evidence mapping and review workflows.

Definition of done: documented behavior, tests passing, threat-model risks reviewed, no committed secrets, operational rollback documented, and production deployment explicitly approved. A documentation merge is not evidence that runtime behavior exists.

## Dashboard delivery track
Follow [the UI specification](ui-dashboard.md). The initial dashboard/API slice is implemented on explicit user request; ISO guideline conformance remains pending the exact source repository. Remaining work follows this sequence: first import the applicable rules, then implement the light/dark shell, real snapshot/health/table integration, polling/freshness states, incidents, real-data charts, and optional SSE. Do not mark these features complete until the specified interaction, accessibility, security, and visual test gates pass.

## Current milestone
Initial working dashboard + telemetry API is implemented and locally verified. See [implementation status](implementation.md). No Cloudflare deployment or real app connection is complete.
