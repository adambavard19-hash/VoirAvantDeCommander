/**
 * Lecture et analyse d'un fichier GLB (glTF 2.0 binaire) sans dépendance native.
 *
 * L'analyse s'appuie sur le JSON du fichier (min/max des positions, obligatoires
 * selon la spécification) : elle fonctionne aussi sur les modèles compressés
 * (Draco, Meshopt) sans avoir à décoder la géométrie.
 *
 * Unités : la spécification glTF impose le mètre. Les dimensions mesurées sont
 * donc celles qu'aura le plat en réalité augmentée, si le modèle respecte la norme.
 */

const MAGIC = 0x46546c67; // "glTF"
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

type Json = Record<string, unknown>;
type Mat4 = number[]; // 16 valeurs, ordre colonne (convention glTF)

export type GlbParts = { json: Json; bin: Buffer | null };

export class GlbError extends Error {}

export function parseGlb(buffer: Buffer): GlbParts {
  if (buffer.length < 20) throw new GlbError("Fichier trop court pour être un GLB.");
  if (buffer.readUInt32LE(0) !== MAGIC) throw new GlbError("Ce fichier n'est pas un GLB valide (signature absente).");
  const version = buffer.readUInt32LE(4);
  if (version !== 2) throw new GlbError(`Version glTF ${version} non prise en charge (2 attendue).`);
  const declared = buffer.readUInt32LE(8);
  if (declared > buffer.length) throw new GlbError("Fichier GLB tronqué (téléversement incomplet ?).");

  let offset = 12;
  let json: Json | null = null;
  let bin: Buffer | null = null;
  while (offset + 8 <= declared) {
    const len = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (start + len > declared) throw new GlbError("Bloc GLB corrompu.");
    if (type === CHUNK_JSON) {
      try {
        json = JSON.parse(buffer.subarray(start, start + len).toString("utf8").replace(/[\s\0]+$/, "")) as Json;
      } catch {
        throw new GlbError("JSON du GLB illisible.");
      }
    } else if (type === CHUNK_BIN && !bin) {
      bin = buffer.subarray(start, start + len);
    }
    offset = start + len;
  }
  if (!json) throw new GlbError("Le GLB ne contient pas de description de scène.");
  return { json, bin };
}

/** Réassemble un GLB à partir de son JSON (modifié) et de son bloc binaire inchangé. */
export function buildGlb(json: Json, bin: Buffer | null): Buffer {
  const jsonBuf = Buffer.from(JSON.stringify(json), "utf8");
  const jsonPad = (4 - (jsonBuf.length % 4)) % 4;
  const jsonChunk = Buffer.concat([jsonBuf, Buffer.alloc(jsonPad, 0x20)]);
  const parts: Buffer[] = [];
  const header = Buffer.alloc(12);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonChunk.length, 0);
  jsonHeader.writeUInt32LE(CHUNK_JSON, 4);
  parts.push(header, jsonHeader, jsonChunk);
  if (bin) {
    const binPad = (4 - (bin.length % 4)) % 4;
    const binChunk = Buffer.concat([bin, Buffer.alloc(binPad, 0)]);
    const binHeader = Buffer.alloc(8);
    binHeader.writeUInt32LE(binChunk.length, 0);
    binHeader.writeUInt32LE(CHUNK_BIN, 4);
    parts.push(binHeader, binChunk);
  }
  const total = parts.reduce((s, p) => s + p.length, 0);
  header.writeUInt32LE(MAGIC, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(total, 8);
  return Buffer.concat(parts);
}

// ─── Mathématiques ───────────────────────────────────────────────────────────

const IDENTITY: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Array<number>(16).fill(0);
  for (let col = 0; col < 4; col++)
    for (let row = 0; row < 4; row++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + row]! * b[col * 4 + k]!;
      out[col * 4 + row] = s;
    }
  return out;
}

