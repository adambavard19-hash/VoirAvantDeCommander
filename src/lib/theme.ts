import { z } from "zod";

/**
 * Identité visuelle d'un restaurant. L'administrateur choisit peu de paramètres
 * (ambiance, couleur principale, typographie) ; la palette complète et lisible
 * est calculée automatiquement, avec un contraste vérifié.
 */
export const FONT_PAIRINGS = {
  elegant: { label: "Élégante (serif gastronomique)", display: "var(--font-fraunces)", body: "var(--font-manrope)" },
  modern: { label: "Moderne (sans serif)", display: "var(--font-manrope)", body: "var(--font-inter)" },
  futuristic: { label: "Futuriste (géométrique)", display: "var(--font-space-grotesk)", body: "var(--font-inter)" },
} as const;

export type FontPairing = keyof typeof FONT_PAIRINGS;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur hexadécimale attendue (#RRGGBB)");

export const themeSchema = z.object({
  preset: z.string().optional(),
  mode: z.enum(["dark", "light"]).default("dark"),
  primary: hex.default("#D4A24C"),
  secondary: hex.optional(),
  background: hex.optional(),
  font: z.enum(["elegant", "modern", "futuristic"]).default("elegant"),
});

export type ThemeSettings = z.infer<typeof themeSchema>;

export const THEME_PRESETS: Record<string, { label: string; theme: ThemeSettings }> = {
  "noir-or": { label: "Noir & or", theme: { preset: "noir-or", mode: "dark", primary: "#D4A24C", font: "elegant" } },
  "creme-terracotta": {
    label: "Crème & terracotta",
    theme: { preset: "creme-terracotta", mode: "light", primary: "#B9532C", background: "#F6EFE4", font: "elegant" },
  },
  "bistrot-vert": {
    label: "Bistrot vert anglais",
    theme: { preset: "bistrot-vert", mode: "dark", primary: "#C9A227", background: "#0E1C17", font: "elegant" },
  },
  neon: {
    label: "Néon futuriste",
    theme: { preset: "neon", mode: "dark", primary: "#FF4D8D", secondary: "#38E8FF", background: "#07060D", font: "futuristic" },
  },
  mediterranee: {
    label: "Méditerranée",
    theme: { preset: "mediterranee", mode: "light", primary: "#1D6FB0", secondary: "#E2A23B", font: "modern" },
  },
  braise: {
    label: "Braise",
    theme: { preset: "braise", mode: "dark", primary: "#FF6B2C", background: "#120B08", font: "modern" },
  },
};

export const DEFAULT_THEME: ThemeSettings = THEME_PRESETS["noir-or"]!.theme;

export function parseTheme(value: unknown): ThemeSettings {
  const parsed = themeSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : DEFAULT_THEME;
}

// ─── Couleurs ────────────────────────────────────────────────────────────────

type Rgb = [number, number, number];

export function hexToRgb(h: string): Rgb {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
}

function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex([f(0) * 255, f(8) * 255, f(4) * 255]);
}

function luminance(h: string): number {
  const [r, g, b] = hexToRgb(h).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (la + 0.05) / (lb + 0.05);
}

/** Ajuste la luminosité d'une couleur d'accent jusqu'à un contraste suffisant sur le fond. */
function ensureContrast(color: string, background: string, min: number): string {
  const [h, s, initialL] = rgbToHsl(hexToRgb(color));
  let l = initialL;
  const bgDark = luminance(background) < 0.2;
  let out = color;
  for (let i = 0; i < 40 && contrastRatio(out, background) < min; i++) {
    l = bgDark ? Math.min(95, l + 2) : Math.max(5, l - 2);
    out = hslToHex(h, s, l);
  }
  return out;
}

export type ThemeTokens = Record<
  "bg" | "surface" | "surface2" | "border" | "text" | "muted" | "primary" | "onPrimary" | "secondary" | "glow",
  string
> & { mode: "dark" | "light"; fontDisplay: string; fontBody: string };

/** Calcule la palette complète à partir des réglages simples. */
export function themeTokens(settings: ThemeSettings): ThemeTokens {
  const [h, s] = rgbToHsl(hexToRgb(settings.primary));
  const dark = settings.mode === "dark";
  const tint = Math.min(s, 40);
  const bg = settings.background ?? (dark ? hslToHex(h, tint * 0.45, 5.5) : hslToHex(h, tint * 0.8, 96.5));
  const [bh, bs, bl] = rgbToHsl(hexToRgb(bg));
  const surface = dark ? hslToHex(bh, bs, Math.min(bl + 5, 30)) : hslToHex(bh, bs * 0.6, Math.min(bl + 2.5, 100));
  const surface2 = dark ? hslToHex(bh, bs, Math.min(bl + 10, 36)) : hslToHex(bh, bs, Math.max(bl - 5, 0));
  const text = dark ? hslToHex(bh, Math.min(bs, 25), 95) : hslToHex(bh, Math.min(bs, 30), 9);
  const muted = dark ? hslToHex(bh, Math.min(bs, 12), 70) : hslToHex(bh, Math.min(bs, 14), 36);
  const primary = ensureContrast(settings.primary, bg, 3.2);
  const onPrimary = contrastRatio("#000000", primary) >= contrastRatio("#FFFFFF", primary) ? "#0B0B0B" : "#FFFFFF";
  const secondary = ensureContrast(settings.secondary ?? settings.primary, bg, 3);
  const [pr, pg, pb] = hexToRgb(primary);
  const fonts = FONT_PAIRINGS[settings.font];
  return {
    mode: settings.mode,
    bg,
    surface,
    surface2,
    border: dark ? "rgba(255,255,255,0.09)" : "rgba(20,15,10,0.10)",
    text,
    muted,
    primary,
    onPrimary,
    secondary,
    glow: `rgba(${pr},${pg},${pb},0.35)`,
    fontDisplay: fonts.display,
    fontBody: fonts.body,
  };
}

/** Variables CSS injectées sur le conteneur du menu. */
export function themeCssVars(tokens: ThemeTokens): Record<string, string> {
  return {
    "--m-bg": tokens.bg,
    "--m-surface": tokens.surface,
    "--m-surface-2": tokens.surface2,
    "--m-border": tokens.border,
    "--m-text": tokens.text,
    "--m-muted": tokens.muted,
    "--m-primary": tokens.primary,
    "--m-on-primary": tokens.onPrimary,
    "--m-secondary": tokens.secondary,
    "--m-glow": tokens.glow,
    "--m-font-display": tokens.fontDisplay,
    "--m-font-body": tokens.fontBody,
  };
}
