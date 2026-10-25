# Contributing

The initial runtime slice exists; the user's ISO coding guidelines remain pending. Do not claim conformance until those source rules are available and reviewed.

For each change: link an issue, document the behavior and security impact, add tests, update contracts and migrations, and request review. Never deploy production changes from an unreviewed branch.

Proposed release gates: formatting, lint, type checking, unit tests, Worker integration tests, migration tests, secret scanning, dependency review, and manually approved production deployment. CI tooling is configured for the current dashboard/API slice; production deployment remains manual.
