/**
 * Prix : stockés en centimes (entiers). Ils sont toujours formatés selon la
 * langue principale du restaurant, jamais selon la langue de traduction :
 * la traduction ne modifie jamais un prix (ni le montant, ni ses chiffres).
 */
export function formatPrice(cents: number, currency = "EUR", restaurantLocale = "fr"): string {
  const hasDecimals = cents % 100 !== 0;
  return new Intl.NumberFormat(`${restaurantLocale}-u-nu-latn`, {
    style: "currency",
    currency,
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Extrait un prix en centimes d'un texte : « 12,50 € », « 12.5 », « 12€50 »,
 * « € 9 », « 14 EUR », « 1 200,00 ». Retourne null si aucun prix fiable.
 */
export function parsePrice(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isFinite(input) && input >= 0 ? Math.round(input * 100) : null;
  let s = input.trim().replace(/ | /g, " ");
  if (!s) return null;
  // 12€50 → 12.50
  const euroMiddle = s.match(/^(\d{1,4})\s?€\s?(\d{2})$/);
  if (euroMiddle) return Number(euroMiddle[1]) * 100 + Number(euroMiddle[2]);
  s = s.replace(/€|eur(os?)?|\$|usd|chf|£|gbp/gi, "").replace(/,-$/, "").trim();
  if (!/^\d{1,3}(?:[ .]\d{3})*(?:[.,]\d{1,2})?$|^\d+(?:[.,]\d{1,2})?$/.test(s)) return null;
  // Séparateur décimal = dernier « , » ou « . » suivi de 1 ou 2 chiffres.
  const m = s.match(/^(.*?)(?:[.,](\d{1,2}))?$/);
  if (!m) return null;
  const intPart = m[1]!.replace(/[ .]/g, "");
  if (!/^\d+$/.test(intPart)) return null;
  const dec = m[2] ? m[2].padEnd(2, "0") : "00";
  const cents = Number(intPart) * 100 + Number(dec);
  return Number.isFinite(cents) && cents < 10_000_000 ? cents : null;
}

export function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2).replace(".", ",").replace(/,00$/, "");
}
