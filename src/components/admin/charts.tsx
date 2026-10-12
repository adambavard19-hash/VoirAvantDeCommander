"use client";

import { useState } from "react";

const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("fr-FR");
const dayLabel = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

/**
 * Colonnes quotidiennes (une seule série) : barres fines à extrémité arrondie,
 * espace de 2 px, info-bulle au survol, tableau accessible pour les lecteurs d'écran.
 */
export function DailyColumns({ data, label, height = 160 }: { data: { day: string; count: number }[]; label: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.count));
  const niceMax = (() => {
    const pow = 10 ** Math.floor(Math.log10(max));
    return Math.ceil(max / pow) * pow;
  })();
  const ticks = [0, niceMax / 2, niceMax];
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) {
    return (
      <div className="grid place-items-center rounded-xl bg-stone-50 text-center text-[13.5px] text-stone-500" style={{ height }}>
        Aucune consultation sur la période.
      </div>
    );
  }

  return (
    <figure className="relative">
      <div className="flex gap-3">
        <div className="relative w-8 shrink-0 text-end text-[11px] text-stone-400 tabular-nums" style={{ height }} aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${(1 - t / niceMax) * 100}%` }}>
              {compact.format(t)}
            </span>
          ))}
        </div>
        <div className="relative flex-1" style={{ height }} onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 h-px bg-stone-100" style={{ top: `${(1 - t / niceMax) * 100}%` }} aria-hidden="true" />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px]" aria-hidden="true">
            {data.map((d, i) => (
              <div key={d.day} className="flex h-full flex-1 cursor-default items-end justify-center" onMouseEnter={() => setHover(i)}>
                <div
                  className={`w-full max-w-6 rounded-t-[4px] transition-colors ${hover === i ? "bg-coral" : "bg-saffron"}`}
                  style={{ height: `${(d.count / niceMax) * 100}%`, minHeight: d.count ? 2 : 0 }}
                />
              </div>
            ))}
          </div>
          {hover !== null && data[hover] ? (
            <div
              className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-ink px-2.5 py-1.5 text-[12px] whitespace-nowrap text-white shadow-lg"
              style={{ left: `${((hover + 0.5) / data.length) * 100}%` }}
            >
              <span className="text-white/60">{dayLabel(data[hover].day)}</span> · <span className="font-semibold">{full.format(data[hover].count)}</span>
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-2 flex justify-between ps-11 text-[11px] text-stone-400" aria-hidden="true">
        <span>{data[0] ? dayLabel(data[0].day) : ""}</span>
        <span>{data.at(-1) ? dayLabel(data.at(-1)!.day) : ""}</span>
      </div>
      <figcaption className="sr-only">
        {label} : {full.format(total)} au total.
      </figcaption>
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th>Jour</th>
            <th>Nombre</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <td>{dayLabel(d.day)}</td>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function StatTile({ label, value, hint, icon }: { label: string; value: number | string; hint?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-200/80">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12.5px] font-medium text-stone-500">{label}</p>
        {icon ? <span className="text-stone-400">{icon}</span> : null}
      </div>
      <p className="mt-2 text-[26px] leading-none font-semibold tracking-tight text-stone-900">
        {typeof value === "number" ? (value >= 10000 ? compact.format(value) : full.format(value)) : value}
      </p>
      {hint ? <p className="mt-1.5 text-[12px] text-stone-500">{hint}</p> : null}
    </div>
  );
}
