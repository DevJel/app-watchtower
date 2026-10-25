import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  exportCsv,
  type Application,
  type Incident,
  type Snapshot,
  type TelemetryEvent,
} from "../shared/core";
import { demoApps, demoSnapshot } from "./demo";
import { Trend } from "./Charts";
function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
    search: (
      <>
        <circle cx="10" cy="10" r="6" />
        <path d="m15 15 5 5" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 7v5h-5M4 17v-5h5" />
        <path d="M6 8a7 7 0 0 1 11-2l3 3M4 15l3 3a7 7 0 0 0 11-2" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
      </>
    ),
    moon: <path d="M20 15.5A9 9 0 0 1 8.5 4 9 9 0 1 0 20 15.5Z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    x: <path d="m6 6 12 12M18 6 6 18" />,
    download: (
      <>
        <path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5" />
      </>
    ),
    arrow: <path d="m9 6 6 6-6 6" />,
    alert: (
      <>
        <path d="m12 3 10 18H2L12 3Z" />
        <path d="M12 9v5m0 3v1" />
      </>
    ),
    check: <path d="m5 12 4 4L20 5" />,
    pause: <path d="M8 5v14M16 5v14" />,
    play: <path d="m8 5 11 7-11 7V5Z" />,
    bolt: <path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z" />,
    server: (
      <>
        <rect x="3" y="3" width="18" height="7" rx="2" />
        <rect x="3" y="14" width="18" height="7" rx="2" />
        <path d="M7 6.5h.01M7 17.5h.01M11 6.5h6m-6 11h6" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.activity}
    </svg>
  );
}
function age(at: string | null) {
  if (!at) return "No data";
  const n = Math.max(0, Math.floor((Date.now() - Date.parse(at)) / 1000));
  return n < 60
    ? `${n}s ago`
    : n < 3600
      ? `${Math.floor(n / 60)}m ago`
      : n < 86400
        ? `${Math.floor(n / 3600)}h ago`
        : `${Math.floor(n / 86400)}d ago`;
}
const count = (n: number) => n.toLocaleString();
const durations = [
  { label: "5m", ms: 300_000 },
  { label: "15m", ms: 900_000 },
  { label: "1h", ms: 3600_000 },
  { label: "6h", ms: 21600_000 },
  { label: "12h", ms: 43200_000 },
  { label: "24h", ms: 86400_000 },
  { label: "7d", ms: 604800_000 },
];
const initialTheme = () => {
  try {
    return localStorage.getItem("watchtower-theme") === "dark"
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
};
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: {
      ...(init?.method
        ? { "Content-Type": "application/json", "X-Watchtower-Request": "1" }
        : {}),
      ...init?.headers,
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data)
    throw new Error(data?.error ?? `API unavailable (${response.status})`);
  return data as T;
}
function Panel({
  title,
  aside,
  children,
  className = "",
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <h2>{title}</h2>
        {aside && <span className="panel-aside">{aside}</span>}
      </div>
      {children}
    </section>
  );
}
function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog ref={ref} aria-label={title} className="modal" onCancel={close}>
      <div className="modal-top">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={close}
        >
          <Icon name="x" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export default function App() {
  const [theme, setTheme] = useState(initialTheme),
    [demo, setDemo] = useState(
      new URLSearchParams(location.search).get("demo") === "1",
    );
  const [snap, setSnap] = useState<Snapshot | null>(null),
    [catalog, setCatalog] = useState<Application[]>([]);
  const [app, setApp] = useState(""),
    [environment, setEnvironment] = useState(""),
    [severity, setSeverity] = useState(""),
    [search, setSearch] = useState(""),
    [q, setQ] = useState("");
  const [range, setRange] = useState(3600_000),
    [absolute, setAbsolute] = useState(false),
    [fromInput, setFromInput] = useState(""),
    [toInput, setToInput] = useState("");
  const [paused, setPaused] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [detail, setDetail] = useState<TelemetryEvent | null>(null),
    [adding, setAdding] = useState(false),
    [token, setToken] = useState(""),
    [saving, setSaving] = useState(false),
    [actionError, setActionError] = useState("");
  const [page, setPage] = useState(0),
    [sort, setSort] = useState<"newest" | "oldest">("newest"),
    [pending, setPending] = useState("");
  const [tick, setTick] = useState(0);
  const acknowledged = useRef(new Set<string>()),
    abort = useRef<AbortController | null>(null),
    lastQuery = useRef("");
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("watchtower-theme", theme);
    } catch {
      /* Storage can be disabled. */
    }
  }, [theme]);
  useEffect(() => {
    const timer = setTimeout(() => setQ(search), 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  const load = useCallback(async () => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setLoading(true);
    setError("");
    const end = absolute ? Date.parse(toInput) : Date.now(),
      start = absolute ? Date.parse(fromInput) : end - range;
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start >= end ||
      end - start > 7 * 86400_000
    ) {
      setError("Choose a valid time range of up to 7 days.");
      setLoading(false);
      return;
    }
    const from = new Date(start).toISOString(),
      to = new Date(end).toISOString();
    try {
      const query = new URLSearchParams({
        from,
        to,
        app,
        environment,
        severity,
        q,
      }).toString();
      lastQuery.current = query;
      const data = demo
        ? demoSnapshot(
            from,
            to,
            { app, environment, severity, q },
            acknowledged.current,
          )
        : await api<Snapshot>(`/v1/dashboard/snapshot?${query}`, {
            signal: controller.signal,
          });
      if (
        !Array.isArray(data.applications) ||
        !Array.isArray(data.events) ||
        !Array.isArray(data.buckets)
      )
        throw new Error("Unexpected API response");
      if (controller.signal.aborted) return;
      setSnap(data);
      setPage(0);
      if (demo) setCatalog(demoApps);
      else if (!app && !environment) setCatalog(data.applications);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : "Unable to refresh");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [
    demo,
    app,
    environment,
    severity,
    q,
    range,
    absolute,
    fromInput,
    toInput,
  ]);
  useEffect(() => {
    setSnap(null);
    void load();
    return () => abort.current?.abort();
  }, [load]);
  useEffect(() => {
    if (paused) return;
    const refresh = () => {
      if (!document.hidden) void load();
    };
    const timer = setInterval(refresh, 15_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [paused, load]);
  function switchMode() {
    setDemo(!demo);
    setCatalog([]);
    setApp("");
    setEnvironment("");
    setSeverity("");
    setSearch("");
    setQ("");
    setDetail(null);
    setToken("");
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Copied to clipboard");
    } catch {
      setNotice("Clipboard unavailable. Select and copy the text.");
    }
  }
  async function createApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setActionError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await api<{ ingestionToken: string }>("/v1/applications", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          environment: form.get("environment"),
        }),
      });
      setToken(result.ingestionToken);
      await load();
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : "Could not create application",
      );
    } finally {
      setSaving(false);
    }
  }
  async function acknowledge(incident: Incident) {
    setPending(incident.id);
    try {
      if (demo) {
        acknowledged.current.add(incident.id);
        setSnap((s) =>
          s
            ? {
                ...s,
                incidents: s.incidents.map((i) =>
                  i.id === incident.id
                    ? {
                        ...i,
                        state: "acknowledged",
                        acknowledgedAt: new Date().toISOString(),
                      }
                    : i,
                ),
              }
            : s,
        );
      } else {
        await api(`/v1/incidents/${incident.id}/acknowledgements`, {
          method: "POST",
          body: "{}",
        });
        await load();
      }
      setNotice(
        demo ? "Demo incident acknowledged locally" : "Incident acknowledged",
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Acknowledgement failed");
    } finally {
      setPending("");
    }
  }
  async function older() {
    if (!snap?.nextCursor) return;
    setPaused(true);
    setPending("older");
    try {
      const data = await api<{
        events: TelemetryEvent[];
        nextCursor: string | null;
      }>(
        `/v1/events?${lastQuery.current}&cursor=${encodeURIComponent(snap.nextCursor)}`,
      );
      setSnap((s) =>
        s
          ? {
              ...s,
              events: [
                ...s.events,
                ...data.events.filter(
                  (e) => !s.events.some((old) => old.id === e.id),
                ),
              ],
              nextCursor: data.nextCursor,
            }
          : s,
      );
      setNotice("Refresh paused while you review older events");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not load events");
    } finally {
      setPending("");
    }
  }
  function download() {
    if (!snap) return;
    const blob = new Blob([exportCsv(snap.events, snap.applications)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${demo ? "DEMO-" : ""}watchtower-loaded-events.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setNotice(
      `Exported ${snap.events.length} loaded events${demo ? " (demo)" : ""}`,
    );
  }
  const health = {
    healthy:
      snap?.applications.filter((a) => a.health === "healthy").length ?? 0,
    failing:
      snap?.applications.filter((a) => a.health === "failing").length ?? 0,
    unknown:
      snap?.applications.filter((a) => a.health === "unknown").length ?? 0,
  };
  const active = snap?.incidents.filter((i) => i.state !== "resolved") ?? [],
    apps = snap?.applications ?? [];
  const sorted = snap
    ? [...snap.events].sort((a, b) =>
        sort === "newest"
          ? b.occurredAt.localeCompare(a.occurredAt)
          : a.occurredAt.localeCompare(b.occurredAt),
      )
    : [];
  const rows = sorted.slice(page * 25, (page + 1) * 25),
    pages = Math.max(1, Math.ceil(sorted.length / 25));
  const staleSnapshot =
    snap && Date.now() - Date.parse(snap.generatedAt) > 45_000;
  const status = demo
    ? "Demo workspace"
    : error
      ? "Connection unavailable"
      : paused
        ? "Refresh paused"
        : snap
          ? "API connected · polling"
          : loading
            ? "Connecting to API"
            : "API not connected";
  const displayZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  void tick;
  return (
    <>
      <a className="skip" href="#main">
        Skip to dashboard
      </a>
      <header className="topbar">
        <a href="#main" className="brand">
          <span className="brand-mark">
            <Icon name="activity" size={23} />
          </span>
          <span>
            watchtower<span className="brand-sub">APPLICATION MONITORING</span>
          </span>
        </a>
        <nav aria-label="Dashboard sections">
          <a href="#main" className="nav-current">
            Overview
          </a>
          <a href="#incidents">
            Incidents
            {active.length > 0 && (
              <span className="nav-count">{active.length}</span>
            )}
          </a>
          <a href="#events">Events</a>
        </nav>
        <div className="header-actions">
          <button
            className="theme-switch"
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
            aria-pressed={theme === "dark"}
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            <Icon name={theme === "light" ? "sun" : "moon"} />
            <span>{theme === "light" ? "Light" : "Dark"}</span>
            <span className="toggle-track">
              <span />
            </span>
          </button>
          <span className="private-label">Private workspace</span>
        </div>
      </header>
      {demo && (
        <div className="demo-banner">
          <span>
            <strong>DEMO DATA</strong> Simulated locally. No production
            applications are connected in this view.
          </span>
          <button onClick={switchMode}>
            Switch to real API <Icon name="arrow" size={15} />
          </button>
        </div>
      )}
      <main id="main">
        <div className="page-heading">
          <div>
            <div className="eyebrow">OPERATIONS / OVERVIEW</div>
            <h1>Your applications, at a glance.</h1>
            <p>
              One place for health, performance, and the signals that need your
              attention.
            </p>
          </div>
          <button
            className="button primary"
            onClick={() => {
              if (demo) {
                switchMode();
              }
              setAdding(true);
              setToken("");
              setActionError("");
            }}
          >
            <Icon name="plus" />
            Add application
          </button>
        </div>
        <div className="connection-row">
          <span
            className={`connection ${demo ? "demo" : error || staleSnapshot ? "warning" : snap ? "ok" : ""}`}
          >
            <span className="dot" />
            {status}
          </span>
          <span className="connection-detail">
            {snap
              ? `Updated ${age(snap.generatedAt)}`
              : "Waiting for your monitoring backend"}{" "}
            ·{" "}
            {demo
              ? "Simulated checks"
              : "Reported checks, not independent probes"}
          </span>
          <div className="connection-controls">
            <button
              className="text-button"
              aria-pressed={paused}
              onClick={() => setPaused(!paused)}
            >
              <Icon name={paused ? "play" : "pause"} size={15} />
              {paused ? "Resume" : "Pause"}
            </button>
            <button
              className="text-button"
              disabled={loading}
              onClick={() => void load()}
            >
              <Icon name="refresh" size={15} />
              {loading ? "Refreshing…" : "Refresh"}
            </button>
            {!demo && (
              <button className="text-button" onClick={switchMode}>
                Try demo
              </button>
            )}
          </div>
        </div>
        {(error || staleSnapshot) && (
          <div className="message warning" role="alert">
            <Icon name="alert" />
            <div>
              <strong>
                {error
                  ? error.replaceAll("_", " ")
                  : "Dashboard snapshot is stale"}
              </strong>
              <p>
                {snap
                  ? "Last successful results are retained. Check the API connection or resume refresh."
                  : "The API needs configuration and an authenticated session. You can explore with clearly labeled demo data."}
              </p>
            </div>
          </div>
        )}
        <section className="filterbar" aria-label="Dashboard filters">
          <div className="search-control">
            <Icon name="search" />
            <input
              aria-label="Search events"
              placeholder="Search events, applications, event IDs…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <label className="sr-only" htmlFor="app-filter">
            Application
          </label>
          <select
            id="app-filter"
            value={app}
            onChange={(e) => setApp(e.target.value)}
          >
            <option value="">All applications</option>
            {catalog.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="environment-filter">
            Environment
          </label>
          <select
            id="environment-filter"
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
          >
            <option value="">All environments</option>
            {[...new Set(catalog.map((a) => a.environment))].map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="severity-filter">
            Severity
          </label>
          <select
            id="severity-filter"
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
          >
            <option value="">All severities</option>
            <option value="error">Error</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
          {(app || environment || severity || search) && (
            <button
              className="text-button"
              onClick={() => {
                setApp("");
                setEnvironment("");
                setSeverity("");
                setSearch("");
                setQ("");
              }}
            >
              Clear filters
            </button>
          )}
        </section>
        <div className="timebar">
          <div className="time-presets" aria-label="Time window">
            {durations.map((d) => (
              <button
                key={d.label}
                aria-pressed={!absolute && range === d.ms}
                onClick={() => {
                  setAbsolute(false);
                  setRange(d.ms);
                }}
              >
                {d.label}
              </button>
            ))}
            <button
              aria-pressed={absolute}
              onClick={() => {
                if (!fromInput) {
                  const local = (date: Date) =>
                    new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
                      .toISOString()
                      .slice(0, 16);
                  setFromInput(local(new Date(Date.now() - range)));
                  setToInput(local(new Date()));
                }
                setAbsolute(!absolute);
              }}
            >
              Custom
            </button>
          </div>
          <span className="timezone">{displayZone} · 15s refresh</span>
        </div>
        {absolute && (
          <div className="absolute-range">
            <label>
              From
              <input
                type="datetime-local"
                value={fromInput}
                onChange={(e) => setFromInput(e.target.value)}
              />
            </label>
            <label>
              To
              <input
                type="datetime-local"
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
              />
            </label>
            <span>Maximum 7 days · fixed window</span>
          </div>
        )}
        {snap?.coverage.limited && (
          <div className="message warning" role="status">
            Metrics use the latest {count(snap.coverage.sampled)} of{" "}
            {count(snap.coverage.matched)} matching events. Narrow the time
            range for full coverage.
          </div>
        )}
        <section className="stats" aria-label="Summary metrics">
          <div className="stat">
            <div className="stat-label">
              APPLICATION HEALTH <Icon name="server" />
            </div>
            <div className="stat-value">
              {snap ? health.healthy : "—"}
              <span>/ {snap ? apps.length : "—"} healthy</span>
            </div>
            <div className="stat-foot">
              {snap ? (
                <>
                  <span className={health.failing ? "text-risk" : ""}>
                    {health.failing} failing
                  </span>
                  <span>·</span>
                  <span>{health.unknown} unknown</span>
                </>
              ) : (
                <span>Awaiting reported check data</span>
              )}
              <span className="current-tag">CURRENT</span>
            </div>
          </div>
          <div className="stat">
            <div className="stat-label">
              REQUEST EVENTS <Icon name="activity" />
            </div>
            <div className="stat-value">
              {snap ? count(snap.metrics.requests) : "—"}
            </div>
            <div className="stat-foot">Observed in selected window</div>
          </div>
          <div className="stat">
            <div className="stat-label">
              REQUEST ERROR RATE <Icon name="alert" />
            </div>
            <div className="stat-value">
              {snap?.metrics.errorRate == null
                ? "—"
                : `${snap.metrics.errorRate.toFixed(1)}%`}
            </div>
            <div className="stat-foot">
              {snap
                ? `${count(snap.metrics.errors)} errors / ${count(snap.metrics.requests)} request events`
                : "Awaiting request telemetry"}
            </div>
          </div>
          <div className="stat">
            <div className="stat-label">
              P95 REQUEST LATENCY <Icon name="bolt" />
            </div>
            <div className="stat-value">
              {snap?.metrics.p95 == null ? "—" : Math.round(snap.metrics.p95)}
              {snap?.metrics.p95 != null && <span>ms</span>}
            </div>
            <div className="stat-foot">
              Nearest-rank · recorded latency samples
            </div>
          </div>
        </section>
        <div className="panel-grid">
          <Panel
            title="Request latency"
            aside={
              <>
                <span className="legend-dot purple" />
                p95 · milliseconds
              </>
            }
          >
            <div className="chart-summary">
              <strong>
                {snap?.metrics.p95 == null
                  ? "No samples yet"
                  : `${Math.round(snap.metrics.p95)} ms`}
              </strong>
              <span>Selected window · observed samples only</span>
            </div>
            <Trend buckets={snap?.buckets ?? []} kind="latency" />
          </Panel>
          <Panel
            title="Request volume"
            aside={
              <>
                <span className="legend-dot blue" />
                Request events
              </>
            }
          >
            <div className="chart-summary">
              <strong>
                {snap ? count(snap.metrics.requests) : "—"}
                <small> requests</small>
              </strong>
              <span>
                {snap ? count(snap.metrics.errors) : "—"} reported errors in
                this window
              </span>
            </div>
            <Trend buckets={snap?.buckets ?? []} kind="requests" />
          </Panel>
        </div>
        <div className="panel-grid health-grid">
          <Panel
            title="Application health"
            aside={<span>Latest reported check · current state</span>}
          >
            <div className="service-list">
              {!apps.length ? (
                <div className="empty-state">
                  <span className="empty-icon">
                    <Icon name="server" size={28} />
                  </span>
                  <h3>
                    {snap
                      ? "No applications in this view"
                      : "Your monitoring starts here"}
                  </h3>
                  <p>
                    {snap
                      ? "Add an application and send its first check event, or clear your filters."
                      : "Connect the API or open the demo to explore the dashboard."}
                  </p>
                </div>
              ) : (
                apps.map((a) => (
                  <button
                    key={a.id}
                    className="service-row"
                    onClick={() => {
                      setApp(a.id);
                      document
                        .getElementById("events")
                        ?.scrollIntoView({ behavior: "instant" });
                    }}
                  >
                    <span className={`service-icon ${a.health}`}>
                      <Icon name="server" />
                    </span>
                    <span className="service-name">
                      <strong>{a.name}</strong>
                      <span>
                        {a.environment} · {age(a.lastCheckAt)}
                      </span>
                    </span>
                    <span
                      className="service-trend"
                      aria-label="Reported check states over selected time window"
                    >
                      {(
                        snap?.checkTimeline[a.id] ?? Array(12).fill("unknown")
                      ).map((s, i) => (
                        <span
                          key={i}
                          className={s}
                          title={`${snap ? new Date(snap.buckets[i].at).toLocaleString() : ""}: ${s}`}
                        />
                      ))}
                    </span>
                    <span className={`status-badge ${a.health}`}>
                      <span className="dot" />
                      {a.health === "unknown" && a.stale
                        ? "Unknown / stale"
                        : a.health}
                    </span>
                    <Icon name="arrow" size={15} />
                  </button>
                ))
              )}
            </div>
            <div className="panel-footer">
              <span className="legend-dot green" />
              Healthy <span className="legend-dot red" />
              Failing <span className="legend-dot gray" />
              No check sample{" "}
              <span className="footer-note">
                Timeline is samples, not uptime %
              </span>
            </div>
          </Panel>
          <div id="incidents">
            <Panel
              title="Incidents"
              aside={
                <span className={`count-badge ${active.length ? "risk" : ""}`}>
                  {snap ? `${active.length} active in window` : "Not connected"}
                </span>
              }
            >
              {!snap?.incidents.length ? (
                <div className="empty-state compact">
                  <Icon name={snap ? "check" : "alert"} size={28} />
                  <h3>
                    {snap
                      ? "No incidents in this window"
                      : "Incident data unavailable"}
                  </h3>
                  <p>
                    {snap
                      ? "Three failed reported checks open an incident. Alerts are not configured in this version."
                      : "Connect the API to load incidents. No incident status can be determined yet."}
                  </p>
                </div>
              ) : (
                <div className="incident-list">
                  {snap.incidents.map((i) => (
                    <article className="incident" key={i.id}>
                      <div className="incident-top">
                        <span
                          className={`status-badge ${i.state === "resolved" ? "healthy" : "failing"}`}
                        >
                          {i.state}
                        </span>
                        <span>{age(i.openedAt)}</span>
                      </div>
                      <h3>
                        {apps.find((a) => a.id === i.applicationId)?.name ??
                          "Application"}
                      </h3>
                      <p>{i.title}</p>
                      <div className="incident-bottom">
                        <span>Notification delivery not configured</span>
                        {i.state === "open" && (
                          <button
                            className="button small"
                            disabled={pending === i.id}
                            onClick={() => void acknowledge(i)}
                          >
                            {pending === i.id
                              ? "Saving…"
                              : `Acknowledge${demo ? " (demo)" : ""}`}
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </div>
        <div className="panel-grid integration-grid">
          <Panel
            title="GitHub delivery signals"
            aside={<span className="integration-label">Telemetry only</span>}
          >
            <div className="integration-summary">
              <span className="integration-symbol">⌘</span>
              <div>
                <strong>
                  {snap ? count(snap.metrics.githubEvents) : "—"}
                  <small> received events</small>
                </strong>
                <p>GitHub App webhook integration is not connected.</p>
              </div>
            </div>
            <p className="panel-note">
              Send sanitized workflow or deployment metadata with event type{" "}
              <code>github</code>. No repository access is implied.
            </p>
          </Panel>
          <Panel
            title="AI usage signals"
            aside={<span className="integration-label">Metadata only</span>}
          >
            <div className="ai-metrics">
              <div>
                <strong>{snap ? count(snap.metrics.aiRequests) : "—"}</strong>
                <span>AI events</span>
              </div>
              <div>
                <strong>
                  {snap?.metrics.tokens == null
                    ? "—"
                    : count(snap.metrics.tokens)}
                </strong>
                <span>
                  {snap
                    ? `${snap.metrics.tokenRequests}/${snap.metrics.aiRequests} events report tokens`
                    : "Reported tokens"}
                </span>
              </div>
              <div>
                <strong>
                  {snap?.metrics.costUsd == null
                    ? "—"
                    : `$${snap.metrics.costUsd.toFixed(4)}`}
                </strong>
                <span>
                  {snap
                    ? `${snap.metrics.pricedRequests}/${snap.metrics.aiRequests} events priced (USD)`
                    : "Reported cost (USD)"}
                </span>
              </div>
            </div>
            <p className="panel-note">
              No prompts or responses collected. AI diagnosis is not enabled.
            </p>
          </Panel>
        </div>
        <section id="events" className="panel events-panel">
          <div className="panel-heading">
            <div className="events-heading">
              <h2>Event explorer</h2>
              <span className="count-badge">
                {snap ? count(snap.coverage.matched) : 0}
              </span>
            </div>
            <div className="event-controls">
              <label className="sr-only" htmlFor="sort">
                Sort loaded events
              </label>
              <select
                id="sort"
                value={sort}
                onChange={(e) => {
                  setPaused(true);
                  setSort(e.target.value as "newest" | "oldest");
                  setPage(0);
                }}
              >
                <option value="newest">Newest loaded first</option>
                <option value="oldest">Oldest loaded first</option>
              </select>
              <button
                className="button small"
                disabled={!snap?.events.length}
                onClick={download}
              >
                <Icon name="download" size={15} />
                Export loaded
              </button>
            </div>
          </div>
          <div className="table-scroll">
            <table className="event-table">
              <caption className="sr-only">
                Filtered, loaded telemetry events. All times displayed in{" "}
                {displayZone}.
              </caption>
              <thead>
                <tr>
                  <th>TIME</th>
                  <th>APPLICATION</th>
                  <th>SEVERITY</th>
                  <th>EVENT</th>
                  <th>DURATION</th>
                  <th>TYPE</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td className="time-cell" title={e.occurredAt}>
                      {new Date(e.occurredAt).toLocaleTimeString([], {
                        hour12: false,
                      })}
                    </td>
                    <td>
                      {apps.find((a) => a.id === e.applicationId)?.name ??
                        e.applicationId}
                    </td>
                    <td>
                      <span className={`severity ${e.severity}`}>
                        <span className="dot" />
                        {e.severity}
                      </span>
                    </td>
                    <td>
                      <button
                        className="event-link"
                        onClick={() => {
                          setPaused(true);
                          setDetail(e);
                        }}
                      >
                        {e.message}
                        <Icon name="arrow" size={13} />
                      </button>
                    </td>
                    <td className="time-cell">
                      {e.latencyMs === null
                        ? "—"
                        : `${e.latencyMs.toLocaleString()} ms`}
                    </td>
                    <td>
                      <span className="type-tag">{e.type}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && (
              <div className="empty-state">
                <Icon name="search" size={28} />
                <h3>{loading ? "Loading events…" : "No matching events"}</h3>
                <p>
                  {q || severity
                    ? "Try another search or clear your filters."
                    : "Your event stream will appear here once telemetry arrives."}
                </p>
              </div>
            )}
          </div>
          <div className="table-footer">
            <span>
              {rows.length
                ? `${page * 25 + 1}–${Math.min((page + 1) * 25, sorted.length)} of ${count(sorted.length)} loaded`
                : "0 events loaded"}
              {snap && snap.coverage.matched > sorted.length
                ? ` · ${count(snap.coverage.matched)} matched`
                : ""}
            </span>
            <div>
              {snap?.nextCursor && (
                <button
                  className="text-button"
                  disabled={pending === "older"}
                  onClick={() => void older()}
                >
                  {pending === "older" ? "Loading…" : "Load older"}
                </button>
              )}
              <button
                className="button small"
                disabled={!page}
                onClick={() => {
                  setPaused(true);
                  setPage(page - 1);
                }}
              >
                Previous
              </button>
              <span>
                {page + 1} / {pages}
              </span>
              <button
                className="button small"
                disabled={page + 1 >= pages}
                onClick={() => {
                  setPaused(true);
                  setPage(page + 1);
                }}
              >
                Next
              </button>
            </div>
          </div>
        </section>
        <footer className="page-footer">
          <span>
            <Icon name="activity" size={15} />
            Watchtower <span>·</span> Your applications. Your visibility.
          </span>
          <span>
            {demo
              ? "DEMO DATA"
              : snap?.dataAsOf
                ? `Latest matching event received ${age(snap.dataAsOf)}`
                : "No telemetry received"}{" "}
            · No autonomous actions
          </span>
        </footer>
      </main>
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
      {detail && (
        <Modal title="Event details" close={() => setDetail(null)}>
          <div className="detail-tags">
            <span className={`severity ${detail.severity}`}>
              {detail.severity}
            </span>
            <span className="type-tag">{detail.type}</span>
            {demo && <span className="type-tag">DEMO DATA</span>}
          </div>
          <p className="detail-message">{detail.message}</p>
          <dl className="detail-list">
            {Object.entries({
              Application:
                apps.find((a) => a.id === detail.applicationId)?.name ??
                detail.applicationId,
              "Occurred (UTC)": detail.occurredAt,
              "Received (UTC)": detail.receivedAt,
              "Event ID": detail.eventId,
              "Latency (ms)": detail.latencyMs,
              "HTTP status": detail.statusCode,
              Provider: detail.provider,
              Model: detail.model,
              Tokens: detail.tokens,
              "Reported cost (USD)": detail.costUsd,
            }).map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value ?? "Not available"}</dd>
              </div>
            ))}
          </dl>
          <button className="button" onClick={() => void copy(detail.eventId)}>
            Copy event ID
          </button>
        </Modal>
      )}
      {adding && (
        <Modal
          title={token ? "Application created" : "Add application"}
          close={() => {
            setAdding(false);
            setToken("");
          }}
        >
          {token ? (
            <>
              <div className="message warning">
                <strong>This ingestion credential is shown once.</strong>
                <p>
                  Store it securely on your application server. Never include it
                  in browser code.
                </p>
              </div>
              <label className="token-label">
                Ingestion credential
                <textarea
                  readOnly
                  rows={4}
                  value={token}
                  aria-label="Ingestion credential shown once"
                />
              </label>
              <button className="button" onClick={() => void copy(token)}>
                Copy credential
              </button>
              <p className="modal-note">
                Send check/request metadata to{" "}
                <code>POST /v1/ingest/events</code>. This does not configure an
                independent probe or alert channel. See the repository setup
                guide for the request contract.
              </p>
            </>
          ) : (
            <form onSubmit={createApplication}>
              <p className="modal-note">
                Register a service and create a scoped, server-side ingestion
                credential. Checks must be reported by your application or
                trusted probe.
              </p>
              <label>
                Application name
                <input
                  name="name"
                  required
                  maxLength={80}
                  placeholder="e.g. Commerce API"
                  autoFocus
                />
              </label>
              <label>
                Environment
                <select name="environment">
                  <option value="production">Production</option>
                  <option value="staging">Staging</option>
                  <option value="development">Development</option>
                </select>
              </label>
              {actionError && (
                <p role="alert" className="text-risk">
                  {actionError.replaceAll("_", " ")}
                </p>
              )}
              <div className="form-actions">
                <button
                  type="button"
                  className="button"
                  onClick={() => setAdding(false)}
                >
                  Cancel
                </button>
                <button className="button primary" disabled={saving}>
                  {saving ? "Creating…" : "Create application"}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
