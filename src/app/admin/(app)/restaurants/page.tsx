import Link from "next/link";
import { Plus, Store, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { isSuperAdmin, requireUserPage, restaurantScope } from "@/lib/auth/guards";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { StatusBadge } from "@/components/admin/status-badge";
import { RestaurantSearch } from "@/components/admin/restaurant-search";
import { toAssetDto } from "@/lib/assets/service";
import type { RestaurantStatus } from "@/generated/prisma/client";

const FILTERS: { key: string; label: string; status?: RestaurantStatus }[] = [
  { key: "all", label: "Tous" },
  { key: "published", label: "En ligne", status: "PUBLISHED" },
  { key: "draft", label: "Brouillons", status: "DRAFT" },
  { key: "suspended", label: "Hors ligne", status: "SUSPENDED" },
  { key: "archived", label: "Archivés", status: "ARCHIVED" },
];

export default async function RestaurantsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const user = await requireUserPage();
  const { filter = "all" } = await searchParams;
  const current = FILTERS.find((f) => f.key === filter) ?? FILTERS[0]!;
  const restaurants = await db.restaurant.findMany({
    where: { ...restaurantScope(user), status: current.status ?? { not: "ARCHIVED" } },
    orderBy: { updatedAt: "desc" },
    include: {
      logo: true,
      _count: { select: { dishes: true, categories: true } },
      publishedVersion: { select: { number: true, publishedAt: true } },
    },
  });
  const dishes3d = await db.dish.groupBy({
    by: ["restaurantId"],
    where: { restaurantId: { in: restaurants.map((r) => r.id) }, glbAssetId: { not: null } },
    _count: true,
  });
  const count3d = new Map(dishes3d.map((d) => [d.restaurantId, d._count]));

  return (
    <>
      <PageHeader
        title="Restaurants"
        description={`${restaurants.length} restaurant${restaurants.length > 1 ? "s" : ""}`}
        actions={
          isSuperAdmin(user) ? (
            <Link href="/admin/restaurants/new" className={buttonClasses("accent")}>
              <Plus className="size-4" /> Créer un restaurant
            </Link>
          ) : null
        }
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <RestaurantSearch />
        <nav className="flex gap-1 rounded-xl bg-white p-1 ring-1 ring-stone-200" aria-label="Filtrer">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={f.key === "all" ? "/admin/restaurants" : `/admin/restaurants?filter=${f.key}`}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-medium ${f.key === current.key ? "bg-ink text-white" : "text-stone-600 hover:bg-stone-100"}`}
            >
              {f.label}
            </Link>
          ))}
        </nav>
      </div>

      <Card>
        {restaurants.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[14px]">
              <thead>
                <tr className="border-b border-stone-100 text-left text-[12px] font-medium text-stone-500">
                  <th className="px-5 py-3 font-medium">Restaurant</th>
                  <th className="px-3 py-3 font-medium">Statut</th>
                  <th className="px-3 py-3 text-right font-medium">Plats</th>
                  <th className="px-3 py-3 text-right font-medium">En 3D</th>
                  <th className="px-3 py-3 font-medium">Dernière publication</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {restaurants.map((r) => (
                  <tr key={r.id} className="group hover:bg-stone-50/70">
                    <td className="px-5 py-3">
                      <Link href={`/admin/restaurants/${r.id}`} className="flex items-center gap-3">
                        <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-stone-100 ring-1 ring-stone-200">
                          {r.logo && toAssetDto(r.logo).thumbUrl ? (
                            <img src={toAssetDto(r.logo).thumbUrl!} alt="" className="max-h-full max-w-full object-contain" />
                          ) : (
                            <Store className="size-4.5 text-stone-400" />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-stone-900 group-hover:underline">{r.name}</span>
                          <span className="block truncate text-[12.5px] text-stone-500">{[r.city, `/menu/${r.slug}`].filter(Boolean).join(" · ")}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{r._count.dishes}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{count3d.get(r.id) ?? 0}</td>
                    <td className="px-3 py-3 text-stone-500">
                      {r.publishedVersion ? `v${r.publishedVersion.number} · ${r.publishedVersion.publishedAt.toLocaleDateString("fr-FR")}` : "—"}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {r.status === "PUBLISHED" ? (
                        <a href={`/menu/${r.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[13px] text-stone-500 hover:text-stone-900">
                          Menu <ExternalLink className="size-3.5" />
                        </a>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<Store className="size-5" />}
            title="Aucun restaurant"
            description="Créez votre premier restaurant : son menu, son QR code et son espace sont générés automatiquement."
            action={
              isSuperAdmin(user) ? (
                <Link href="/admin/restaurants/new" className={buttonClasses("accent")}>
                  <Plus className="size-4" /> Créer un restaurant
                </Link>
              ) : null
            }
          />
        )}
      </Card>
    </>
  );
}
