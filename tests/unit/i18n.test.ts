import { describe, expect, it } from "vitest";
import { ALL_LOCALES, pickLocale, localeDir } from "@/lib/i18n/locales";
import { MENU_STRINGS } from "@/lib/i18n/menu-strings";
import { ALLERGENS } from "@/lib/allergens";
import { DISH_TAGS } from "@/lib/tags";
import { numbersPreserved } from "@/lib/i18n/translate";
import { formatPrice, parsePrice } from "@/lib/money";

describe("langues", () => {
  it("chaque langue a toutes les chaînes d'interface, allergènes et pictogrammes", () => {
    const keys = Object.keys(MENU_STRINGS.fr!).sort();
    for (const locale of ALL_LOCALES) {
      expect(Object.keys(MENU_STRINGS[locale] ?? {}).sort(), locale).toEqual(keys);
      for (const [code, labels] of Object.entries(ALLERGENS)) expect((labels as Record<string, string>)[locale], `${code}/${locale}`).toBeTruthy();
      for (const [code, labels] of Object.entries(DISH_TAGS)) expect((labels as Record<string, string>)[locale], `${code}/${locale}`).toBeTruthy();
    }
  });

  it("choisit la langue : paramètre, navigateur, puis langue du restaurant", () => {
    expect(pickLocale(["fr", "en", "es"], "fr", "es", "en-US")).toBe("es");
    expect(pickLocale(["fr", "en", "es"], "fr", "zz", "de-DE,en;q=0.8")).toBe("en");
    expect(pickLocale(["fr", "en"], "fr", null, "ja-JP")).toBe("fr");
  });

  it("gère l'écriture de droite à gauche", () => {
    expect(localeDir("ar")).toBe("rtl");
    expect(localeDir("fr")).toBe("ltr");
  });

  it("détecte une traduction qui modifie un nombre", () => {
    expect(numbersPreserved("Fondant 70 %, cuisson 12 min", "Lava cake 70%, baked 12 min")).toBe(true);
    expect(numbersPreserved("Pizza 4 fromages", "Four cheese pizza")).toBe(false);
  });
});

describe("prix", () => {
  it("lit les formats de prix courants", () => {
    expect(parsePrice("12,50 €")).toBe(1250);
    expect(parsePrice("12.5")).toBe(1250);
    expect(parsePrice("12€50")).toBe(1250);
    expect(parsePrice("€ 9")).toBe(900);
    expect(parsePrice("1 200,00")).toBe(120000);
    expect(parsePrice("douze")).toBeNull();
    expect(parsePrice("12,345")).toBeNull();
  });

  it("formate toujours selon la langue du restaurant, avec chiffres latins", () => {
    expect(formatPrice(1250, "EUR", "fr")).toMatch(/^12,50\s?€$/);
    expect(formatPrice(1900, "EUR", "fr")).toMatch(/^19\s?€$/);
    // Même pour un restaurant arabophone, les chiffres restent ceux du menu.
    expect(formatPrice(1250, "EUR", "ar")).toMatch(/12[.,٫]50/);
  });
});
