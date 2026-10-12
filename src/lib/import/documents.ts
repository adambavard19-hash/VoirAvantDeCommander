import "server-only";
import Papa from "papaparse";
import readExcelFile from "read-excel-file/node";
import { extensionOf } from "@/lib/storage/mime";
import { parseMenuText } from "./parse-text";
import { parseMenuTable } from "./parse-table";
import { layoutPage } from "./pdf-layout";
import type { ExtractionResult } from "./types";

/** Texte d'un PDF, page par page, avec reconstruction de la mise en page. */
export async function pdfToText(buffer: Buffer): Promise<{ text: string; pages: number; characters: number }> {
  const { extractTextItems, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { items, totalPages } = await extractTextItems(pdf);
  const pages = items.map((pageItems) =>
    layoutPage(pageItems.map((i) => ({ str: i.str, x: i.x, y: i.y, width: i.width, fontSize: i.fontSize }))).join("\n"),
  );
  const text = pages.join("\n\f\n");
  return { text, pages: totalPages, characters: text.replace(/\s/g, "").length };
}

function decodeText(buffer: Buffer): string {
  const utf8 = buffer.toString("utf8");
  // Fichiers Excel « CSV » enregistrés en Windows-1252 : caractères de remplacement en UTF-8.
  if (utf8.includes("�")) return new TextDecoder("windows-1252").decode(buffer);
  return utf8.replace(/^﻿/, "");
}

/**
 * Extrait catégories, plats, prix et allergènes explicites d'un document de menu.
 * Formats : PDF (texte), CSV, Excel (.xlsx), texte brut.
 */
export async function extractMenuDocument(buffer: Buffer, name: string): Promise<ExtractionResult> {
  const ext = extensionOf(name);
  if (ext === "csv") {
    const parsed = Papa.parse<string[]>(decodeText(buffer), { skipEmptyLines: "greedy", delimiter: "" });
    return parseMenuTable(parsed.data, name);
  }
  if (ext === "xlsx") {
    const sheets = await readExcelFile(buffer);
    const results = sheets.map((s) => {
      const r = parseMenuTable(s.data as unknown[][], `${name} (${s.sheet})`);
      // Plusieurs feuilles sans colonne catégorie : le nom de la feuille sert de catégorie.
      if (sheets.length > 1) for (const c of r.categories) if (c.name === "Menu") c.name = s.sheet;
      return r;
    });
    return {
      categories: results.flatMap((r) => r.categories),
      warnings: results.flatMap((r) => r.warnings).filter((w, i, all) => all.indexOf(w) === i),
      method: "table",
    };
  }
  if (ext === "pdf") {
    const { text, characters } = await pdfToText(buffer);
    if (characters < 20) {
      return {
        categories: [],
        warnings: ["Ce PDF ne contient pas de texte exploitable (document scanné ou image). Utilisez l'extraction par IA si elle est configurée, ou un fichier Excel/CSV."],
        method: "text",
      };
    }
    return parseMenuText(text, name);
  }
  if (ext === "txt") return parseMenuText(decodeText(buffer), name);
  return { categories: [], warnings: [`Format non pris en charge : .${ext}`], method: "text" };
}
