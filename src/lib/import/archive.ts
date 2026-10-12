import { unzipSync } from "fflate";
import { categorizeFile } from "@/lib/storage/mime";

export const ARCHIVE_LIMITS = { maxFiles: 2000, maxTotalBytes: 600 * 1024 * 1024, maxFileBytes: 120 * 1024 * 1024 };

export type ArchiveEntry = { path: string; name: string; data: Buffer };

/**
 * Extrait une archive ZIP en mémoire, avec garde-fous : nombre de fichiers,
 * taille décompressée (protection « zip bomb »), fichiers système ignorés.
 * Les .usdz contenus ne sont pas décompressés (ce sont des fichiers à part entière).
 */
export function extractArchive(buffer: Buffer): { entries: ArchiveEntry[]; skipped: string[] } {
  const skipped: string[] = [];
  let count = 0;
  let total = 0;
  const files = unzipSync(new Uint8Array(buffer), {
    filter: (file) => {
      const name = file.name.replace(/\\/g, "/");
      const base = name.split("/").pop() ?? "";
      if (!base || name.endsWith("/") || name.startsWith("__MACOSX/") || base.startsWith(".") || base === "Thumbs.db") return false;
      const category = categorizeFile(base);
      if (category === "unsupported" || category === "archive") {
        skipped.push(name);
        return false;
      }
      if (file.compression !== 0 && file.compression !== 8) {
        skipped.push(`${name} (compression non prise en charge)`);
        return false;
      }
      if (file.originalSize > ARCHIVE_LIMITS.maxFileBytes) {
        skipped.push(`${name} (trop volumineux)`);
        return false;
      }
      count++;
      total += file.originalSize;
      if (count > ARCHIVE_LIMITS.maxFiles) throw new Error(`Archive trop volumineuse : plus de ${ARCHIVE_LIMITS.maxFiles} fichiers.`);
      if (total > ARCHIVE_LIMITS.maxTotalBytes) throw new Error("Archive trop volumineuse une fois décompressée (600 Mo maximum).");
      return true;
    },
  });
  const entries = Object.entries(files).map(([path, data]) => {
    const clean = path.replace(/\\/g, "/").replace(/^\/+/, "");
    return { path: clean, name: clean.split("/").pop()!, data: Buffer.from(data) };
  });
  return { entries, skipped };
}
