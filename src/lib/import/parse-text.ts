import { detectAllergens } from "@/lib/allergens";
import { matchCategoryPreset } from "@/lib/categories";
import { parsePrice } from "@/lib/money";
import type { ExtractedCategory, ExtractedDish, ExtractionResult } from "./types";

/**
 * Analyse heuristique du texte d'un menu (PDF texte, .txt, copier-coller).
 * Reconnaît catégories, plats, descriptions, prix, déclinaisons et mentions
 * explicites d'allergènes. Le résultat est TOUJOURS relu avant publication.
 */

const CURRENCY = String.raw`(?:€|eur(?:os?)?\b|chf\b|£|\$)`;
// Un prix : « 12 », « 12,50 », « 12.5 », « 12 € », « €12 », « 12€50 »
const PRICE_RE = new RegExp(String.raw`(?:${CURRENCY}\s?)?(\d{1,4}(?:[.,]\d{1,2})?)(?:\s?${CURRENCY}(\d{2})?)?`, "gi");
const UNIT_AFTER = /^\s?(cl|ml|l|g|gr|kg|%|h|cm|mm|pcs?|pi[eè]ces?|pers|personnes?|ans|min|°)\b/i;
const ALLERGEN_LINE = /^\(?\s*(allerg[eè]nes?|allergens?|contient|contains|al[eé]rgenos)\s*[:：\-–]\s*/i;
const INLINE_ALLERGENS = /\(\s*(?:allerg[eè]nes?|allergens?)\s*[:：]\s*([^)]+)\)/i;
const LEADER = /[.·…_]{3,}|\s{3,}|\t+/;

type PriceToken = { cents: number; start: number; end: number; explicit: boolean };

function findPrices(line: string, allowBare: boolean): PriceToken[] {
  const tokens: PriceToken[] = [];
  for (const m of line.matchAll(PRICE_RE)) {
    const full = m[0];
    const start = m.index!;
    const end = start + full.length;
    const explicit = new RegExp(CURRENCY, "i").test(full);
    const hasDecimals = /[.,]\d{1,2}/.test(m[1]!) || !!m[2];
    const after = line.slice(end);
    if (UNIT_AFTER.test(after)) continue; // « 50 cl », « 70 % », « 48 h »
    // Un nombre collé à des lettres (« 4fromages ») ou faisant partie d'un mot n'est pas un prix.
    if (/[a-zà-ÿ]/i.test(line[start - 1] ?? "") && !explicit) continue;
    const atEnd = /^\s*[/|·•,;)\-–—]?\s*$/.test(after) || /^\s*[/|·•]/.test(after);
    const cents = m[2] ? Number(m[1]) * 100 + Number(m[2]) : parsePrice(m[1]!);
    if (cents === null || cents === 0) continue;
    if (explicit || hasDecimals || (allowBare && atEnd)) tokens.push({ cents, start, end, explicit });
  }
  return tokens;
}

