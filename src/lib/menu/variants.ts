import { z } from "zod";

export const priceVariantSchema = z.object({
  label: z.string().trim().min(1).max(60),
  priceCents: z.number().int().min(0).max(10_000_000),
});

export type PriceVariant = z.infer<typeof priceVariantSchema>;

export function parsePriceVariants(value: unknown): PriceVariant[] {
  const parsed = z.array(priceVariantSchema).max(8).safeParse(value ?? []);
  return parsed.success ? parsed.data : [];
}
