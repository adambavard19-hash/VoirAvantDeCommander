import { readJson, route } from "@/lib/http";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { updateUser, userUpdateSchema } from "@/lib/users";

export const PATCH = route<{ userId: string }>(async (request, { userId }) => {
  const actor = await requireSuperAdmin();
  await updateUser(userId, userUpdateSchema.parse(await readJson(request)), actor.id);
  return { ok: true };
});
