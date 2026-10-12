import "server-only";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { parseTheme } from "@/lib/theme";
import { ensureQrCode } from "@/lib/menu/publish";
import { parseQrStyle, qrPng, qrSvg } from "./qr";
import { printablePdf, PRINT_TEMPLATES, type PrintTemplate } from "./print";

export type QrFormat = "png" | "svg" | "pdf";

/** Logo du restaurant (variante PNG/WebP la plus adaptée), ou null. */
async function restaurantLogo(restaurantId: string): Promise<Buffer | null> {
  const r = await db.restaurant.findUnique({ where: { id: restaurantId }, select: { logo: true } });
  if (!r?.logo || r.logo.status !== "READY") return null;
  const variants = (r.logo.variants as Record<string, string> | null) ?? {};
  return storage().getBuffer(variants.w480 ?? variants.w960 ?? r.logo.storageKey);
}

/** Produit le fichier QR demandé. L'URL encodée est celle, figée, du QrCode du restaurant. */
export async function renderQr(restaurantId: string, format: QrFormat, template: PrintTemplate = "table-card", opts: { countDownload?: boolean } = {}) {
  const restaurant = await db.restaurant.findUniqueOrThrow({ where: { id: restaurantId }, select: { slug: true, name: true, theme: true } });
  const qr = await ensureQrCode(restaurantId, restaurant.slug);
  const style = parseQrStyle(qr.style);
  const logo = style.logo ? await restaurantLogo(restaurantId) : null;
  const base = restaurant.slug;
  if (opts.countDownload !== false) await db.qrCode.update({ where: { id: qr.id }, data: { downloads: { increment: 1 } } });
  if (format === "png") {
    return { body: await qrPng(qr.targetUrl, { fg: style.fg, bg: style.bg, logo, size: 2000 }), type: "image/png", filename: `qr-${base}.png` };
  }
  if (format === "svg") {
    return { body: Buffer.from(await qrSvg(qr.targetUrl, { fg: style.fg, bg: style.bg, logo })), type: "image/svg+xml", filename: `qr-${base}.svg` };
  }
  const accent = style.accent ?? parseTheme(restaurant.theme).primary;
  const pdf = await printablePdf({ url: qr.targetUrl, restaurantName: restaurant.name, logoPng: logo, style, accent, template });
  return { body: pdf, type: "application/pdf", filename: `qr-${base}-${template}.pdf` };
}

export function isTemplate(value: string | null): value is PrintTemplate {
  return !!value && value in PRINT_TEMPLATES;
}
