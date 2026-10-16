import { describe, expect, it } from "vitest";
import { suggestAmbiance } from "@/lib/ambiance";
import { themeSchema } from "@/lib/theme";

const darkWarm = { luminance: 0.22, accents: ["#d9902b", "#2f6b4f"], average: "#3a2a1c" };
const brightBlue = { luminance: 0.74, accents: ["#2a78d6"], average: "#dfe7ef" };

describe("ambiance automatique", () => {
  it("photos tamisées et cuisine gastronomique : sombre, élégante, couleur prise dans les photos", () => {
    const { theme, reasons } = suggestAmbiance({ photos: [darkWarm], cuisineType: "Bistronomie" });
    expect(theme.mode).toBe("dark");
    expect(theme.font).toBe("elegant");
    expect(theme.primary).toMatch(/^#[0-9a-f]{6}$/);
    expect(theme.secondary).toBeDefined(); // vert, assez éloigné de l'orangé
    expect(reasons.length).toBeGreaterThan(0);
    expect(themeSchema.safeParse(theme).success).toBe(true);
  });

  it("photos lumineuses : menu clair ; burger : typographie moderne", () => {
    const { theme } = suggestAmbiance({ photos: [brightBlue], cuisineType: "Burger & frites maison" });
    expect(theme.mode).toBe("light");
    expect(theme.font).toBe("modern");
  });

  it("le type de cuisine l'emporte sur la luminosité (bar à cocktails : sombre, futuriste)", () => {
    const { theme } = suggestAmbiance({ photos: [brightBlue], cuisineType: "Bar à cocktails" });
    expect(theme.mode).toBe("dark");
    expect(theme.font).toBe("futuristic");
  });

  it("sans photo ni type reconnu : valeurs par défaut valides", () => {
    const { theme } = suggestAmbiance({ photos: [] });
    expect(themeSchema.safeParse(theme).success).toBe(true);
    expect(theme.primary).toBe("#D4A24C");
  });
});
