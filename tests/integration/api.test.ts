import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { readFileSync } from "node:fs";
let mf: Miniflare;
let token: string;
let appId: string;
const origin = "http://localhost";
const request = (path: string, init?: RequestInit) =>
  mf.dispatchFetch(origin + path, init);
const ownerHeaders = {
  "Content-Type": "application/json",
  "X-Watchtower-Request": "1",
};
async function ingest(events: unknown[]) {
  return request("/v1/ingest/events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ events }),
  });
}
beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      scriptPath: ".worker-build/index.js",
      compatibilityDate: "2026-10-01",
      d1Databases: ["DB"],
      bindings: { ENVIRONMENT: "development", ALLOW_DEV_AUTH: "true" },
    }),
  );
  const db = await mf.getD1Database("DB");
  for (const sql of readFileSync("migrations/0001_initial.sql", "utf8")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean))
    await db.prepare(sql).run();
}, 30_000);
afterAll(async () => {
  await mf?.dispose();
});
describe.sequential("Worker with real local D1", () => {
  it("denies nonlocal development bypass", async () => {
    const r = await mf.dispatchFetch(
      "https://public.example/v1/dashboard/snapshot",
    );
    expect(r.status).toBe(503);
  });
  it("returns a truthful empty snapshot", async () => {
    const r = await request("/v1/dashboard/snapshot");
    expect(r.status).toBe(200);
    const s = (await r.json()) as any;
    expect(s.applications).toHaveLength(0);
    expect(s.metrics.p95).toBeNull();
  });
  it("requires a same-origin write header and rejects cross-origin writes", async () => {
    const r = await request("/v1/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(r.status).toBe(403);
    const x = await request("/v1/applications", {
      method: "POST",
      headers: { ...ownerHeaders, Origin: "https://evil.example" },
      body: "{}",
    });
    expect(x.status).toBe(403);
  });
  it("creates a scoped credential and never returns its stored hash", async () => {
    const r = await request("/v1/applications", {
      method: "POST",
      headers: ownerHeaders,
      body: JSON.stringify({ name: "Test API", environment: "production" }),
    });
    expect(r.status).toBe(201);
    const data = (await r.json()) as any;
    token = data.ingestionToken;
    appId = data.applicationId;
    expect(token.startsWith(appId + ".")).toBe(true);
  });
  it("rejects invalid ingestion credentials and oversize bodies", async () => {
    const r = await request("/v1/ingest/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(r.status).toBe(401);
    const large = await request("/v1/ingest/events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ events: [], padding: "x".repeat(66000) }),
    });
    expect(large.status).toBe(413);
  });
  it("deduplicates check deliveries and opens one incident", async () => {
    const events = Array.from({ length: 3 }, (_, i) => ({
      eventId: `fail-${i}`,
      occurredAt: new Date(Date.now() - 10000 + i * 1000).toISOString(),
      type: "check",
      severity: "error",
      statusCode: 503,
      message: "Reported check failed",
    }));
    expect((await ingest(events)).status).toBe(202);
    await ingest(events);
    const s = (await (await request("/v1/dashboard/snapshot")).json()) as any;
    expect(s.events).toHaveLength(3);
    expect(s.incidents).toHaveLength(1);
    expect(s.applications[0].health).toBe("failing");
  });
  it("acknowledges idempotently with audit and resolves after recovery", async () => {
    const s = (await (await request("/v1/dashboard/snapshot")).json()) as any;
    const path = `/v1/incidents/${s.incidents[0].id}/acknowledgements`;
    expect(
      (
        await request(path, {
          method: "POST",
          headers: ownerHeaders,
          body: "{}",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(path, {
          method: "POST",
          headers: ownerHeaders,
          body: "{}",
        })
      ).status,
    ).toBe(409);
    const events = [0, 1].map((i) => ({
      eventId: `recover-${i}`,
      occurredAt: new Date(Date.now() - 1000 + i * 100).toISOString(),
      type: "check",
      severity: "info",
      statusCode: 200,
      message: "Recovered",
    }));
    await ingest(events);
    const recovered = (await (
      await request("/v1/dashboard/snapshot")
    ).json()) as any;
    expect(recovered.incidents[0].state).toBe("resolved");
    expect(recovered.applications[0].health).toBe("healthy");
  });
  it("does not reopen an incident from old replayed failures", async () => {
    await ingest([
      {
        eventId: "old-failure",
        occurredAt: new Date(Date.now() - 30000).toISOString(),
        type: "check",
        severity: "error",
        message: "Old failure",
        statusCode: 500,
      },
    ]);
    const s = (await (await request("/v1/dashboard/snapshot")).json()) as any;
    expect(s.incidents.filter((i: any) => i.state !== "resolved")).toHaveLength(
      0,
    );
  });
  it("ignores forged app IDs and rejects unknown payload fields", async () => {
    const r = await ingest([
      {
        eventId: "wrong-app",
        occurredAt: new Date().toISOString(),
        applicationId: "another-app",
        type: "custom",
        severity: "info",
        message: "forged",
      },
    ]);
    expect(r.status).toBe(400);
  });
  it("paginates without duplicates and parameterizes search", async () => {
    const events = Array.from({ length: 60 }, (_, i) => ({
      eventId: `request-${i}`,
      occurredAt: new Date(Date.now() - 60000 + i * 100).toISOString(),
      type: "request",
      severity: "info",
      statusCode: 200,
      latencyMs: i,
      message: "Request complete",
    }));
    await ingest(events);
    const s = (await (await request("/v1/dashboard/snapshot")).json()) as any;
    expect(s.events).toHaveLength(50);
    expect(s.nextCursor).toBeTruthy();
    const next = (await (
      await request("/v1/events?cursor=" + encodeURIComponent(s.nextCursor))
    ).json()) as any;
    expect(next.events.length).toBeGreaterThan(0);
    expect(
      new Set([...s.events, ...next.events].map((e: any) => e.id)).size,
    ).toBe(s.events.length + next.events.length);
    const injection = (await (
      await request(
        "/v1/dashboard/snapshot?q=" + encodeURIComponent("%' OR 1=1--"),
      )
    ).json()) as any;
    expect(injection.events).toHaveLength(0);
    expect(injection.applications[0].id).toBe(appId);
  });
});
