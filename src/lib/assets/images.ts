import "server-only";
import sharp, { type Metadata } from "sharp";

/** Largeurs des variantes WebP générées pour chaque photo (srcset). */
export const IMAGE_WIDTHS = [480, 960, 1600] as const;

export type ProcessedImage = {
  width: number;
  height: number;
  format: string;
  variants: { name: string; width: number; buffer: Buffer }[];
  /** Miniature floue (data URL) affichée pendant le chargement. */
  blurDataUrl: string;
  /** Couleurs dominantes (utile pour suggérer une identité visuelle depuis un logo). */
  dominant: string;
  hasAlpha: boolean;
};

export class ImageError extends Error {}

export async function processImage(input: Buffer, opts: { keepAlpha?: boolean } = {}): Promise<ProcessedImage> {
  let meta: Metadata;
  try {
    meta = await sharp(input, { failOn: "error" }).metadata();
  } catch {
    throw new ImageError("Image illisible ou format non pris en charge (utilisez JPEG, PNG ou WebP).");
  }
  if (!meta.width || !meta.height) throw new ImageError("Dimensions d'image introuvables.");
  if (meta.width * meta.height > 80_000_000) throw new ImageError("Image trop grande (plus de 80 mégapixels).");

  // Orientation EXIF appliquée, métadonnées (dont GPS) supprimées des variantes.
  const base = sharp(input, { failOn: "error" }).rotate();
  const oriented = await base.clone().metadata();
  const swap = (meta.orientation ?? 1) >= 5;
  const width = swap ? meta.height : meta.width;
  const height = swap ? meta.width : meta.height;
  const hasAlpha = !!oriented.hasAlpha;

  const variants: ProcessedImage["variants"] = [];
  // Variantes plus petites que l'original, plus l'original lui-même s'il fait moins de 1600 px.
  const widths: number[] = IMAGE_WIDTHS.filter((w) => w < width);
  if (width <= IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1]!) widths.push(width);
  for (const w of widths) {
    const buffer = await base
      .clone()
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: 80, alphaQuality: opts.keepAlpha || hasAlpha ? 90 : 80, effort: 4 })
      .toBuffer();
    variants.push({ name: `w${w}.webp`, width: w, buffer });
  }

  const blur = await base.clone().resize({ width: 20 }).webp({ quality: 40 }).toBuffer();
  const stats = await sharp(input).stats();
  const d = stats.dominant;
  const dominant = `#${[d.r, d.g, d.b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;

  return {
    width,
    height,
    format: meta.format ?? "unknown",
    variants,
    blurDataUrl: `data:image/webp;base64,${blur.toString("base64")}`,
    dominant,
    hasAlpha,
  };
}
