import { z } from "zod";
import { db } from "@/lib/db";
import { badRequest, readJson, route } from "@/lib/http";
import { requireRestaurantAccess } from "@/lib/auth/guards";
import { listTranslatables } from "@/lib/i18n/translate";
import { sourceHash } from "@/lib/i18n/translatable";
import { ALL_LOCALES } from "@/lib/i18n/locales";

const schema = z.object({
  entityType: z.enum(["RESTAURANT", "CATEGORY", "DISH"]),
  entityId: z.string(),
  field: z.string().max(40),
  locale: z.enum(ALL_LOCALES as [string, ...string[]]),
  value: z.string().max(3000),
});

/** Correction manuelle d'une traduction (jamais écrasée ensuite par la traduction automatique). */
export const PUT = route<{ id: string }>(async (request, { id }) => {
  await requireRestaurantAccess(id, "EDIT");
  const input = schema.parse(await readJson(request));
  // Le texte doit appartenir à ce restaurant (isolation).
  const item = (await listTranslatables(id)).find((i) => i.entityType === input.entityType && i.entityId === input.entityId && i.field === input.field);
  if (!item) throw badRequest("Texte introuvable pour ce restaurant.");
  const where = { entityType_entityId_field_locale: { entityType: input.entityType, entityId: input.entityId, field: input.field, locale: input.locale } };
  const value = input.value.trim();
  if (!value) {
    await db.translation.deleteMany({ where: { restaurantId: id, entityType: input.entityType, entityId: input.entityId, field: input.field, locale: input.locale } });
    return { state: "missing" };
  }
  await db.translation.upsert({
    where,
    update: { value, sourceHash: sourceHash(item.source), source: "MANUAL", provider: null },
    create: { restaurantId: id, entityType: input.entityType, entityId: input.entityId, field: input.field, locale: input.locale, value, sourceHash: sourceHash(item.source), source: "MANUAL" },
  });
  return { state: "manual" };
});
