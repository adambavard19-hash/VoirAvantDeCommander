import "server-only";
import { env } from "@/lib/env";
import { safeFileName } from "@/lib/slug";
import { localDriver } from "./local";
import { s3Driver } from "./s3";
import type { StorageDriver } from "./types";

export function storage(): StorageDriver {
  return env().STORAGE_DRIVER === "s3" ? s3Driver : localDriver;
}

/**
 * Clé de stockage d'un fichier. Les documents sources (menus PDF/Excel) sont
 * rangés sous « private » : ils ne sont jamais servis publiquement.
 */
export function assetKey(restaurantId: string, assetId: string, fileName: string, visibility: "public" | "private") {
  return `restaurants/${restaurantId}/${visibility}/${assetId}/${safeFileName(fileName)}`;
}

export function variantKey(originalKey: string, variant: string): string {
  const dir = originalKey.slice(0, originalKey.lastIndexOf("/"));
  return `${dir}/${variant}`;
}

export function isPrivateKey(key: string): boolean {
  return key.split("/")[2] === "private";
}

export function restaurantPrefix(restaurantId: string) {
  return `restaurants/${restaurantId}/`;
}
