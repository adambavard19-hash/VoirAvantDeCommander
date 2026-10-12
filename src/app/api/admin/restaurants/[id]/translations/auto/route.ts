import { z } from "zod";
import { readJson, route } from "@/lib/http";
import { requireRestaurantAccess } from "@/lib/auth/guards";
import { autoTranslate } from "@/lib/i18n/translate";
import { aiErrorMessage } from "@/lib/ai";

export const maxDuration = 300;

export const POST = route<{ id: string }>(async (request, { id }) => {
  await requireRestaurantAccess(id, "EDIT");
  const { locales } = z.object({ locales: z.array(z.string()).min(1).max(20) }).parse(await readJson(request));
  try {
    return { report: await autoTranslate(id, locales) };
  } catch (error) {
    return Response.json({ error: aiErrorMessage(error) }, { status: 502 });
  }
});