function trs(node: Json): Mat4 {
  if (Array.isArray(node.matrix) && node.matrix.length === 16) return node.matrix as number[];
  const [tx, ty, tz] = (node.translation as number[] | undefined) ?? [0, 0, 0];
  const [qx, qy, qz, qw] = (node.rotation as number[] | undefined) ?? [0, 0, 0, 1];
  const [sx, sy, sz] = (node.scale as number[] | undefined) ?? [1, 1, 1];
  const x2 = qx! + qx!,
    y2 = qy! + qy!,
    z2 = qz! + qz!;
  const xx = qx! * x2,
    xy = qx! * y2,
    xz = qx! * z2;
  const yy = qy! * y2,
    yz = qy! * z2,
    zz = qz! * z2;
  const wx = qw! * x2,
    wy = qw! * y2,
    wz = qw! * z2;
  return [
    (1 - (yy + zz)) * sx!, (xy + wz) * sx!, (xz - wy) * sx!, 0,
    (xy - wz) * sy!, (1 - (xx + zz)) * sy!, (yz + wx) * sy!, 0,
    (xz + wy) * sz!, (yz - wx) * sz!, (1 - (xx + yy)) * sz!, 0,
    tx!, ty!, tz!, 1,
  ];
}

function transformPoint(m: Mat4, [x, y, z]: number[]): [number, number, number] {
  return [
    m[0]! * x! + m[4]! * y! + m[8]! * z! + m[12]!,
    m[1]! * x! + m[5]! * y! + m[9]! * z! + m[13]!,
    m[2]! * x! + m[6]! * y! + m[10]! * z! + m[14]!,
  ];
}

const NORMALIZE_DIVISOR: Record<number, number> = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };

// ─── Dimensions d'image (en-têtes PNG / JPEG / WebP / KTX2) ───────────────────

export function imageSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let o = 2;
    while (o + 9 < buf.length) {
      if (buf[o] !== 0xff) return null;
      const marker = buf[o + 1]!;
      const len = buf.readUInt16BE(o + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
        return { height: buf.readUInt16BE(o + 5), width: buf.readUInt16BE(o + 7) };
      o += 2 + len;
    }
    return null;
  }
  if (buf.length > 30 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const chunk = buf.toString("ascii", 12, 16);
    if (chunk === "VP8X") return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    if (chunk === "VP8 ") return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (chunk === "VP8L") {
      const b = buf.readUInt32LE(21);
      return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
    }
  }
  if (buf.length > 32 && buf[1] === 0x4b && buf.toString("ascii", 1, 7) === "KTX 20") {
    return { width: buf.readUInt32LE(20), height: buf.readUInt32LE(24) };
  }
  return null;
}

// ─── Analyse ─────────────────────────────────────────────────────────────────

export type GlbAnalysis = {
  /** Dimensions de la boîte englobante en centimètres (X = largeur, Y = hauteur, Z = profondeur). */
  dimensionsCm: { width: number; height: number; depth: number } | null;
  /** Point le plus bas (cm) : un plat bien préparé repose sur Y = 0. */
  minYcm: number | null;
  triangles: number;
  vertices: number;
  meshes: number;
  materials: number;
  textures: { count: number; maxSize: number | null; formats: string[] };
  extensionsUsed: string[];
  extensionsRequired: string[];
  animations: number;
  sizeBytes: number;
  warnings: string[];
};

