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
});

export type RestaurantSettings = z.infer<typeof restaurantSettingsSchema>;

export function parseRestaurantSettings(value: unknown): RestaurantSettings {
  const parsed = restaurantSettingsSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : restaurantSettingsSchema.parse({});
}
