import { db } from "@/lib/db";
import { route } from "@/lib/http";
import { requireRestaurantAccess } from "@/lib/auth/guards";

/** Démarre un nouvel import (les fichiers sont ensuite téléversés avec son identifiant). */
export const POST = route<{ id: string }>(async (_request, { id }) => {
  const user = await requireRestaurantAccess(id, "EDIT");
  const job = await db.importJob.create({ data: { restaurantId: id, createdById: user.id } });
  return { job: { id: job.id } };
});

export const GET = route<{ id: string }>(async (_request, { id }) => {
  await requireRestaurantAccess(id, "VIEW");
  const jobs = await db.importJob.findMany({
    where: { restaurantId: id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, status: true, createdAt: true, appliedAt: true, report: true, _count: { select: { assets: true } } },
  });
  return { jobs };
});
