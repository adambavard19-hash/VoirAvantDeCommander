import type { FontPairing, ThemeSettings } from "./theme";

/**
 * « Ambiance automatique » : propose une identité visuelle à partir des photos
 * du restaurant (luminosité, couleurs dominantes) et de son type de cuisine.
 * Fonction pure : l'analyse des pixels se fait dans le navigateur.
 */

export type PhotoAnalysis = {
  /** Luminance moyenne 0 (noir) – 1 (blanc). */
  luminance: number;
  /** Couleurs marquantes (saturées), de la plus présente à la moins présente. */
  accents: string[];
  /** Teinte moyenne de la photo (pour un fond assorti). */
  average: string;
};

export type AmbianceResult = { theme: ThemeSettings; reasons: string[] };

const FONT_RULES: { font: FontPairing; words: string[]; label: string }[] = [
  {
    font: "elegant",
    label: "cuisine gastronomique / traditionnelle → typographie élégante",
    words: ["gastro", "bistronom", "francais", "français", "traditionnel", "terroir", "vin", "cave", "brasserie", "bouchon", "etoile", "étoilé", "fruits de mer", "poisson"],
  },
  {
    font: "futuristic",
    label: "concept moderne / fusion / bar → typographie futuriste",
    words: ["sushi", "japon", "fusion", "asiat", "thai", "coréen", "coreen", "ramen", "poke", "bar", "cocktail", "lounge", "rooftop", "healthy", "vegan", "concept", "food court", "street"],
  },
  {
    font: "modern",
    label: "cuisine conviviale → typographie moderne",
    words: ["burger", "pizza", "pizzeria", "tacos", "kebab", "snack", "fast", "grill", "smash", "café", "cafe", "brunch", "boulangerie", "crêperie", "creperie", "glacier", "salon de thé", "italien", "mexicain", "libanais", "méditerran", "mediterran"],
  },
];

const LIGHT_WORDS = ["brunch", "café", "cafe", "boulangerie", "crêperie", "creperie", "salon de thé", "glacier", "healthy", "méditerran", "mediterran", "plage"];
const DARK_WORDS = ["bar", "cocktail", "lounge", "gastro", "étoilé", "etoile", "sushi", "cave", "rooftop", "nuit"];

function normalize(s: string) {
  return s.toLowerCase();
}

function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
}

function hsl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function fromHsl(h: number, s: number, l: number) {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

function hueDistance(a: number, b: number) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function suggestAmbiance(input: { photos: PhotoAnalysis[]; cuisineType?: string | null; name?: string | null }): AmbianceResult {
  const reasons: string[] = [];
  const text = normalize(`${input.cuisineType ?? ""} ${input.name ?? ""}`);

  // Typographie d'après le type de cuisine.
  const rule = FONT_RULES.find((r) => r.words.some((w) => text.includes(w)));
  const font: FontPairing = rule?.font ?? "modern";
  reasons.push(rule ? rule.label : "type de cuisine non reconnu → typographie moderne");

  // Clair ou sombre : d'après la luminosité des photos, puis le type de cuisine.
  const photos = input.photos.filter((p) => Number.isFinite(p.luminance));
  const avgLum = photos.length ? photos.reduce((s, p) => s + p.luminance, 0) / photos.length : null;
  let mode: "dark" | "light";
  if (DARK_WORDS.some((w) => text.includes(w))) {
    mode = "dark";
    reasons.push("ambiance de soirée → menu sombre");
  } else if (LIGHT_WORDS.some((w) => text.includes(w))) {
    mode = "light";
    reasons.push("ambiance de journée → menu clair");
  } else if (avgLum !== null) {
    mode = avgLum < 0.5 ? "dark" : "light";
    reasons.push(avgLum < 0.5 ? "photos plutôt sombres et tamisées → menu sombre" : "photos lumineuses → menu clair");
  } else {
    mode = "dark";
  }

  // Couleur principale : l'accent le plus présent, rendu assez vif pour les boutons.
  const accents = photos.flatMap((p) => p.accents);
  let primary = "#D4A24C";
  let secondary: string | undefined;
  if (accents.length) {
    const [h, s] = hsl(accents[0]!);
    primary = fromHsl(h, Math.max(0.55, Math.min(0.9, s)), mode === "dark" ? 0.6 : 0.45);
    reasons.push("couleur principale prise dans vos photos");
    const second = accents.find((a) => hueDistance(hsl(a)[0], h) > 50);
    if (second) {
      const [h2, s2] = hsl(second);
      secondary = fromHsl(h2, Math.max(0.45, Math.min(0.85, s2)), mode === "dark" ? 0.62 : 0.42);
    }
  } else {
    reasons.push("aucune couleur marquante dans les photos → or par défaut");
  }

  // Fond : teinte moyenne des photos, très assombrie (ou éclaircie).
  let background: string | undefined;
  const base = photos.find((p) => p.average)?.average;
  if (base) {
    const [h, s] = hsl(base);
    background = mode === "dark" ? fromHsl(h, Math.min(0.35, s), 0.06) : fromHsl(h, Math.min(0.4, s), 0.95);
  }

  return { theme: { mode, primary, secondary, background, font }, reasons };
}
