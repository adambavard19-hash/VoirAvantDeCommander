import Link from "next/link";
import { Box, Eye, Plus, QrCode, ScanLine, Store, UtensilsCrossed, BookOpen } from "lucide-react";
import { db } from "@/lib/db";
import { requireUserPage, isSuperAdmin, restaurantScope } from "@/lib/auth/guards";
import { statSeries, statTotals } from "@/lib/stats";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { DailyColumns, StatTile } from "@/components/admin/charts";
import { RestaurantSearch } from "@/components/admin/restaurant-search";
import { StatusBadge } from "@/components/admin/status-badge";

export default async function DashboardPage() {
  const user = await requireUserPage();
  const scope = { ...restaurantScope(user), status: { not: "ARCHIVED" as const } };
  const restaurants = await db.restaurant.findMany({ where: scope, select: { id: true } });
  const ids = restaurants.map((r) => r.id);
  const dishScope = { restaurantId: { in: ids } };

  const [published, dishes, dishesWith3d, dishesComplete3d, qrCodes, totals, series, recent, leads] = await Promise.all([
    db.restaurant.count({ where: { ...scope, status: "PUBLISHED" } }),
    db.dish.count({ where: dishScope }),
    db.dish.count({ where: { ...dishScope, OR: [{ glbAssetId: { not: null } }, { usdzAssetId: { not: null } }] } }),
    db.dish.count({ where: { ...dishScope, glbAssetId: { not: null }, usdzAssetId: { not: null } } }),
    db.qrCode.count({ where: { restaurantId: { in: ids } } }),
    statTotals({ restaurantIds: ids, days: 30 }),
    statSeries({ restaurantIds: ids, days: 30, event: "MENU_VIEW" }),
    db.restaurant.findMany({
      where: scope,
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: { id: true, name: true, city: true, slug: true, status: true, updatedAt: true, _count: { select: { dishes: true } } },
    }),
    isSuperAdmin(user)
      ? db.lead.findMany({ where: { status: "NEW" }, orderBy: { createdAt: "desc" }, take: 5 })
      : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        description="Vue d'ensemble de vos restaurants et de leurs menus 3D."
        actions={
          isSuperAdmin(user) ? (
            <Link href="/admin/restaurants/new" className={buttonClasses("accent")}>
              <Plus className="size-4" /> Créer un restaurant
            </Link>
          ) : null
        }
      />

      <div className="mb-6">
        <RestaurantSearch />
      </div>

      <section aria-label="Indicateurs" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Restaurants" value={ids.length} icon={<Store className="size-4" />} />
        <StatTile label="Menus publiés" value={published} icon={<BookOpen className="size-4" />} />
        <StatTile label="Plats" value={dishes} icon={<UtensilsCrossed className="size-4" />} />
        <StatTile
          label="Plats avec 3D complète"
          value={dishesComplete3d}
          hint={dishesWith3d > dishesComplete3d ? `${dishesWith3d - dishesComplete3d} avec un seul format (GLB ou USDZ)` : "GLB + USDZ"}
          icon={<Box className="size-4" />}
        />
        <StatTile label="QR codes générés" value={qrCodes} icon={<QrCode className="size-4" />} />
        <StatTile label="Consultations (30 j)" value={totals.MENU_VIEW} hint={`${totals.DISH_VIEW} fiches plats ouvertes`} icon={<Eye className="size-4" />} />
        <StatTile label="Interactions 3D (30 j)" value={totals.MODEL_VIEW} icon={<Box className="size-4" />} />
        <StatTile label="Lancements AR (30 j)" value={totals.AR_LAUNCH} icon={<ScanLine className="size-4" />} />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader title="Consultations des menus" description="30 derniers jours, tous restaurants confondus" />
          <div className="px-5 py-5">
            <DailyColumns data={series} label="Consultations des menus par jour" />
            <p className="mt-4 text-[12px] text-stone-400">
              Mesure d&apos;audience anonyme : aucun cookie ni donnée personnelle, compteurs agrégés par jour.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Activité récente"
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
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">{r.name}</p>
                    <p className="truncate text-[12.5px] text-stone-500">
                      {r._count.dishes} plat{r._count.dishes > 1 ? "s" : ""} · /menu/{r.slug}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </Link>
              </li>
            ))}
            {!recent.length ? <li className="px-5 py-8 text-center text-[13.5px] text-stone-500">Aucun restaurant pour le moment.</li> : null}
          </ul>
        </Card>
      </div>

      {leads.length ? (
        <Card className="mt-6">
          <CardHeader
            title="Nouvelles demandes de démonstration"
            actions={
              <Link href="/admin/leads" className="text-[13px] font-medium text-stone-600 hover:text-stone-900">
                Toutes les demandes
              </Link>
            }
          />
          <ul className="divide-y divide-stone-100">
            {leads.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-[14px]">
                <span className="font-medium">{l.name}</span>
                <span className="text-stone-500">{l.restaurantName ?? "—"}</span>
                <span className="text-stone-500">{l.city ?? ""}</span>
                <span className="ms-auto text-[12.5px] text-stone-400">{l.createdAt.toLocaleDateString("fr-FR")}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
