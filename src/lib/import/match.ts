import { normalizeDishName, normalizeName, type NormalizedName } from "./normalize";

/**
 * Correspondance entre fichiers et plats.
 *
 * Règle de sécurité : un fichier n'est associé AUTOMATIQUEMENT à un plat que si
 * les noms sont identiques après normalisation (mêmes mots significatifs, ordre
 * indifférent) et que ce plat est le seul candidat. Toute autre ressemblance
 * produit une SUGGESTION qui doit être validée par un humain.
 */

export type MediaKind = "image" | "glb" | "usdz";

export type MediaFile = { assetId: string; name: string; path?: string | null; kind: MediaKind };

export type MediaGroup = {
  key: string;
  display: string;
  tokens: string[];
  folder: string | null;
  images: MediaFile[];
  glbs: MediaFile[];
  usdzs: MediaFile[];
  anonymous: boolean;
};

export type Candidate = { ref: string; name: string };

export type MatchResult =
  | { status: "exact"; candidate: Candidate; score: 1 }
  | { status: "suggested"; candidate: Candidate; score: number; alternatives: { candidate: Candidate; score: number }[] }
  | { status: "none"; alternatives: { candidate: Candidate; score: number }[] };

/** Seuil à partir duquel une ressemblance est proposée à la validation. */
export const SUGGESTION_THRESHOLD = 0.55;

function bigrams(s: string): Map<string, number> {
  const out = new Map<string, number>();
  const t = ` ${s} `;
  for (let i = 0; i < t.length - 1; i++) {
    const g = t.slice(i, i + 2);
    out.set(g, (out.get(g) ?? 0) + 1);
  }
  return out;
}

/** Coefficient de Dice sur les bigrammes de caractères (tolère fautes et variantes). */
export function diceSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const A = bigrams(a);
  const B = bigrams(b);
  let inter = 0;
  let total = 0;
  for (const [g, n] of A) {
    inter += Math.min(n, B.get(g) ?? 0);
    total += n;
  }
  for (const n of B.values()) total += n;
  return (2 * inter) / total;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length]!;
}

function tokenEquals(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 5 || b.length < 5) return false;
  return levenshtein(a, b) <= (Math.max(a.length, b.length) >= 8 ? 2 : 1);
}

/** Similarité de deux noms normalisés, entre 0 et 1. */
export function nameSimilarity(a: NormalizedName, b: NormalizedName): number {
  if (!a.tokens.length || !b.tokens.length) return 0;
  if (a.key === b.key) return 1;
  // Recouvrement de mots (avec tolérance aux fautes de frappe).
  const used = new Set<number>();
  let common = 0;
  for (const ta of a.tokens) {
    const idx = b.tokens.findIndex((tb, i) => !used.has(i) && tokenEquals(ta, tb));
    if (idx >= 0) {
      used.add(idx);
      common++;
    }
  }
  const overlap = (2 * common) / (a.tokens.length + b.tokens.length);
  const dice = diceSimilarity(a.tokens.join(""), b.tokens.join(""));
  return Math.round((0.6 * overlap + 0.4 * dice) * 1000) / 1000;
}

/** Mêmes mots significatifs (ordre indifférent) : correspondance certaine. */
export function sameTokens(a: NormalizedName, b: NormalizedName): boolean {
  if (!a.tokens.length || a.tokens.length !== b.tokens.length) return false;
  return [...a.tokens].sort().join(" ") === [...b.tokens].sort().join(" ");
}

function folderOf(path?: string | null): string | null {
  if (!path) return null;
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 2]! : null;
}

/**
 * Regroupe les fichiers qui désignent le même plat (« burger-maison.glb »,
 * « burger-maison.usdz », « Burger_Maison.jpg »). Seule l'égalité stricte des
 * noms normalisés regroupe des fichiers ; un fichier anonyme (IMG_1234.jpg)
 * reste seul.
 */
export function groupMediaFiles(files: MediaFile[]): MediaGroup[] {
  const groups = new Map<string, MediaGroup>();
  for (const f of files) {
    const n = normalizeName(f.name);
    const groupKey = n.anonymous || !n.key ? `__anon__${f.assetId}` : [...n.tokens].sort().join(" ");
    let g = groups.get(groupKey);
    if (!g) {
      g = { key: n.key, display: n.display, tokens: n.tokens, folder: folderOf(f.path), images: [], glbs: [], usdzs: [], anonymous: n.anonymous || !n.key };
      groups.set(groupKey, g);
    }
    if (f.kind === "image") g.images.push(f);
    else if (f.kind === "glb") g.glbs.push(f);
    else g.usdzs.push(f);
    g.folder ??= folderOf(f.path);
  }
  return [...groups.values()];
}

/** Cherche le plat correspondant à un nom de fichier (ou à un nom de plat extrait). */
export function matchName(name: NormalizedName, candidates: Candidate[]): MatchResult {
  if (!name.tokens.length) return { status: "none", alternatives: [] };
  const scored = candidates
    .map((candidate) => {
      const n = normalizeDishName(candidate.name);
      return { candidate, exact: sameTokens(name, n), score: sameTokens(name, n) ? 1 : nameSimilarity(name, n) };
    })
    .sort((a, b) => b.score - a.score);
  const exact = scored.filter((s) => s.exact);
  if (exact.length === 1) return { status: "exact", candidate: exact[0]!.candidate, score: 1 };
  const alternatives = scored.filter((s) => s.score >= SUGGESTION_THRESHOLD).slice(0, 4).map(({ candidate, score }) => ({ candidate, score }));
  // Plusieurs plats portent exactement le même nom : ambigu, donc validation humaine.
  if (exact.length > 1) return { status: "suggested", candidate: exact[0]!.candidate, score: 0.99, alternatives };
  if (alternatives.length) return { status: "suggested", candidate: alternatives[0]!.candidate, score: alternatives[0]!.score, alternatives };
  return { status: "none", alternatives: scored.slice(0, 3).filter((s) => s.score > 0.3).map(({ candidate, score }) => ({ candidate, score })) };
}
