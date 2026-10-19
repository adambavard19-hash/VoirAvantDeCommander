import "server-only";
import { NodeIO } from "@gltf-transform/core";
import sharp from "sharp";

/** En dessous, le modèle charge déjà vite : on n'y touche pas. */
const MIN_BYTES = 4 * 1024 * 1024;

export type GlbOptimization = { fromBytes: number; toBytes: number; textures: number };

/**
 * Allège un GLB lourd (scans 3D aux textures PNG 2048 px, ~11 Mo) : les textures
 * OPAQUES passent en JPEG haute qualité. La géométrie, les dimensions et les
 * textures avec transparence sont conservées telles quelles. Renvoie null si
 * rien n'est à gagner ou si le fichier utilise des extensions non gérées.
 */
export async function optimizeGlb(buffer: Buffer): Promise<{ buffer: Buffer; info: GlbOptimization } | null> {
  if (buffer.length < MIN_BYTES) return null;
  const io = new NodeIO();
  let doc;
  try {
    doc = await io.readBinary(new Uint8Array(buffer));
  } catch {
    return null; // extension requise inconnue (Draco, KTX2…) : fichier laissé intact
  }
  let converted = 0;
  for (const texture of doc.getRoot().listTextures()) {
    const image = texture.getImage();
    if (!image || texture.getMimeType() !== "image/png") continue;
    const input = sharp(Buffer.from(image));
    const { isOpaque } = await input.stats();
    if (!isOpaque) continue;
    const jpeg = await sharp(Buffer.from(image)).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
    if (jpeg.length >= image.byteLength) continue;
    texture.setImage(new Uint8Array(jpeg)).setMimeType("image/jpeg");
    const uri = texture.getURI();
    if (uri) texture.setURI(uri.replace(/\.png$/i, ".jpg"));
    converted++;
  }
  if (!converted) return null;
  const out = Buffer.from(await io.writeBinary(doc));
  if (out.length >= buffer.length * 0.9) return null;
  return { buffer: out, info: { fromBytes: buffer.length, toBytes: out.length, textures: converted } };
}
