import { z } from "zod";
import { db } from "@/lib/db";
import { readJson, route } from "@/lib/http";
import { requireSuperAdmin } from "@/lib/auth/guards";

export const PATCH = route<{ leadId: string }>(async (request, { leadId }) => {
  await requireSuperAdmin();
  const input = z.object({ status: z.enum(["NEW", "CONTACTED", "WON", "LOST"]).optional(), notes: z.string().max(3000).optional() }).parse(await readJson(request));
  const lead = await db.lead.update({ where: { id: leadId }, data: input });
  return { lead: { id: lead.id, status: lead.status } };
});

/** Suppression (droit à l'effacement RGPD). */
export const DELETE = route<{ leadId: string }>(async (_request, { leadId }) => {
  await requireSuperAdmin();
  await db.lead.delete({ where: { id: leadId } });
  return { ok: true };
});
