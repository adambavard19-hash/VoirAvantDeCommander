import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { env } from "@/lib/env";
import { isPrivateKey } from "@/lib/storage";
import { resolveLocalPath } from "@/lib/storage/local";
import { mimeFor } from "@/lib/storage/mime";
import { getCurrentUser } from "@/lib/auth/session";
import { checkRestaurantAccess } from "@/lib/auth/guards";

/**
 * Diffusion des fichiers en stockage local (développement ou serveur unique).
 * En production avec S3, les fichiers sont servis directement par le CDN.
 */
export async function GET(request: Request, ctx: { params: Promise<{ key: string[] }> }) {
  if (env().STORAGE_DRIVER !== "local") return new Response("Not found", { status: 404 });
  const { key: parts } = await ctx.params;
  const key = parts.map(decodeURIComponent).join("/");

  if (isPrivateKey(key)) {
    // Documents sources (menus PDF…) : réservés aux utilisateurs ayant accès au restaurant.
    const user = await getCurrentUser();
    const restaurantId = key.split("/")[1] ?? "";
    if (!user || !(await checkRestaurantAccess(user, restaurantId, "VIEW"))) return new Response("Not found", { status: 404 });
  }

  let path: string;
  try {
    path = resolveLocalPath(key);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  let size: number;
  try {
    const s = await stat(path);
    if (!s.isFile()) return new Response("Not found", { status: 404 });
    size = s.size;
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers({
    "Content-Type": mimeFor(key),
    "Accept-Ranges": "bytes",
    // Chaque fichier a une clé unique : il ne change jamais, on peut le mettre en cache indéfiniment.
    "Cache-Control": isPrivateKey(key) ? "private, no-store" : "public, max-age=31536000, immutable",
    "Access-Control-Allow-Origin": "*",
    "X-Content-Type-Options": "nosniff",
  });

  // Requêtes partielles (Range) : utiles pour les gros modèles 3D.
  const range = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(size - 1, end);
    if (start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(end - start + 1));
    const stream = Readable.toWeb(createReadStream(path, { start, end })) as ReadableStream;
    return new Response(stream, { status: 206, headers });
  }
  headers.set("Content-Length", String(size));
  return new Response(Readable.toWeb(createReadStream(path)) as ReadableStream, { status: 200, headers });
}
