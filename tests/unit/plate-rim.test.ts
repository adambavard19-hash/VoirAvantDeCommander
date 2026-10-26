import { describe, expect, it } from "vitest";
import { Document, NodeIO } from "@gltf-transform/core";
import { PlateRimError, smoothPlateRim } from "@/lib/assets/plate-rim";

/** Assiette synthétique : disque (dessus + dessous) au bord bosselé, avec un « plat » au centre. */
async function plate(shape: (t: number) => number) {
  const doc = new Document();
  const pos: number[] = [], nor: number[] = [], idx: number[] = [];
  const RINGS = 12, SEG = 120;
  for (const [y, ny] of [[0.012, 1], [0, -1]] as const) {
    const base = pos.length / 3;
    pos.push(0, y + (ny > 0 ? 0.04 : 0), 0); // centre (le « plat » dépasse au milieu)
    nor.push(0, ny, 0);
    for (let r = 1; r <= RINGS; r++)
      for (let s = 0; s < SEG; s++) {
        const t = (s / SEG) * 2 * Math.PI - Math.PI;
        const rad = (r / RINGS) * shape(t);
        pos.push(Math.cos(t) * rad, y, Math.sin(t) * rad);
        nor.push(0, ny, 0);
      }
    for (let s = 0; s < SEG; s++) idx.push(base, base + 1 + s, base + 1 + ((s + 1) % SEG));
    for (let r = 1; r < RINGS; r++)
      for (let s = 0; s < SEG; s++) {
        const a = base + 1 + (r - 1) * SEG + s, b = base + 1 + (r - 1) * SEG + ((s + 1) % SEG);
        idx.push(a, a + SEG, b, b, a + SEG, b + SEG);
      }
  }
  const buffer = doc.createBuffer();
  const prim = doc
    .createPrimitive()
    .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(new Float32Array(pos)).setBuffer(buffer))
    .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(new Float32Array(nor)).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType("SCALAR").setArray(new Uint32Array(idx)).setBuffer(buffer));
  doc.createScene().addChild(doc.createNode().setMesh(doc.createMesh().addPrimitive(prim)));
  return Buffer.from(await new NodeIO().writeBinary(doc));
}

/** Contour vu de dessus : étendue (max − min) et rayon maximal des sommets extérieurs, en mm. */
async function rimDeviationMm(buf: Buffer) {
  const doc = await new NodeIO().readBinary(new Uint8Array(buf));
  const p = doc.getRoot().listMeshes()[0]!.listPrimitives()[0]!.getAttribute("POSITION")!.getArray()!;
  // Sommet le plus extérieur de chaque secteur de 6° (le contour vu de dessus).
  // Mesuré autour du centre de la boîte englobante, comme la correction.
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < p.length; i += 3) { x0 = Math.min(x0, p[i]!); x1 = Math.max(x1, p[i]!); z0 = Math.min(z0, p[i + 2]!); z1 = Math.max(z1, p[i + 2]!); }
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const outerBy = new Map<number, number>();
  for (let i = 0; i < p.length; i += 3) {
    const k = Math.floor(((Math.atan2(p[i + 2]! - cz, p[i]! - cx) + Math.PI) / (2 * Math.PI)) * 60);
    outerBy.set(k, Math.max(outerBy.get(k) ?? 0, Math.hypot(p[i]! - cx, p[i + 2]! - cz)));
  }
  const outer = [...outerBy.values()];
  return { spreadMm: (Math.max(...outer) - Math.min(...outer)) * 1000, maxMm: Math.max(...outer) * 1000 };
}

describe("bord d'assiette régularisé", () => {
  it("coupe les bosses du bord d'une assiette ronde, sans changer sa taille ni le plat", async () => {
    const bumpy = await plate((t) => 0.1 + 0.004 * Math.sin(17 * t) + 0.002 * Math.cos(29 * t));
    const before = await rimDeviationMm(bumpy);
    const { buffer, info } = await smoothPlateRim(bumpy);
    const after = await rimDeviationMm(buffer);
    // Plus aucune bosse ne dépasse le cercle ; les creux, eux, sont conservés (choix assumé).
    expect(after.maxMm).toBeLessThanOrEqual(info.diameterCm * 5 + 0.3); // diamètre arrondi au mm
    expect(after.spreadMm).toBeLessThan(before.spreadMm * 0.6);
    expect(info.diameterCm).toBeGreaterThan(19);
    expect(info.diameterCm).toBeLessThan(20.5);
    // Le centre (le plat, plus haut que le rebord) n'a pas bougé.
    const doc = await new NodeIO().readBinary(new Uint8Array(buffer));
    const p = doc.getRoot().listMeshes()[0]!.listPrimitives()[0]!.getAttribute("POSITION")!.getArray()!;
    expect([p[0], p[1], p[2]]).toEqual([0, expect.closeTo(0.052, 5), 0]);
  });

  it("refuse une planche rectangulaire plutôt que de la déformer", async () => {
    const board = await plate((t) => 0.12 / Math.max(Math.abs(Math.cos(t)), Math.abs(Math.sin(t)) * 2));
    await expect(smoothPlateRim(board)).rejects.toBeInstanceOf(PlateRimError);
  });
});
