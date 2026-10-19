import "server-only";
import { createId } from "./id";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { assetKey, storage, variantKey } from "@/lib/storage";
import { MAX_BYTES, categorizeFile, mimeFor, type FileCategory } from "@/lib/storage/mime";
import { badRequest } from "@/lib/http";
import { ImageError, processImage } from "./images";
import { GlbError, analyzeGlb, type GlbAnalysis } from "./glb";
import { optimizeGlb } from "./optimize-glb";
import { analyzeUsdz, type UsdzAnalysis } from "./usdz";
import type { Asset, AssetKind, Prisma } from "@/generated/prisma/client";

const KIND_BY_CATEGORY: Partial<Record<FileCategory, AssetKind>> = {
  image: "IMAGE",
  glb: "MODEL_GLB",
  usdz: "MODEL_USDZ",
  "menu-document": "DOCUMENT",
  archive: "DOCUMENT",
  video: "VIDEO",
};

export type UploadRequestFile = { name: string; size: number; path?: string };

export type UploadReservation = {
  assetId: string;
  name: string;
  path?: string;
  upload: { url: string; method: "PUT"; headers: Record<string, string> };
};

/**
 * Réserve des emplacements de stockage et renvoie une URL de téléversement direct
 * par fichier : les fichiers 3D volumineux ne transitent pas par l'API.
 */
export async function reserveUploads(params: {
  restaurantId: string;
  userId: string;
  files: UploadRequestFile[];
  importJobId?: string;
  accept?: FileCategory[];
}): Promise<{ reservations: UploadReservation[]; rejected: { name: string; reason: string }[] }> {
  const reservations: UploadReservation[] = [];
  const rejected: { name: string; reason: string }[] = [];
  for (const file of params.files) {
    const category = categorizeFile(file.name);
    const kind = KIND_BY_CATEGORY[category];
    if (!kind || (params.accept && !params.accept.includes(category))) {
      rejected.push({ name: file.name, reason: "Type de fichier non pris en charge." });
      continue;
    }
    const max = MAX_BYTES[category as Exclude<FileCategory, "unsupported">];
    if (file.size > max) {
      rejected.push({ name: file.name, reason: `Fichier trop volumineux (max ${Math.round(max / 1024 / 1024)} Mo).` });
      continue;
    }
    if (file.size <= 0) {
      rejected.push({ name: file.name, reason: "Fichier vide." });
      continue;
    }
    const id = createId();
    const visibility = kind === "DOCUMENT" ? "private" : "public";
    const key = assetKey(params.restaurantId, id, file.name, visibility);
    const contentType = mimeFor(file.name);
    await db.asset.create({
      data: {
        id,
        restaurantId: params.restaurantId,
        kind,
        status: "PENDING",
        storageKey: key,
        originalName: file.name.slice(0, 255),
        originalPath: file.path?.slice(0, 500) ?? null,
        mimeType: contentType,
        sizeBytes: file.size,
        importJobId: params.importJobId ?? null,
        uploadedById: params.userId,
      },
    });
    const upload = await storage().createUploadTarget(key, contentType, max);
    reservations.push({ assetId: id, name: file.name, path: file.path, upload });
  }
  return { reservations, rejected };
}

/** Finalise un téléversement : vérifie le fichier reçu puis l'analyse et l'optimise. */
export async function finalizeAsset(restaurantId: string, assetId: string): Promise<Asset> {
  const asset = await db.asset.findFirst({ where: { id: assetId, restaurantId } });
  if (!asset) throw badRequest("Fichier inconnu.");
  if (asset.status === "READY") return asset;
  const buffer = await storage().getBuffer(asset.storageKey);
  if (!buffer) return markFailed(asset, "Le fichier n'a pas été reçu. Relancez le téléversement.");
  return processStoredAsset(asset, buffer);
}

async function markFailed(asset: Asset, error: string) {
  return db.asset.update({ where: { id: asset.id }, data: { status: "FAILED", error } });
}

