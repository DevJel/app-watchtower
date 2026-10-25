import { useEffect, useId, useRef, useState } from "react";
import type { Bucket } from "../shared/core";
const time = (at: string) =>
  new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
export function Trend({
  buckets,
  kind,
}: {
  buckets: Bucket[];
  kind: "latency" | "requests";
}) {
  const id = useId();
  const host = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(640);
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver((entries) =>
      setChartWidth(entries[0].contentRect.width),
    );
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  const values = buckets.map((b) =>
    kind === "latency" ? b.latencyP95 : b.requests,
  );
  const hasData =
    kind === "latency"
      ? values.some((v) => v !== null)
      : values.some((v) => v! > 0);
  if (!hasData)
    return (
      <div ref={host} className="chart-empty">
        <svg
          className="empty-grid"
          width="48"
          height="48"
          viewBox="0 0 48 48"
          aria-hidden="true"
        >
          <path
            d="M7 35h34M7 35V10m4 18 8-9 8 5 10-14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
        <strong>
          {!buckets.length
            ? "Telemetry unavailable"
            : `No ${kind === "latency" ? "latency samples" : "request events"} in this window`}
        </strong>
        <span>
          {!buckets.length
            ? "Connect the API to load your measurements."
            : "Data appears when your applications send request telemetry."}
        </span>
      </div>
    );
  const rawMax = Math.max(1, ...values.flatMap((v) => (v === null ? [] : [v])));
  const step = Math.pow(10, Math.floor(Math.log10(rawMax / 4)));
  const unit = Math.ceil(rawMax / (4 * step)) * step;
  const max = unit * 4;
  const left = 42,
    right = Math.max(220, chartWidth - 24),
    top = 20,
    bottom = 154,
    width = right - left;
  const x = (i: number) => left + (i * width) / Math.max(1, buckets.length - 1);
  const y = (value: number) => bottom - (value / max) * (bottom - top);
  let path = "";
  let disconnected = true;
  values.forEach((v, i) => {
    if (v === null) disconnected = true;
    else {
      path += `${disconnected ? "M" : "L"}${x(i)},${y(v)} `;
      disconnected = false;
    }
  });
  return (
    <div ref={host}>
      <svg
        className="trend"
        viewBox={`0 0 ${chartWidth} 190`}
        role="img"
        aria-labelledby={id}
      >
        <title id={id}>
          {kind === "latency"
            ? "p95 request latency, milliseconds, in 12 time buckets"
            : "Request event count in 12 time buckets"}
          . Exact values in the data table below.
        </title>
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <line
              x1={left}
              x2={right}
              y1={y(unit * i)}
              y2={y(unit * i)}
              className="gridline"
            />
            <text x={left - 9} y={y(unit * i) + 4} textAnchor="end">
              {new Intl.NumberFormat(undefined, {
                notation: "compact",
                maximumFractionDigits: 1,
              }).format(unit * i)}
            </text>
          </g>
        ))}
        {kind === "latency" ? (
          <>
            <path d={path} fill="none" className="latency-line" />
            {values.map((v, i) =>
              v === null ? null : (
                <circle
                  key={i}
                  cx={x(i)}
                  cy={y(v)}
                  r="3.5"
                  className="latency-point"
                  tabIndex={0}
                  aria-label={`${new Date(buckets[i].at).toLocaleString()}: ${v} milliseconds`}
                >
                  <title>
                    {time(buckets[i].at)} · {v} ms
                  </title>
                </circle>
              ),
            )}
          </>
        ) : (
          buckets.map((b, i) => (
            <rect
              key={i}
              x={left + i * (width / 12) + 5}
              width={width / 12 - 10}
              y={y(b.requests)}
              height={bottom - y(b.requests)}
              rx="3"
              className="request-bar"
              tabIndex={0}
              aria-label={`${new Date(b.at).toLocaleString()}: ${b.requests} request events, ${b.errors} errors`}
            >
              <title>
                {time(b.at)} · {b.requests} requests · {b.errors} errors
              </title>
            </rect>
          ))
        )}
        {(chartWidth < 420 ? [0, 6, 11] : [0, 3, 6, 9, 11]).map((i) => (
          <text
            key={i}
            x={kind === "requests" ? left + ((i + 0.5) * width) / 12 : x(i)}
            y="181"
            textAnchor="middle"
          >
            {time(buckets[i].at)}
          </text>
        ))}
      </svg>
      <details className="chart-data">
        <summary>View exact data</summary>
        <div className="table-scroll">
          <table>
            <caption>
              {kind === "latency"
                ? "Observed request latency p95 per bucket (ms)"
                : "Observed request event counts per bucket"}
            </caption>
            <thead>
              <tr>
                <th>Bucket start</th>
                <th>{kind === "latency" ? "p95 (ms)" : "Requests"}</th>
                {kind === "requests" && <th>Errors</th>}
              </tr>
            </thead>
            <tbody>
              {buckets.map((b) => (
                <tr key={b.at}>
                  <td>{new Date(b.at).toLocaleString()}</td>
                  <td>
                    {kind === "latency"
                      ? (b.latencyP95 ?? "Not available")
                      : b.requests}
                  </td>
                  {kind === "requests" && <td>{b.errors}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
