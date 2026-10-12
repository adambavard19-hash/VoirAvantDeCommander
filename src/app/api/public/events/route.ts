import { z } from "zod";
import { db } from "@/lib/db";
import { recordEvent } from "@/lib/stats";

const schema = z.object({
  slug: z.string().min(1).max(80),
  event: z.enum(["MENU_VIEW", "DISH_VIEW", "MODEL_VIEW", "AR_LAUNCH"]),
  dishId: z.string().max(40).optional(),
});

const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse/i;

/**
 * Collecte anonyme d'événements du menu. Aucune IP, aucun cookie, aucun
 * identifiant n'est enregistré : uniquement des compteurs journaliers.
 */
export async function POST(request: Request) {
  const ok = new Response(null, { status: 204 });
  if (BOT.test(request.headers.get("user-agent") ?? "")) return ok;
  if (request.headers.get("sec-gpc") === "1" || request.headers.get("dnt") === "1") return ok;
  let body: unknown;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return ok;
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return ok;
  const { slug, event, dishId } = parsed.data;
  const restaurant = await db.restaurant.findUnique({ where: { slug }, select: { id: true, status: true } });
  if (!restaurant || restaurant.status !== "PUBLISHED") return ok;
  if (dishId) {
    const dish = await db.dish.findFirst({ where: { id: dishId, restaurantId: restaurant.id }, select: { id: true } });
    if (!dish) return ok;
  }
  if (event !== "MENU_VIEW" && !dishId) return ok;
  await recordEvent(restaurant.id, event, event === "MENU_VIEW" ? "" : dishId);
  return ok;
}
