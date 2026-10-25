import { describe, it, expect } from "vitest";
import {
  csvCell,
  exportCsv,
  metrics,
  quantile,
  redact,
  type TelemetryEvent,
} from "../../shared/core";
import { filters, parseEvents } from "../../worker/validation";
const now = "2026-10-24T15:30:00.000Z";
const base = {
  eventId: "example-1",
  occurredAt: now,
  type: "request",
  severity: "info",
  message: "GET /health",
  latencyMs: 120,
  statusCode: 200,
};
const event = (overrides: Partial<TelemetryEvent> = {}): TelemetryEvent => ({
  ...parseEvents([base], "app", now)[0],
  ...overrides,
});
describe("telemetry and metrics", () => {
  it("uses nearest-rank observed quantiles and preserves missing latency", () => {
    expect(quantile([1, 2, 3, 4, 100], 0.95)).toBe(100);
    expect(quantile([], 0.95)).toBeNull();
  });
  it("counts only real request records in traffic denominators", () => {
    const m = metrics(
      [
        event(),
        event({ statusCode: 503 }),
        event({ type: "check", statusCode: 500 }),
      ],
      "2026-10-24T14:30:00Z",
      now,
    );
    expect(m.metrics.requests).toBe(2);
    expect(m.metrics.errorRate).toBe(50);
  });
  it("does not treat absent AI tokens, prices, or request latency as zero", () => {
    const m = metrics(
      [event({ type: "ai", latencyMs: null })],
      "2026-10-24T14:30:00Z",
      now,
    );
    expect(m.metrics.costUsd).toBeNull();
    expect(m.metrics.tokens).toBeNull();
    expect(m.metrics.p95).toBeNull();
    expect(m.metrics.errorRate).toBeNull();
  });
  it("preserves explicitly reported zero tokens and zero cost", () => {
    const m = metrics(
      [event({ type: "ai", tokens: 0, costUsd: 0 })],
      "2026-10-24T14:30:00Z",
      now,
    );
    expect(m.metrics.tokens).toBe(0);
    expect(m.metrics.costUsd).toBe(0);
  });
  it("rejects untrusted fields and invalid values", () => {
    expect(() =>
      parseEvents([{ ...base, prompt: "secret" }], "app", now),
    ).toThrow("unknown_event_fields");
    expect(() =>
      parseEvents([{ ...base, latencyMs: -1 }], "app", now),
    ).toThrow();
    expect(() => parseEvents([{ ...base, tokens: 1.1 }], "app", now)).toThrow();
  });
  it("rejects large batches, future events, and invalid check outcomes", () => {
    expect(() => parseEvents(Array(101).fill(base), "app", now)).toThrow();
    expect(() =>
      parseEvents([{ ...base, occurredAt: "2026-10-25" }], "app", now),
    ).toThrow();
    expect(() =>
      parseEvents([{ ...base, type: "check", statusCode: null }], "app", now),
    ).toThrow();
  });
  it("redacts common secret patterns", () => {
    expect(redact("Bearer abc123 token=hidden")).not.toContain("abc123");
    expect(redact('"password": "hidden"')).not.toContain("hidden");
  });
  it("neutralizes CSV formulas, including leading whitespace, and quotes safely", () => {
    expect(csvCell(' =HYPERLINK("bad")')).toBe('"\' =HYPERLINK(""bad"")"');
    expect(csvCell("@cmd")).toContain("'@");
    expect(exportCsv([event({ message: "=cmd" })], [])).toContain("'=cmd");
  });
  it("validates date windows and cursors", () => {
    expect(() =>
      filters(new URL("https://app/v1/events?from=bad"), now),
    ).toThrow();
    expect(() =>
      filters(new URL("https://app/v1/events?cursor=not-json"), now),
    ).toThrow();
    expect(() =>
      filters(
        new URL("https://app/v1/events?from=2026-10-01&to=2026-10-24"),
        now,
      ),
    ).toThrow();
  });
  it("keeps missing check buckets unknown", () => {
    const m = metrics([event({ type: "check" })], "2026-10-24T14:30:00Z", now);
    expect(m.checkTimeline.app.filter((x) => x === "unknown")).toHaveLength(11);
  });
});
