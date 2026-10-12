import Link from "next/link";
import { ArrowRight, Box, CircleCheck, Circle, Eye, ScanLine, Sparkles, Upload, UtensilsCrossed } from "lucide-react";
import { db } from "@/lib/db";
import { checkRestaurantAccess, requireRestaurantAccessPage } from "@/lib/auth/guards";
import { statSeries, statTotals, topDishes } from "@/lib/stats";
import { Card, CardHeader } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { DailyColumns, StatTile } from "@/components/admin/charts";
import { VersionHistory } from "@/components/admin/version-history";

export default async function RestaurantOverview({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = await searchParams;
  const user = await requireRestaurantAccessPage(id, "VIEW");
  const canPublish = await checkRestaurantAccess(user, id, "PUBLISH");

  const [restaurant, dishes, translations, totals, series, top, versions] = await Promise.all([
    db.restaurant.findUniqueOrThrow({ where: { id }, select: { logoAssetId: true, coverAssetId: true, locales: true, defaultLocale: true, publishedVersionId: true, qrCode: { select: { id: true } } } }),
    db.dish.findMany({ where: { restaurantId: id }, select: { photoAssetId: true, glbAssetId: true, usdzAssetId: true, scaleStatus: true, isVisible: true, priceCents: true, priceVariants: true } }),
    db.translation.count({ where: { restaurantId: id } }),
    statTotals({ restaurantId: id, days: 30 }),
    statSeries({ restaurantId: id, days: 30, event: "MENU_VIEW" }),
    topDishes(id, 30),
    db.menuVersion.findMany({ where: { restaurantId: id }, orderBy: { number: "desc" }, take: 8, select: { id: true, number: true, publishedAt: true, note: true } }),
  ]);

  const visible = dishes.filter((d) => d.isVisible);
  const withPhoto = visible.filter((d) => d.photoAssetId).length;
  const with3d = visible.filter((d) => d.glbAssetId || d.usdzAssetId);
  const complete3d = visible.filter((d) => d.glbAssetId && d.usdzAssetId).length;
  const scaled = with3d.filter((d) => d.scaleStatus === "VALIDATED").length;
  const extraLocales = restaurant.locales.filter((l) => l !== restaurant.defaultLocale).length;

  const checklist = [
    { done: !!restaurant.logoAssetId, label: "Logo ajouté", href: "settings" },
    { done: !!restaurant.coverAssetId, label: "Photo de couverture", href: "settings" },
    { done: visible.length > 0, label: `Plats au menu (${visible.length})`, href: "import" },
    { done: visible.length > 0 && withPhoto === visible.length, label: `Photos des plats (${withPhoto}/${visible.length})`, href: "menu" },
    { done: with3d.length > 0, label: `Plats en 3D (${with3d.length}, dont ${complete3d} GLB + USDZ)`, href: "import" },
    { done: with3d.length > 0 && scaled === with3d.length, label: `Taille réelle validée (${scaled}/${with3d.length})`, href: "menu" },
    { done: extraLocales === 0 || translations > 0, label: extraLocales ? `Traductions (${extraLocales} langue${extraLocales > 1 ? "s" : ""})` : "Menu dans une seule langue", href: "translations" },
    { done: !!restaurant.publishedVersionId, label: "Menu publié", href: "" },
    { done: !!restaurant.qrCode, label: "QR code généré", href: "qr" },
  ];

  return (
    <div className="space-y-6">
      {created ? (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-5 bg-[linear-gradient(110deg,#08080c,#1b1426)] p-6 text-white">
            <div className="grid size-12 place-items-center rounded-2xl bg-saffron/15 text-saffron">
              <Sparkles className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold">L&apos;espace du restaurant est prêt</h2>
              <p className="mt-0.5 text-[14px] text-white/65">
                Étape suivante : déposez en une fois photos, menu (PDF, Excel, CSV) et fichiers 3D (.glb, .usdz). Le logiciel associe tout automatiquement.
              </p>
            </div>
            <Link href={`/admin/restaurants/${id}/import`} className={buttonClasses("accent", "lg")}>
              <Upload className="size-4" /> Importer les fichiers
            </Link>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section aria-label="Statistiques" className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="Consultations (30 j)" value={totals.MENU_VIEW} icon={<Eye className="size-4" />} />
            <StatTile label="Fiches plats ouvertes" value={totals.DISH_VIEW} icon={<UtensilsCrossed className="size-4" />} />
            <StatTile label="Interactions 3D" value={totals.MODEL_VIEW} icon={<Box className="size-4" />} />
            <StatTile label="Lancements AR" value={totals.AR_LAUNCH} icon={<ScanLine className="size-4" />} />
          </section>
          <Card>
            <CardHeader title="Consultations du menu" description="30 derniers jours" />
            <div className="p-5">
              <DailyColumns data={series} label="Consultations du menu par jour" height={140} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Plats les plus consultés" description="30 derniers jours" />
            {top.length ? (
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="text-left text-[12px] text-stone-500">
                    <th className="px-5 py-2 font-medium">Plat</th>
                    <th className="px-3 py-2 text-right font-medium">Ouvertures</th>
                    <th className="px-3 py-2 text-right font-medium">3D</th>
                    <th className="px-5 py-2 text-right font-medium">AR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {top.map((d) => (
                    <tr key={d.id}>
                      <td className="px-5 py-2.5">{d.name}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{d.views}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{d.models}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums">{d.ar}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="px-5 py-8 text-center text-[13.5px] text-stone-500">Pas encore de consultation enregistrée.</p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Mise en service" description="Ce qu'il reste à faire pour un menu complet" />
            <ul className="divide-y divide-stone-100">
              {checklist.map((c) => (
                <li key={c.label}>
                  <Link href={`/admin/restaurants/${id}${c.href ? `/${c.href}` : ""}`} className="flex items-center gap-3 px-5 py-2.5 text-[13.5px] hover:bg-stone-50">
                    {c.done ? <CircleCheck className="size-4.5 shrink-0 text-emerald-600" /> : <Circle className="size-4.5 shrink-0 text-stone-300" />}
                    <span className={c.done ? "text-stone-600" : "font-medium text-stone-900"}>{c.label}</span>
                    {!c.done ? <ArrowRight className="ms-auto size-3.5 text-stone-400" /> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <VersionHistory
            restaurantId={id}
            canPublish={canPublish}
            currentId={restaurant.publishedVersionId}
            versions={versions.map((v) => ({ id: v.id, number: v.number, publishedAt: v.publishedAt.toISOString(), note: v.note }))}
          />
        </div>
      </div>
    </div>
  );
}
