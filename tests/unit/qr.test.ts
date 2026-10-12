import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import jsQR from "jsqr";
import { PDFDocument } from "pdf-lib";
import { parseQrStyle, qrColorProblem, qrPng, qrSvg } from "@/lib/qr/qr";
import { printablePdf, PRINT_TEMPLATES, type PrintTemplate } from "@/lib/qr/print";

const URL = "https://voiravantdecommander.fr/menu/le-petit-bistrot";
const out = process.env.QR_OUT; // dossier facultatif pour inspecter les rendus

async function logo() {
  return sharp({ create: { width: 400, height: 400, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: Buffer.from(`<svg width="400" height="400"><circle cx="200" cy="200" r="180" fill="#b9532c"/><text x="200" y="250" font-size="150" text-anchor="middle" fill="white" font-family="serif">LP</text></svg>`) }])
    .png()
    .toBuffer();
}

async function decode(png: Buffer): Promise<string | null> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data ?? null;
}

describe("QR codes", () => {
  it("encode l'URL du menu, y compris avec le logo au centre", async () => {
    expect(await decode(await qrPng(URL, { fg: "#111111", bg: "#FFFFFF" }))).toBe(URL);
    const withLogo = await qrPng(URL, { fg: "#1a1a1a", bg: "#FFFFFF", logo: await logo() });
    expect(await decode(withLogo)).toBe(URL);
    if (out) writeFileSync(path.join(out, "qr.png"), withLogo);
  });

  it("produit un SVG lisible (rendu puis décodé)", async () => {
    const svg = await qrSvg(URL, { fg: "#111111", bg: "#FFFFFF", logo: await logo() });
    expect(svg).toContain("<svg");
    const png = await sharp(Buffer.from(svg), { density: 300 }).png().toBuffer();
    expect(await decode(png)).toBe(URL);
  });

  it("refuse les couleurs illisibles", () => {
    expect(qrColorProblem("#FFFFFF", "#000000")).toMatch(/plus foncé/);
    expect(qrColorProblem("#BBBBBB", "#FFFFFF")).toMatch(/Contraste/);
    expect(qrColorProblem("#111111", "#FFFFFF")).toBeNull();
  });

  it.each(Object.keys(PRINT_TEMPLATES) as PrintTemplate[])("génère le support imprimable « %s »", async (template) => {
    const pdf = await printablePdf({ url: URL, restaurantName: "Le Petit Bistrot d'Émile", logoPng: await logo(), style: parseQrStyle({}), accent: "#B9532C", template });
    const doc = await PDFDocument.load(pdf);
    const [w, h] = PRINT_TEMPLATES[template].size;
    const page = doc.getPage(0);
    expect(Math.round((page.getWidth() * 25.4) / 72)).toBe(w);
    expect(Math.round((page.getHeight() * 25.4) / 72)).toBe(h);
    if (out) writeFileSync(path.join(out, `qr-${template}.pdf`), pdf);
  });
});
