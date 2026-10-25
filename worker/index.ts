import { createRemoteJWKSet, jwtVerify } from "jose";
import {
  failed,
  metrics,
  type Application,
  type Incident,
  type TelemetryEvent,
} from "../shared/core";
import {
  filters,
  HttpError,
  parseEvents,
  string,
  type Filters,
} from "./validation";
export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  ENVIRONMENT: string;
  ALLOW_DEV_AUTH?: string;
  ACCESS_ISSUER?: string;
  ACCESS_AUD?: string;
}
const jwks = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}
export function localDev(request: Request, env: Env): boolean {
  return (
    env.ENVIRONMENT === "development" &&
    env.ALLOW_DEV_AUTH === "true" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(new URL(request.url).hostname)
  );
}
async function owner(request: Request, env: Env): Promise<string> {
  if (localDev(request, env)) return "local-development";
  if (
    !env.ACCESS_ISSUER ||
    !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_ISSUER) ||
    !env.ACCESS_AUD
  )
    throw new HttpError(503, "authentication_not_configured");
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) throw new HttpError(401, "authentication_required");
  try {
    let keys = jwks.get(env.ACCESS_ISSUER);
    if (!keys) {
      keys = createRemoteJWKSet(
        new URL(`${env.ACCESS_ISSUER}/cdn-cgi/access/certs`),
      );
      jwks.set(env.ACCESS_ISSUER, keys);
    }
    const { payload } = await jwtVerify(token, keys, {
      issuer: env.ACCESS_ISSUER,
      audience: env.ACCESS_AUD,
      algorithms: ["RS256"],
    });
    if (typeof payload.sub !== "string") throw Error();
    return payload.sub;
  } catch {
    throw new HttpError(401, "invalid_access_token");
  }
}
async function body(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new HttpError(415, "json_required");
  if (Number(request.headers.get("content-length") ?? 0) > 65536)
    throw new HttpError(413, "body_too_large");
  if (!request.body) throw new HttpError(400, "empty_body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 65536) {
      await reader.cancel();
      throw new HttpError(413, "body_too_large");
    }
    chunks.push(value);
  }
  const data = new Uint8Array(length);
  let offset = 0;
  for (const c of chunks) {
    data.set(c, offset);
    offset += c.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(data));
  } catch {
    throw new HttpError(400, "invalid_json");
  }
}
async function hash(token: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
const eventColumns = `e.id, e.event_id AS eventId, e.application_id AS applicationId, e.occurred_at AS occurredAt, e.received_at AS receivedAt, e.type, e.severity, e.message, e.latency_ms AS latencyMs, e.status_code AS statusCode, e.provider, e.model, e.tokens, e.cost_usd AS costUsd`;
function clause(f: Filters, withCursor = false) {
  const conditions = [
    "e.occurred_at >= ?",
    "e.occurred_at <= ?",
    "e.received_at <= ?",
  ];
  const params: (string | number)[] = [f.from, f.to, f.cutoff];
  for (const [column, value] of [
    ["e.application_id", f.app],
    ["a.environment", f.environment],
    ["e.severity", f.severity],
  ])
    if (value) {
      conditions.push(`${column} = ?`);
      params.push(value);
    }
  if (f.q) {
    conditions.push(
      "(e.message LIKE ? ESCAPE '\\' OR e.event_id LIKE ? ESCAPE '\\' OR a.name LIKE ? ESCAPE '\\')",
    );
    const escaped = "%" + f.q.replace(/[\\%_]/g, "\\$&") + "%";
    params.push(escaped, escaped, escaped);
  }
  if (withCursor && f.cursor) {
    conditions.push("(e.occurred_at < ? OR (e.occurred_at = ? AND e.id < ?))");
    params.push(f.cursor.at, f.cursor.at, f.cursor.id);
  }
  return { sql: conditions.join(" AND "), params };
}
function cursor(events: TelemetryEvent[], more: boolean, cutoff: string) {
  const last = events.at(-1);
  return more && last
    ? btoa(JSON.stringify({ at: last.occurredAt, id: last.id, cutoff }))
    : null;
}
async function snapshot(request: Request, env: Env, now: string) {
  const f = filters(new URL(request.url), now);
  const c = clause(f);
  const rows = await env.DB.prepare(
    `SELECT ${eventColumns} FROM events e JOIN applications a ON a.id=e.application_id WHERE ${c.sql} ORDER BY e.occurred_at DESC,e.id DESC LIMIT 5001`,
  )
    .bind(...c.params)
    .all<TelemetryEvent>();
  const matched = await env.DB.prepare(
    `SELECT COUNT(*) AS total FROM events e JOIN applications a ON a.id=e.application_id WHERE ${c.sql}`,
  )
    .bind(...c.params)
    .first<{ total: number }>();
  const sample = rows.results.slice(0, 5000);
  const appRows = await env.DB.prepare(
    `SELECT a.id,a.name,a.environment,a.created_at AS createdAt,a.stale_after_seconds AS staleAfter,e.occurred_at AS lastCheckAt,e.latency_ms AS latencyMs,e.status_code AS statusCode,e.severity FROM applications a LEFT JOIN events e ON e.id=(SELECT id FROM events WHERE application_id=a.id AND type='check' ORDER BY occurred_at DESC,id DESC LIMIT 1) ORDER BY a.name`,
  ).all<{
    id: string;
    name: string;
    environment: string;
    createdAt: string;
    staleAfter: number;
    lastCheckAt: string | null;
    latencyMs: number | null;
    statusCode: number | null;
    severity: string | null;
  }>();
  const applications: Application[] = appRows.results
    .filter(
      (a) =>
        (!f.app || a.id === f.app) &&
        (!f.environment || a.environment === f.environment),
    )
    .map((a) => {
      const stale =
        !a.lastCheckAt ||
        Date.parse(now) - Date.parse(a.lastCheckAt) > a.staleAfter * 1000;
      return {
        id: a.id,
        name: a.name,
        environment: a.environment,
        createdAt: a.createdAt,
        lastCheckAt: a.lastCheckAt,
        latencyMs: a.latencyMs,
        stale,
        health: stale
          ? "unknown"
          : a.severity === "error" ||
              (a.statusCode !== null && a.statusCode >= 400)
            ? "failing"
            : "healthy",
      };
    });
  const incidents = await env.DB.prepare(
    `SELECT id,application_id AS applicationId,title,state,opened_at AS openedAt,acknowledged_at AS acknowledgedAt,resolved_at AS resolvedAt FROM incidents WHERE opened_at <= ? AND (resolved_at IS NULL OR resolved_at >= ?) ORDER BY opened_at DESC LIMIT 100`,
  )
    .bind(f.to, f.from)
    .all<Incident>();
  const page = sample.slice(0, 50);
  return json({
    generatedAt: now,
    dataAsOf: sample.length
      ? sample.reduce(
          (a, b) => (a > b.receivedAt ? a : b.receivedAt),
          sample[0].receivedAt,
        )
      : null,
    from: f.from,
    to: f.to,
    applications,
    incidents: incidents.results.filter((i) =>
      applications.some((a) => a.id === i.applicationId),
    ),
    events: page,
    nextCursor: cursor(page, (matched?.total ?? 0) > 50, f.cutoff),
    coverage: {
      matched: matched?.total ?? 0,
      sampled: sample.length,
      limited: rows.results.length > 5000,
    },
    ...metrics(sample, f.from, f.to),
  });
}
async function evaluateIncidents(env: Env, applicationId: string, now: string) {
  const fresh = new Date(Date.parse(now) - 900_000).toISOString();
  // Evaluate the current rows inside the write statements, not a previously read JS snapshot.
  // This prevents concurrent/out-of-order ingestion handlers from acting on stale check sequences.
  await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO incidents(id,application_id,state,title,opened_at)
      SELECT ?,?,'open','Three consecutive reported check failures',?
      WHERE (SELECT COUNT(*) FROM (SELECT severity,status_code,occurred_at FROM events WHERE application_id=? AND type='check' ORDER BY occurred_at DESC,id DESC LIMIT 3)
        WHERE occurred_at>=? AND (severity='error' OR status_code>=400))=3`,
    ).bind(crypto.randomUUID(), applicationId, now, applicationId, fresh),
    env.DB.prepare(
      `UPDATE incidents SET state='resolved',resolved_at=? WHERE application_id=? AND resolved_at IS NULL
      AND (SELECT COUNT(*) FROM (SELECT severity,status_code,occurred_at FROM events WHERE application_id=? AND type='check' ORDER BY occurred_at DESC,id DESC LIMIT 2)
        WHERE occurred_at>=? AND severity!='error' AND status_code IS NOT NULL AND status_code<400)=2`,
    ).bind(now, applicationId, applicationId, fresh),
  ]);
}
async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url),
    path = url.pathname,
    now = new Date().toISOString();
  if (path === "/healthz") return json({ status: "ok" });
  if (!path.startsWith("/v1/")) return env.ASSETS.fetch(request);
  if (path === "/v1/ingest/events" && request.method === "POST") {
    const token = request.headers
      .get("authorization")
      ?.match(/^Bearer ([a-f0-9-]{36}\.[a-f0-9]{64})$/i)?.[1];
    if (!token) throw new HttpError(401, "invalid_ingestion_credential");
    const app = await env.DB.prepare(
      "SELECT id FROM applications WHERE id=? AND token_hash=?",
    )
      .bind(token.split(".")[0], await hash(token))
      .first<{ id: string }>();
    if (!app) throw new HttpError(401, "invalid_ingestion_credential");
    const input = (await body(request)) as { events?: unknown };
    const events = parseEvents(input?.events, app.id, now);
    await env.DB.batch(
      events.map((e) =>
        env.DB.prepare(
          `INSERT OR IGNORE INTO events(id,event_id,application_id,occurred_at,received_at,type,severity,message,latency_ms,status_code,provider,model,tokens,cost_usd) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        ).bind(
          e.id,
          e.eventId,
          e.applicationId,
          e.occurredAt,
          e.receivedAt,
          e.type,
          e.severity,
          e.message,
          e.latencyMs,
          e.statusCode,
          e.provider,
          e.model,
          e.tokens,
          e.costUsd,
        ),
      ),
    );
    if (events.some((e) => e.type === "check"))
      await evaluateIncidents(env, app.id, now);
    return json(
      { accepted: events.length, note: "Duplicate event IDs are ignored." },
      202,
    );
  }
  const actor = await owner(request, env);
  if (request.method !== "GET") {
    if (request.headers.get("X-Watchtower-Request") !== "1")
      throw new HttpError(403, "csrf_check_failed");
    const origin = request.headers.get("origin");
    if (origin && origin !== url.origin)
      throw new HttpError(403, "invalid_origin");
  }
  if (path === "/v1/dashboard/snapshot" && request.method === "GET")
    return snapshot(request, env, now);
  if (path === "/v1/events" && request.method === "GET") {
    const f = filters(url, now),
      c = clause(f, true);
    const result = await env.DB.prepare(
      `SELECT ${eventColumns} FROM events e JOIN applications a ON a.id=e.application_id WHERE ${c.sql} ORDER BY e.occurred_at DESC,e.id DESC LIMIT 51`,
    )
      .bind(...c.params)
      .all<TelemetryEvent>();
    const events = result.results.slice(0, 50);
    return json({
      events,
      nextCursor: cursor(events, result.results.length > 50, f.cutoff),
    });
  }
  if (path === "/v1/applications" && request.method === "POST") {
    const input = (await body(request)) as Record<string, unknown>;
    if (!input || typeof input !== "object")
      throw new HttpError(400, "invalid_application");
    const name = string(input.name, 80, "name"),
      environment = string(input.environment, 40, "environment");
    const id = crypto.randomUUID(),
      key = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
    const token = `${id}.${key}`;
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO applications(id,name,environment,created_at,token_hash) VALUES(?,?,?,?,?)",
      ).bind(id, name, environment, now, await hash(token)),
      env.DB.prepare(
        "INSERT INTO audit_events(id,actor,action,object_id,occurred_at) VALUES(?,?,?,?,?)",
      ).bind(crypto.randomUUID(), actor, "application.create", id, now),
    ]);
    return json(
      {
        applicationId: id,
        ingestionToken: token,
        note: "Shown once. Store securely; do not put this credential in frontend code.",
      },
      201,
    );
  }
  const ack = path.match(
    /^\/v1\/incidents\/([a-f0-9-]{36})\/acknowledgements$/,
  );
  if (ack && request.method === "POST") {
    const result = await env.DB.batch([
      env.DB.prepare(
        `UPDATE incidents SET state='acknowledged',acknowledged_at=? WHERE id=? AND state='open'`,
      ).bind(now, ack[1]),
      env.DB.prepare(
        `INSERT INTO audit_events(id,actor,action,object_id,occurred_at) SELECT ?,?,'incident.acknowledge',?,? WHERE EXISTS(SELECT 1 FROM incidents WHERE id=? AND state='acknowledged' AND acknowledged_at=?)`,
      ).bind(crypto.randomUUID(), actor, ack[1], now, ack[1], now),
    ]);
    if (!result[0].meta.changes) throw new HttpError(409, "incident_not_open");
    return json({ acknowledged: true });
  }
  throw new HttpError(404, "not_found");
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await route(request, env);
    } catch (error) {
      const known = error instanceof HttpError;
      return json(
        {
          error: known ? error.code : "internal_error",
          requestId: crypto.randomUUID(),
        },
        known ? error.status : 500,
      );
    }
  },
  async scheduled(_controller: ScheduledController, env: Env) {
    // Retain telemetry for 30 days. Incident/audit retention is intentionally separate and must be approved.
    const cutoff = new Date(Date.now() - 30 * 86400_000).toISOString();
    await env.DB.prepare("DELETE FROM events WHERE occurred_at < ?")
      .bind(cutoff)
      .run();
  },
};
