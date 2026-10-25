export type EventType =
  "check" | "heartbeat" | "request" | "github" | "ai" | "custom";
export type Severity = "info" | "warning" | "error";
export interface TelemetryEvent {
  id: string;
  eventId: string;
  applicationId: string;
  occurredAt: string;
  receivedAt: string;
  type: EventType;
  severity: Severity;
  message: string;
  latencyMs: number | null;
  statusCode: number | null;
  provider: string | null;
  model: string | null;
  tokens: number | null;
  costUsd: number | null;
}
export interface Application {
  id: string;
  name: string;
  environment: string;
  createdAt: string;
  health: "healthy" | "failing" | "unknown";
  lastCheckAt: string | null;
  latencyMs: number | null;
  stale: boolean;
}
export interface Incident {
  id: string;
  applicationId: string;
  title: string;
  state: "open" | "acknowledged" | "resolved";
  openedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
}
export interface Bucket {
  at: string;
  requests: number;
  errors: number;
  latencyP95: number | null;
}
export interface Snapshot {
  generatedAt: string;
  dataAsOf: string | null;
  from: string;
  to: string;
  applications: Application[];
  incidents: Incident[];
  events: TelemetryEvent[];
  nextCursor: string | null;
  coverage: { matched: number; sampled: number; limited: boolean };
  metrics: {
    requests: number;
    errors: number;
    errorRate: number | null;
    p95: number | null;
    aiRequests: number;
    tokens: number | null;
    tokenRequests: number;
    costUsd: number | null;
    pricedRequests: number;
    githubEvents: number;
  };
  buckets: Bucket[];
  checkTimeline: Record<string, ("healthy" | "failing" | "unknown")[]>;
}
export function quantile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
}
export function failed(
  event: Pick<TelemetryEvent, "severity" | "statusCode">,
): boolean {
  return (
    event.severity === "error" ||
    (event.statusCode !== null && event.statusCode >= 400)
  );
}
export function metrics(events: TelemetryEvent[], from: string, to: string) {
  const requests = events.filter((e) => e.type === "request");
  const errors = requests.filter(failed).length;
  const ai = events.filter((e) => e.type === "ai");
  const priced = ai.filter((e) => e.costUsd !== null);
  const tokenized = ai.filter((e) => e.tokens !== null);
  const duration = Date.parse(to) - Date.parse(from);
  const buckets: Bucket[] = Array.from({ length: 12 }, (_, i) => ({
    at: new Date(Date.parse(from) + (duration * i) / 12).toISOString(),
    requests: 0,
    errors: 0,
    latencyP95: null,
  }));
  const samples: number[][] = buckets.map(() => []);
  const checkTimeline: Record<string, ("healthy" | "failing" | "unknown")[]> =
    {};
  // Ascending order ensures the latest reported check wins within a bucket.
  for (const event of [...events].sort(
    (a, b) =>
      a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id),
  )) {
    const time = Date.parse(event.occurredAt);
    if (time < Date.parse(from) || time > Date.parse(to)) continue;
    const i = Math.min(
      11,
      Math.floor(((time - Date.parse(from)) / duration) * 12),
    );
    if (event.type === "request") {
      buckets[i].requests++;
      if (failed(event)) buckets[i].errors++;
      if (event.latencyMs !== null) samples[i].push(event.latencyMs);
    }
    if (event.type === "check") {
      checkTimeline[event.applicationId] ??= Array(12).fill("unknown");
      checkTimeline[event.applicationId][i] = failed(event)
        ? "failing"
        : event.statusCode !== null
          ? "healthy"
          : "unknown";
    }
  }
  buckets.forEach((b, i) => {
    b.latencyP95 = quantile(samples[i], 0.95);
  });
  return {
    metrics: {
      requests: requests.length,
      errors,
      errorRate: requests.length ? (errors / requests.length) * 100 : null,
      p95: quantile(
        requests.flatMap((e) => (e.latencyMs === null ? [] : [e.latencyMs])),
        0.95,
      ),
      aiRequests: ai.length,
      tokens: tokenized.length
        ? tokenized.reduce((n, e) => n + e.tokens!, 0)
        : null,
      tokenRequests: tokenized.length,
      costUsd: priced.length
        ? priced.reduce((n, e) => n + e.costUsd!, 0)
        : null,
      pricedRequests: priced.length,
      githubEvents: events.filter((e) => e.type === "github").length,
    },
    buckets,
    checkTimeline,
  };
}
export function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return (
    '"' +
    (/^\s*[=+\-@]|^[\t\r\n]/.test(text) ? "'" : "") +
    text.replaceAll('"', '""') +
    '"'
  );
}
export function exportCsv(
  events: TelemetryEvent[],
  apps: Application[],
): string {
  const names = new Map(apps.map((a) => [a.id, a.name]));
  return [
    [
      "Timestamp (UTC)",
      "Application",
      "Type",
      "Severity",
      "Message",
      "Latency (ms)",
      "Event ID",
    ],
    ...events.map((e) => [
      e.occurredAt,
      names.get(e.applicationId) ?? e.applicationId,
      e.type,
      e.severity,
      e.message,
      e.latencyMs,
      e.eventId,
    ]),
  ]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}
export function redact(text: string): string {
  return text
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [REDACTED]")
    .replace(
      /\b(password|secret|token|api[_-]?key)["']?\s*[:=]\s*["']?[^\s,"';]+/gi,
      "$1=[REDACTED]",
    );
}
