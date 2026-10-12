/**
 * Langues du menu client. Pour ajouter une langue : l'ajouter ici, puis compléter
 * src/lib/i18n/menu-strings.ts et src/lib/allergens.ts (les tests vérifient la complétude).
 */
export const LOCALES = {
  fr: { label: "Français", english: "French", dir: "ltr" },
  en: { label: "English", english: "English", dir: "ltr" },
  es: { label: "Español", english: "Spanish", dir: "ltr" },
  it: { label: "Italiano", english: "Italian", dir: "ltr" },
  de: { label: "Deutsch", english: "German", dir: "ltr" },
  pt: { label: "Português", english: "Portuguese", dir: "ltr" },
  ar: { label: "العربية", english: "Arabic", dir: "rtl" },
  zh: { label: "中文", english: "Simplified Chinese", dir: "ltr" },
  ja: { label: "日本語", english: "Japanese", dir: "ltr" },
} as const satisfies Record<string, { label: string; english: string; dir: "ltr" | "rtl" }>;

export type Locale = keyof typeof LOCALES;

export const ALL_LOCALES = Object.keys(LOCALES) as Locale[];

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && value in LOCALES;
}

export function localeDir(locale: string): "ltr" | "rtl" {
  return isLocale(locale) ? LOCALES[locale].dir : "ltr";
}

/**
 * Choisit la langue d'affichage : paramètre explicite, puis préférences du
 * navigateur (Accept-Language), puis langue principale du restaurant.
 */
export function pickLocale(
  available: string[],
  fallback: string,
  requested?: string | null,
  acceptLanguage?: string | null,
): string {
  if (requested && available.includes(requested)) return requested;
  if (acceptLanguage) {
    const prefs = acceptLanguage
      .split(",")
      .map((part) => {
        const [tag, q] = part.trim().split(";q=");
        return { tag: tag!.toLowerCase().split("-")[0]!, q: q ? Number(q) : 1 };
      })
      .filter((p) => p.tag && !Number.isNaN(p.q))
      .sort((a, b) => b.q - a.q);
    for (const p of prefs) if (available.includes(p.tag)) return p.tag;
  }
  return available.includes(fallback) ? fallback : (available[0] ?? fallback);
}
