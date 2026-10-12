/** Pictogrammes affichables sur une fiche plat. */
export const DISH_TAGS = {
  signature: {
    fr: "Signature",
    en: "Signature",
    es: "Especialidad",
    it: "Specialità",
    de: "Spezialität",
    pt: "Especialidade",
    ar: "طبق مميز",
    zh: "招牌",
    ja: "看板メニュー",
  },
  new: { fr: "Nouveau", en: "New", es: "Nuevo", it: "Novità", de: "Neu", pt: "Novo", ar: "جديد", zh: "新品", ja: "新作" },
  homemade: {
    fr: "Fait maison",
    en: "Homemade",
    es: "Casero",
    it: "Fatto in casa",
    de: "Hausgemacht",
    pt: "Caseiro",
    ar: "محضّر في المطعم",
    zh: "自制",
    ja: "自家製",
  },
  vegetarian: {
    fr: "Végétarien",
    en: "Vegetarian",
    es: "Vegetariano",
    it: "Vegetariano",
    de: "Vegetarisch",
    pt: "Vegetariano",
    ar: "نباتي",
    zh: "素食",
    ja: "ベジタリアン",
  },
  vegan: { fr: "Vegan", en: "Vegan", es: "Vegano", it: "Vegano", de: "Vegan", pt: "Vegano", ar: "نباتي صرف", zh: "纯素", ja: "ヴィーガン" },
  gluten_free: {
    fr: "Sans gluten",
    en: "Gluten-free",
    es: "Sin gluten",
    it: "Senza glutine",
    de: "Glutenfrei",
    pt: "Sem glúten",
    ar: "خالٍ من الغلوتين",
    zh: "无麸质",
    ja: "グルテンフリー",
  },
  spicy: { fr: "Épicé", en: "Spicy", es: "Picante", it: "Piccante", de: "Scharf", pt: "Picante", ar: "حار", zh: "辣", ja: "辛口" },
  halal: { fr: "Halal", en: "Halal", es: "Halal", it: "Halal", de: "Halal", pt: "Halal", ar: "حلال", zh: "清真", ja: "ハラール" },
  local: {
    fr: "Produits locaux",
    en: "Local produce",
    es: "Producto local",
    it: "Prodotti locali",
    de: "Regional",
    pt: "Produto local",
    ar: "منتجات محلية",
    zh: "本地食材",
    ja: "地元食材",
  },
} as const;

export type DishTag = keyof typeof DISH_TAGS;
export const DISH_TAG_CODES = Object.keys(DISH_TAGS) as DishTag[];

export function isDishTag(v: string): v is DishTag {
  return v in DISH_TAGS;
}

export function tagLabel(code: string, locale: string): string {
  const entry = DISH_TAGS[code as DishTag];
  if (!entry) return code;
  return (entry as Record<string, string>)[locale] ?? entry.fr;
}
