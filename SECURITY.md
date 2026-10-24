# Security

Do not open public issues containing credentials or customer data. A private security reporting channel and maintainer contact must be configured before any public release.

See docs/security.md for the threat model. This repository does not certify ISO compliance, implement immutable audit storage, or provide a production-ready monitoring service.

If a secret is exposed, revoke/rotate it first and investigate access; deleting it from the latest commit is not sufficient.
