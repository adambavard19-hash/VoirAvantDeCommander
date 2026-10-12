import { detectAllergens } from "@/lib/allergens";
import { parsePrice } from "@/lib/money";
import { stripAccents } from "@/lib/slug";
import { DISH_TAG_CODES } from "@/lib/tags";
import type { ExtractedCategory, ExtractedDish, ExtractionResult } from "./types";

/**
 * Lecture d'un menu tabulaire (CSV / Excel). Les colonnes sont reconnues par
 * leur titre (français, anglais, italien, espagnol). Colonnes reconnues :
 * catégorie, nom, description, prix, allergènes, pictogrammes, photo, glb, usdz.
 */

type Column = "category" | "name" | "description" | "price" | "allergens" | "tags" | "photo" | "glb" | "usdz" | "available";

const HEADER_SYNONYMS: Record<Column, string[]> = {
  category: ["categorie", "category", "categoria", "rubrique", "section", "type", "famille"],
  name: ["nom", "name", "plat", "dish", "produit", "product", "intitule", "libelle", "article", "nome", "nombre", "titre", "title"],
  description: ["description", "desc", "ingredients", "composition", "detail", "details", "descrizione", "descripcion"],
  price: ["prix", "price", "tarif", "prezzo", "precio", "montant", "prix ttc", "prix eur", "prix euros", "pvc"],
  allergens: ["allergenes", "allergene", "allergens", "allergen", "allergeni", "alergenos"],
  tags: ["pictogrammes", "tags", "regime", "regimes", "labels", "badges", "options"],
  photo: ["photo", "image", "visuel", "picture", "fichier photo", "photo fichier"],
  glb: ["glb", "fichier glb", "modele glb", "3d android", "modele 3d"],
  usdz: ["usdz", "fichier usdz", "modele usdz", "3d ios", "3d iphone"],
  available: ["disponible", "available", "dispo", "stock"],
};

