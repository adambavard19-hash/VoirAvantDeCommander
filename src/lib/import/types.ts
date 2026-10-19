/** Plat extrait d'un document (menu PDF, Excel, CSV ou texte). Toujours vérifié par un humain avant publication. */
export type ExtractedDish = {
  name: string;
  description: string | null;
  priceCents: number | null;
  variants: { label: string; priceCents: number }[];
  /** Allergènes EXPLICITEMENT mentionnés dans le document (jamais déduits). */
  allergens: string[];
  tags: string[];
  /** Noms de fichiers indiqués dans le document (colonnes photo / glb / usdz d'un tableau). */
  files?: { photo?: string; glb?: string; usdz?: string };
  /** Origine lisible (ex. « menu.pdf, page 2 » ou « carte.xlsx, ligne 14 »). */
  source: string;
  /** Points d'attention pour la relecture. */
  flags: string[];
};

export type ExtractedCategory = { name: string; dishes: ExtractedDish[] };

export type ExtractionResult = {
  categories: ExtractedCategory[];
  warnings: string[];
  /** Méthode employée, affichée à l'utilisateur. */
  method: "table" | "text" | "ai";
};

export type ImportMediaLink = {
  assetId: string;
  name: string;
  /** exact : nom identique ; explicit : fichier cité dans le tableau ; suggested : ressemblance à valider ; manual : choisi à la main */
  confidence: "exact" | "explicit" | "suggested" | "manual";
  score: number;
  /** Seuls les liens confirmés sont appliqués. */
  confirmed: boolean;
  thumbUrl?: string | null;
};

export type ImportCategoryProposal = {
  ref: string;
  name: string;
  existingId: string | null;
  /** Nom de la catégorie parente, pour une sous-catégorie existante (« Plats › Burgers »). */
  parentName?: string | null;
};

export type ImportDishProposal = {
  ref: string;
  action: "create" | "update" | "skip";
  existingDishId: string | null;
  /** Correspondance avec un plat existant à confirmer (nom ressemblant). */
  existingMatch: { dishId: string; name: string; score: number; confirmed: boolean } | null;
  categoryRef: string;
  name: string;
  description: string | null;
  priceCents: number | null;
  variants: { label: string; priceCents: number }[];
  allergens: string[];
  tags: string[];
  /** Valeurs actuelles (plat existant), pour afficher les différences. */
  current?: { name: string; description: string | null; priceCents: number | null; hasPhoto: boolean; hasGlb: boolean; hasUsdz: boolean } | null;
  media: { photo: ImportMediaLink | null; glb: ImportMediaLink | null; usdz: ImportMediaLink | null };
  source: string;
  flags: string[];
};

export type ImportUnmatchedFile = {
  assetId: string;
  name: string;
  path: string | null;
  kind: "image" | "glb" | "usdz";
  thumbUrl?: string | null;
  suggestions: { dishRef: string; score: number }[];
};

export type ImportDocumentReport = {
  assetId: string;
  name: string;
  status: "parsed" | "empty" | "error";
  method?: ExtractionResult["method"];
  dishes: number;
  message: string | null;
};

export type ImportProposal = {
  version: 1;
  documents: ImportDocumentReport[];
  categories: ImportCategoryProposal[];
  dishes: ImportDishProposal[];
  unmatched: ImportUnmatchedFile[];
  failedFiles: { name: string; error: string }[];
  warnings: string[];
};

export type ImportReport = {
  categoriesCreated: number;
  dishesCreated: number;
  dishesUpdated: number;
  mediaAttached: number;
  skippedSuggestions: number;
  errors: string[];
};
