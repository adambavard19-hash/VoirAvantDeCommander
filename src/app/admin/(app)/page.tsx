import Link from "next/link";
import { Box, Eye, Plus, QrCode, ScanLine, Store, UtensilsCrossed, BookOpen, UsersRound, MousePointerClick } from "lucide-react";
import { db } from "@/lib/db";
import { requireUserPage, isSuperAdmin, restaurantScope } from "@/lib/auth/guards";
import { daysAgo, statComparison, statDaily, topDishesAcross } from "@/lib/stats";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { KpiCard, TrendLines } from "@/components/admin/charts";
import { changeBetween } from "@/components/admin/change";
import { RestaurantSearch } from "@/components/admin/restaurant-search";
import { StatusBadge } from "@/components/admin/status-badge";

const PERIODS = [7, 30, 90] as const;
const nf = new Intl.NumberFormat("fr-FR");

/** Couleurs des courbes : palette catégorielle validée (daltonisme), ordre fixe. */
const SERIES_COLORS = { MENU_VIEW: "#2a78d6", MODEL_VIEW: "#eb6834", AR_LAUNCH: "#1baf7a" } as const;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  const user = await requireUserPage();
  const { periode } = await searchParams;
  const days = PERIODS.find((p) => String(p) === periode) ?? 30;
  const since = daysAgo(days);
  const periodLabel = `vs ${days} j précédents`;

  const scope = { ...restaurantScope(user), status: { not: "ARCHIVED" as const } };
  const restaurants = await db.restaurant.findMany({ where: scope, select: { id: true } });
  const ids = restaurants.map((r) => r.id);
  const dishScope = { restaurantId: { in: ids } };
  const admin = isSuperAdmin(user);

  const [
    published,
    newRestaurants,
    dishes,
    newDishes,
    dishesWith3d,
    dishesComplete3d,
    qrCodes,
    qrDownloads,
    users,
    stats,
    daily,
    top,
    recent,
    leads,
  ] = await Promise.all([
    db.restaurant.count({ where: { ...scope, status: "PUBLISHED" } }),
    db.restaurant.count({ where: { ...scope, createdAt: { gte: since } } }),
    db.dish.count({ where: dishScope }),
    db.dish.count({ where: { ...dishScope, createdAt: { gte: since } } }),
    db.dish.count({ where: { ...dishScope, OR: [{ glbAssetId: { not: null } }, { usdzAssetId: { not: null } }] } }),
    db.dish.count({ where: { ...dishScope, glbAssetId: { not: null }, usdzAssetId: { not: null } } }),
    db.qrCode.count({ where: { restaurantId: { in: ids } } }),
    db.qrCode.aggregate({ where: { restaurantId: { in: ids } }, _sum: { downloads: true } }),
    admin ? db.user.count({ where: { isActive: true } }) : Promise.resolve(0),
    statComparison({ restaurantIds: ids, days }),
    statDaily({ restaurantIds: ids, days }),
    topDishesAcross(ids, days, 6),
    db.restaurant.findMany({
      where: scope,
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: { id: true, name: true, city: true, slug: true, status: true, updatedAt: true, _count: { select: { dishes: true } } },
    }),
    admin ? db.lead.findMany({ where: { status: "NEW" }, orderBy: { createdAt: "desc" }, take: 5 }) : Promise.resolve([]),
  ]);

  const { current, previous } = stats;
  const coverage3d = dishes ? Math.round((dishesComplete3d / dishes) * 100) : 0;
  const arRate = current.DISH_VIEW ? Math.round((current.AR_LAUNCH / current.DISH_VIEW) * 100) : null;

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        description="Vue d'ensemble de vos restaurants, de leurs menus 3D et de leur audience."
        actions={
          admin ? (
            <Link href="/admin/restaurants/new" className={buttonClasses("accent")}>
              <Plus className="size-4" /> Créer un restaurant
            </Link>
          ) : null
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="min-w-64 flex-1">
          <RestaurantSearch />
        </div>
        <nav aria-label="Période" className="inline-flex rounded-xl bg-stone-100 p-1 text-[13px] font-medium">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={p === 30 ? "/admin" : `/admin?periode=${p}`}
              aria-current={p === days ? "page" : undefined}
              className={`rounded-lg px-3 py-1.5 transition ${p === days ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800"}`}
              scroll={false}
            >
              {p} jours
            </Link>
          ))}
        </nav>
      </div>

      {/* Indicateurs principaux */}
      <section aria-label="Indicateurs principaux" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Restaurants"
          value={ids.length}
          icon={<Store className="size-[18px]" />}
          change={{ kind: "count", value: newRestaurants, label: `créé${newRestaurants > 1 ? "s" : ""} sur ${days} j` }}
          hint={`${published} menu${published > 1 ? "s" : ""} en ligne`}
          tone="saffron"
        />
        <KpiCard
          title={`Consultations des menus (${days} j)`}
          value={current.MENU_VIEW}
          icon={<Eye className="size-[18px]" />}
          change={changeBetween(current.MENU_VIEW, previous.MENU_VIEW)}
          period={periodLabel}
          tone="violet"
        />
        <KpiCard
          title={`Vues en 3D (${days} j)`}
          value={current.MODEL_VIEW}
          icon={<Box className="size-[18px]" />}
          change={changeBetween(current.MODEL_VIEW, previous.MODEL_VIEW)}
          period={periodLabel}
          tone="coral"
        />
        <KpiCard
          title={`Plats posés sur la table (AR, ${days} j)`}
          value={current.AR_LAUNCH}
          icon={<ScanLine className="size-[18px]" />}
          change={changeBetween(current.AR_LAUNCH, previous.AR_LAUNCH)}
          period={periodLabel}
          tone="holo"
        />
      </section>

      {/* Indicateurs secondaires */}
      <section aria-label="Contenu des menus" className="mt-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard
          title="Plats"
          value={dishes}
          icon={<UtensilsCrossed className="size-[18px]" />}
          change={{ kind: "count", value: newDishes, label: `ajouté${newDishes > 1 ? "s" : ""} sur ${days} j` }}
          tone="saffron"
        />
        <KpiCard
          title="Plats avec 3D complète"
          value={dishesComplete3d}
          icon={<Box className="size-[18px]" />}
          hint={
            dishes
              ? `${coverage3d} % de la carte · ${dishesWith3d > dishesComplete3d ? `${dishesWith3d - dishesComplete3d} avec un seul format` : "GLB + USDZ"}`
              : "GLB (Android) + USDZ (iPhone)"
          }
          tone="coral"
        />
        <KpiCard
          title="QR codes"
          value={qrCodes}
          icon={<QrCode className="size-[18px]" />}
          hint={`${nf.format(qrDownloads._sum.downloads ?? 0)} téléchargement${(qrDownloads._sum.downloads ?? 0) > 1 ? "s" : ""}`}
          tone="violet"
        />
        {admin ? (
          <KpiCard title="Comptes actifs" value={users} icon={<UsersRound className="size-[18px]" />} hint="Administrateurs et restaurateurs" tone="holo" />
        ) : (
          <KpiCard
            title={`Fiches plats ouvertes (${days} j)`}
            value={current.DISH_VIEW}
            icon={<MousePointerClick className="size-[18px]" />}
            change={changeBetween(current.DISH_VIEW, previous.DISH_VIEW)}
            period={periodLabel}
            tone="holo"
          />
        )}
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card className="min-w-0">
          <CardHeader
            title="Évolution de l'audience"
            description={`Par jour, sur les ${days} derniers jours, tous restaurants confondus`}
          />
          <div className="px-5 py-5">
            <TrendLines
              label={`Audience quotidienne des menus sur ${days} jours`}
              days={daily.map((d) => d.day)}
              series={[
                { key: "MENU_VIEW", label: "Consultations", color: SERIES_COLORS.MENU_VIEW, values: daily.map((d) => d.MENU_VIEW) },
                { key: "MODEL_VIEW", label: "Vues 3D", color: SERIES_COLORS.MODEL_VIEW, values: daily.map((d) => d.MODEL_VIEW) },
                { key: "AR_LAUNCH", label: "Réalité augmentée", color: SERIES_COLORS.AR_LAUNCH, values: daily.map((d) => d.AR_LAUNCH) },
              ]}
            />
            <div className="mt-5 grid gap-3 border-t border-stone-100 pt-4 text-[12.5px] text-stone-500 sm:grid-cols-2">
              <p>
                <span className="font-semibold text-stone-800 tabular-nums">{nf.format(current.DISH_VIEW)}</span> fiches plats ouvertes
                {arRate !== null ? (
                  <>
                    {" "}
                    · <span className="font-semibold text-stone-800 tabular-nums">{arRate} %</span> menant à la réalité augmentée
                  </>
                ) : null}
              </p>
              <p className="sm:text-end">Mesure anonyme : aucun cookie ni donnée personnelle, compteurs agrégés par jour.</p>
            </div>
          </div>
        </Card>

        <Card className="min-w-0">
          <CardHeader title="Plats les plus regardés" description={`${days} derniers jours`} />
          {top.length ? (
            <ol className="divide-y divide-stone-100">
              {top.map((d, i) => {
                const maxViews = Math.max(1, top[0]!.views);
                return (
                  <li key={d.id} className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-stone-100 text-[11.5px] font-semibold text-stone-600 tabular-nums">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link href={`/admin/restaurants/${d.restaurantId}/menu`} className="block truncate text-[14px] font-medium hover:underline">
                          {d.name}
                        </Link>
                        <p className="truncate text-[12px] text-stone-500">{d.restaurantName}</p>
                      </div>
                      <div className="text-end text-[12px] text-stone-500 tabular-nums">
                        <p>
                          <span className="font-semibold text-stone-900">{nf.format(d.views)}</span> vues
                        </p>
                        <p>
                          {nf.format(d.models)} 3D · {nf.format(d.ar)} AR
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 ms-9 h-1.5 overflow-hidden rounded-full bg-stone-100" aria-hidden="true">
                      <div className="h-full rounded-full bg-[#2a78d6]" style={{ width: `${(d.views / maxViews) * 100}%` }} />
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="px-5 py-10 text-center text-[13.5px] text-stone-500">Le classement apparaîtra dès que des clients ouvriront des fiches plats.</p>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card className="min-w-0">
          <CardHeader
            title="Restaurants récemment modifiés"
            actions={
              <Link href="/admin/restaurants" className="text-[13px] font-medium text-stone-600 hover:text-stone-900">
                Tout voir
              </Link>
            }
          />
          <ul className="divide-y divide-stone-100">
            {recent.map((r) => (
              <li key={r.id}>
                <Link href={`/admin/restaurants/${r.id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-stone-50">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-stone-100 text-stone-500" aria-hidden="true">
                    <BookOpen className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">{r.name}</p>
                    <p className="truncate text-[12.5px] text-stone-500">
                      {r._count.dishes} plat{r._count.dishes > 1 ? "s" : ""} · /menu/{r.slug}
                    </p>
                  </div>
                  <span className="hidden text-[12px] text-stone-400 sm:block">{r.updatedAt.toLocaleDateString("fr-FR")}</span>
                  <StatusBadge status={r.status} />
                </Link>
              </li>
            ))}
            {!recent.length ? <li className="px-5 py-8 text-center text-[13.5px] text-stone-500">Aucun restaurant pour le moment.</li> : null}
          </ul>
        </Card>

        {admin ? (
          <Card className="min-w-0">
            <CardHeader
              title="Nouvelles demandes de démo"
              actions={
                <Link href="/admin/leads" className="text-[13px] font-medium text-stone-600 hover:text-stone-900">
                  Toutes
                </Link>
              }
            />
            {leads.length ? (
              <ul className="divide-y divide-stone-100">
                {leads.map((l) => (
                  <li key={l.id} className="px-5 py-3 text-[14px]">
                    <p className="flex items-center gap-2">
                      <span className="font-medium">{l.name}</span>
                      <span className="ms-auto text-[12px] text-stone-400">{l.createdAt.toLocaleDateString("fr-FR")}</span>
                    </p>
                    <p className="text-[12.5px] text-stone-500">{[l.restaurantName, l.city].filter(Boolean).join(" · ") || "—"}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-10 text-center text-[13.5px] text-stone-500">Aucune nouvelle demande.</p>
            )}
          </Card>
        ) : null}
      </div>
    </>
  );
}
