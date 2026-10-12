import { z } from "zod";
import { db } from "@/lib/db";
import { conflict, notFound, readJson, route } from "@/lib/http";
import { requireRestaurantAccess } from "@/lib/auth/guards";
import { analyzeImport, proposalStats, saveProposal } from "@/lib/import/analyze";

export const maxDuration = 300;

/** Analyse les fichiers de l'import et produit une proposition à relire. */
export const POST = route<{ id: string; jobId: string }>(async (request, { id, jobId }) => {
  const user = await requireRestaurantAccess(id, "EDIT");
  const job = await db.importJob.findFirst({ where: { id: jobId, restaurantId: id } });
  if (!job) throw notFound("Import introuvable.");
  if (job.status === "APPLIED" || job.status === "CANCELLED") throw conflict("Cet import est terminé.");
  const { useAi } = z.object({ useAi: z.boolean().optional() }).parse(await readJson(request).catch(() => ({})));
  const proposal = await analyzeImport({ restaurantId: id, jobId, userId: user.id, useAi });
  await saveProposal(jobId, proposal);
  return { proposal, stats: proposalStats(proposal) };
});
