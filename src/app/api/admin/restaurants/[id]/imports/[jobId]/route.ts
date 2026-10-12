import { db } from "@/lib/db";
import { notFound, readJson, route } from "@/lib/http";
import { requireRestaurantAccess } from "@/lib/auth/guards";
import { deleteAsset } from "@/lib/assets/service";
import { proposalSchema } from "@/lib/import/apply";
import { proposalStats, saveProposal } from "@/lib/import/analyze";
import type { ImportProposal } from "@/lib/import/types";

type P = { id: string; jobId: string };

async function findJob(restaurantId: string, jobId: string) {
  const job = await db.importJob.findFirst({ where: { id: jobId, restaurantId } });
  if (!job) throw notFound("Import introuvable.");
  return job;
}

export const GET = route<P>(async (_request, { id, jobId }) => {
  await requireRestaurantAccess(id, "VIEW");
  const job = await findJob(id, jobId);
  const proposal = job.proposal as unknown as ImportProposal | null;
  return { job: { id: job.id, status: job.status, report: job.report }, proposal, stats: proposal ? proposalStats(proposal) : null };
});

/** Enregistre les corrections de la relecture (sans appliquer). */
export const PUT = route<P>(async (request, { id, jobId }) => {
  await requireRestaurantAccess(id, "EDIT");
  await findJob(id, jobId);
  const { proposal } = (await readJson<{ proposal: unknown }>(request)) ?? {};
  const parsed = proposalSchema.parse(proposal) as ImportProposal;
  await saveProposal(jobId, parsed);
  return { stats: proposalStats(parsed) };
});

/** Annule l'import : les fichiers téléversés qui ne servent à aucun plat sont supprimés. */
export const DELETE = route<P>(async (_request, { id, jobId }) => {
  await requireRestaurantAccess(id, "EDIT");
  const job = await findJob(id, jobId);
  if (job.status !== "APPLIED") {
    const assets = await db.asset.findMany({
      where: { importJobId: jobId, restaurantId: id },
      include: { _count: { select: { photoOf: true, glbOf: true, usdzOf: true, logoOf: true, coverOf: true, categoryOf: true } } },
    });
    for (const a of assets) if (Object.values(a._count).every((n) => n === 0)) await deleteAsset(a);
  }
  await db.importJob.update({ where: { id: jobId }, data: { status: job.status === "APPLIED" ? "APPLIED" : "CANCELLED" } });
  return { ok: true };
});
