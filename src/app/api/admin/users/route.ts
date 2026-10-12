import { db } from "@/lib/db";
import { readJson, route } from "@/lib/http";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { createUser, userCreateSchema } from "@/lib/users";

export const GET = route(async () => {
  await requireSuperAdmin();
  const users = await db.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true, role: true, isActive: true, lastLoginAt: true, memberships: { select: { restaurantId: true, role: true } } },
  });
  return { users };
});

export const POST = route(async (request) => {
  const actor = await requireSuperAdmin();
  const { user, password } = await createUser(userCreateSchema.parse(await readJson(request)), actor.id);
  return { user: { id: user.id, email: user.email }, temporaryPassword: password };
});
