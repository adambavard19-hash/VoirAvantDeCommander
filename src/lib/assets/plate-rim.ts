import { NodeIO } from "@gltf-transform/core";

export class PlateRimError extends Error {}

export type PlateRimInfo = { verticesMoved: number; maxMoveMm: number; diameterCm: number; roundness: number };

const BINS = 180;
/** Début de la zone corrigée, en fraction du rayon : le centre de l'assiette (et le plat) n'est jamais touché. */
const START = 0.86;

/**
 * Régularise le bord d'une assiette RONDE dans un scan 3D d'une seule pièce (plat + assiette) :
 * le contour vu de dessus devient un cercle, et le dessus / dessous du rebord suivent le
 * profil moyen mesuré sur tout le tour (une assiette est un objet de révolution). Les bosses,
 * creux et « coulures » locales disparaissent ; textures, plat et dimensions sont conservés.
 * La tranche verticale garde sa hauteur pour ne pas aplatir l'épaisseur de l'assiette.
 */
export async function smoothPlateRim(buffer: Buffer): Promise<{ buffer: Buffer; info: PlateRimInfo }> {
  const io = new NodeIO();
  let doc;
  try {
    doc = await io.readBinary(new Uint8Array(buffer));
  } catch {
    throw new PlateRimError("Modèle 3D illisible ou compressé dans un format non géré.");
  }
  const prims = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives());
  const nodes = doc.getRoot().listNodes().filter((nd) => nd.getMesh());
  if (prims.length !== 1 || nodes.length !== 1) throw new PlateRimError("Correction réservée aux scans d'une seule pièce (plat et assiette ensemble).");
  const m = nodes[0]!.getWorldMatrix();
  const identity = m.every((v, i) => Math.abs(v - (i % 5 === 0 ? 1 : 0)) < 1e-6);
  if (!identity) throw new PlateRimError("Modèle orienté ou mis à l'échelle par une transformation : correction non disponible.");
  const prim = prims[0]!;
  const pos = prim.getAttribute("POSITION");
  const nor = prim.getAttribute("NORMAL");
  if (!pos || !nor) throw new PlateRimError("Modèle sans normales : correction non disponible.");
  const P = pos.getArray()!;
  const N = nor.getArray()!;
  const n = pos.getCount();

  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < n; i++) {
    x0 = Math.min(x0, P[i * 3]!); x1 = Math.max(x1, P[i * 3]!);
    y0 = Math.min(y0, P[i * 3 + 1]!); y1 = Math.max(y1, P[i * 3 + 1]!);
    z0 = Math.min(z0, P[i * 3 + 2]!); z1 = Math.max(z1, P[i * 3 + 2]!);
  }
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const ang = (i: number) => Math.atan2(P[i * 3 + 2]! - cz, P[i * 3]! - cx);
  const rad = (i: number) => Math.hypot(P[i * 3]! - cx, P[i * 3 + 2]! - cz);
  const binOf = (t: number) => Math.min(BINS - 1, Math.floor(((t + Math.PI) / (2 * Math.PI)) * BINS));

  // Enveloppe du contour (rayon maximal par secteur), médiane glissante contre les pointes.
  const R = new Float64Array(BINS);
  for (let i = 0; i < n; i++) { const b = binOf(ang(i)); R[b] = Math.max(R[b]!, rad(i)); }
  const med = Array.from(R, (_, b) => {
    const w: number[] = [];
    for (let d = -5; d <= 5; d++) w.push(R[(b + d + BINS) % BINS]!);
    return w.sort((a, c) => a - c)[5]!;
  });
  const meanMed = med.reduce((a, b) => a + b, 0) / BINS;
  const radius = meanMed;
  const roundness = Math.sqrt(med.reduce((a, b) => a + (b - meanMed) ** 2, 0) / BINS) / meanMed;
  if (roundness > 0.06) throw new PlateRimError("L'assiette ne semble pas ronde : la correction automatique risquerait de la déformer.");

  // Hauteur du rebord : tout ce qui dépasse (le plat) est protégé.
  const rimYs: number[] = [];
  for (let i = 0; i < n; i++) if (rad(i) / radius > 0.9) rimYs.push(P[i * 3 + 1]!);
  rimYs.sort((a, b) => a - b);
  const rimTop = rimYs[Math.floor(rimYs.length * 0.95)]! + 0.03 * (y1 - y0);

  // Profil moyen (médiane) de la hauteur selon la position relative ; dessus, dessous, tranche.
  const SB = 48;
  const sBin = (s: number) => Math.min(SB - 1, Math.max(0, Math.floor(((s - START) / (1.04 - START)) * SB)));
  const groups = [Array.from({ length: SB }, () => [] as number[]), Array.from({ length: SB }, () => [] as number[])];
  const band: [number, number, 0 | 1 | 2][] = []; // sommet, position relative au rayon, groupe
  for (let i = 0; i < n; i++) {
    if (P[i * 3 + 1]! > rimTop) continue;
    const s = rad(i) / radius;
    if (s < START) continue;
    const ny = N[i * 3 + 1]!;
    const g = ny > 0.45 ? 0 : ny < -0.45 ? 1 : 2;
    if (g < 2) groups[g]![sBin(s)]!.push(P[i * 3 + 1]!);
    band.push([i, s, g]);
  }
  const prof = groups.map((bins) => bins.map((ys) => (ys.length ? [...ys].sort((a, b) => a - b)[Math.floor(ys.length / 2)]! : null)));
  for (const p of prof)
    for (let k = 0; k < SB; k++)
      if (p[k] === null) {
        let a = k - 1, b = k + 1;
        while (a >= 0 && p[a] === null) a--;
        while (b < SB && p[b] === null) b++;
        p[k] = a >= 0 && b < SB ? (p[a]! + p[b]!) / 2 : a >= 0 ? p[a]! : b < SB ? p[b]! : 0;
      }

  const smoothstep = (e0: number, e1: number, x: number) => { const u = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return u * u * (3 - 2 * u); };
  let maxMove = 0;
  for (const [i, s0, g] of band) {
    const w = smoothstep(START, START + 0.06, s0);
    const r = rad(i);
    // Les bosses qui dépassent sont ramenées sur le cercle. Les creux ne sont pas comblés :
    // les « remplir » ferait apparaître un bord froissé (testé sur des scans réels).
    const target = Math.min(s0, 1) * radius;
    const k = r ? (r + w * (target - r)) / r : 1;
    const ny = g < 2 ? P[i * 3 + 1]! + w * (prof[g]![sBin(s0)]! - P[i * 3 + 1]!) : P[i * 3 + 1]!;
    const nx = cx + (P[i * 3]! - cx) * k;
    const nz = cz + (P[i * 3 + 2]! - cz) * k;
    maxMove = Math.max(maxMove, Math.hypot(nx - P[i * 3]!, ny - P[i * 3 + 1]!, nz - P[i * 3 + 2]!));
    P[i * 3] = nx; P[i * 3 + 1] = ny; P[i * 3 + 2] = nz;
  }
  pos.setArray(P);
  const out = Buffer.from(await io.writeBinary(doc));
  return { buffer: out, info: { verticesMoved: band.length, maxMoveMm: +(maxMove * 1000).toFixed(1), diameterCm: +(radius * 200).toFixed(1), roundness: +roundness.toFixed(3) } };
}