export async function processStoredAsset(asset: Asset, buffer: Buffer): Promise<Asset> {
  const base = { sizeBytes: buffer.length, checksum: sha256(buffer) };
  try {
    if (asset.kind === "IMAGE") {
      const img = await processImage(buffer);
      const variants: Record<string, string> = {};
      for (const v of img.variants) {
        const key = variantKey(asset.storageKey, v.name);
        await storage().put(key, v.buffer, "image/webp");
        variants[v.name.replace(".webp", "")] = key;
      }
      return db.asset.update({
        where: { id: asset.id },
        data: {
          ...base,
          status: "READY",
          error: null,
          width: img.width,
          height: img.height,
          variants,
          metadata: { blur: img.blurDataUrl, dominant: img.dominant, hasAlpha: img.hasAlpha, format: img.format },
        },
      });
    }
    if (asset.kind === "MODEL_GLB") {
      analyzeGlb(buffer); // fichier invalide : erreur explicite avant toute optimisation
      // Scans 3D lourds : textures allégées automatiquement (même adresse, contenu remplacé).
      const optimized = await optimizeGlb(buffer).catch((error) => {
        console.error("[assets] optimisation GLB", error);
        return null;
      });
      if (optimized) await storage().put(asset.storageKey, optimized.buffer, "model/gltf-binary");
      const final = optimized?.buffer ?? buffer;
      const analysis = analyzeGlb(final);
      return db.asset.update({
        where: { id: asset.id },
        data: {
          sizeBytes: final.length,
          checksum: sha256(final),
          status: "READY",
          error: null,
          metadata: { ...analysis, ...(optimized ? { optimized: optimized.info } : {}) } as unknown as Prisma.InputJsonValue,
        },
      });
    }
    if (asset.kind === "MODEL_USDZ") {
      const analysis = analyzeUsdz(buffer);
      return db.asset.update({
        where: { id: asset.id },
        data: {
          ...base,
          status: analysis.valid ? "READY" : "FAILED",
          error: analysis.valid ? null : analysis.errors.join(" "),
          metadata: analysis as unknown as Prisma.InputJsonValue,
        },
      });
    }
    if (asset.kind === "VIDEO") {
      // MP4/MOV : boîte « ftyp » à l'octet 4 ; WebM : signature EBML.
      const isMp4 = buffer.subarray(4, 8).toString("latin1") === "ftyp";
      const isWebm = buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
      if (!isMp4 && !isWebm) {
        return db.asset.update({ where: { id: asset.id }, data: { ...base, status: "FAILED", error: "Vidéo illisible : formats acceptés MP4, MOV ou WebM." } });
      }
    }
    return db.asset.update({ where: { id: asset.id }, data: { ...base, status: "READY", error: null } });
  } catch (error) {
    const message =
      error instanceof ImageError || error instanceof GlbError ? error.message : "Fichier illisible ou corrompu.";
    if (!(error instanceof ImageError || error instanceof GlbError)) console.error("[assets] traitement", error);
    return db.asset.update({ where: { id: asset.id }, data: { ...base, status: "FAILED", error: message } });
  }
}

/** Crée un fichier à partir d'un contenu déjà en mémoire (extraction d'archive ZIP, échelle corrigée…). */
export async function createAssetFromBuffer(params: {
  restaurantId: string;
  userId: string | null;
  name: string;
  path?: string;
  buffer: Buffer;
  importJobId?: string;
}): Promise<Asset | null> {
  const category = categorizeFile(params.name);
  const kind = KIND_BY_CATEGORY[category];
  if (!kind) return null;
  const id = createId();
  const key = assetKey(params.restaurantId, id, params.name, kind === "DOCUMENT" ? "private" : "public");
  const contentType = mimeFor(params.name);
  await storage().put(key, params.buffer, contentType);
  const asset = await db.asset.create({
    data: {
      id,
      restaurantId: params.restaurantId,
      kind,
      status: "PENDING",
      storageKey: key,
      originalName: params.name.slice(0, 255),
      originalPath: params.path?.slice(0, 500) ?? null,
      mimeType: contentType,
      sizeBytes: params.buffer.length,
      importJobId: params.importJobId ?? null,
      uploadedById: params.userId,
    },
  });
  return processStoredAsset(asset, params.buffer);
}

/** Supprime un fichier et ses variantes (stockage + base). */
export async function deleteAsset(asset: Asset) {
  const dir = asset.storageKey.slice(0, asset.storageKey.lastIndexOf("/") + 1);
  await storage().deletePrefix(dir);
  await db.asset.delete({ where: { id: asset.id } });
}

// ─── Représentation côté client ─────────────────────────────────────────────

export type AssetDto = {
  id: string;
  kind: AssetKind;
  status: Asset["status"];
  name: string;
  path: string | null;
  sizeBytes: number;
  url: string | null;
  thumbUrl: string | null;
  width: number | null;
  height: number | null;
  error: string | null;
  glb?: GlbAnalysis;
  usdz?: UsdzAnalysis;
  dominant?: string;
};

export function assetUrl(asset: Pick<Asset, "storageKey" | "kind">): string | null {
  if (asset.kind === "DOCUMENT") return null;
  return storage().publicUrl(asset.storageKey);
}

export function toAssetDto(asset: Asset): AssetDto {
  const variants = (asset.variants as Record<string, string> | null) ?? {};
  const thumbKey = variants.w480 ?? Object.values(variants)[0];
  const meta = (asset.metadata ?? {}) as Record<string, unknown>;
  return {
    id: asset.id,
    kind: asset.kind,
    status: asset.status,
    name: asset.originalName,
    path: asset.originalPath,
    sizeBytes: asset.sizeBytes,
    url: asset.status === "READY" ? assetUrl(asset) : null,
    thumbUrl: asset.kind === "IMAGE" && thumbKey ? storage().publicUrl(thumbKey) : null,
    width: asset.width,
    height: asset.height,
    error: asset.error,
    glb: asset.kind === "MODEL_GLB" && asset.status === "READY" ? (meta as unknown as GlbAnalysis) : undefined,
    usdz: asset.kind === "MODEL_USDZ" ? (meta as unknown as UsdzAnalysis) : undefined,
    dominant: typeof meta.dominant === "string" ? meta.dominant : undefined,
  };
}
