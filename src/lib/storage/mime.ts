/** Types de fichiers acceptés et leur type MIME de diffusion. */
export const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  svg: "image/svg+xml",
  glb: "model/gltf-binary",
  // Type exigé par AR Quick Look (iOS) pour ouvrir un fichier USDZ.
  usdz: "model/vnd.usdz+zip",
  pdf: "application/pdf",
  csv: "text/csv",
  txt: "text/plain",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  zip: "application/zip",
};

export function extensionOf(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
}

export function mimeFor(name: string): string {
  return MIME_BY_EXT[extensionOf(name)] ?? "application/octet-stream";
}

export type FileCategory = "image" | "glb" | "usdz" | "menu-document" | "archive" | "unsupported";

export function categorizeFile(name: string): FileCategory {
  const ext = extensionOf(name);
  if (["jpg", "jpeg", "png", "webp", "avif"].includes(ext)) return "image";
  if (ext === "glb") return "glb";
  if (ext === "usdz") return "usdz";
  if (["pdf", "csv", "xlsx", "txt"].includes(ext)) return "menu-document";
  if (ext === "zip") return "archive";
  return "unsupported";
}

/** Tailles maximales par type (octets). Les modèles 3D peuvent être volumineux. */
export const MAX_BYTES: Record<Exclude<FileCategory, "unsupported">, number> = {
  image: 25 * 1024 * 1024,
  glb: 80 * 1024 * 1024,
  usdz: 80 * 1024 * 1024,
  "menu-document": 25 * 1024 * 1024,
  archive: 500 * 1024 * 1024,
};
