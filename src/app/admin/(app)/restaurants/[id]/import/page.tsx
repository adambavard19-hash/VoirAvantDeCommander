import { db } from "@/lib/db";
import { requireRestaurantAccessPage } from "@/lib/auth/guards";
import { aiAvailable } from "@/lib/ai";
import { proposalStats } from "@/lib/import/analyze";
import { ImportWizard } from "@/components/admin/import-wizard";
import type { ImportProposal } from "@/lib/import/types";

export const metadata = { title: "Import intelligent" };

export default async function ImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRestaurantAccessPage(id, "EDIT");
  const [job, categories, dishes, history] = await Promise.all([
    db.importJob.findFirst({ where: { restaurantId: id, status: { in: ["UPLOADING", "REVIEW"] } }, orderBy: { createdAt: "desc" }, include: { _count: { select: { assets: true } } } }),
    db.category.findMany({ where: { restaurantId: id }, orderBy: { position: "asc" }, select: { id: true, name: true } }),
    db.dish.findMany({ where: { restaurantId: id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.importJob.findMany({ where: { restaurantId: id, status: "APPLIED" }, orderBy: { appliedAt: "desc" }, take: 5, select: { id: true, appliedAt: true, report: true } }),
  ]);
  const proposal = (job?.proposal as unknown as ImportProposal | null) ?? null;
  return (
    <ImportWizard
      restaurantId={id}
      aiAvailable={aiAvailable()}
      initialJob={job ? { id: job.id, status: job.status, files: job._count.assets } : null}
      initialProposal={job?.status === "REVIEW" ? proposal : null}
      initialStats={job?.status === "REVIEW" && proposal ? proposalStats(proposal) : null}
      existingDishes={dishes}
      existingCategories={categories}
      history={history.map((h) => ({ id: h.id, appliedAt: h.appliedAt?.toISOString() ?? null, report: h.report as Record<string, number> | null }))}
    />
  );
}
