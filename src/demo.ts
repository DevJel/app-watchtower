import {
  metrics,
  type Application,
  type Incident,
  type Snapshot,
  type TelemetryEvent,
} from "../shared/core";
export const demoApps: Application[] = [
  "Commerce API",
  "Customer portal",
  "AI assistant",
  "Billing worker",
  "Preview web",
].map((name, i) => ({
  id: `demo-${i}`,
  name,
  environment: i === 4 ? "staging" : "production",
  createdAt: "2026-10-01T00:00:00.000Z",
  health: i === 3 ? "failing" : i === 4 ? "unknown" : "healthy",
  lastCheckAt: null,
  latencyMs: [124, 86, 340, 1200, 0][i] || null,
  stale: i === 4,
}));
export function demoSnapshot(
  from: string,
  to: string,
  options: { app: string; environment: string; severity: string; q: string },
  acknowledged: Set<string>,
): Snapshot {
  const now = new Date().toISOString(),
    end = Date.parse(to),
    duration = end - Date.parse(from);
  const apps = demoApps
    .map((a, i) => ({
      ...a,
      lastCheckAt:
        i === 4 ? null : new Date(Date.now() - (i + 1) * 17_000).toISOString(),
    }))
    .filter(
      (a) =>
        (!options.app || a.id === options.app) &&
        (!options.environment || a.environment === options.environment),
    );
  const all: TelemetryEvent[] = [];
  const add = (
    i: number,
    app: number,
    type: TelemetryEvent["type"],
    severity: TelemetryEvent["severity"],
    at: number,
    latency: number | null,
    message: string,
    status = 200,
  ) =>
    all.push({
      id: `sample-${i}`,
      eventId: `demo-event-${i}`,
      applicationId: `demo-${app}`,
      occurredAt: new Date(at).toISOString(),
      receivedAt: new Date(at).toISOString(),
      type,
      severity,
      message,
      latencyMs: latency,
      statusCode: type === "check" || type === "request" ? status : null,
      provider: type === "ai" ? "Example provider" : null,
      model: type === "ai" ? "example-model" : null,
      tokens: type === "ai" ? 120 + (i % 200) : null,
      costUsd: type === "ai" ? 0.0004 : null,
    });
  for (let i = 0; i < 220; i++) {
    const at = end - duration + (duration * (i + 0.4)) / 220,
      app = i % 4,
      error = app === 3 && i > 155;
    add(
      i,
      app,
      "request",
      error ? "error" : "info",
      at,
      Math.round(
        75 +
          (Math.sin(i * 0.31) + 1) * 65 +
          (app === 2 ? 130 : 0) +
          (error ? 400 : 0),
      ),
      error
        ? "Upstream request timed out"
        : [
            "GET /v1/products completed",
            "Page request completed",
            "Assistant request completed",
            "Invoice batch completed",
          ][app],
      error ? 504 : 200,
    );
  }
  for (let i = 0; i < 48; i++) {
    const app = i % 4;
    const error = app === 3 && i >= 32;
    add(
      300 + i,
      app,
      "check",
      error ? "error" : "info",
      end - duration + (duration * (Math.floor(i / 4) + 0.7)) / 12,
      80 + app * 25,
      error ? "Reported health check failed" : "Reported health check passed",
      error ? 503 : 200,
    );
  }
  for (let i = 0; i < 18; i++)
    add(
      400 + i,
      2,
      "ai",
      i === 8 ? "warning" : "info",
      end - (duration * (i + 0.5)) / 19,
      280 + i * 12,
      "Model invocation metadata received",
    );
  for (let i = 0; i < 4; i++)
    add(
      500 + i,
      i % 3,
      "github",
      i === 1 ? "error" : "info",
      end - (duration * (i + 0.4)) / 5,
      null,
      i === 1
        ? "CI workflow failed · example repository"
        : "Deployment succeeded · example repository",
    );
  const events = all
    .filter(
      (e) =>
        apps.some((a) => a.id === e.applicationId) &&
        (!options.severity || e.severity === options.severity) &&
        (!options.q ||
          `${e.message} ${e.eventId} ${apps.find((a) => a.id === e.applicationId)?.name}`
            .toLowerCase()
            .includes(options.q.toLowerCase())),
    )
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const incidents: Incident[] = apps.some((a) => a.id === "demo-3")
    ? [
        {
          id: "demo-incident",
          applicationId: "demo-3",
          title: "Three consecutive reported check failures",
          state: acknowledged.has("demo-incident") ? "acknowledged" : "open",
          openedAt: new Date(Date.now() - 11 * 60_000).toISOString(),
          acknowledgedAt: acknowledged.has("demo-incident") ? now : null,
          resolvedAt: null,
        },
      ]
    : [];
  return {
    generatedAt: now,
    dataAsOf: events[0]?.receivedAt ?? null,
    from,
    to,
    applications: apps,
    incidents,
    events,
    nextCursor: null,
    coverage: {
      matched: events.length,
      sampled: events.length,
      limited: false,
    },
    ...metrics(events, from, to),
  };
}
