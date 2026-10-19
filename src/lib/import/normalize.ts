import { stripAccents } from "@/lib/slug";

/**
 * Mots sans valeur pour identifier un plat dans un nom de fichier
 * (« burger-maison-photo-final-v2.jpg » → « burger maison »).
 */
const NOISE = new Set([
  "photo", "photos", "img", "image", "images", "pic", "picture", "visuel", "hd", "sd", "4k", "web", "final", "finale", "def",
  "definitif", "definitive", "copy", "copie", "new", "nouveau", "edit", "edited", "retouche", "retouchee", "export", "low",
  "high", "lowpoly", "highpoly", "lod0", "lod1", "optimise", "optimisee", "optimized", "compressed", "draco", "model", "modele",
  "mesh", "scan", "ar", "3d", "glb", "gltf", "usdz", "usd", "jpg", "jpeg", "png", "webp", "fichier", "file", "plat", "dish",
]);

/** Mots de liaison ignorés pour comparer deux noms (mais conservés à l'affichage). */
const STOPWORDS = new Set(["de", "du", "des", "la", "le", "les", "l", "d", "a", "au", "aux", "et", "en", "the", "of", "and", "with", "avec", "sa", "son", "ses", "un", "une"]);

export type NormalizedName = {
  /** Clé de comparaison stricte : mots significatifs, sans accents, au singulier. */
  key: string;
  /** Mots significatifs (pour la similarité). */
  tokens: string[];
  /** Nom lisible proposé pour un plat créé à partir du fichier. */
  display: string;
  /** Nom de fichier générique d'appareil photo (IMG_1234) : aucune information sur le plat. */
  anonymous: boolean;
};

function baseName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  return base.replace(/\.(glb|gltf|usdz|usdc|usda|jpe?g|png|webp|avif|heic)$/i, "");
}

/** Singulier approximatif (fr/en) pour rapprocher « tomates » et « tomate ». */
function singular(token: string): string {
  if (token.length > 4 && /(eaux|aux)$/.test(token)) return token;
  if (token.length > 3 && /[sx]$/.test(token) && !/(ss|us|is)$/.test(token)) return token.slice(0, -1);
  return token;
}

function normalizeText(raw: string): NormalizedName {
  // Découpe CamelCase (« BurgerMaison ») et séparateurs.
  const spaced = raw
    .replace(/([a-zà-ÿ])([A-ZÀ-Þ])/g, "$1 $2")
    .replace(/[_\-.+~/]+/g, " ")
    .replace(/\(\s*\d+\s*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/@\dx/gi, " ")
    .replace(/\b\d{2,5}\s*[x×]\s*\d{2,5}\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const anonymous = /^(img|dsc|dscf|dscn|pxl|photo|image|mvimg|p)\s?\d{3,}/i.test(spaced) || /^\d+$/.test(spaced.replace(/\s/g, ""));

  const displayWords: string[] = [];
  const tokens: string[] = [];
  for (const word of spaced.split(" ")) {
    const lower = stripAccents(word.toLowerCase()).replace(/œ/g, "oe").replace(/[^a-z0-9]/g, "");
    if (!lower) continue;
    // Les nombres sont conservés (« pizza 4 fromages » ≠ « pizza 3 fromages ») ;
    // seuls les numéros de version et dates d'export sont ignorés.
    if (NOISE.has(lower) || /^v\d{1,3}$/.test(lower) || /^(19|20)\d{6}$/.test(lower)) continue;
    displayWords.push(word);
    if (!STOPWORDS.has(lower)) tokens.push(singular(lower));
  }
  // Élision perdue dans les noms de fichiers : « tacos_d_agneau » → « tacos d'agneau ».
  const displayRaw = displayWords
    .join(" ")
    .replace(/\b([dlj]|qu) (?=[aeiouyhàâéèêëîïôûü])/gi, "$1'")
    .trim();
  // Majuscules conservées quand elles sont choisies (« Tacos d'agneau Los Amigos ») ;
  // un nom tout en majuscules ou avec chaque mot capitalisé est remis en casse de phrase.
  const words = displayRaw.split(" ").filter((w) => /\p{L}/u.test(w));
  const uniform = words.every((w) => /^\p{Lu}/u.test(w)) || displayRaw === displayRaw.toLocaleUpperCase("fr");
  const rest = uniform ? displayRaw.slice(1).toLocaleLowerCase("fr") : displayRaw.slice(1);
  const display = displayRaw ? displayRaw.charAt(0).toLocaleUpperCase("fr") + rest : raw;
  return { key: tokens.join(" "), tokens, display, anonymous };
}

/** Normalisation d'un nom de fichier (chemin et extension ignorés). */
export function normalizeName(fileName: string): NormalizedName {
  return normalizeText(baseName(fileName));
}

/** Normalisation d'un nom de plat, avec les mêmes règles que pour les fichiers. */
export function normalizeDishName(name: string): NormalizedName {
  return { ...normalizeText(name), anonymous: false };
}
