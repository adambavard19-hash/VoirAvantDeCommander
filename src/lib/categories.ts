import { stripAccents } from "./slug";

/** Icônes de catégorie disponibles (noms d'icônes Lucide, rendues par CategoryIcon). */
export const CATEGORY_ICONS = [
  "salad",
  "soup",
  "utensils",
  "beef",
  "drumstick",
  "fish",
  "shell",
  "sandwich",
  "pizza",
  "carrot",
  "cake",
  "ice-cream",
  "cookie",
  "wine",
  "beer",
  "martini",
  "coffee",
  "cup",
  "croissant",
  "egg",
  "leaf",
  "menu",
  "sparkles",
  "baby",
] as const;

export type CategoryIcon = (typeof CATEGORY_ICONS)[number];

type Preset = { key: string; name: string; icon: CategoryIcon; synonyms: string[] };

/**
 * Catégories proposées par défaut, avec leurs synonymes (FR/EN/IT/ES) utilisés
 * pour reconnaître une catégorie à l'import (titres de menu, noms de dossiers).
 */
export const CATEGORY_PRESETS: Preset[] = [
  { key: "entrees", name: "Entrées", icon: "salad", synonyms: ["entree", "entrees", "starter", "starters", "appetizer", "appetizers", "antipasti", "antipasto", "entrantes", "a partager", "tapas", "pour commencer", "hors d oeuvre", "hors d oeuvres"] },
  { key: "plats", name: "Plats", icon: "utensils", synonyms: ["plat", "plats", "plats principaux", "main", "mains", "main course", "main courses", "secondi", "principales", "nos plats", "plats du jour", "plat du jour"] },
  { key: "viandes", name: "Viandes", icon: "beef", synonyms: ["viande", "viandes", "meat", "meats", "carne", "carnes", "grillades", "grill"] },
  { key: "poissons", name: "Poissons", icon: "fish", synonyms: ["poisson", "poissons", "fish", "pesce", "pescado", "pescados", "fruits de mer", "seafood", "la mer"] },
  { key: "burgers", name: "Burgers", icon: "sandwich", synonyms: ["burger", "burgers", "sandwich", "sandwichs", "sandwiches"] },
  { key: "pizzas", name: "Pizzas", icon: "pizza", synonyms: ["pizza", "pizzas", "pizze"] },
  { key: "pates", name: "Pâtes", icon: "utensils", synonyms: ["pates", "pasta", "pastas", "primi"] },
  { key: "accompagnements", name: "Accompagnements", icon: "carrot", synonyms: ["accompagnement", "accompagnements", "garniture", "garnitures", "side", "sides", "side dishes", "contorni", "guarniciones", "supplements"] },
  { key: "desserts", name: "Desserts", icon: "cake", synonyms: ["dessert", "desserts", "dolci", "postres", "sucre", "douceurs", "patisseries", "pour finir"] },
  { key: "boissons", name: "Boissons", icon: "cup", synonyms: ["boisson", "boissons", "drink", "drinks", "beverages", "bevande", "bebidas", "softs", "boissons fraiches"] },
  { key: "vins", name: "Vins", icon: "wine", synonyms: ["vin", "vins", "wine", "wines", "vini", "vinos", "carte des vins"] },
  { key: "bieres", name: "Bières", icon: "beer", synonyms: ["biere", "bieres", "beer", "beers", "birre", "cervezas"] },
  { key: "cocktails", name: "Cocktails", icon: "martini", synonyms: ["cocktail", "cocktails", "aperitif", "aperitifs", "mocktails"] },
  { key: "cafes", name: "Boissons chaudes", icon: "coffee", synonyms: ["cafe", "cafes", "coffee", "the", "thes", "tea", "boissons chaudes", "hot drinks"] },
  { key: "formules", name: "Menus et formules", icon: "menu", synonyms: ["menu", "menus", "formule", "formules", "menus et formules", "set menu", "lunch", "menu du midi"] },
  { key: "enfants", name: "Menu enfant", icon: "baby", synonyms: ["enfant", "enfants", "menu enfant", "kids", "kids menu", "bambini"] },
];

/** Catégories créées par défaut pour un nouveau restaurant. */
export const DEFAULT_CATEGORY_KEYS = ["entrees", "plats", "desserts", "boissons"];

function normalizeLabel(label: string): string {
  return stripAccents(label.toLowerCase())
    .replace(/œ/g, "oe")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Reconnaît une catégorie connue à partir d'un titre ou d'un nom de dossier. */
export function matchCategoryPreset(label: string): Preset | null {
  const norm = normalizeLabel(label).replace(/^(nos|les|la|le|des|our|the)\s+/, "");
  if (!norm) return null;
  for (const preset of CATEGORY_PRESETS) {
    if (preset.synonyms.includes(norm) || normalizeLabel(preset.name) === norm) return preset;
  }
  return null;
}

export function iconForCategoryName(name: string): CategoryIcon {
  return matchCategoryPreset(name)?.icon ?? "utensils";
}
