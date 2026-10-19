import { db } from "@/lib/db";
import { requireRestaurantAccessPage } from "@/lib/auth/guards";
import { toAssetDto } from "@/lib/assets/service";
import { parsePriceVariants } from "@/lib/menu/variants";
import { MenuEditor } from "@/components/admin/menu-editor";
import type { EditorCategory, EditorDish } from "@/components/admin/menu-types";
import { orderCategoryTree } from "@/lib/category-tree";

export default async function MenuEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRestaurantAccessPage(id, "EDIT");
  const restaurant = await db.restaurant.findUniqueOrThrow({ where: { id }, select: { currency: true, defaultLocale: true, slug: true } });
  const categories = await db.category.findMany({
    where: { restaurantId: id },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: {
      dishes: {
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        include: { photo: true, glb: true, usdz: true, recommendations: { orderBy: { position: "asc" }, select: { targetId: true } } },
      },
    },
  });

  const dishes: EditorDish[] = categories.flatMap((c) =>
    c.dishes.map((d) => ({
      id: d.id,
      categoryId: c.id,
      name: d.name,
      description: d.description,
      priceCents: d.priceCents,
      priceVariants: parsePriceVariants(d.priceVariants),
      photo: d.photo ? toAssetDto(d.photo) : null,
      glb: d.glb ? toAssetDto(d.glb) : null,
      usdz: d.usdz ? toAssetDto(d.usdz) : null,
      allergens: d.allergens,
      tags: d.tags,
      isAvailable: d.isAvailable,
      isVisible: d.isVisible,
      isFeatured: d.isFeatured,
      realWidthCm: d.realWidthCm,
      realDepthCm: d.realDepthCm,
      realHeightCm: d.realHeightCm,
      scaleStatus: d.scaleStatus,
      recommendationIds: d.recommendations.map((r) => r.targetId),
    })),
  );
  const editorCategories: EditorCategory[] = orderCategoryTree(categories).map((c) => ({
    id: c.id,
    parentId: c.parentId,
    name: c.name,
    description: c.description,
    icon: c.icon,
    isVisible: c.isVisible,
    dishIds: c.dishes.map((d) => d.id),
  }));

  return (
    <MenuEditor
      restaurantId={id}
      currency={restaurant.currency}
      locale={restaurant.defaultLocale}
      initialCategories={editorCategories}
      initialDishes={dishes}
    />
  );
}
