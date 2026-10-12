import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import sharp from "sharp";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, degrees, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";
import type { QrStyle } from "./qr";

/** Supports imprimables proposés. Dimensions en millimètres. */
export const PRINT_TEMPLATES = {
  "table-card": { label: "Carte de table A6", description: "105 × 148 mm, à glisser dans un présentoir", size: [105, 148] },
  "table-tent": { label: "Chevalet A5 à plier", description: "Feuille A5 pliée en deux : lisible des deux côtés de la table", size: [148, 210] },
  poster: { label: "Affiche A4", description: "Vitrine, entrée, comptoir", size: [210, 297] },
  stickers: { label: "Planche d'autocollants A4", description: "12 autocollants de 60 × 60 mm pour les tables", size: [210, 297] },
} as const;

export type PrintTemplate = keyof typeof PRINT_TEMPLATES;

const MM = 72 / 25.4;
const INK = "#141414";
const MUTED = "#6b6b6b";

function hexRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

type Fonts = { display: PDFFont; bold: PDFFont; regular: PDFFont };

async function loadFonts(pdf: PDFDocument): Promise<Fonts> {
  pdf.registerFontkit(fontkit);
  const dir = path.join(process.cwd(), "node_modules", "@fontsource");
  const [display, bold, regular] = await Promise.all([
    readFile(path.join(dir, "fraunces/files/fraunces-latin-600-normal.woff")),
    readFile(path.join(dir, "manrope/files/manrope-latin-700-normal.woff")),
    readFile(path.join(dir, "manrope/files/manrope-latin-400-normal.woff")),
  ]);
  return {
    display: await pdf.embedFont(display, { subset: true }),
    bold: await pdf.embedFont(bold, { subset: true }),
    regular: await pdf.embedFont(regular, { subset: true }),
  };
}

/** Retire les caractères absents de la police (évite une erreur d'impression). */
function safe(font: PDFFont, text: string): string {
  const supported = new Set(font.getCharacterSet());
  return [...text].filter((ch) => ch === " " || supported.has(ch.codePointAt(0)!)).join("").replace(/\s+/g, " ").trim();
}

/**
 * Zone de dessin dans le repère de lecture d'une face (origine en bas à gauche).
 * Une face retournée (chevalet) est dessinée à 180° : tout reste lisible une fois pliée.
 */
class Face {
  constructor(
    readonly page: PDFPage,
    readonly x: number,
    readonly y: number,
    readonly w: number,
    readonly h: number,
    readonly flipped = false,
  ) {}

  private point(lx: number, ly: number) {
    return this.flipped ? { x: this.x + this.w - lx, y: this.y + this.h - ly } : { x: this.x + lx, y: this.y + ly };
  }

  rect(lx: number, ly: number, w: number, h: number, opts: { color?: RGB; borderColor?: RGB; borderWidth?: number }) {
    const p = this.flipped ? { x: this.x + this.w - lx - w, y: this.y + this.h - ly - h } : { x: this.x + lx, y: this.y + ly };
    this.page.drawRectangle({ ...p, width: w, height: h, ...opts });
  }

  line(x1: number, y1: number, x2: number, y2: number, thickness: number, color: RGB) {
    this.page.drawLine({ start: this.point(x1, y1), end: this.point(x2, y2), thickness, color, lineCap: 1 });
  }

  image(img: PDFImage, lx: number, ly: number, w: number, h: number) {
    this.page.drawImage(img, { ...this.point(lx, ly), width: w, height: h, rotate: this.flipped ? degrees(180) : undefined });
  }

  /** Texte dont la ligne de base commence en (lx, ly), réduit pour tenir dans maxWidth. */
  text(text: string, opts: { font: PDFFont; size: number; lx: number; ly: number; maxWidth: number; color: RGB; align?: "left" | "center" }) {
    const t = safe(opts.font, text);
    if (!t) return 0;
    let size = opts.size;
    while (size > 5 && opts.font.widthOfTextAtSize(t, size) > opts.maxWidth) size -= 0.25;
    const width = opts.font.widthOfTextAtSize(t, size);
    const lx = opts.align === "center" ? opts.lx - width / 2 : opts.lx;
    this.page.drawText(t, { ...this.point(lx, opts.ly), size, font: opts.font, color: opts.color, rotate: this.flipped ? degrees(180) : undefined });
    return width;
  }

