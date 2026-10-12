import { createHash } from "node:crypto";

/** Champs traduisibles par type d'entité. Les prix n'en font jamais partie. */
export const TRANSLATABLE_FIELDS = {
  RESTAURANT: ["tagline", "description", "practicalInfo"],
  CATEGORY: ["name", "description"],
  DISH: ["name", "description"], // + « variant.N » pour les libellés de déclinaisons de prix
} as const;

/** Empreinte courte du texte source : une traduction dont l'empreinte diffère est obsolète. */
export function sourceHash(text: string): string {
  return createHash("sha256").update(text.trim()).digest("hex").slice(0, 16);
}
