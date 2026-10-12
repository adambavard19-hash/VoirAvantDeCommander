"use client";

import { api } from "./api";
import type { AssetDto } from "@/lib/assets/service";

export type UploadItem = { file: File; path?: string };
export type UploadProgress = { name: string; loaded: number; total: number; status: "pending" | "uploading" | "processing" | "done" | "error"; error?: string };

type Reservation = { assetId: string; name: string; path?: string; upload: { url: string; method: "PUT"; headers: Record<string, string> } };

function putWithProgress(url: string, file: File, headers: Record<string, string>, onProgress: (loaded: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Échec du téléversement (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Connexion interrompue pendant le téléversement."));
    xhr.send(file);
  });
}

/**
 * Téléverse des fichiers directement vers le stockage (S3 ou local), avec
 * progression, puis demande au serveur de les analyser (images optimisées,
 * modèles 3D mesurés).
 */
export async function uploadFiles(
  restaurantId: string,
  items: UploadItem[],
  opts: { importJobId?: string; accept?: string[]; concurrency?: number; onProgress?: (progress: UploadProgress[]) => void } = {},
): Promise<{ assets: AssetDto[]; rejected: { name: string; reason: string }[] }> {
  const progress: UploadProgress[] = items.map((i) => ({ name: i.path ?? i.file.name, loaded: 0, total: i.file.size, status: "pending" }));
  const emit = () => opts.onProgress?.(progress.map((p) => ({ ...p })));
  emit();

  const assets: AssetDto[] = [];
  const rejected: { name: string; reason: string }[] = [];
  // Réservations par lots de 100 fichiers.
  for (let start = 0; start < items.length; start += 100) {
    const batch = items.slice(start, start + 100);
    const { reservations, rejected: rej } = await api<{ reservations: Reservation[]; rejected: { name: string; reason: string }[] }>(
      `/api/admin/restaurants/${restaurantId}/uploads`,
      {
        body: {
          files: batch.map((i) => ({ name: i.file.name, size: i.file.size, path: i.path })),
          importJobId: opts.importJobId,
          accept: opts.accept,
        },
      },
    );
    rejected.push(...rej);
    for (const r of rej) {
      const idx = progress.findIndex((p, i) => i >= start && items[i]!.file.name === r.name && p.status === "pending");
      if (idx >= 0) progress[idx] = { ...progress[idx]!, status: "error", error: r.reason };
    }
    emit();

    const queue = reservations.map((r) => {
      const idx = progress.findIndex((p, i) => i >= start && i < start + batch.length && items[i]!.file.name === r.name && (items[i]!.path ?? undefined) === (r.path ?? undefined) && p.status === "pending");
      return { r, idx };
    });
    const concurrency = opts.concurrency ?? 3;
    let cursor = 0;
    const worker = async () => {
      while (cursor < queue.length) {
        const { r, idx } = queue[cursor++]!;
        const item = items[idx]!;
        progress[idx] = { ...progress[idx]!, status: "uploading" };
        emit();
        try {
          await putWithProgress(r.upload.url, item.file, r.upload.headers, (loaded) => {
            progress[idx] = { ...progress[idx]!, loaded };
            emit();
          });
          progress[idx] = { ...progress[idx]!, loaded: item.file.size, status: "processing" };
          emit();
          const { assets: done } = await api<{ assets: AssetDto[] }>(`/api/admin/restaurants/${restaurantId}/uploads/complete`, {
            body: { assetIds: [r.assetId] },
          });
          const asset = done[0]!;
          assets.push(asset);
          progress[idx] = { ...progress[idx]!, status: asset.status === "READY" ? "done" : "error", error: asset.error ?? undefined };
        } catch (error) {
          progress[idx] = { ...progress[idx]!, status: "error", error: error instanceof Error ? error.message : "Erreur" };
        }
        emit();
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
  }
  return { assets, rejected };
}

/** Parcourt récursivement un dépôt de dossiers (glisser-déposer) en conservant les chemins relatifs. */
export async function filesFromDataTransfer(dt: DataTransfer): Promise<UploadItem[]> {
  const entries = Array.from(dt.items)
    .map((i) => (typeof i.webkitGetAsEntry === "function" ? i.webkitGetAsEntry() : null))
    .filter((e): e is FileSystemEntry => !!e);
  if (!entries.length) return Array.from(dt.files).map((file) => ({ file }));
  const out: UploadItem[] = [];
  const walk = async (entry: FileSystemEntry, prefix: string): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
      if (!file.name.startsWith(".")) out.push({ file, path: prefix ? `${prefix}/${file.name}` : undefined });
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const children: FileSystemEntry[] = [];
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
        if (!batch.length) break;
        children.push(...batch);
      }
      for (const c of children) await walk(c, prefix ? `${prefix}/${entry.name}` : entry.name);
    }
  };
  for (const e of entries) await walk(e, "");
  return out;
}