function normHeader(h: string): string {
  return stripAccents(String(h ?? "").toLowerCase())
    .replace(/[(€)]/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectColumns(row: string[]): Partial<Record<Column, number>> {
  const map: Partial<Record<Column, number>> = {};
  row.forEach((cell, index) => {
    const h = normHeader(cell);
    if (!h) return;
    for (const [col, synonyms] of Object.entries(HEADER_SYNONYMS) as [Column, string[]][]) {
      if (map[col] !== undefined) continue;
      if (synonyms.includes(h) || synonyms.some((s) => h.startsWith(`${s} `))) {
        map[col] = index;
        return;
      }
    }
  });
  return map;
}

const TAG_WORDS: Record<string, string[]> = {
  vegetarian: ["vegetarien", "vegetarienne", "vegetarian", "veggie", "vege"],
  vegan: ["vegan", "vegane", "vegetalien"],
  gluten_free: ["sans gluten", "gluten free", "gluten-free"],
  spicy: ["epice", "epicee", "piquant", "spicy", "pimente"],
  homemade: ["fait maison", "maison", "homemade"],
  new: ["nouveau", "nouveaute", "new"],
  signature: ["signature", "specialite"],
  halal: ["halal"],
  local: ["local", "locaux", "produits locaux"],
};

function detectTags(text: string): string[] {
  const norm = ` ${stripAccents(text.toLowerCase()).replace(/[^a-z0-9]+/g, " ")} `;
  return DISH_TAG_CODES.filter((code) => (TAG_WORDS[code] ?? []).some((w) => norm.includes(` ${w} `)));
}

/** Analyse un tableau (première ligne d'en-têtes détectée automatiquement). */
export function parseMenuTable(rows: unknown[][], sourceName: string): ExtractionResult {
  const cells = rows.map((r) => r.map((c) => (c === null || c === undefined ? "" : String(c).trim())));
  const warnings: string[] = [];
  let headerIndex = -1;
  let columns: Partial<Record<Column, number>> = {};
  for (let i = 0; i < Math.min(cells.length, 15); i++) {
    const detected = detectColumns(cells[i]!);
    if (detected.name !== undefined && Object.keys(detected).length >= 2) {
      headerIndex = i;
      columns = detected;
      break;
    }
  }

  if (headerIndex < 0) {
    // Pas d'en-tête : on suppose « nom ; (description ;) prix » en repérant la colonne des prix.
    const width = Math.max(0, ...cells.map((r) => r.length));
    let priceCol = -1;
    let best = 0;
    for (let c = 0; c < width; c++) {
      const ratio = cells.filter((r) => r[c] && parsePrice(r[c]!) !== null).length / Math.max(1, cells.filter((r) => r[c]).length);
      if (ratio > best && ratio >= 0.6) {
        best = ratio;
        priceCol = c;
      }
    }
    if (priceCol < 0) return { categories: [], warnings: ["Colonnes non reconnues : ajoutez une ligne d'en-têtes (Catégorie, Nom, Description, Prix…)."], method: "table" };
    const textCols = Array.from({ length: width }, (_, c) => c).filter((c) => c !== priceCol);
    columns = { name: textCols[0], description: textCols[1], price: priceCol };
    warnings.push("Aucune ligne d'en-têtes : colonnes devinées (nom, description, prix). Vérifiez le résultat.");
  }

  const categories: ExtractedCategory[] = [];
  const byName = new Map<string, ExtractedCategory>();
  let currentCategory = "Menu";
  const get = (row: string[], col: Column) => (columns[col] !== undefined ? (row[columns[col]!] ?? "").trim() : "");

  for (let i = headerIndex + 1; i < cells.length; i++) {
    const row = cells[i]!;
    if (row.every((c) => !c)) continue;
    const name = get(row, "name");
    const priceText = get(row, "price");
    const categoryText = get(row, "category");
    if (categoryText) currentCategory = categoryText;
    if (!name) {
      // Ligne de titre de catégorie (seule cellule remplie).
      const filled = row.filter(Boolean);
      if (filled.length === 1 && columns.category === undefined) currentCategory = filled[0]!;
      continue;
    }
    const dish: ExtractedDish = {
      name: name.slice(0, 140),
      description: get(row, "description") || null,
      priceCents: null,
      variants: [],
      allergens: detectAllergens(get(row, "allergens")),
      tags: detectTags(get(row, "tags")),
      source: `${sourceName}, ligne ${i + 1}`,
      flags: [],
    };
    if (priceText) {
      // « 6 / 28 » ou « Verre 6 € / Bouteille 28 € »
      const pieces = priceText.split(/\s*[/|;]\s*/).filter(Boolean);
      if (pieces.length > 1) {
        dish.variants = pieces
          .map((p, k) => {
            const m = p.match(/^(.*?)(\d[\d\s.,]*\s*(?:€|eur)?)$/i);
            const cents = parsePrice(m ? m[2]! : p);
            return cents === null ? null : { label: (m?.[1] ?? "").trim() || `Option ${k + 1}`, priceCents: cents };
          })
          .filter((v): v is { label: string; priceCents: number } => v !== null);
        if (dish.variants.length) dish.flags.push("Déclinaisons de prix détectées : à vérifier");
      } else {
        dish.priceCents = parsePrice(priceText);
        if (dish.priceCents === null) dish.flags.push(`Prix illisible : « ${priceText} »`);
      }
    } else {
      dish.flags.push("Prix non trouvé");
    }
    const available = get(row, "available").toLowerCase();
    if (available && /^(non|no|0|false|epuise|épuisé|indisponible)$/.test(available)) dish.flags.push("Indiqué indisponible");
    const files = { photo: get(row, "photo") || undefined, glb: get(row, "glb") || undefined, usdz: get(row, "usdz") || undefined };
    if (files.photo || files.glb || files.usdz) dish.files = files;

    let cat = byName.get(currentCategory.toLowerCase());
    if (!cat) {
      cat = { name: currentCategory, dishes: [] };
      byName.set(currentCategory.toLowerCase(), cat);
      categories.push(cat);
    }
    cat.dishes.push(dish);
  }
  if (!categories.length) warnings.push("Aucun plat trouvé dans le tableau.");
  return { categories, warnings, method: "table" };
}
