import "server-only";
import { z } from "zod";
import { aiStructured } from "@/lib/ai";
import { ALLERGEN_CODES } from "@/lib/allergens";
import { extensionOf } from "@/lib/storage/mime";
import type { ExtractionResult } from "./types";

const schema = z.object({
  categories: z.array(
    z.object({
      name: z.string(),
      dishes: z.array(
        z.object({
          name: z.string(),
          description: z.string().nullable(),
          price: z.number().nullable(),
          variants: z.array(z.object({ label: z.string(), price: z.number() })),
          allergens: z.array(z.enum(ALLERGEN_CODES as [string, ...string[]])),
        }),
      ),
    }),
  ),
  notes: z.array(z.string()),
});

const SYSTEM = `Tu extrais le contenu d'une carte de restaurant pour l'importer dans un menu numérique.
Règles impératives :
- Recopie exactement les noms de catégories, de plats et les descriptions tels qu'ils sont imprimés (même langue, sans reformuler ni traduire).
- price : le prix imprimé, en unités monétaires (ex. 14.5 pour « 14,50 € »). Si aucun prix n'est imprimé pour un plat, mets null. N'invente jamais un prix.
- variants : uniquement si plusieurs prix sont imprimés pour un même plat (ex. verre / bouteille), avec leur libellé ; sinon tableau vide.
- allergens : uniquement les allergènes EXPLICITEMENT indiqués pour ce plat sur la carte (mention « allergènes », pictogramme légendé…). Ne déduis jamais un allergène des ingrédients. Sinon tableau vide.
- Ignore les mentions légales, horaires, adresses et slogans.
- notes : signale en français tout passage illisible ou ambigu.`;

/** Extraction d'un menu par IA (PDF, y compris scanné). Le résultat est toujours relu avant application. */
export async function aiExtractMenu(buffer: Buffer, name: string, extractedText?: string): Promise<ExtractionResult> {
  const ext = extensionOf(name);
  const content =
    ext === "pdf"
      ? [
          { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: buffer.toString("base64") } },
          { type: "text" as const, text: "Extrais la carte de ce document." },
        ]
      : [{ type: "text" as const, text: `Extrais la carte suivante :\n\n${extractedText ?? buffer.toString("utf8")}` }];
  const result = await aiStructured({ schema, system: SYSTEM, content, effort: "medium", maxTokens: 32000 });
  const toCents = (n: number | null) => (n === null || !Number.isFinite(n) || n < 0 ? null : Math.round(n * 100));
  return {
    method: "ai",
    warnings: result.notes,
    categories: result.categories
      .map((c) => ({
        name: c.name.trim() || "Menu",
        dishes: c.dishes
          .filter((d) => d.name.trim())
          .map((d) => ({
            name: d.name.trim().slice(0, 140),
            description: d.description?.trim() || null,
            priceCents: toCents(d.price),
            variants: d.variants.map((v) => ({ label: v.label.trim(), priceCents: toCents(v.price) ?? 0 })).filter((v) => v.label),
            allergens: d.allergens,
            tags: [],
            source: `${name} (extraction IA)`,
            flags: ["Extrait par IA : vérifiez le texte et le prix", ...(d.price === null && !d.variants.length ? ["Prix non trouvé"] : [])],
          })),
      }))
      .filter((c) => c.dishes.length),
  };
}
