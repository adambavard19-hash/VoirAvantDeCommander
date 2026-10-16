"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { Change } from "./change";

const compact = new Intl.NumberFormat("fr-FR", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const full = new Intl.NumberFormat("fr-FR");
const dayLabel = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });

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
                  style={{
                    height: `${(d.count / niceMax) * 100}%`,
                    minHeight: d.count ? 2 : 0,
                  }}
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
      <div className="sr-only">
        <table>
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
      </div>
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

function ChangeBadge({ change, period }: { change: Change; period?: string }) {
  if (!change) return <p className="mt-3 text-[12px] text-stone-400">Pas encore de données à comparer</p>;
  if (change.kind === "count") {
    return (
      <p className="mt-3 flex items-center gap-1.5 text-[12px] text-stone-500">
        <span
          className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold ${change.value > 0 ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"}`}
        >
          {change.value > 0 ? <ArrowUpRight className="size-3" aria-hidden="true" /> : <Minus className="size-3" aria-hidden="true" />}
          {change.value > 0 ? `+${full.format(change.value)}` : "0"}
        </span>
        {change.label}
      </p>
    );
  }
  if (change.kind === "new") {
    return (
      <p className="mt-3 flex items-center gap-1.5 text-[12px] text-stone-500">
        <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700">
          <ArrowUpRight className="size-3" aria-hidden="true" /> Nouveau
        </span>
        {period ? `aucune donnée ${period}` : null}
      </p>
    );
  }
  const up = change.value > 0;
  const down = change.value < 0;
  return (
    <p className="mt-3 flex items-center gap-1.5 text-[12px] text-stone-500">
      <span
        className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold tabular-nums ${
          up ? "bg-emerald-50 text-emerald-700" : down ? "bg-red-50 text-red-700" : "bg-stone-100 text-stone-500"
        }`}
      >
        {up ? (
          <ArrowUpRight className="size-3" aria-hidden="true" />
        ) : down ? (
          <ArrowDownRight className="size-3" aria-hidden="true" />
        ) : (
          <Minus className="size-3" aria-hidden="true" />
        )}
        {up ? "+" : ""}
        {change.value} %
      </span>
      {period}
    </p>
  );
}

/** Carte d'indicateur : icône, titre, valeur et évolution calculée sur les données réelles. */
export function KpiCard({
  title,
  value,
  icon,
  change,
  period,
  hint,
  tone = "saffron",
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  change?: Change;
  period?: string;
  hint?: string;
  tone?: "saffron" | "violet" | "holo" | "coral";
}) {
  const tones = {
    saffron: "bg-amber-50 text-amber-600 ring-amber-100",
    violet: "bg-violet-50 text-violet-600 ring-violet-100",
    holo: "bg-teal-50 text-teal-600 ring-teal-100",
    coral: "bg-orange-50 text-orange-600 ring-orange-100",
  };
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white p-5 ring-1 ring-stone-200/80 transition hover:shadow-[0_12px_40px_-20px_rgba(0,0,0,.25)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-stone-500">{title}</p>
        <span className={`grid size-9 shrink-0 place-items-center rounded-xl ring-1 ${tones[tone]}`} aria-hidden="true">
          {icon}
        </span>
      </div>
      <p className="mt-1 text-[30px] leading-none font-semibold tracking-tight text-stone-900 tabular-nums">
        {typeof value === "number" ? (value >= 100000 ? compact.format(value) : full.format(value)) : value}
      </p>
      {change !== undefined ? <ChangeBadge change={change} period={period} /> : hint ? <p className="mt-3 text-[12px] text-stone-500">{hint}</p> : null}
      {change !== undefined && hint ? <p className="mt-1 text-[12px] text-stone-400">{hint}</p> : null}
    </div>
  );
}

export type TrendSeries = {
  key: string;
  label: string;
  color: string;
  values: number[];
};

/**
 * Courbes d'évolution quotidienne (même unité, un seul axe) : lignes de 2 px,
 * réticule et info-bulle au survol, légende avec totaux, tableau accessible.
 */
export function TrendLines({ days, series, height = 220, label }: { days: string[]; series: TrendSeries[]; height?: number; label: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const visible = series.filter((s) => !hidden.has(s.key));
  const max = Math.max(1, ...visible.flatMap((s) => s.values));
  const niceMax = (() => {
    const pow = 10 ** Math.floor(Math.log10(max));
    const n = Math.ceil(max / pow) * pow;
    return n < 4 ? 4 : n;
  })();
  const ticks = [0, niceMax / 4, niceMax / 2, (niceMax * 3) / 4, niceMax].filter((t) => Number.isInteger(t) || niceMax >= 8);
  const padL = 36;
  const padR = 8;
  const padT = 8;
  const padB = 24;
  const w = width;
  const h = height;
  const x = (i: number) => padL + (days.length <= 1 ? 0 : (i / (days.length - 1)) * (w - padL - padR));
  const y = (v: number) => padT + (1 - v / niceMax) * (h - padT - padB);
  const total = series.reduce((s, ser) => s + ser.values.reduce((a, b) => a + b, 0), 0);
  const labelEvery = Math.ceil(days.length / Math.max(2, Math.floor((w - padL) / 70)));

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * w;
    const i = Math.round(((px - padL) / (w - padL - padR)) * (days.length - 1));
    setHover(Math.min(days.length - 1, Math.max(0, i)));
  };

  return (
    <figure className="min-w-0">
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Séries affichées">
        {series.map((s) => {
          const sum = s.values.reduce((a, b) => a + b, 0);
          const off = hidden.has(s.key);
          return (
            <button
              key={s.key}
              type="button"
              aria-pressed={!off}
              onClick={() =>
                setHidden((prev) => {
                  const next = new Set(prev);
                  if (next.has(s.key)) next.delete(s.key);
                  else if (series.length - next.size > 1) next.add(s.key);
                  return next;
                })
              }
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px] ring-1 transition ${
                off ? "text-stone-400 ring-stone-200" : "bg-stone-50 text-stone-700 ring-stone-200 hover:bg-stone-100"
              }`}
            >
              <span className="h-[3px] w-4 rounded-full" style={{ background: off ? "#d6d3d1" : s.color }} aria-hidden="true" />
              {s.label}
              <span className="font-semibold text-stone-900 tabular-nums">{full.format(sum)}</span>
            </button>
          );
        })}
      </div>
      <div ref={wrapRef} className="relative w-full min-w-0">
        {total === 0 ? (
          <div className="grid place-items-center rounded-xl bg-stone-50 text-center text-[13.5px] text-stone-500" style={{ height }}>
            Aucune activité sur la période. Les courbes apparaîtront dès les premières visites des menus.
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${w} ${h}`}
            style={{ width: "100%", height: h }}
            className="block touch-pan-y select-none"
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHover(null)}
            aria-hidden="true"
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke="#f0eeec" />
                <text x={padL - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill="#a8a29e" className="tabular-nums">
                  {compact.format(t)}
                </text>
              </g>
            ))}
            {days.map((d, i) =>
              (i % labelEvery === 0 && x(days.length - 1) - x(i) >= 64) || i === days.length - 1 ? (
                <text key={d} x={x(i)} y={h - 6} textAnchor={i === 0 ? "start" : i === days.length - 1 ? "end" : "middle"} fontSize="11" fill="#a8a29e">
                  {dayLabel(d)}
                </text>
              ) : null,
            )}
            {visible.map((s) => (
              <path
                key={s.key}
                d={s.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("")}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
            {hover !== null ? (
              <g>
                <line x1={x(hover)} x2={x(hover)} y1={padT} y2={h - padB} stroke="#d6d3d1" strokeDasharray="3 3" />
                {visible.map((s) => (
                  <circle key={s.key} cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={4.5} fill={s.color} stroke="#fff" strokeWidth={2} />
                ))}
              </g>
            ) : null}
          </svg>
        )}
        {hover !== null && total > 0 ? (
          <div
            className="pointer-events-none absolute top-0 z-10 min-w-40 rounded-xl bg-ink px-3 py-2 text-[12px] text-white shadow-xl"
            style={{
              left: Math.min(Math.max(x(hover) + 12, 0), w - 170),
            }}
          >
            <p className="mb-1 text-white/60">{dayLabel(days[hover]!)}</p>
            {visible.map((s) => (
              <p key={s.key} className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                <span className="text-white/80">{s.label}</span>
                <span className="ms-auto font-semibold tabular-nums">{full.format(s.values[hover] ?? 0)}</span>
              </p>
            ))}
          </div>
        ) : null}
      </div>
      <figcaption className="sr-only">{label}</figcaption>
      <div className="sr-only">
        <table>
          <caption>{label}</caption>
          <thead>
            <tr>
              <th>Jour</th>
              {series.map((s) => (
                <th key={s.key}>{s.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((d, i) => (
              <tr key={d}>
                <td>{dayLabel(d)}</td>
                {series.map((s) => (
                  <td key={s.key}>{s.values[i] ?? 0}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
