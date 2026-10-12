import { db } from "@/lib/db";
import { readJson, route } from "@/lib/http";
import { requireSuperAdmin, requireUser, restaurantScope } from "@/lib/auth/guards";
import { createRestaurant, restaurantInputSchema } from "@/lib/restaurants";
import type { Prisma, RestaurantStatus } from "@/generated/prisma/client";

export const GET = route(async (request) => {
  const user = await requireUser();
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim();
  const status = url.searchParams.get("status") as RestaurantStatus | null;
  const where: Prisma.RestaurantWhereInput = {
    AND: [
      restaurantScope(user),
      q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { city: { contains: q, mode: "insensitive" } },
              { slug: { contains: q.toLowerCase() } },
            ],
          }
        : {},
      status ? { status } : { status: { not: "ARCHIVED" } },
    ],
  };
  const restaurants = await db.restaurant.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, name: true, slug: true, city: true, status: true, updatedAt: true },
  });
  return { restaurants };
});

export const POST = route(async (request) => {
  const user = await requireSuperAdmin();
  const input = restaurantInputSchema.parse(await readJson(request));
  const restaurant = await createRestaurant(input, user.id);
  return { restaurant: { id: restaurant.id, slug: restaurant.slug } };
});
