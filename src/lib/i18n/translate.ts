import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { aiAvailable, aiStructured } from "@/lib/ai";
import { parsePriceVariants } from "@/lib/menu/variants";
import { LOCALES, isLocale } from "./locales";
import { sourceHash } from "./translatable";
import type { TranslatableEntity, Translation } from "@/generated/prisma/client";

/** Texte traduisible du brouillon, avec son contexte (pour guider la traduction). */
export type TranslatableItem = {
  key: string;
  entityType: TranslatableEntity;
  entityId: string;
  field: string;
  source: string;
  context: string;
};

export type TranslationState = "missing" | "stale" | "auto" | "manual";

export function itemKey(entityType: string, entityId: string, field: string) {
  return `${entityType}:${entityId}:${field}`;
}

export async function listTranslatables(restaurantId: string): Promise<TranslatableItem[]> {
  const restaurant = await db.restaurant.findUniqueOrThrow({ where: { id: restaurantId }, select: { id: true, name: true, tagline: true, description: true, practicalInfo: true } });
  const categories = await db.category.findMany({
    where: { restaurantId },
    orderBy: { position: "asc" },
    include: { dishes: { orderBy: { position: "asc" } } },
  });
  const items: TranslatableItem[] = [];
  const push = (entityType: TranslatableEntity, entityId: string, field: string, source: string | null, context: string) => {
    const text = source?.trim();
    if (text) items.push({ key: itemKey(entityType, entityId, field), entityType, entityId, field, source: text, context });
  };
  push("RESTAURANT", restaurant.id, "tagline", restaurant.tagline, "Accroche du restaurant");
  push("RESTAURANT", restaurant.id, "description", restaurant.description, "Présentation du restaurant");
  push("RESTAURANT", restaurant.id, "practicalInfo", restaurant.practicalInfo, "Informations pratiques");
  for (const c of categories) {
    push("CATEGORY", c.id, "name", c.name, "Nom de catégorie du menu");
    push("CATEGORY", c.id, "description", c.description, `Description de la catégorie « ${c.name} »`);
    for (const d of c.dishes) {
      push("DISH", d.id, "name", d.name, `Nom de plat (catégorie « ${c.name} »)`);
      push("DISH", d.id, "description", d.description, `Description du plat « ${d.name} »`);
      parsePriceVariants(d.priceVariants).forEach((v, i) => push("DISH", d.id, `variant.${i}`, v.label, `Libellé de déclinaison de prix du plat « ${d.name} »`));
    }
  }
  return items;
}

export function stateOf(item: TranslatableItem, t: Translation | undefined): TranslationState {
  if (!t || !t.value.trim()) return "missing";
  if (t.sourceHash !== sourceHash(item.source)) return "stale";
  return t.source === "MANUAL" ? "manual" : "auto";
}

export async function translationOverview(restaurantId: string) {
  const restaurant = await db.restaurant.findUniqueOrThrow({ where: { id: restaurantId }, select: { defaultLocale: true, locales: true } });
  const [items, rows] = await Promise.all([listTranslatables(restaurantId), db.translation.findMany({ where: { restaurantId } })]);
  const byKey = new Map(rows.map((t) => [`${itemKey(t.entityType, t.entityId, t.field)}:${t.locale}`, t]));
  const locales = restaurant.locales.filter((l) => l !== restaurant.defaultLocale);
  const summary = locales.map((locale) => {
    const counts = { missing: 0, stale: 0, auto: 0, manual: 0 };
    for (const item of items) counts[stateOf(item, byKey.get(`${item.key}:${locale}`))]++;
    return { locale, total: items.length, ...counts };
  });
  return { defaultLocale: restaurant.defaultLocale, locales, items, byKey, summary };
}

// ─── Fournisseurs de traduction automatique ─────────────────────────────────

export function translationProvider(): "claude" | "deepl" | null {
  const e = env();
  if (e.ANTHROPIC_API_KEY) return "claude";
  if (e.DEEPL_API_KEY) return "deepl";
  return null;
}

const DEEPL_TARGET: Record<string, string> = { en: "EN-GB", es: "ES", it: "IT", de: "DE", pt: "PT-PT", ar: "AR", zh: "ZH-HANS", ja: "JA", fr: "FR" };

