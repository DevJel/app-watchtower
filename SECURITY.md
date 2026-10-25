# Security

Do not open public issues containing credentials or customer data. A private security reporting channel and maintainer contact must be configured before any public release.

See docs/security.md for the threat model. This initial implementation does not certify ISO compliance, implement immutable audit storage, or constitute a fully hardened production monitoring service. Review docs/implementation.md and the README release gates.

If a secret is exposed, revoke/rotate it first and investigate access; deleting it from the latest commit is not sufficient.