export function analyzeGlb(buffer: Buffer): GlbAnalysis {
  const { json, bin } = parseGlb(buffer);
  const accessors = (json.accessors as Json[] | undefined) ?? [];
  const meshes = (json.meshes as Json[] | undefined) ?? [];
  const nodes = (json.nodes as Json[] | undefined) ?? [];
  const scenes = (json.scenes as Json[] | undefined) ?? [];
  const sceneIndex = typeof json.scene === "number" ? json.scene : 0;
  const roots = ((scenes[sceneIndex]?.nodes as number[] | undefined) ?? nodes.map((_, i) => i)).filter(
    (i) => nodes[i],
  );

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let triangles = 0;
  let vertices = 0;
  const visited = new Set<number>();

  const visit = (index: number, parent: Mat4) => {
    if (visited.has(index)) return; // protège des graphes cycliques (fichier invalide)
    visited.add(index);
    const node = nodes[index]!;
    const world = multiply(parent, trs(node));
    if (typeof node.mesh === "number" && meshes[node.mesh]) {
      for (const prim of (meshes[node.mesh]!.primitives as Json[] | undefined) ?? []) {
        const attrs = (prim.attributes as Record<string, number> | undefined) ?? {};
        const posAcc = accessors[attrs.POSITION ?? -1];
        if (!posAcc) continue;
        const count = (posAcc.count as number) ?? 0;
        vertices += count;
        const mode = (prim.mode as number | undefined) ?? 4;
        if (mode === 4) {
          const idx = typeof prim.indices === "number" ? accessors[prim.indices] : null;
          triangles += Math.floor((((idx?.count as number | undefined) ?? count) || 0) / 3);
        }
        const pmin = posAcc.min as number[] | undefined;
        const pmax = posAcc.max as number[] | undefined;
        if (!pmin || !pmax) continue;
        const div = posAcc.normalized ? (NORMALIZE_DIVISOR[posAcc.componentType as number] ?? 1) : 1;
        const lo = pmin.map((v) => v / div);
        const hi = pmax.map((v) => v / div);
        for (let c = 0; c < 8; c++) {
          const corner = [c & 1 ? hi[0]! : lo[0]!, c & 2 ? hi[1]! : lo[1]!, c & 4 ? hi[2]! : lo[2]!];
          const p = transformPoint(world, corner);
          for (let a = 0; a < 3; a++) {
            min[a] = Math.min(min[a]!, p[a]!);
            max[a] = Math.max(max[a]!, p[a]!);
          }
        }
      }
    }
    for (const child of (node.children as number[] | undefined) ?? []) if (nodes[child]) visit(child, world);
  };
  for (const r of roots) visit(r, IDENTITY);

  const hasBounds = Number.isFinite(min[0]) && Number.isFinite(max[0]);
  const round = (v: number) => Math.round(v * 1000) / 10; // m → cm, 1 décimale
  const dimensionsCm = hasBounds
    ? { width: round(max[0]! - min[0]!), height: round(max[1]! - min[1]!), depth: round(max[2]! - min[2]!) }
    : null;

  // Textures
  const images = (json.images as Json[] | undefined) ?? [];
  const bufferViews = (json.bufferViews as Json[] | undefined) ?? [];
  let maxSize: number | null = null;
  const formats = new Set<string>();
  for (const img of images) {
    if (typeof img.mimeType === "string") formats.add(img.mimeType.replace("image/", ""));
    if (typeof img.bufferView === "number" && bin) {
      const bv = bufferViews[img.bufferView];
      if (!bv) continue;
      const start = (bv.byteOffset as number | undefined) ?? 0;
      const size = imageSize(bin.subarray(start, start + Math.min((bv.byteLength as number) ?? 0, 65536)));
      if (size) maxSize = Math.max(maxSize ?? 0, size.width, size.height);
    }
  }

  const extensionsUsed = (json.extensionsUsed as string[] | undefined) ?? [];
  const extensionsRequired = (json.extensionsRequired as string[] | undefined) ?? [];
  const analysis: GlbAnalysis = {
    dimensionsCm,
    minYcm: hasBounds ? round(min[1]!) : null,
    triangles,
    vertices,
    meshes: meshes.length,
    materials: ((json.materials as unknown[]) ?? []).length,
    textures: { count: images.length, maxSize, formats: [...formats] },
    extensionsUsed,
    extensionsRequired,
    animations: ((json.animations as unknown[]) ?? []).length,
    sizeBytes: buffer.length,
    warnings: [],
  };
  analysis.warnings = glbWarnings(analysis);
  return analysis;
}

