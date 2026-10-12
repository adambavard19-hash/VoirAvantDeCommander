import { readJson, route } from "@/lib/http";
import { requireRestaurantAccess } from "@/lib/auth/guards";
import { applyImport } from "@/lib/import/apply";
import type { ImportProposal } from "@/lib/import/types";

export const POST = route<{ id: string; jobId: string }>(async (request, { id, jobId }) => {
  const user = await requireRestaurantAccess(id, "EDIT");
  const { proposal } = await readJson<{ proposal: ImportProposal }>(request);
  const report = await applyImport({ restaurantId: id, jobId, userId: user.id, proposal });
  return { report };
});