async function translateWithDeepl(texts: string[], from: string, to: string): Promise<string[]> {
  const key = env().DEEPL_API_KEY!;
  const endpoint = key.endsWith(":fx") ? "https://api-free.deepl.com/v2/translate" : "https://api.deepl.com/v2/translate";
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `DeepL-Auth-Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: texts, source_lang: from.toUpperCase(), target_lang: DEEPL_TARGET[to] ?? to.toUpperCase(), preserve_formatting: true }),
  });
  if (!res.ok) throw new Error(`DeepL : erreur ${res.status}`);
  const data = (await res.json()) as { translations: { text: string }[] };
  return data.translations.map((t) => t.text);
}

const claudeSchema = z.object({ translations: z.array(z.object({ id: z.string(), text: z.string() })) });

async function translateWithClaude(items: TranslatableItem[], from: string, to: string, restaurantName: string): Promise<Map<string, string>> {
  const target = isLocale(to) ? LOCALES[to].english : to;
  const source = isLocale(from) ? LOCALES[from].english : from;
  const system = `You translate restaurant menu content from ${source} into ${target} for a digital menu read by guests at the table.
Rules:
- Natural, appetizing ${target}, as a professional restaurant would write it. Keep it concise.
- Keep proper names and widely known dish names as they are when that is how guests know them (e.g. tiramisu, burrata, pizza margherita, ramen); translate descriptive names.
- Never change, add or remove numbers, quantities, percentages, prices, units or allergens. Copy every number exactly.
- Do not add information that is not in the source. Preserve line breaks.
- Return one translation for every id provided.`;
  const content = JSON.stringify({ restaurant: restaurantName, items: items.map((i) => ({ id: i.key, context: i.context, text: i.source })) });
  const result = await aiStructured({ schema: claudeSchema, system, content: [{ type: "text", text: content }], effort: "low", maxTokens: 16000 });
  return new Map(result.translations.map((t) => [t.id, t.text]));
}

/** Les nombres (prix, quantités, %) doivent être identiques dans la traduction. */
export function numbersPreserved(source: string, translated: string): boolean {
  const nums = (s: string) => (s.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(",", ".")).sort();
  return JSON.stringify(nums(source)) === JSON.stringify(nums(translated));
}

export type AutoTranslateReport = { locale: string; translated: number; skipped: number; errors: string[] }[];

/**
 * Traduit automatiquement les textes manquants ou obsolètes. Les traductions
 * saisies à la main (MANUAL) ne sont jamais écrasées.
 */
export async function autoTranslate(restaurantId: string, locales: string[]): Promise<AutoTranslateReport> {
  const provider = translationProvider();
  if (!provider) throw new Error("Aucun service de traduction configuré (ANTHROPIC_API_KEY ou DEEPL_API_KEY).");
  const overview = await translationOverview(restaurantId);
  const restaurant = await db.restaurant.findUniqueOrThrow({ where: { id: restaurantId }, select: { name: true } });
  const report: AutoTranslateReport = [];
  for (const locale of locales.filter((l) => overview.locales.includes(l))) {
    const todo = overview.items.filter((item) => {
      const t = overview.byKey.get(`${item.key}:${locale}`);
      const state = stateOf(item, t);
      return state === "missing" || (state === "stale" && t?.source !== "MANUAL");
    });
    const entry = { locale, translated: 0, skipped: 0, errors: [] as string[] };
    for (let i = 0; i < todo.length; i += 40) {
      const batch = todo.slice(i, i + 40);
      try {
        const results =
          provider === "claude"
            ? await translateWithClaude(batch, overview.defaultLocale, locale, restaurant.name)
            : new Map((await translateWithDeepl(batch.map((b) => b.source), overview.defaultLocale, locale)).map((text, k) => [batch[k]!.key, text]));
        for (const item of batch) {
          const text = results.get(item.key)?.trim();
          if (!text || !numbersPreserved(item.source, text)) {
            entry.skipped++;
            continue;
          }
          await db.translation.upsert({
            where: { entityType_entityId_field_locale: { entityType: item.entityType, entityId: item.entityId, field: item.field, locale } },
            update: { value: text, sourceHash: sourceHash(item.source), source: "AUTO", provider },
            create: { restaurantId, entityType: item.entityType, entityId: item.entityId, field: item.field, locale, value: text, sourceHash: sourceHash(item.source), source: "AUTO", provider },
          });
          entry.translated++;
        }
      } catch (error) {
        entry.errors.push(error instanceof Error ? error.message : "Erreur de traduction");
      }
    }
    report.push(entry);
  }
  return report;
}

export function autoTranslationAvailable(): boolean {
  return aiAvailable() || !!env().DEEPL_API_KEY;
}
