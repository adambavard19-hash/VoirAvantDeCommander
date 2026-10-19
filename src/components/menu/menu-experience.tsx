"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Globe, Heart, MapPin, Phone, Search, X } from "lucide-react";
import type { CategoryView, DishView, MenuView } from "@/lib/menu/view";
import { ArIcon, CategoryIcon, InstagramIcon } from "./icons";
import { DishImage } from "./dish-image";
import { DishSheet } from "./dish-sheet";
import { Sheet, afterSheetClosed } from "./sheet";
import { TagIcon } from "./tag-icon";
import { loadModelViewer } from "./model-stage";
import { useFavorites } from "./use-favorites";
import { track } from "./track";
import { DashboardCategory, DashboardFeatured, DashboardHeader, DashboardTrend } from "./dashboard-layout";

export function MenuExperience({ view, trend }: { view: MenuView; trend?: { day: string; count: number }[] }) {
  const s = view.strings;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const favorites = useFavorites(view.restaurant.slug);

  const dishesById = useMemo(() => {
    const map = new Map<string, DishView>();
    for (const c of view.categories) for (const d of c.dishes) map.set(d.id, d);
    return map;
  }, [view.categories]);

  const [openDishId, setOpenDishId] = useState<string | null>(null);
  const [langOpen, setLangOpen] = useState(false);
  const [favOpen, setFavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(view.categories[0]?.id ?? "");
  const navRef = useRef<HTMLDivElement>(null);

  const has3d = useMemo(() => [...dishesById.values()].some((d) => d.model), [dishesById]);

  useEffect(() => {
    if (!view.preview) track(view.restaurant.slug, "MENU_VIEW");
  }, [view.preview, view.restaurant.slug]);

  // Préchargement de la visionneuse 3D dès la première interaction (ouverture instantanée ensuite).
  useEffect(() => {
    if (!has3d) return;
    const events = ["touchstart", "scroll", "pointermove"] as const;
    const detach = () => events.forEach((e) => window.removeEventListener(e, prefetch));
    function prefetch() {
      detach();
      loadModelViewer().catch(() => {});
    }
    events.forEach((e) => window.addEventListener(e, prefetch, { passive: true }));
    return detach;
  }, [has3d]);

  // Catégorie active selon le défilement.
  useEffect(() => {
    const sections = view.categories.map((c) => document.getElementById(`cat-${c.id}`)).filter(Boolean) as HTMLElement[];
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveCategory(visible[0].target.id.replace("cat-", ""));
      },
      { rootMargin: "-120px 0px -60% 0px" },
    );
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [view.categories]);

  // Sous-catégories : la barre montre les catégories principales, puis les sous-catégories de la catégorie active.
  const topCategories = view.categories.filter((c) => !c.parentId);
  const activeTop = view.categories.find((c) => c.id === activeCategory)?.parentId ?? activeCategory;
  const subCategories = view.categories.filter((c) => c.parentId === activeTop);

  useEffect(() => {
    const chip = navRef.current?.querySelector<HTMLElement>(`[data-cat="${activeTop}"]`);
    chip?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeTop]);

  const scrollToCategory = (id: string) => {
    const el = document.getElementById(`cat-${id}`);
    if (!el) return;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 76, behavior: "smooth" });
  };

  const changeLanguage = (code: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("lang", code);
    setLangOpen(false);
    afterSheetClosed(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  };

  const openDish = useCallback((id: string) => setOpenDishId(id), []);
  const openDishView = openDishId ? (dishesById.get(openDishId) ?? null) : null;

  const featured = view.featured.map((id) => dishesById.get(id)).filter((d): d is DishView => !!d);
  const normalizedQuery = query.trim().toLowerCase();
  const searchResults = normalizedQuery
    ? [...dishesById.values()].filter((d) => `${d.name} ${d.description}`.toLowerCase().includes(normalizedQuery))
    : [];
  const favoriteDishes = favorites.ids.map((id) => dishesById.get(id)).filter((d): d is DishView => !!d);
  const favoriteTotal = favoriteDishes.reduce((sum, d) => sum + (d.priceCents ?? 0), 0);
  const formatTotal = (cents: number) =>
    new Intl.NumberFormat(`${view.restaurant.priceLocale}-u-nu-latn`, { style: "currency", currency: view.restaurant.currency }).format(cents / 100);

  const r = view.restaurant;
  const dashboard = view.layout === "dashboard";

  return (
    <div
      lang={view.locale}
      dir={view.dir}
      style={view.themeVars as React.CSSProperties}
      className="m-body min-h-dvh bg-[var(--m-bg)] text-[var(--m-text)] selection:bg-[var(--m-primary)] selection:text-[var(--m-on-primary)]"
    >
      {view.preview ? (
        <div className="sticky top-0 z-[70] bg-amber-400 px-4 py-2 text-center text-[13px] font-semibold text-black">
          Prévisualisation du brouillon — ce menu n&apos;est pas encore visible par les clients
        </div>
      ) : null}

      <div className="mx-auto max-w-[1180px]">
        {dashboard ? (
          <>
            <DashboardHeader
              view={view}
              dishes={[...dishesById.values()]}
              favoritesCount={favorites.ids.length}
              onFavorites={() => setFavOpen(true)}
              onLanguages={() => setLangOpen(true)}
            />
            {trend ? <DashboardTrend view={view} trend={trend} /> : null}
          </>
        ) : (
        /* ─── Couverture ─── */
        <header className="relative">
          <div className="relative h-[52vh] min-h-[340px] max-h-[560px] w-full overflow-hidden md:rounded-b-[36px]">
            {r.cover ? (
              <DishImage image={r.cover} alt={r.name} sizes="100vw" priority className="absolute inset-0 size-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_70%_20%,var(--m-glow)_0%,transparent_60%),radial-gradient(70%_60%_at_10%_90%,var(--m-surface-2)_0%,transparent_70%)]" />
            )}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.45)_0%,transparent_28%,transparent_45%,var(--m-bg)_100%)]" />
          </div>

          <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] md:px-8">
            {r.logo ? (
              <div className="grid size-14 place-items-center overflow-hidden rounded-2xl bg-white/90 p-1.5 shadow-lg backdrop-blur">
                <img src={r.logo.src} alt={r.name} className="max-h-full max-w-full object-contain" />
              </div>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              {view.restaurant.settings.enableFavorites ? (
                <button
                  type="button"
                  onClick={() => setFavOpen(true)}
                  className="relative grid size-11 place-items-center rounded-full bg-black/40 text-white backdrop-blur-md transition hover:bg-black/55"
                  aria-label={s.favorites}
                >
                  <Heart className="size-5" />
                  {favorites.ids.length ? (
                    <span className="absolute -end-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-[var(--m-primary)] px-1 text-[11px] font-bold text-[var(--m-on-primary)]">
                      {favorites.ids.length}
                    </span>
                  ) : null}
                </button>
              ) : null}
              {view.languages.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setLangOpen(true)}
                  className="flex h-11 items-center gap-2 rounded-full bg-black/40 px-4 text-[13px] font-semibold text-white uppercase backdrop-blur-md transition hover:bg-black/55"
                  aria-label={s.chooseLanguage}
                >
                  <Globe className="size-4.5" />
                  {view.locale}
                </button>
              ) : null}
            </div>
          </div>

          <div className="relative -mt-36 px-5 md:-mt-44 md:px-10">
            {r.cuisineType ? (
              <p className="mb-2 text-[12px] font-semibold tracking-[.22em] text-[var(--m-primary)] uppercase">{r.cuisineType}</p>
            ) : null}
            <h1 className="m-display text-[40px] leading-[1.02] font-semibold tracking-tight drop-shadow-[0_2px_18px_rgba(0,0,0,.35)] md:text-[64px]">
              {r.name}
            </h1>
            {r.tagline ? <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-[var(--m-text)]/80 md:text-lg">{r.tagline}</p> : null}
            {has3d ? (
              <div className="mt-5 inline-flex items-center gap-3 rounded-full border border-[var(--m-border)] bg-[var(--m-surface)]/70 py-2 ps-2 pe-4 text-[13px] backdrop-blur">
                <span className="relative grid size-8 place-items-center rounded-full bg-[var(--m-primary)] text-[var(--m-on-primary)]">
                  <span className="absolute inset-0 rounded-full bg-[var(--m-primary)] animate-pulse-ring" />
                  <ArIcon className="relative size-4.5" />
                </span>
                {s.tapToDiscover}
              </div>
            ) : null}
          </div>
        </header>
        )}

        {/* ─── Navigation des catégories ─── */}
        <nav className="m-glass sticky top-0 z-40 mt-6 border-b border-[var(--m-border)]" aria-label={s.categories}>
          <div className="flex items-center gap-2 px-3 py-2.5 md:px-8">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label={s.search}
              className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--m-surface)] text-[var(--m-text)]"
            >
              <Search className="size-[18px]" />
            </button>
            <div ref={navRef} className="no-scrollbar flex flex-1 gap-2 overflow-x-auto scroll-smooth">
              {topCategories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  data-cat={c.id}
                  onClick={() => scrollToCategory(c.id)}
                  aria-current={activeTop === c.id ? "true" : undefined}
                  className={`flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[14px] font-medium whitespace-nowrap transition ${
                    activeTop === c.id
                      ? "bg-[var(--m-primary)] text-[var(--m-on-primary)] shadow-[0_6px_24px_-8px_var(--m-glow)]"
                      : "bg-[var(--m-surface)] text-[var(--m-text)]/85"
                  }`}
                >
                  <CategoryIcon name={c.icon} className="size-4" />
                  {c.name}
                </button>
              ))}
            </div>
          </div>
          {subCategories.length ? (
            <div className="no-scrollbar flex gap-5 overflow-x-auto px-4 pb-2 md:px-9" aria-label={view.categories.find((c) => c.id === activeTop)?.name}>
              {subCategories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => scrollToCategory(c.id)}
                  aria-current={activeCategory === c.id ? "true" : undefined}
                  className={`relative shrink-0 py-1.5 text-[13.5px] font-medium whitespace-nowrap transition ${
                    activeCategory === c.id ? "text-[var(--m-text)]" : "text-[var(--m-muted)] hover:text-[var(--m-text)]"
                  }`}
                >
                  {c.name}
                  <span
                    className={`absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full bg-[var(--m-primary)] transition-opacity ${activeCategory === c.id ? "opacity-100" : "opacity-0"}`}
                  />
                </button>
              ))}
            </div>
          ) : null}
        </nav>

        <main className="pb-16">
          {dashboard ? (
            <>
              <DashboardFeatured dishes={featured} view={view} onOpen={openDish} />
              {view.categories.map((c, i) => (
                <DashboardCategory key={c.id} category={c} index={i} view={view} onOpen={openDish} isFavorite={favorites.has} />
              ))}
            </>
          ) : null}

          {/* ─── Incontournables ─── */}
          {!dashboard && featured.length ? (
            <section className="pt-8" aria-labelledby="featured-title">
              <h2 id="featured-title" className="m-display px-5 text-2xl font-semibold md:px-10 md:text-3xl">
                {s.featured}
              </h2>
              <ul className="no-scrollbar mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-5 px-5 pb-2 md:px-10">
                {featured.map((d) => (
                  <li key={d.id} className="w-[78%] max-w-[360px] shrink-0 snap-start">
                    <FeaturedCard dish={d} view={view} onOpen={openDish} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {dashboard ? null : view.categories.map((c) => (
            <CategorySection key={c.id} category={c} view={view} onOpen={openDish} isFavorite={favorites.has} />
          ))}

          {/* ─── Infos pratiques ─── */}
          <footer className="mx-5 mt-14 rounded-[28px] border border-[var(--m-border)] bg-[var(--m-surface)] p-6 md:mx-10 md:p-8">
            <h2 className="m-display text-xl font-semibold">{s.info}</h2>
            {r.practicalInfo ? <p className="mt-3 text-[14.5px] leading-relaxed whitespace-pre-line text-[var(--m-text)]/80">{r.practicalInfo}</p> : null}
            <ul className="mt-5 space-y-3 text-[14.5px]">
              {r.address ? (
                <li>
                  <a href={r.mapsUrl ?? undefined} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 hover:underline">
                    <MapPin className="mt-0.5 size-4.5 shrink-0 text-[var(--m-primary)]" />
                    <span>{r.address}</span>
                  </a>
                </li>
              ) : null}
              {r.phone ? (
                <li>
                  <a href={`tel:${r.phone.replace(/[^+\d]/g, "")}`} className="flex items-center gap-3 hover:underline" dir="ltr">
                    <Phone className="size-4.5 shrink-0 text-[var(--m-primary)]" />
                    {r.phone}
                  </a>
                </li>
              ) : null}
              {r.instagram ? (
                <li>
                  <a
                    href={r.instagram.startsWith("http") ? r.instagram : `https://instagram.com/${r.instagram.replace(/^@/, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 hover:underline"
                  >
                    <InstagramIcon className="size-4.5 shrink-0 text-[var(--m-primary)]" />
                    {r.instagram.startsWith("http") ? "Instagram" : `@${r.instagram.replace(/^@/, "")}`}
                  </a>
                </li>
              ) : null}
            </ul>
            <div className="mt-6 space-y-1.5 border-t border-[var(--m-border)] pt-5 text-[12px] text-[var(--m-muted)]">
              {view.autoTranslated ? <p>{s.autoTranslated}</p> : null}
              {r.settings.showPoweredBy ? (
                <p>
                  <Link href="/" className="inline-flex items-center gap-1.5 hover:text-[var(--m-text)]">
                    <ArIcon className="size-3.5" /> {s.poweredBy}
                  </Link>
                </p>
              ) : null}
            </div>
          </footer>
        </main>
      </div>

      <DishSheet
        view={view}
        dish={openDishView}
        dishesById={dishesById}
        onClose={() => setOpenDishId(null)}
        onOpenDish={openDish}
        favorite={openDishView ? favorites.has(openDishView.id) : false}
        onToggleFavorite={favorites.toggle}
      />

      {/* ─── Langues ─── */}
      <Sheet open={langOpen} onClose={() => setLangOpen(false)} label={s.chooseLanguage} closeLabel={s.close} size="md" dir={view.dir} style={view.themeVars as React.CSSProperties}>
        <div className="px-5 pt-8 pb-8">
          <h2 className="m-display text-2xl font-semibold">{s.chooseLanguage}</h2>
          <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {view.languages.map((l) => (
              <li key={l.code}>
                <button
                  type="button"
                  lang={l.code}
                  onClick={() => changeLanguage(l.code)}
                  className={`flex h-14 w-full items-center justify-between rounded-2xl border px-4 text-[16px] transition ${
                    l.code === view.locale
                      ? "border-[var(--m-primary)] bg-[var(--m-primary)]/10 font-semibold"
                      : "border-[var(--m-border)] bg-[var(--m-surface)]"
                  }`}
                >
                  {l.label}
                  <span className="text-[12px] font-semibold text-[var(--m-muted)] uppercase">{l.code}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Sheet>

      {/* ─── Mes envies ─── */}
      <Sheet open={favOpen} onClose={() => setFavOpen(false)} label={s.favorites} closeLabel={s.close} size="md" dir={view.dir} style={view.themeVars as React.CSSProperties}>
        <div className="px-5 pt-8 pb-8">
          <h2 className="m-display text-2xl font-semibold">{s.favorites}</h2>
          {favoriteDishes.length ? (
            <>
              <p className="mt-1 text-[13.5px] text-[var(--m-muted)]">{s.favoritesHint}</p>
              <ul className="mt-5 divide-y divide-[var(--m-border)]">
                {favoriteDishes.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 py-3">
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-start" onClick={() => { setFavOpen(false); openDish(d.id); }}>
                      <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-[var(--m-surface)]">
                        {d.photo ? <DishImage image={d.photo} alt="" sizes="56px" className="size-full object-cover" /> : null}
                      </div>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{d.name}</span>
                        {d.price ? <span className="text-[13px] text-[var(--m-primary)] tabular-nums" dir="ltr">{d.price}</span> : null}
                      </span>
                    </button>
                    <button type="button" onClick={() => favorites.toggle(d.id)} aria-label={s.removeFavorite} className="grid size-9 place-items-center rounded-full text-[var(--m-muted)] hover:bg-[var(--m-surface)]">
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
              {favoriteTotal > 0 ? (
                <div className="mt-4 flex items-center justify-between rounded-2xl bg-[var(--m-surface)] px-4 py-3">
                  <span className="text-[14px] text-[var(--m-muted)]">{s.favoritesTotal}</span>
                  <span className="text-lg font-semibold tabular-nums" dir="ltr">{formatTotal(favoriteTotal)}</span>
                </div>
              ) : null}
            </>
          ) : (
            <p className="mt-4 text-[15px] text-[var(--m-muted)]">{s.favoritesEmpty}</p>
          )}
        </div>
      </Sheet>

      {/* ─── Recherche ─── */}
      <Sheet open={searchOpen} onClose={() => { setSearchOpen(false); setQuery(""); }} label={s.search} closeLabel={s.close} size="md" dir={view.dir} style={view.themeVars as React.CSSProperties}>
        <div className="px-5 pt-14 pb-8">
          <label className="flex h-13 items-center gap-3 rounded-2xl border border-[var(--m-border)] bg-[var(--m-surface)] px-4">
            <Search className="size-5 text-[var(--m-muted)]" />
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={s.search}
              className="h-12 w-full bg-transparent text-[16px] outline-none placeholder:text-[var(--m-muted)]"
            />
          </label>
          {normalizedQuery ? (
            searchResults.length ? (
              <ul className="mt-4 divide-y divide-[var(--m-border)]">
                {searchResults.map((d) => (
                  <li key={d.id}>
                    <button type="button" onClick={() => { setSearchOpen(false); setQuery(""); openDish(d.id); }} className="flex w-full items-center gap-3 py-3 text-start">
                      <div className="size-12 shrink-0 overflow-hidden rounded-xl bg-[var(--m-surface)]">
                        {d.photo ? <DishImage image={d.photo} alt="" sizes="48px" className="size-full object-cover" /> : null}
                      </div>
                      <span className="min-w-0 flex-1 truncate font-medium">{d.name}</span>
                      {d.price ? <span className="text-[14px] text-[var(--m-primary)] tabular-nums" dir="ltr">{d.price}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-6 text-center text-[14px] text-[var(--m-muted)]">{s.searchEmpty}</p>
            )
          ) : null}
        </div>
      </Sheet>
    </div>
  );
}

function CategorySection({
  category,
  view,
  onOpen,
  isFavorite,
}: {
  category: CategoryView;
  view: MenuView;
  onOpen: (id: string) => void;
  isFavorite: (id: string) => boolean;
}) {
  return (
    <section
      id={`cat-${category.id}`}
      className={`scroll-mt-28 px-5 md:px-10 ${category.parentId ? "pt-8" : "pt-12"}`}
      aria-labelledby={`cat-title-${category.id}`}
    >
      <div className="flex items-end justify-between gap-4">
        <div>
          {category.parentId ? (
            <h3 id={`cat-title-${category.id}`} className="flex items-center gap-3 text-[19px] font-semibold tracking-tight md:text-[22px]">
              <span className="h-5 w-1 rounded-full bg-[var(--m-primary)]" aria-hidden="true" />
              {category.name}
            </h3>
          ) : (
            <h2 id={`cat-title-${category.id}`} className="m-display flex items-center gap-3 text-[28px] font-semibold tracking-tight md:text-[34px]">
              {category.name}
            </h2>
          )}
          {category.description ? <p className="mt-1.5 max-w-2xl text-[14.5px] text-[var(--m-muted)]">{category.description}</p> : null}
        </div>
        {category.dishes.length ? (
          <span className="hidden shrink-0 text-[13px] text-[var(--m-muted)] sm:block">
            {category.dishes.length} {view.strings.dishCount}
          </span>
        ) : null}
      </div>

      {!category.dishes.length ? null : category.layout === "tiles" ? (
        <ul className="mt-5 grid grid-cols-2 gap-x-3.5 gap-y-6 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4">
          {category.dishes.map((d) => (
            <li key={d.id}>
              <DishTile dish={d} view={view} onOpen={onOpen} favorite={isFavorite(d.id)} />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--m-border)] md:grid md:grid-cols-2 md:gap-x-10 md:divide-y-0">
          {category.dishes.map((d) => (
            <li key={d.id} className="md:border-b md:border-[var(--m-border)]">
              <DishRow dish={d} view={view} onOpen={onOpen} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ModelBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[10.5px] font-bold tracking-wide text-white shadow-[0_0_0_1px_rgba(255,255,255,.18),0_4px_18px_-4px_var(--m-glow)] backdrop-blur-md">
      <ArIcon className="size-3.5" />
      {label}
    </span>
  );
}

function DishTile({ dish, view, onOpen, favorite }: { dish: DishView; view: MenuView; onOpen: (id: string) => void; favorite: boolean }) {
  const s = view.strings;
  return (
    <button type="button" onClick={() => onOpen(dish.id)} className={`group block w-full text-start ${dish.available ? "" : "opacity-55"}`}>
      <div className="relative aspect-square overflow-hidden rounded-[22px] bg-[var(--m-surface)] ring-1 ring-[var(--m-border)]">
        {dish.photo ? (
          <DishImage
            image={dish.photo}
            alt={dish.name}
            sizes="(min-width: 1024px) 280px, (min-width: 768px) 33vw, 50vw"
            className={`size-full object-cover transition duration-700 group-hover:scale-[1.04] ${dish.available ? "" : "grayscale"}`}
          />
        ) : (
          <div className="grid size-full place-items-center p-4 text-center">
            <span className="m-display text-lg text-[var(--m-muted)]">{dish.name}</span>
          </div>
        )}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2.5">
          {dish.model ? <ModelBadge label={s.badge3d} /> : <span />}
          {favorite ? (
            <span className="grid size-7 place-items-center rounded-full bg-[var(--m-primary)] text-[var(--m-on-primary)]">
              <Heart className="size-3.5 fill-current" />
            </span>
          ) : null}
        </div>
        {!dish.available ? (
          <span className="absolute bottom-2.5 start-2.5 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-white">{s.unavailable}</span>
        ) : null}
      </div>
      <div className="mt-2.5 px-0.5">
        <h3 className="line-clamp-2 text-[15px] leading-snug font-semibold">{dish.name}</h3>
        <div className="mt-1 flex items-center justify-between gap-2">
          {dish.price ? (
            <span className="text-[14.5px] font-semibold text-[var(--m-primary)] tabular-nums" dir="ltr">
              {dish.price}
            </span>
          ) : dish.variants[0] ? (
            <span className="text-[13px] text-[var(--m-muted)]">
              {s.from} <span className="font-semibold text-[var(--m-primary)] tabular-nums" dir="ltr">{dish.variants[0].price}</span>
            </span>
          ) : (
            <span />
          )}
          <span className="flex gap-1 text-[var(--m-muted)]">
            {dish.tags.slice(0, 3).map((t) => (
              <TagIcon key={t.code} code={t.code} className="size-3.5" />
            ))}
          </span>
        </div>
      </div>
    </button>
  );
}

function DishRow({ dish, view, onOpen }: { dish: DishView; view: MenuView; onOpen: (id: string) => void }) {
  const s = view.strings;
  return (
    <button type="button" onClick={() => onOpen(dish.id)} className={`flex w-full items-center gap-4 py-4 text-start ${dish.available ? "" : "opacity-55"}`}>
      {dish.photo ? (
        <div className="relative size-[72px] shrink-0 overflow-hidden rounded-2xl bg-[var(--m-surface)]">
          <DishImage image={dish.photo} alt="" sizes="72px" className="size-full object-cover" />
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <h3 className="text-[15.5px] leading-snug font-semibold">{dish.name}</h3>
          <span className="mb-1 min-w-4 flex-1 border-b border-dotted border-[var(--m-border)]" aria-hidden="true" />
          {dish.price ? (
            <span className="shrink-0 text-[15px] font-semibold text-[var(--m-primary)] tabular-nums" dir="ltr">
              {dish.price}
            </span>
          ) : null}
        </div>
        {dish.description ? <p className="mt-1 line-clamp-2 text-[13.5px] leading-snug text-[var(--m-muted)]">{dish.description}</p> : null}
        {dish.variants.length ? (
          <p className="mt-1 text-[13px] text-[var(--m-muted)]">
            {dish.variants.map((v) => (
              <span key={v.label} className="me-3 inline-block">
                {v.label} <span className="font-semibold text-[var(--m-text)] tabular-nums" dir="ltr">{v.price}</span>
              </span>
            ))}
          </p>
        ) : null}
        <div className="mt-1.5 flex items-center gap-2">
          {dish.model ? (
            <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[var(--m-primary)]">
              <ArIcon className="size-3.5" /> {s.view3d}
            </span>
          ) : null}
          {!dish.available ? <span className="text-[11.5px] font-semibold">{s.unavailable}</span> : null}
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-[var(--m-muted)] rtl:rotate-180" />
    </button>
  );
}

function FeaturedCard({ dish, view, onOpen }: { dish: DishView; view: MenuView; onOpen: (id: string) => void }) {
  return (
    <button type="button" onClick={() => onOpen(dish.id)} className="group relative block aspect-[4/5] w-full overflow-hidden rounded-[28px] bg-[var(--m-surface)] text-start ring-1 ring-[var(--m-border)]">
      {dish.photo ? (
        <DishImage image={dish.photo} alt={dish.name} sizes="(min-width: 768px) 360px, 78vw" className="absolute inset-0 size-full object-cover transition duration-700 group-hover:scale-[1.04]" />
      ) : null}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,rgba(0,0,0,.82)_100%)]" />
      {dish.model ? (
        <div className="absolute start-3.5 top-3.5">
          <ModelBadge label={view.strings.badge3d} />
        </div>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 p-5 text-white">
        <h3 className="m-display text-[22px] leading-tight font-semibold">{dish.name}</h3>
        {dish.description ? <p className="mt-1 line-clamp-2 text-[13px] text-white/75">{dish.description}</p> : null}
        <div className="mt-3 flex items-center justify-between">
          {dish.price ? <span className="text-[16px] font-semibold tabular-nums" dir="ltr">{dish.price}</span> : <span />}
          {dish.model ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--m-primary)] px-3 py-1.5 text-[12px] font-semibold text-[var(--m-on-primary)]">
              <ArIcon className="size-4" /> {view.strings.view3d}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}
