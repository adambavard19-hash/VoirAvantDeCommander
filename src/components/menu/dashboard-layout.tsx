"use client";

import { Box, ChevronRight, Globe, Heart, Languages, Sparkles, TrendingUp, UtensilsCrossed } from "lucide-react";
import type { CategoryView, DishView, MenuView } from "@/lib/menu/view";
import { ArIcon, CategoryIcon } from "./icons";
import { DishImage } from "./dish-image";
import { TagIcon } from "./tag-icon";

/**
 * Mise en page « tableau de bord » du menu client : fenêtre d'application,
 * cartes d'indicateurs (calculés sur le vrai menu) et plats présentés en cartes.
 */

type HeaderProps = {
  view: MenuView;
  dishes: DishView[];
  favoritesCount: number;
  onFavorites: () => void;
  onLanguages: () => void;
};

export function DashboardHeader({ view, dishes, favoritesCount, onFavorites, onLanguages }: HeaderProps) {
  const s = view.strings;
  const r = view.restaurant;
  const with3d = dishes.filter((d) => d.model).length;
  const signatures = dishes.filter((d) => d.featured).length;

  const stats = [
    { title: s.statDishes, value: dishes.length, icon: <UtensilsCrossed className="size-[18px]" />, change: `${view.categories.length} ${view.categories.length > 1 ? s.statCategories : s.statCategory}`, tone: "var(--m-primary)" },
    { title: s.stat3d, value: with3d, icon: <Box className="size-[18px]" />, change: s.statOnTable, tone: "var(--m-secondary)" },
    { title: s.statLanguages, value: view.languages.length, icon: <Languages className="size-[18px]" />, change: `${view.locale.toUpperCase()} · ${s.statTranslated}`, tone: "#f5a97f" },
    { title: s.statSignatures, value: signatures, icon: <Sparkles className="size-[18px]" />, change: s.statMustTry, tone: "#a6e3a1" },
  ].filter((st) => st.value > 0 || st.title === s.statDishes);

  return (
    <header className="px-3.5 pt-[max(.9rem,env(safe-area-inset-top))] md:px-8 md:pt-8">
      {/* Fenêtre d'application */}
      <div className="overflow-hidden rounded-[22px] border border-[var(--m-border)] bg-[var(--m-surface)] shadow-[0_30px_80px_-40px_var(--m-glow)]">
        <div className="flex items-center gap-3 border-b border-[var(--m-border)] px-4 py-3">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="size-3 rounded-full bg-[#ff5f57]" />
            <span className="size-3 rounded-full bg-[#febc2e]" />
            <span className="size-3 rounded-full bg-[#28c840]" />
          </span>
          <span className="flex min-w-0 items-center gap-2 border-s border-[var(--m-border)] ps-3 font-mono text-[12.5px] text-[var(--m-text)]/80">
            <span className="truncate">{r.slug}.menu</span>
          </span>
          <span className="ms-auto flex items-center gap-1.5">
            {r.settings.enableFavorites ? (
              <button
                type="button"
                onClick={onFavorites}
                aria-label={s.favorites}
                className="relative grid size-9 place-items-center rounded-full text-[var(--m-text)]/80 transition hover:bg-[var(--m-surface-2)]"
              >
                <Heart className="size-[18px]" />
                {favoritesCount ? (
                  <span className="absolute -end-0.5 -top-0.5 grid min-w-4.5 place-items-center rounded-full bg-[var(--m-primary)] px-1 text-[10px] font-bold text-[var(--m-on-primary)]">
                    {favoritesCount}
                  </span>
                ) : null}
              </button>
            ) : null}
            {view.languages.length > 1 ? (
              <button
                type="button"
                onClick={onLanguages}
                aria-label={s.chooseLanguage}
                className="flex h-9 items-center gap-1.5 rounded-full px-2.5 font-mono text-[12px] font-semibold text-[var(--m-secondary)] uppercase transition hover:bg-[var(--m-surface-2)]"
              >
                <Globe className="size-4" />
                {view.locale}
              </button>
            ) : null}
          </span>
        </div>

        <div className="grid gap-5 p-4 md:grid-cols-[1.1fr_1fr] md:p-6">
          <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-[var(--m-surface-2)] md:order-2 md:aspect-auto md:min-h-[260px]">
            {r.cover ? <DishImage image={r.cover} alt={r.name} sizes="(min-width: 768px) 520px, 100vw" priority className="absolute inset-0 size-full object-cover" /> : null}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,rgba(0,0,0,.55))]" />
            <span className="absolute start-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-[12px] font-semibold text-white backdrop-blur-md">
              <ArIcon className="size-4" /> 3D · AR
            </span>
          </div>
          <div className="flex flex-col justify-center">
            {r.cuisineType ? <p className="font-mono text-[12px] tracking-wide text-[var(--m-secondary)]">{`// ${r.cuisineType}`}</p> : null}
            <h1 className="m-display mt-1.5 text-[34px] leading-[1.05] font-semibold tracking-tight md:text-[48px]">{r.name}</h1>
            {r.tagline ? <p className="mt-2.5 text-[15px] leading-relaxed text-[var(--m-muted)]">{r.tagline}</p> : null}
            {dishes.some((d) => d.model) ? (
              <p className="mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-[var(--m-primary)]/12 px-3 py-1.5 text-[13px] font-medium text-[var(--m-primary)] ring-1 ring-[var(--m-primary)]/30">
                <ArIcon className="size-4" /> {s.tapToDiscover}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Indicateurs, calculés sur le menu réel */}
      <ul className="mt-3.5 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {stats.map((st) => (
          <li key={st.title} className="rounded-[20px] border border-[var(--m-border)] bg-[var(--m-surface)] p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[12.5px] leading-snug text-[var(--m-muted)]">{st.title}</p>
              <span
                className="grid size-9 shrink-0 place-items-center rounded-xl"
                style={{ color: st.tone, background: `color-mix(in srgb, ${st.tone} 14%, transparent)` }}
                aria-hidden="true"
              >
                {st.icon}
              </span>
            </div>
            <p className="mt-1 font-mono text-[30px] leading-none font-semibold tabular-nums" style={{ color: st.tone }}>
              {st.value}
            </p>
            <p className="mt-2.5 inline-flex max-w-full items-center gap-1 rounded-full bg-[#a6e3a1]/12 px-2 py-0.5 text-[11.5px] font-semibold text-[#a6e3a1]">
              <TrendingUp className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{st.change}</span>
            </p>
          </li>
        ))}
      </ul>
    </header>
  );
}

