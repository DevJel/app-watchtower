import {
  redact,
  type TelemetryEvent,
  type EventType,
  type Severity,
} from "../shared/core";
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
export function string(value: unknown, max: number, name: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new HttpError(400, `invalid_${name}`);
  return value.trim();
}
export function number(
  value: unknown,
  max: number,
  name: string,
  integer = false,
): number | null {
  if (value === undefined || value === null) return null;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > max ||
    (integer && !Number.isInteger(value))
  )
    throw new HttpError(400, `invalid_${name}`);
  return value;
}
export function parseEvents(
  value: unknown,
  applicationId: string,
  now: string,
): TelemetryEvent[] {
  if (!Array.isArray(value) || !value.length || value.length > 100)
    throw new HttpError(400, "invalid_event_batch");
  const types: EventType[] = [
    "check",
    "heartbeat",
    "request",
    "github",
    "ai",
    "custom",
  ];
  const severities: Severity[] = ["info", "warning", "error"];
  const allowed = new Set([
    "eventId",
    "occurredAt",
    "type",
    "severity",
    "message",
    "latencyMs",
    "statusCode",
    "provider",
    "model",
    "tokens",
    "costUsd",
  ]);
  return value.map((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      Object.keys(item).some((k) => !allowed.has(k))
    )
      throw new HttpError(400, "unknown_event_fields");
    const e = item as Record<string, unknown>;
    const eventId = string(e.eventId, 128, "event_id");
    if (!/^[\w.:-]+$/.test(eventId))
      throw new HttpError(400, "invalid_event_id");
    if (
      !types.includes(e.type as EventType) ||
      !severities.includes(e.severity as Severity)
    )
      throw new HttpError(400, "invalid_event_kind");
    const at = Date.parse(string(e.occurredAt, 40, "timestamp"));
    if (
      !Number.isFinite(at) ||
      at > Date.parse(now) + 300_000 ||
      at < Date.parse(now) - 7 * 86400_000
    )
      throw new HttpError(400, "timestamp_out_of_range");
    const statusCode = number(e.statusCode, 599, "status_code", true);
    if (statusCode !== null && statusCode < 100)
      throw new HttpError(400, "invalid_status_code");
    if (e.type === "check" && statusCode === null && e.severity !== "error")
      throw new HttpError(400, "check_requires_status_or_error");
    return {
      id: crypto.randomUUID(),
      eventId,
      applicationId,
      occurredAt: new Date(at).toISOString(),
      receivedAt: now,
      type: e.type as EventType,
      severity: e.severity as Severity,
      message: redact(string(e.message, 500, "message")),
      latencyMs: number(e.latencyMs, 3_600_000, "latency"),
      statusCode,
      provider: e.provider == null ? null : string(e.provider, 60, "provider"),
      model: e.model == null ? null : string(e.model, 100, "model"),
      tokens: number(e.tokens, 1e9, "tokens", true),
      costUsd: number(e.costUsd, 1e6, "cost"),
    };
  });
}
export interface Filters {
  from: string;
  to: string;
  cutoff: string;
  app: string;
  environment: string;
  severity: string;
  q: string;
  cursor?: { at: string; id: string };
}
export function filters(url: URL, now: string): Filters {
  const q = url.searchParams;
  const to = q.get("to") ? Date.parse(q.get("to")!) : Date.parse(now);
  const from = q.get("from") ? Date.parse(q.get("from")!) : to - 3600_000;
  if (
    !Number.isFinite(to) ||
    !Number.isFinite(from) ||
    from >= to ||
    to - from > 7 * 86400_000 ||
    to > Date.parse(now) + 300_000
  )
    throw new HttpError(400, "invalid_time_range");
  const severity = q.get("severity") ?? "";
  if (severity && !["info", "warning", "error"].includes(severity))
    throw new HttpError(400, "invalid_severity");
  let cursor: Filters["cursor"];
  let cutoff = now;
  if (q.has("cursor")) {
    try {
      const raw = q.get("cursor")!;
      if (raw.length > 400) throw Error();
      const parsed = JSON.parse(atob(raw));
      if (
        typeof parsed.id !== "string" ||
        parsed.id.length > 64 ||
        !Number.isFinite(Date.parse(parsed.at)) ||
        !Number.isFinite(Date.parse(parsed.cutoff)) ||
        Date.parse(parsed.cutoff) > Date.parse(now) + 1000
      )
        throw Error();
      cursor = { at: new Date(parsed.at).toISOString(), id: parsed.id };
      cutoff = new Date(parsed.cutoff).toISOString();
    } catch {
      throw new HttpError(400, "invalid_cursor");
    }
  }
  for (const k of ["app", "environment", "q"])
    if ((q.get(k)?.length ?? 0) > 128)
      throw new HttpError(400, "filter_too_long");
  return {
    from: new Date(from).toISOString(),
    to: new Date(to).toISOString(),
    cutoff,
    app: q.get("app") ?? "",
    environment: q.get("environment") ?? "",
    severity,
    q: q.get("q") ?? "",
    cursor,
  };
}