  /** QR code vectoriel : modules fusionnés par lignes, net à toute taille d'impression. */
  qr(url: string, lx: number, ly: number, size: number, style: QrStyle, logo: PDFImage | null) {
    const code = QRCode.create(url, { errorCorrectionLevel: logo ? "H" : "M" });
    const n = code.modules.size;
    const quiet = 2;
    const cell = size / (n + quiet * 2);
    const fg = hexRgb(style.fg);
    this.rect(lx, ly, size, size, { color: hexRgb(style.bg) });
    for (let row = 0; row < n; row++) {
      let col = 0;
      while (col < n) {
        if (!code.modules.get(row, col)) {
          col++;
          continue;
        }
        let end = col;
        while (end + 1 < n && code.modules.get(row, end + 1)) end++;
        this.rect(lx + (quiet + col) * cell, ly + size - (quiet + row + 1) * cell, (end - col + 1) * cell + 0.05, cell + 0.05, { color: fg });
        col = end + 1;
      }
    }
    if (logo) {
      const box = size * 0.2;
      const bx = lx + (size - box) / 2;
      const by = ly + (size - box) / 2;
      this.rect(bx, by, box, box, { color: hexRgb(style.bg) });
      const inset = box * 0.14;
      const d = logo.scaleToFit(box - inset * 2, box - inset * 2);
      this.image(logo, bx + (box - d.width) / 2, by + (box - d.height) / 2, d.width, d.height);
    }
  }

  /** Pictogramme « cube AR » centré en (cx, cy). */
  arCube(cx: number, cy: number, s: number, color: RGB) {
    const segs: [number, number, number, number][] = [
      [0, 1, 0.87, 0.5],
      [0.87, 0.5, 0.87, -0.5],
      [0.87, -0.5, 0, -1],
      [0, -1, -0.87, -0.5],
      [-0.87, -0.5, -0.87, 0.5],
      [-0.87, 0.5, 0, 1],
      [-0.87, 0.5, 0, 0],
      [0.87, 0.5, 0, 0],
      [0, 0, 0, -1],
    ];
    for (const [a, b, c, d] of segs) this.line(cx + a * s, cy + b * s, cx + c * s, cy + d * s, s * 0.15, color);
  }
}

export type PrintInput = {
  url: string;
  restaurantName: string;
  logoPng: Buffer | null;
  style: QrStyle;
  accent: string;
  template: PrintTemplate;
};

const MULTILINGUAL = "Scan for our 3D menu · Escanee para ver la carta · Scansiona il menù";