export function DashboardFeatured({ dishes, view, onOpen }: { dishes: DishView[]; view: MenuView; onOpen: (id: string) => void }) {
  if (!dishes.length) return null;
  return (
    <section className="pt-8" aria-labelledby="featured-title">
      <SectionTitle id="featured-title" index="★" title={view.strings.featured} />
      <ul className="no-scrollbar mt-4 flex snap-x snap-mandatory gap-3.5 overflow-x-auto scroll-px-3.5 px-3.5 pb-2 md:px-8">
        {dishes.map((d) => (
          <li key={d.id} className="w-[76%] max-w-[340px] shrink-0 snap-start">
            <button
              type="button"
              onClick={() => onOpen(d.id)}
              className="group relative block aspect-[4/5] w-full overflow-hidden rounded-[22px] border border-[var(--m-border)] bg-[var(--m-surface)] text-start"
            >
              {d.photo ? (
                <DishImage image={d.photo} alt={d.name} sizes="(min-width: 768px) 340px, 76vw" className="absolute inset-0 size-full object-cover transition duration-700 group-hover:scale-[1.04]" />
              ) : null}
              <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_35%,rgba(0,0,0,.85)_100%)]" />
              {d.model ? <ModelChip label={view.strings.badge3d} className="absolute start-3 top-3" /> : null}
              <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                <h3 className="m-display text-[21px] leading-tight font-semibold">{d.name}</h3>
                <div className="mt-2.5 flex items-center justify-between">
                  {d.price ? (
                    <span className="font-mono text-[17px] font-semibold text-[var(--m-primary)] tabular-nums" dir="ltr">
                      {d.price}
                    </span>
                  ) : (
                    <span />
                  )}
                  {d.model ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/12 px-2.5 py-1 text-[11.5px] font-semibold ring-1 ring-white/20 backdrop-blur">
                      <ArIcon className="size-3.5" /> {view.strings.view3d}
                    </span>
                  ) : null}
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DashboardCategory({ category, index, view, onOpen, isFavorite }: { category: CategoryView; index: number; view: MenuView; onOpen: (id: string) => void; isFavorite: (id: string) => boolean }) {
  return (
    <section id={`cat-${category.id}`} className="scroll-mt-20 pt-10" aria-labelledby={`cat-title-${category.id}`}>
      <SectionTitle
        id={`cat-title-${category.id}`}
        index={String(index + 1).padStart(2, "0")}
        title={category.name}
        icon={<CategoryIcon name={category.icon} className="size-4" />}
        count={`${category.dishes.length} ${view.strings.dishCount}`}
      />
      {category.description ? <p className="mt-1.5 px-3.5 text-[14px] text-[var(--m-muted)] md:px-8">{category.description}</p> : null}
      <ul className="mt-4 grid gap-3 px-3.5 sm:grid-cols-2 md:px-8 lg:grid-cols-3">
        {category.dishes.map((d) => (
          <li key={d.id}>
            <DishCard dish={d} view={view} onOpen={onOpen} favorite={isFavorite(d.id)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function SectionTitle({ id, index, title, icon, count }: { id: string; index: string; title: string; icon?: React.ReactNode; count?: string }) {
  return (
    <div className="flex items-center gap-3 px-3.5 md:px-8">
      <span className="font-mono text-[12px] text-[var(--m-muted)] tabular-nums">{index}</span>
      <h2 id={id} className="m-display flex items-center gap-2.5 text-[24px] font-semibold tracking-tight md:text-[30px]">
        {icon ? <span className="grid size-8 place-items-center rounded-lg bg-[var(--m-surface)] text-[var(--m-secondary)] ring-1 ring-[var(--m-border)]">{icon}</span> : null}
        {title}
      </h2>
      <span className="ms-auto h-px min-w-6 flex-1 bg-[var(--m-border)]" aria-hidden="true" />
      {count ? <span className="shrink-0 font-mono text-[12px] text-[var(--m-muted)]">{count}</span> : null}
    </div>
  );
}

function ModelChip({ label, className = "" }: { label: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10.5px] font-bold tracking-wide text-[var(--m-secondary)] ring-1 ring-[var(--m-secondary)]/40 backdrop-blur-md ${className}`}>
      <ArIcon className="size-3.5" />
      {label}
    </span>
  );
}

function DishCard({ dish, view, onOpen, favorite }: { dish: DishView; view: MenuView; onOpen: (id: string) => void; favorite: boolean }) {
  const s = view.strings;
  const price = dish.price ?? (dish.variants[0] ? `${s.from} ${dish.variants[0].price}` : null);
  return (
    <button
      type="button"
      onClick={() => onOpen(dish.id)}
      className={`group flex w-full gap-3.5 rounded-[20px] border border-[var(--m-border)] bg-[var(--m-surface)] p-3 text-start transition hover:border-[var(--m-primary)]/50 ${dish.available ? "" : "opacity-55"}`}
    >
      <div className="relative size-[92px] shrink-0 overflow-hidden rounded-2xl bg-[var(--m-surface-2)]">
        {dish.photo ? (
          <DishImage image={dish.photo} alt="" sizes="92px" className={`size-full object-cover transition duration-700 group-hover:scale-[1.06] ${dish.available ? "" : "grayscale"}`} />
        ) : (
          <span className="grid size-full place-items-center text-[var(--m-muted)]">
            <UtensilsCrossed className="size-6" />
          </span>
        )}
        {dish.model ? <ModelChip label={s.badge3d} className="absolute start-1.5 top-1.5 !px-1.5 !py-0.5" /> : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start gap-2">
          <h3 className="line-clamp-2 flex-1 text-[15.5px] leading-snug font-semibold">{dish.name}</h3>
          {favorite ? <Heart className="mt-0.5 size-4 shrink-0 fill-[var(--m-primary)] text-[var(--m-primary)]" /> : null}
        </div>
        {dish.description ? <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-[var(--m-muted)]">{dish.description}</p> : null}
        <div className="mt-auto flex items-center gap-2 pt-2">
          {price ? (
            <span className="font-mono text-[17px] font-semibold text-[var(--m-primary)] tabular-nums" dir="ltr">
              {price}
            </span>
          ) : null}
          <span className="ms-auto flex items-center gap-1.5 text-[var(--m-muted)]">
            {dish.tags.slice(0, 3).map((t) => (
              <TagIcon key={t.code} code={t.code} className="size-3.5" />
            ))}
            {!dish.available ? <span className="text-[11px] font-semibold text-[var(--m-text)]">{s.unavailable}</span> : null}
            <ChevronRight className="size-4 rtl:rotate-180" />
          </span>
        </div>
      </div>
    </button>
  );
}

/** Courbe des consultations réelles du menu (anonymes, agrégées par jour). */
export function DashboardTrend({ view, trend }: { view: MenuView; trend: { day: string; count: number }[] }) {
  const total = trend.reduce((s, d) => s + d.count, 0);
  if (trend.length < 2 || total < 10) return null;
  const w = 600;
  const h = 120;
  const max = Math.max(1, ...trend.map((d) => d.count));
  const x = (i: number) => 8 + (i / (trend.length - 1)) * (w - 16);
  const y = (v: number) => 10 + (1 - v / max) * (h - 28);
  const line = trend.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.count).toFixed(1)}`).join("");
  const area = `${line}L${x(trend.length - 1)},${h - 18}L${x(0)},${h - 18}Z`;
  const fmt = new Intl.DateTimeFormat(`${view.locale}-u-nu-latn`, { weekday: "short" });
  const first = trend[0]!;
  const last = trend.at(-1)!;
  const change = first.count ? Math.round(((last.count - first.count) / first.count) * 100) : null;
  return (
    <section className="mx-3.5 mt-3.5 rounded-[20px] border border-[var(--m-border)] bg-[var(--m-surface)] p-4 md:mx-8" aria-label={view.strings.statTrend}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12.5px] text-[var(--m-muted)]">{view.strings.statTrend}</p>
        <p className="font-mono text-[15px] font-semibold text-[var(--m-secondary)] tabular-nums">
          {total}
          {change !== null ? <span className="ms-2 text-[11.5px] text-[#a6e3a1]">{change >= 0 ? `+${change}` : change} %</span> : null}
        </p>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 block h-[120px] w-full" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--m-secondary)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--m-secondary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#trend-fill)" />
        <path d={line} fill="none" stroke="var(--m-secondary)" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[10.5px] text-[var(--m-muted)]" aria-hidden="true">
        {trend.map((d) => (
          <span key={d.day}>{fmt.format(new Date(`${d.day}T12:00:00Z`))}</span>
        ))}
      </div>
    </section>
  );
}
