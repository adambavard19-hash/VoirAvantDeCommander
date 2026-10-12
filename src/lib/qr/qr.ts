import "server-only";
import QRCode from "qrcode";
import sharp from "sharp";
import { z } from "zod";
import { contrastRatio } from "@/lib/theme";

/** Personnalisation du QR code et de ses supports imprimables. */
export const qrStyleSchema = z.object({
  fg: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#111111"),
  bg: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#FFFFFF"),
  /** Logo du restaurant au centre du QR code (correction d'erreur renforcée). */
  logo: z.boolean().default(true),
  headline: z.string().max(80).default("Découvrez nos plats en 3D"),
  subline: z.string().max(140).default("Scannez avec l'appareil photo de votre téléphone"),
  /** Couleur d'accent des supports imprimables (par défaut celle du restaurant). */
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export type QrStyle = z.infer<typeof qrStyleSchema>;

export function parseQrStyle(value: unknown): QrStyle {
  const parsed = qrStyleSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : qrStyleSchema.parse({});
}

/**
 * Un QR code doit rester lisible par tous les téléphones : modules foncés sur
 * fond clair, contraste suffisant.
 */
export function qrColorProblem(fg: string, bg: string): string | null {
  const lum = (h: string) => {
    const n = parseInt(h.slice(1), 16);
    return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114;
  };
  if (lum(fg) >= lum(bg)) return "Le QR code doit être plus foncé que son fond (certains téléphones ne lisent pas les QR inversés).";
  if (contrastRatio(fg, bg) < 4) return "Contraste insuffisant entre le QR code et son fond.";
  return null;
}

type RenderOptions = { fg: string; bg: string; logo?: Buffer | null; size?: number; margin?: number };

/** QR code PNG haute définition, avec logo centré facultatif. */
export async function qrPng(text: string, opts: RenderOptions): Promise<Buffer> {
  const size = opts.size ?? 1200;
  const png = await QRCode.toBuffer(text, {
    errorCorrectionLevel: opts.logo ? "H" : "M",
    margin: opts.margin ?? 4,
    width: size,
    color: { dark: opts.fg, light: opts.bg },
  });
  if (!opts.logo) return png;
  // Logo : 20 % de la largeur, sur une pastille du fond (la correction « H » tolère ~30 % de pertes).
  const logoSize = Math.round(size * 0.2);
  const pad = Math.round(logoSize * 0.14);
  const logo = await sharp(opts.logo).resize(logoSize - pad * 2, logoSize - pad * 2, { fit: "contain", background: opts.bg }).png().toBuffer();
  const badge = await sharp({ create: { width: logoSize, height: logoSize, channels: 4, background: opts.bg } })
    .composite([{ input: logo, top: pad, left: pad }])
    .png()
    .toBuffer();
  const offset = Math.round((size - logoSize) / 2);
  return sharp(png).composite([{ input: badge, top: offset, left: offset }]).png().toBuffer();
}

/** QR code vectoriel SVG (impression à toutes tailles). */
export async function qrSvg(text: string, opts: RenderOptions): Promise<string> {
  const svg = await QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: opts.logo ? "H" : "M",
    margin: opts.margin ?? 4,
    color: { dark: opts.fg, light: opts.bg },
  });
  if (!opts.logo) return svg;
  const viewBox = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  const w = Number(viewBox?.[1] ?? 0);
  if (!w) return svg;
  const logoPng = await sharp(opts.logo).resize(256, 256, { fit: "contain", background: opts.bg }).png().toBuffer();
  const box = w * 0.2;
  const start = (w - box) / 2;
  const inset = box * 0.14;
  const overlay = `<rect x="${start}" y="${start}" width="${box}" height="${box}" fill="${opts.bg}"/><image x="${start + inset}" y="${start + inset}" width="${box - inset * 2}" height="${box - inset * 2}" href="data:image/png;base64,${logoPng.toString("base64")}"/>`;
  return svg.replace("</svg>", `${overlay}</svg>`);
}