/** Recommandations pour un chargement rapide sur réseau mobile et une AR fidèle. */
export function glbWarnings(a: GlbAnalysis): string[] {
  const w: string[] = [];
  const mb = a.sizeBytes / 1024 / 1024;
  if (mb > 25) w.push(`Fichier très lourd (${mb.toFixed(1)} Mo) : chargement lent en 4G. Visez moins de 10 Mo.`);
  else if (mb > 10) w.push(`Fichier lourd (${mb.toFixed(1)} Mo) : visez moins de 10 Mo pour un chargement rapide.`);
  if (a.triangles > 500_000) w.push(`${a.triangles.toLocaleString("fr-FR")} triangles : trop pour les téléphones d'entrée de gamme (visez < 200 000).`);
  else if (a.triangles > 200_000) w.push(`${a.triangles.toLocaleString("fr-FR")} triangles : allégez le maillage si possible (< 200 000).`);
  if (a.textures.maxSize && a.textures.maxSize > 4096) w.push(`Textures en ${a.textures.maxSize} px : 2048 px suffisent sur mobile.`);
  if (!a.dimensionsCm) w.push("Dimensions introuvables : le modèle ne contient pas de géométrie mesurable.");
  else {
    const largest = Math.max(a.dimensionsCm.width, a.dimensionsCm.depth, a.dimensionsCm.height);
    if (largest < 2) w.push(`Le modèle mesure ${largest} cm : il est probablement exporté dans une mauvaise unité (taille AR fausse).`);
    if (largest > 150) w.push(`Le modèle mesure ${largest} cm : il est probablement exporté dans une mauvaise unité (taille AR fausse).`);
  }
  if (a.minYcm !== null && Math.abs(a.minYcm) > 1) w.push("Le modèle ne repose pas sur le sol (Y ≠ 0) : il risque de flotter ou de s'enfoncer dans la table en AR.");
  const unsupported = a.extensionsRequired.filter(
    (e) => !["KHR_draco_mesh_compression", "EXT_meshopt_compression", "KHR_mesh_quantization", "KHR_texture_transform", "KHR_materials_unlit", "KHR_texture_basisu", "EXT_texture_webp"].includes(e),
  );
  if (unsupported.length) w.push(`Extensions requises peu compatibles : ${unsupported.join(", ")}.`);
  if (a.extensionsRequired.includes("EXT_texture_webp") || a.extensionsRequired.includes("KHR_texture_basisu"))
    w.push("Textures WebP/KTX2 obligatoires : la visionneuse Android Scene Viewer peut ne pas les afficher. Testez sur un appareil Android.");
  return w;
}

/**
 * Applique un facteur d'échelle uniforme au modèle, sans toucher à la géométrie :
 * les nœuds racines sont placés sous un nouveau nœud portant l'échelle. Fonctionne
 * aussi sur les fichiers compressés.
 */
export function rescaleGlb(buffer: Buffer, factor: number): Buffer {
  if (!(factor > 0) || !Number.isFinite(factor)) throw new GlbError("Facteur d'échelle invalide.");
  const { json, bin } = parseGlb(buffer);
  const nodes = ((json.nodes as Json[] | undefined) ?? []).slice();
  const scenes = ((json.scenes as Json[] | undefined) ?? []).map((s) => ({ ...s }));
  const sceneIndex = typeof json.scene === "number" ? json.scene : 0;
  const scene = scenes[sceneIndex];
  if (!scene) throw new GlbError("Le GLB ne contient pas de scène.");
  const roots = (scene.nodes as number[] | undefined) ?? [];
  nodes.push({ name: "VADC_echelle_reelle", scale: [factor, factor, factor], children: roots });
  scene.nodes = [nodes.length - 1];
  return buildGlb({ ...json, nodes, scenes }, bin);
}
