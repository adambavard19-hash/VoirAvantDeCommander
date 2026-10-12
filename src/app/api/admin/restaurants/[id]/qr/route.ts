import { db } from "@/lib/db";
import { badRequest, readJson, route } from "@/lib/http";
import { requireRestaurantAccess } from "@/lib/auth/guards";
import { ensureQrCode } from "@/lib/menu/publish";
import { qrColorProblem, qrStyleSchema } from "@/lib/qr/qr";
import { isTemplate, renderQr, type QrFormat } from "@/lib/qr/service";
import type { Prisma } from "@/generated/prisma/client";

/** Téléchargement : ?format=png|svg|pdf&template=table-card|table-tent|poster|stickers&inline=1 */
export const GET = route<{ id: string }>(async (request, { id }) => {
  await requireRestaurantAccess(id, "VIEW");
  const url = new URL(request.url);
  const format = (url.searchParams.get("format") ?? "png") as QrFormat;
  if (!["png", "svg", "pdf"].includes(format)) throw badRequest("Format inconnu.");
  const template = url.searchParams.get("template");
  const inline = url.searchParams.get("inline") === "1";
  const file = await renderQr(id, format, isTemplate(template) ? template : "table-card", { countDownload: !inline });
  return new Response(new Uint8Array(file.body), {
    headers: {
      "Content-Type": file.type,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${file.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
});

/** Personnalisation du QR code (couleurs, logo, textes du support imprimable). */
export const PATCH = route<{ id: string }>(async (request, { id }) => {
  await requireRestaurantAccess(id, "EDIT");
  const style = qrStyleSchema.parse(await readJson(request));
  const problem = qrColorProblem(style.fg, style.bg);
  if (problem) throw badRequest(problem);
  const restaurant = await db.restaurant.findUniqueOrThrow({ where: { id }, select: { slug: true } });
  const qr = await ensureQrCode(id, restaurant.slug);
  await db.qrCode.update({ where: { id: qr.id }, data: { style: style as Prisma.InputJsonValue } });
  return { ok: true };
});
