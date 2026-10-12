import { createWriteStream } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import { verifyPayload } from "@/lib/crypto";
import { badRequest, forbidden, handle, HttpError } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { resolveLocalPath } from "@/lib/storage/local";

/**
 * Réception d'un fichier en stockage local (équivalent de l'URL présignée S3).
 * Le jeton signé fixe la clé de destination et la taille maximale.
 */
export async function PUT(request: Request) {
  return handle(async () => {
    if (env().STORAGE_DRIVER !== "local") throw forbidden();
    await requireUser();
    const token = new URL(request.url).searchParams.get("token") ?? "";
    const payload = verifyPayload<{ key: string; maxBytes: number }>(env().APP_SECRET, token);
    if (!payload) throw forbidden("Lien de téléversement expiré ou invalide.");
    if (!request.body) throw badRequest("Fichier manquant.");

    const finalPath = resolveLocalPath(payload.key);
    await mkdir(path.dirname(finalPath), { recursive: true });
    const tmpPath = `${finalPath}.part`;
    const out = createWriteStream(tmpPath);
    let received = 0;
    try {
      const reader = request.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > payload.maxBytes) throw new HttpError(413, "Fichier trop volumineux.");
        if (!out.write(value)) await new Promise<void>((resolve) => out.once("drain", () => resolve()));
      }
      await new Promise<void>((resolve, reject) => out.end((err?: Error | null) => (err ? reject(err) : resolve())));
      await rename(tmpPath, finalPath);
    } catch (error) {
      out.destroy();
      await rm(tmpPath, { force: true });
      throw error;
    }
    return { ok: true, size: received };
  });
}
