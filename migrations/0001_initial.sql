CREATE TABLE applications (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, environment TEXT NOT NULL,
 created_at TEXT NOT NULL, token_hash TEXT NOT NULL, stale_after_seconds INTEGER NOT NULL DEFAULT 300
);
CREATE TABLE events (
 id TEXT PRIMARY KEY, event_id TEXT NOT NULL, application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
 occurred_at TEXT NOT NULL, received_at TEXT NOT NULL, type TEXT NOT NULL, severity TEXT NOT NULL,
 message TEXT NOT NULL, latency_ms REAL, status_code INTEGER, provider TEXT, model TEXT, tokens INTEGER, cost_usd REAL,
 UNIQUE(application_id,event_id)
);
CREATE INDEX events_time ON events(occurred_at DESC,id DESC);
CREATE INDEX events_app_type_time ON events(application_id,type,occurred_at DESC);
CREATE TABLE incidents (
 id TEXT PRIMARY KEY, application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
 state TEXT NOT NULL CHECK(state IN ('open','acknowledged','resolved')), title TEXT NOT NULL,
 opened_at TEXT NOT NULL, acknowledged_at TEXT, resolved_at TEXT
);
CREATE UNIQUE INDEX one_active_incident ON incidents(application_id) WHERE resolved_at IS NULL;
CREATE TABLE audit_events (
 id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, object_id TEXT NOT NULL, occurred_at TEXT NOT NULL
);
