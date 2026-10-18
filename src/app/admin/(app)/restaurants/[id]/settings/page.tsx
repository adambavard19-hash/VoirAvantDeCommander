import { db } from "@/lib/db";
import { isSuperAdmin, requireRestaurantAccessPage } from "@/lib/auth/guards";
import { toAssetDto } from "@/lib/assets/service";
import { restaurantToValues } from "@/lib/restaurant-form-values";
import { appUrl } from "@/lib/env";
import { RestaurantForm } from "@/components/admin/restaurant-form";
import { DangerZone } from "@/components/admin/danger-zone";

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireRestaurantAccessPage(id, "EDIT");
  const restaurant = await db.restaurant.findUniqueOrThrow({ where: { id }, include: { logo: true, cover: true, facade: true, interior: true, entranceVideo: true, slugRedirects: true } });
  const gallery = restaurant.galleryAssetIds.length
    ? await db.asset.findMany({ where: { id: { in: restaurant.galleryAssetIds }, restaurantId: id } })
    : [];
  const byId = new Map(gallery.map((g) => [g.id, g]));
  return (
    <div className="space-y-8">
      <RestaurantForm
        mode="edit"
        restaurantId={id}
        initial={restaurantToValues(restaurant)}
        initialImages={{
          logo: restaurant.logo ? toAssetDto(restaurant.logo).thumbUrl : null,
          cover: restaurant.cover ? toAssetDto(restaurant.cover).thumbUrl : null,
          facade: restaurant.facade ? toAssetDto(restaurant.facade).url : null,
          interior: restaurant.interior ? toAssetDto(restaurant.interior).url : null,
          entranceVideo: restaurant.entranceVideo ? toAssetDto(restaurant.entranceVideo).url : null,
          gallery: restaurant.galleryAssetIds
            .map((gid) => byId.get(gid))
            .filter((a): a is NonNullable<typeof a> => !!a)
            .map((a) => ({ id: a.id, url: toAssetDto(a).thumbUrl ?? "" })),
        }}
      />
      {isSuperAdmin(user) ? (
        <DangerZone
          restaurantId={id}
          name={restaurant.name}
          slug={restaurant.slug}
          baseUrl={appUrl()}
          redirects={restaurant.slugRedirects.map((r) => r.slug)}
          archived={restaurant.status === "ARCHIVED"}
        />
      ) : null}
    </div>
  );
}