function cleanName(text: string): string {
  return text
    .replace(LEADER, " ")
    .replace(/[.·…_]+$/g, "")
    .replace(/^[\s\-–—•*·|:/,;]+|[\s\-–—•*·|:/,;]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function isHeader(line: string, hasPrice: boolean): boolean {
  if (hasPrice) return false;
  const text = line.replace(/^#+\s*/, "").trim();
  if (!text || text.length > 42) return false;
  if (/[.,;]$/.test(text)) return false;
  if (matchCategoryPreset(text)) return true;
  if (/^#+\s/.test(line)) return true;
  const letters = text.replace(/[^a-zA-ZÀ-ÿ]/g, "");
  return letters.length >= 3 && letters === letters.toUpperCase() && text.split(/\s+/).length <= 5;
}

function titleCase(text: string): string {
  const t = text.replace(/^#+\s*/, "").trim();
  if (t !== t.toUpperCase()) return t;
  const lower = t.toLocaleLowerCase("fr");
  return lower.charAt(0).toLocaleUpperCase("fr") + lower.slice(1);
}

function newDish(name: string, source: string): ExtractedDish {
  return { name, description: null, priceCents: null, variants: [], allergens: [], tags: [], source, flags: [] };
}

export function parseMenuText(text: string, sourceName: string): ExtractionResult {
  const rawLines = text.replace(/\r/g, "").split("\n");
  // Les prix sans symbole monétaire ne sont acceptés que si le document fonctionne ainsi.
  const withCurrency = rawLines.filter((l) => new RegExp(String.raw`\d\s?${CURRENCY}|${CURRENCY}\s?\d`, "i").test(l)).length;
  const bareEnding = rawLines.filter((l) => /[a-zà-ÿ].*\s\d{1,3}(?:[.,]\d{1,2})?\s*$/i.test(l.trim())).length;
  const allowBare = bareEnding > 0 && withCurrency < bareEnding * 0.4;

  const categories: ExtractedCategory[] = [];
  const warnings: string[] = [];
  let current: ExtractedCategory | null = null;
  let lastDish: ExtractedDish | null = null;
  let pendingName: string | null = null;
  let page = 1;

  const ensureCategory = () => {
    if (!current) {
      current = { name: "Menu", dishes: [] };
      categories.push(current);
    }
    return current;
  };
  const src = (lineNo: number) => `${sourceName}${page > 1 ? `, page ${page}` : ""}, ligne ${lineNo}`;

  const lines = rawLines.map((l) => l.replace(/\u00a0/g, " ").trim());
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^\f|^-{3,}\s*page/i.test(line)) {
      page++;
      continue;
    }
    if (!line) {
      pendingName = null;
      continue;
    }

    if (ALLERGEN_LINE.test(line)) {
      const found = detectAllergens(line.replace(ALLERGEN_LINE, ""));
      if (lastDish && found.length) lastDish.allergens = [...new Set([...lastDish.allergens, ...found])];
      continue;
    }

    const prices = findPrices(line, allowBare);
    const priceOnly = prices.length > 0 && cleanName(line.replace(PRICE_RE, "")).replace(/[^a-zà-ÿ]/gi, "").length === 0;

    if (priceOnly) {
      if (pendingName) {
        const dish = newDish(cleanName(pendingName), src(i + 1));
        if (prices.length === 1) dish.priceCents = prices[0]!.cents;
        else dish.variants = prices.map((p, k) => ({ label: `Option ${k + 1}`, priceCents: p.cents }));
        ensureCategory().dishes.push(dish);
        lastDish = dish;
        pendingName = null;
      } else if (lastDish && lastDish.priceCents === null && !lastDish.variants.length) {
        lastDish.priceCents = prices[0]!.cents;
      }
      continue;
    }

    if (isHeader(line, prices.length > 0)) {
      current = { name: titleCase(line), dishes: [] };
      categories.push(current);
      lastDish = null;
      pendingName = null;
      continue;
    }

    if (prices.length) {
      let head = line.slice(0, prices[0]!.start);
      let description: string | null = null;
      const inline = head.match(INLINE_ALLERGENS);
      const allergens = inline ? detectAllergens(inline[1]!) : [];
      if (inline) head = head.replace(INLINE_ALLERGENS, " ");
      // « Nom — description … 14 € » : la partie après le tiret est une description.
      const parts = head.split(/\s[–—-]\s|\s:\s/);
      let name = cleanName(parts[0] ?? head);
      if (parts.length > 1) {
        const rest = cleanName(parts.slice(1).join(" - "));
        // Plusieurs prix : la partie après le tiret est le libellé de la première déclinaison.
        if (prices.length > 1 || rest.split(/\s+/).length >= 3) description = rest;
        else name = cleanName(head);
      }
      if (!name && pendingName) name = cleanName(pendingName);
      if (!name) continue;
      const dish = newDish(name, src(i + 1));
      dish.description = description;
      dish.allergens = allergens;
      if (prices.length === 1) {
        dish.priceCents = prices[0]!.cents;
      } else {
        // Déclinaisons : « Vin rouge — verre 6 € / bouteille 28 € »
        dish.variants = prices.map((p, k) => {
          const labelText = k === 0 ? (parts.length > 1 ? cleanName(parts.slice(1).join(" ")) : "") : cleanName(line.slice(prices[k - 1]!.end, p.start));
          return { label: labelText && labelText.length <= 40 ? labelText : `Option ${k + 1}`, priceCents: p.cents };
        });
        if (parts.length > 1 && dish.variants[0]?.label !== "Option 1") dish.description = null;
        dish.flags.push("Déclinaisons de prix détectées : à vérifier");
      }
      ensureCategory().dishes.push(dish);
      lastDish = dish;
      pendingName = null;
      continue;
    }

    // Ligne de texte sans prix : nom d'un plat dont le prix suit, ou description.
    const next = lines.slice(i + 1).find((l) => l.length > 0);
    const nextPrices = next ? findPrices(next, allowBare) : [];
    const nextPriceOnly = !!next && nextPrices.length > 0 && cleanName(next.replace(PRICE_RE, "")).replace(/[^a-zà-ÿ]/gi, "").length === 0;
    if (nextPriceOnly) {
      pendingName = line;
      continue;
    }
    const inlineAllergens = line.match(INLINE_ALLERGENS);
    if (lastDish) {
      const cleaned = line.replace(INLINE_ALLERGENS, " ").replace(/\s{2,}/g, " ").trim();
      if (inlineAllergens) lastDish.allergens = [...new Set([...lastDish.allergens, ...detectAllergens(inlineAllergens[1]!)])];
      if (cleaned) lastDish.description = lastDish.description ? `${lastDish.description} ${cleaned}` : cleaned;
      continue;
    }
    if (line.length <= 70) {
      const dish = newDish(cleanName(line), src(i + 1));
      dish.flags.push("Prix non trouvé");
      ensureCategory().dishes.push(dish);
      lastDish = dish;
    }
  }

  const result = categories.filter((c) => c.dishes.length > 0);
  for (const c of result)
    for (const d of c.dishes) {
      if (d.priceCents === null && !d.variants.length && !d.flags.includes("Prix non trouvé")) d.flags.push("Prix non trouvé");
      if (d.description && d.description.length > 600) {
        d.description = d.description.slice(0, 600);
        d.flags.push("Description tronquée");
      }
    }
  if (!result.length) warnings.push("Aucun plat reconnu dans le texte.");
  if (result.length && result[0]!.name === "Menu") warnings.push("Certains plats apparaissent avant tout titre de catégorie : ils sont rangés dans « Menu ».");
  return { categories: result, warnings, method: "text" };
}
