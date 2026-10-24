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
