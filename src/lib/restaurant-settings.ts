import { z } from "zod";

/** Préférences d'affichage du menu client, réglables par restaurant. */
export const restaurantSettingsSchema = z.object({
  /** Affiche les plats indisponibles (grisés) plutôt que de les masquer. */
  showUnavailable: z.boolean().default(true),
  /** Liste « Mes envies » (favoris stockés uniquement sur le téléphone du client). */
  enableFavorites: z.boolean().default(true),
  /** Affiche les allergènes renseignés sur les fiches. */
  showAllergens: z.boolean().default(true),
  /** Mention affichée sous les allergènes (ex. « Liste non exhaustive, demandez à l'équipe »). */
  allergenNotice: z.string().max(300).optional(),
  /** Mention « Menu 3D par VoirAvantDeCommander » en pied de page. */
  showPoweredBy: z.boolean().default(true),
  /** Entrée animée (devanture puis salle) avant le menu, si les deux photos existent. */
  entranceIntro: z.boolean().default(true),
  /** Position de la porte sur la photo de la devanture (0–1) : la caméra « entre » à cet endroit. */
  entranceFocus: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).default({ x: 0.5, y: 0.62 }),
});

export type RestaurantSettings = z.infer<typeof restaurantSettingsSchema>;

export function parseRestaurantSettings(value: unknown): RestaurantSettings {
  const parsed = restaurantSettingsSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : restaurantSettingsSchema.parse({});
}
