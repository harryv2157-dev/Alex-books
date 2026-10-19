"use client";

import { useState } from "react";

const fmt = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });

// Pages read per week, last 12 weeks. One series, so no legend: the heading names it.
export default function PagesChart({ weeks }: { weeks: { start: string; pages: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(10, ...weeks.map((w) => w.pages));
  const nice = max <= 50 ? Math.ceil(max / 10) * 10 : Math.ceil(max / 50) * 50;
  const H = 160;
  const total = weeks.reduce((n, w) => n + w.pages, 0);

  return (
    <figure className="pchart">
      <div className="pchart-readout" aria-hidden="true">
        {hover === null ? (
          <>
            <strong>{total.toLocaleString()} pages</strong> <span>in the last 12 weeks</span>
          </>
        ) : (
          <>
            <strong>{weeks[hover].pages} pages</strong> <span>week of {fmt(weeks[hover].start)}</span>
          </>
        )}
      </div>
      <div className="pchart-plot" style={{ height: H }} onMouseLeave={() => setHover(null)}>
        <div className="pchart-grid" style={{ bottom: H / 2 }}>
          <span>{Math.round(nice / 2)}</span>
        </div>
        <div className="pchart-grid" style={{ bottom: H }}>
          <span>{nice}</span>
        </div>
        {weeks.map((w, i) => (
          <button
            key={w.start}
            type="button"
            className={`pchart-col ${i === hover ? "on" : ""}`}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onClick={() => setHover(i)}
            aria-label={`Week of ${fmt(w.start)}: ${w.pages} pages`}
          >
            <span className="pchart-bar" style={{ height: w.pages ? Math.max(4, (w.pages / nice) * H) : 0 }} />
          </button>
        ))}
      </div>
      <div className="pchart-axis" aria-hidden="true">
        <span>{fmt(weeks[0].start)}</span>
        <span>This week</span>
      </div>
      <table className="sr-only">
        <caption>Pages read per week</caption>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.start}>
              <th scope="row">Week of {fmt(w.start)}</th>
              <td>{w.pages}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