/** Face verticale : logo, nom, accroche, QR, consigne (carte de table, affiche). */
function portraitFace(face: Face, input: PrintInput, fonts: Fonts, logo: PDFImage | null) {
  const { w, h } = face;
  const k = w / (105 * MM); // facteur d'échelle par rapport à l'A6
  const accent = hexRgb(input.accent);
  const cx = w / 2;
  face.rect(0, h - 3 * MM * k, w, 3 * MM * k, { color: accent });
  let top = h - 13 * MM * k;
  if (logo) {
    const d = logo.scaleToFit(w * 0.34, 17 * MM * k);
    face.image(logo, cx - d.width / 2, top - d.height, d.width, d.height);
    top -= d.height + 8 * MM * k;
  } else {
    top -= 4 * MM * k;
  }
  face.text(input.restaurantName, { font: fonts.display, size: 21 * k, lx: cx, ly: top - 6 * MM * k, maxWidth: w - 16 * MM * k, color: hexRgb(INK), align: "center" });
  top -= 13 * MM * k;
  face.text(input.style.headline, { font: fonts.bold, size: 12 * k, lx: cx, ly: top - 3 * MM * k, maxWidth: w - 16 * MM * k, color: accent, align: "center" });
  top -= 11 * MM * k;
  const bottomBlock = 30 * MM * k;
  const qr = Math.min(w * 0.6, top - bottomBlock);
  face.rect(cx - qr / 2 - 2.5 * MM * k, top - qr - 2.5 * MM * k, qr + 5 * MM * k, qr + 5 * MM * k, { borderColor: accent, borderWidth: 1.2 * k });
  face.qr(input.url, cx - qr / 2, top - qr, qr, input.style, input.style.logo ? logo : null);
  top -= qr + 11 * MM * k;
  const sublineWidth = Math.min(fonts.regular.widthOfTextAtSize(safe(fonts.regular, input.style.subline), 9 * k), w - 28 * MM * k);
  face.arCube(cx - sublineWidth / 2 - 4.5 * MM * k, top + 1.1 * MM * k, 2 * MM * k, accent);
  face.text(input.style.subline, { font: fonts.regular, size: 9 * k, lx: cx + 2.5 * MM * k, ly: top, maxWidth: w - 28 * MM * k, color: hexRgb(INK), align: "center" });
  face.text(MULTILINGUAL, { font: fonts.regular, size: 6.3 * k, lx: cx, ly: top - 6 * MM * k, maxWidth: w - 14 * MM * k, color: hexRgb(MUTED), align: "center" });
  face.text(input.url.replace(/^https?:\/\//, ""), { font: fonts.regular, size: 6.3 * k, lx: cx, ly: 7 * MM * k, maxWidth: w - 14 * MM * k, color: hexRgb(MUTED), align: "center" });
}

/** Face horizontale : textes à gauche, QR à droite (faces du chevalet). */
function landscapeFace(face: Face, input: PrintInput, fonts: Fonts, logo: PDFImage | null) {
  const { w, h } = face;
  const accent = hexRgb(input.accent);
  const margin = 10 * MM;
  face.rect(0, 0, w, 2.5 * MM, { color: accent });
  const qr = Math.min(h - 2 * margin - 14 * MM, w * 0.42);
  const qrX = w - margin - qr;
  const qrY = (h - qr) / 2 + 1.5 * MM;
  face.rect(qrX - 2 * MM, qrY - 2 * MM, qr + 4 * MM, qr + 4 * MM, { borderColor: accent, borderWidth: 1 });
  face.qr(input.url, qrX, qrY, qr, input.style, input.style.logo ? logo : null);
  const colW = qrX - margin - 8 * MM;
  let top = h - margin;
  if (logo) {
    const d = logo.scaleToFit(colW * 0.5, 14 * MM);
    face.image(logo, margin, top - d.height, d.width, d.height);
    top -= d.height + 6 * MM;
  }
  face.text(input.restaurantName, { font: fonts.display, size: 22, lx: margin, ly: top - 6 * MM, maxWidth: colW, color: hexRgb(INK) });
  top -= 13 * MM;
  face.text(input.style.headline, { font: fonts.bold, size: 12.5, lx: margin, ly: top - 2 * MM, maxWidth: colW, color: accent });
  top -= 10 * MM;
  face.arCube(margin + 2 * MM, top - 0.5 * MM, 1.9 * MM, accent);
  face.text(input.style.subline, { font: fonts.regular, size: 8.5, lx: margin + 6 * MM, ly: top - 1.6 * MM, maxWidth: colW - 6 * MM, color: hexRgb(INK) });
  face.text(MULTILINGUAL, { font: fonts.regular, size: 5.8, lx: margin, ly: margin + 6 * MM, maxWidth: colW, color: hexRgb(MUTED) });
  face.text(input.url.replace(/^https?:\/\//, ""), { font: fonts.regular, size: 6, lx: margin, ly: margin + 1.5 * MM, maxWidth: colW, color: hexRgb(MUTED) });
}

/** Génère le PDF imprimable (texte vectoriel, QR vectoriel, logo du restaurant). */
export async function printablePdf(input: PrintInput): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${input.restaurantName} — QR code du menu`);
  pdf.setCreator("VoirAvantDeCommander");
  const fonts = await loadFonts(pdf);
  const logo = input.logoPng ? await pdf.embedPng(await sharp(input.logoPng).png().toBuffer()) : null;
  const [wmm, hmm] = PRINT_TEMPLATES[input.template].size;
  const W = wmm * MM;
  const H = hmm * MM;
  const page = pdf.addPage([W, H]);

  if (input.template === "table-tent") {
    // Pliée à mi-hauteur, la feuille tient debout : la face du haut est retournée.
    landscapeFace(new Face(page, 0, 0, W, H / 2), input, fonts, logo);
    landscapeFace(new Face(page, 0, H / 2, W, H / 2, true), input, fonts, logo);
    page.drawLine({ start: { x: 0, y: H / 2 }, end: { x: W, y: H / 2 }, thickness: 0.4, color: hexRgb("#bbbbbb"), dashArray: [4, 4] });
  } else if (input.template === "stickers") {
    const size = 60 * MM;
    const gapX = (W - 3 * size) / 4;
    const gapY = (H - 4 * size) / 5;
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 3; c++) {
        const face = new Face(page, gapX + c * (size + gapX), H - (r + 1) * (size + gapY), size, size);
        face.rect(0, 0, size, size, { borderColor: hexRgb("#dddddd"), borderWidth: 0.3 });
        const q = size * 0.66;
        face.qr(input.url, (size - q) / 2, size * 0.25, q, input.style, input.style.logo ? logo : null);
        face.text(input.style.headline, { font: fonts.bold, size: 7.5, lx: size / 2, ly: size * 0.14, maxWidth: size - 6 * MM, color: hexRgb(input.accent), align: "center" });
        face.text(input.restaurantName, { font: fonts.regular, size: 6, lx: size / 2, ly: size * 0.06, maxWidth: size - 6 * MM, color: hexRgb("#555555"), align: "center" });
      }
  } else {
    portraitFace(new Face(page, 0, 0, W, H), input, fonts, logo);
  }
  return Buffer.from(await pdf.save());
}
