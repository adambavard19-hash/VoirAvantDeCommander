import { stripAccents } from "./slug";

/**
 * Les 14 allergènes à déclaration obligatoire (règlement UE n° 1169/2011, annexe II).
 * Les libellés sont fournis dans toutes les langues du menu client.
 */
export const ALLERGENS = {
  gluten: {
    fr: "Gluten",
    en: "Gluten",
    es: "Gluten",
    it: "Glutine",
    de: "Gluten",
    pt: "Glúten",
    ar: "الغلوتين",
    zh: "麸质",
    ja: "グルテン",
  },
  crustaceans: {
    fr: "Crustacés",
    en: "Crustaceans",
    es: "Crustáceos",
    it: "Crostacei",
    de: "Krebstiere",
    pt: "Crustáceos",
    ar: "القشريات",
    zh: "甲壳类",
    ja: "甲殻類",
  },
  eggs: {
    fr: "Œufs",
    en: "Eggs",
    es: "Huevos",
    it: "Uova",
    de: "Eier",
    pt: "Ovos",
    ar: "البيض",
    zh: "蛋类",
    ja: "卵",
  },
  fish: {
    fr: "Poisson",
    en: "Fish",
    es: "Pescado",
    it: "Pesce",
    de: "Fisch",
    pt: "Peixe",
    ar: "السمك",
    zh: "鱼类",
    ja: "魚",
  },
  peanuts: {
    fr: "Arachides",
    en: "Peanuts",
    es: "Cacahuetes",
    it: "Arachidi",
    de: "Erdnüsse",
    pt: "Amendoins",
    ar: "الفول السوداني",
    zh: "花生",
    ja: "落花生",
  },
  soy: {
    fr: "Soja",
    en: "Soy",
    es: "Soja",
    it: "Soia",
    de: "Soja",
    pt: "Soja",
    ar: "الصويا",
    zh: "大豆",
    ja: "大豆",
  },
  milk: {
    fr: "Lait",
    en: "Milk",
    es: "Leche",
    it: "Latte",
    de: "Milch",
    pt: "Leite",
    ar: "الحليب",
    zh: "乳制品",
    ja: "乳",
  },
  nuts: {
    fr: "Fruits à coque",
    en: "Tree nuts",
    es: "Frutos de cáscara",
    it: "Frutta a guscio",
    de: "Schalenfrüchte",
    pt: "Frutos de casca rija",
    ar: "المكسرات",
    zh: "坚果",
    ja: "ナッツ類",
  },
  celery: {
    fr: "Céleri",
    en: "Celery",
    es: "Apio",
    it: "Sedano",
    de: "Sellerie",
    pt: "Aipo",
    ar: "الكرفس",
    zh: "芹菜",
    ja: "セロリ",
  },
  mustard: {
    fr: "Moutarde",
    en: "Mustard",
    es: "Mostaza",
    it: "Senape",
    de: "Senf",
    pt: "Mostarda",
    ar: "الخردل",
    zh: "芥末",
    ja: "マスタード",
  },
  sesame: {
    fr: "Sésame",
    en: "Sesame",
    es: "Sésamo",
    it: "Sesamo",
    de: "Sesam",
    pt: "Sésamo",
    ar: "السمسم",
    zh: "芝麻",
    ja: "ごま",
  },
  sulphites: {
    fr: "Sulfites",
    en: "Sulphites",
    es: "Sulfitos",
    it: "Solfiti",
    de: "Sulfite",
    pt: "Sulfitos",
    ar: "الكبريتيت",
    zh: "亚硫酸盐",
    ja: "亜硫酸塩",
  },
  lupin: {
    fr: "Lupin",
    en: "Lupin",
    es: "Altramuces",
    it: "Lupini",
    de: "Lupinen",
    pt: "Tremoço",
    ar: "الترمس",
    zh: "羽扇豆",
    ja: "ルピナス",
  },
  molluscs: {
    fr: "Mollusques",
    en: "Molluscs",
    es: "Moluscos",
    it: "Molluschi",
    de: "Weichtiere",
    pt: "Moluscos",
    ar: "الرخويات",
    zh: "软体动物",
    ja: "軟体動物",
  },
} as const;

export type AllergenCode = keyof typeof ALLERGENS;
export const ALLERGEN_CODES = Object.keys(ALLERGENS) as AllergenCode[];

export function isAllergenCode(v: string): v is AllergenCode {
  return v in ALLERGENS;
}

export function allergenLabel(code: string, locale: string): string {
  const entry = ALLERGENS[code as AllergenCode];
  if (!entry) return code;
  return (entry as Record<string, string>)[locale] ?? entry.fr;
}

/**
 * Mots-clés reconnus lors de l'import. On ne détecte un allergène que s'il est
 * EXPLICITEMENT mentionné dans une zone « allergènes » (colonne dédiée ou
 * mention « Allergènes : … »). On ne déduit jamais un allergène d'une description.
 */
const KEYWORDS: Record<AllergenCode, string[]> = {
  gluten: ["gluten", "ble", "froment", "wheat", "seigle", "orge", "avoine", "epeautre", "glutine"],
  crustaceans: ["crustace", "crustaces", "crustaceans", "crustacean", "crevette", "homard", "crabe", "langoustine"],
  eggs: ["oeuf", "oeufs", "egg", "eggs", "uova", "huevo", "huevos"],
  fish: ["poisson", "poissons", "fish", "pesce", "pescado"],
  peanuts: ["arachide", "arachides", "cacahuete", "cacahuetes", "peanut", "peanuts"],
  soy: ["soja", "soy", "soya", "soia"],
  milk: ["lait", "lactose", "milk", "dairy", "latte", "leche", "produits laitiers"],
  nuts: ["fruits a coque", "fruit a coque", "noix", "noisette", "noisettes", "amande", "amandes", "pistache", "nuts", "tree nuts", "cajou", "pecan"],
  celery: ["celeri", "celery", "sedano"],
  mustard: ["moutarde", "mustard", "senape"],
  sesame: ["sesame", "sesamo"],
  sulphites: ["sulfite", "sulfites", "sulphite", "sulphites", "anhydride sulfureux", "so2", "solfiti"],
  lupin: ["lupin", "lupins", "lupini"],
  molluscs: ["mollusque", "mollusques", "molluscs", "mollusc", "moule", "moules", "huitre", "huitres", "calamar", "poulpe", "seiche"],
};

/** Codes allergènes explicitement cités dans un texte d'allergènes (ex. « Gluten, lait, œufs »). */
export function detectAllergens(text: string): AllergenCode[] {
  const norm = ` ${stripAccents(text.toLowerCase()).replace(/œ/g, "oe").replace(/[^a-z0-9]+/g, " ")} `;
  const found = new Set<AllergenCode>();
  for (const code of ALLERGEN_CODES) {
    if (KEYWORDS[code].some((k) => norm.includes(` ${k} `))) found.add(code);
  }
  return ALLERGEN_CODES.filter((c) => found.has(c));
}
