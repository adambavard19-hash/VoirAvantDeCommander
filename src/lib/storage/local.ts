import "server-only";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import { signPayload } from "@/lib/crypto";
import type { StorageDriver } from "./types";

export function localRoot(): string {
  // Dossier choisi à l'exécution : exclu de l'analyse statique du bundler.
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), env().STORAGE_LOCAL_DIR);
}

/** Résout une clé en chemin disque en refusant toute sortie du dossier racine. */
export function resolveLocalPath(key: string): string {
  if (!key || key.includes("\0") || key.split("/").some((p) => p === ".." || p === "")) {
    throw new Error("Clé de stockage invalide");
  }
  const root = localRoot();
  const full = path.resolve(/*turbopackIgnore: true*/ root, key);
  if (!full.startsWith(root + path.sep)) throw new Error("Clé de stockage invalide");
  return full;
}

export const localDriver: StorageDriver = {
  name: "local",
  async put(key, body) {
    const full = resolveLocalPath(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, body);
  },
  async getBuffer(key) {
    try {
      return await readFile(resolveLocalPath(key));
    } catch {
      return null;
    }
  },
  async stat(key) {
    try {
      const s = await stat(resolveLocalPath(key));
      return { size: s.size };
    } catch {
      return null;
    }
  },
  async delete(key) {
    await rm(resolveLocalPath(key), { force: true });
  },
  async deletePrefix(prefix) {
    await rm(resolveLocalPath(prefix.replace(/\/+$/, "")), { recursive: true, force: true });
  },
  publicUrl(key) {
    return `/files/${key}`;
  },
  async createUploadTarget(key, contentType, maxBytes) {
    const token = signPayload(env().APP_SECRET, { key, contentType, maxBytes }, 3600);
    return {
      url: `/api/admin/uploads/local?token=${encodeURIComponent(token)}`,
      method: "PUT",
      headers: { "Content-Type": contentType },
    };
  },
};
