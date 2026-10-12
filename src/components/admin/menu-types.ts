import type { AssetDto } from "@/lib/assets/service";
import type { PriceVariant } from "@/lib/menu/variants";

export type EditorDish = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceCents: number | null;
  priceVariants: PriceVariant[];
  photo: AssetDto | null;
  glb: AssetDto | null;
  usdz: AssetDto | null;
  allergens: string[];
  tags: string[];
  isAvailable: boolean;
  isVisible: boolean;
  isFeatured: boolean;
  realWidthCm: number | null;
  realDepthCm: number | null;
  realHeightCm: number | null;
  scaleStatus: "UNVERIFIED" | "VALIDATED";
  recommendationIds: string[];
};

export type EditorCategory = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  isVisible: boolean;
  dishIds: string[];
};
