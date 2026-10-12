/** Supprime les accents et normalise les caractères Unicode. */
export function stripAccents(input: string): string {
  return input.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** « Le Petit Bistrot d'Émile » → « le-petit-bistrot-d-emile » */
export function slugify(input: string, maxLength = 60): string {
  const slug = stripAccents(input)
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/ß/g, "ss")
    .replace(/&/g, " et ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return slug;
}

const RESERVED_SLUGS = new Set(["admin", "api", "files", "new", "nouveau", "demo-request", "preview"]);

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/.test(slug) && !slug.includes("--") && !RESERVED_SLUGS.has(slug);
}

/** Nom de fichier sûr pour une clé de stockage, en conservant l'extension. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "fichier";
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const cleanStem = slugify(stem, 80) || "fichier";
  return ext ? `${cleanStem}.${ext}` : cleanStem;
}
