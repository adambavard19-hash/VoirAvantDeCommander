/**
 * Génère les modèles 3D de démonstration (GLB + USDZ) du restaurant fictif
 * « VoirAvantDeCommander — démo ». Ce sont des modèles procéduraux, stylisés,
 * qui servent de remplaçants honnêtes en attendant de vraies photogrammétries.
 *
 * Conventions : mètres, Y vers le haut, modèle centré en X/Z, point le plus bas
 * exactement à Y = 0 (le plat repose sur la table), servi sur son assiette ou sa
 * planche pour que l'emprise en réalité augmentée soit réaliste.
 *
 * Pas de texture image : uniquement des matériaux PBR unis, un matériau par
 * maillage (l'exporteur USDZ de three.js n'exploite pas les couleurs de sommets
 * dans le matériau UsdPreviewSurface : GLB et USDZ restent ainsi identiques).
 *
 * Usage :
 *   npx tsx scripts/generate-demo-models.ts            # génère + valide les 6 plats
 *   npx tsx scripts/generate-demo-models.ts --only=burger-signature,tiramisu
 *   npx tsx scripts/generate-demo-models.ts --check    # valide les fichiers existants
 *   npx tsx scripts/generate-demo-models.ts --out=/tmp/modeles   # écrit ailleurs (comparaison)
 */
import fs from "node:fs";
import path from "node:path";
import { strFromU8, unzipSync } from "fflate";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { USDZExporter } from "three/examples/jsm/exporters/USDZExporter.js";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { analyzeGlb } from "../src/lib/assets/glb";
import { analyzeUsdz } from "../src/lib/assets/usdz";

const ROOT = path.resolve(__dirname, "..");
let OUT_DIR = path.join(ROOT, "public", "demo", "models");

// ─── Polyfills Node (GLTFExporter en mode binaire utilise FileReader) ────────

function installPolyfills() {
  const g = globalThis as unknown as { FileReader?: unknown };
  if (typeof g.FileReader !== "undefined") return;
  class NodeFileReader {
    result: ArrayBuffer | string | null = null;
    onloadend: (() => void) | null = null;
    readAsArrayBuffer(blob: Blob) {
      void blob.arrayBuffer().then((buf) => {
        this.result = buf;
        this.onloadend?.();
      });
    }
    readAsDataURL(blob: Blob) {
      void blob.arrayBuffer().then((buf) => {
        this.result = `data:${blob.type || "application/octet-stream"};base64,${Buffer.from(buf).toString("base64")}`;
        this.onloadend?.();
      });
    }
  }
  g.FileReader = NodeFileReader;
}

// ─── Aléatoire et bruit (déterministes) ──────────────────────────────────────

type Rand = () => number;

function rng(seed: number): Rand {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const range = (r: Rand, a: number, b: number) => a + (b - a) * r();
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const TAU = Math.PI * 2;

/** Hachage pseudo-aléatoire d'une position (variation par triangle, stable). */
function hash3(x: number, y: number, z: number): number {
  const h = Math.sin(x * 12989.8 + y * 78233.1 + z * 37719.3) * 43758.5453;
  return h - Math.floor(h);
}

/** Bruit de Perlin « amélioré » 3D, permutation tirée d'une graine. */
class Noise {
  private readonly p = new Uint8Array(512);
  constructor(seed: number) {
    const r = rng(seed);
    const perm = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    for (let i = 0; i < 512; i++) this.p[i] = perm[i & 255];
  }
  private static fade(t: number) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  private static grad(h: number, x: number, y: number, z: number) {
    const k = h & 15;
    const u = k < 8 ? x : y;
    const v = k < 4 ? y : k === 12 || k === 14 ? x : z;
    return ((k & 1) === 0 ? u : -u) + ((k & 2) === 0 ? v : -v);
  }
  n3(x: number, y: number, z: number): number {
    const p = this.p;
    const fx = Math.floor(x),
      fy = Math.floor(y),
      fz = Math.floor(z);
    const X = fx & 255,
      Y = fy & 255,
      Z = fz & 255;
    x -= fx;
    y -= fy;
    z -= fz;
    const u = Noise.fade(x),
      v = Noise.fade(y),
      w = Noise.fade(z);
    const A = p[X] + Y,
      AA = p[A] + Z,
      AB = p[A + 1] + Z,
      B = p[X + 1] + Y,
      BA = p[B] + Z,
      BB = p[B + 1] + Z;
    const g = Noise.grad;
    return lerp(
      lerp(lerp(g(p[AA], x, y, z), g(p[BA], x - 1, y, z), u), lerp(g(p[AB], x, y - 1, z), g(p[BB], x - 1, y - 1, z), u), v),
      lerp(
        lerp(g(p[AA + 1], x, y, z - 1), g(p[BA + 1], x - 1, y, z - 1), u),
        lerp(g(p[AB + 1], x, y - 1, z - 1), g(p[BB + 1], x - 1, y - 1, z - 1), u),
        v,
      ),
      w,
    );
  }
  fbm(x: number, y: number, z: number, octaves = 4): number {
    let sum = 0,
      amp = 0.5,
      f = 1,
      norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * this.n3(x * f, y * f, z * f);
      norm += amp;
      amp *= 0.5;
      f *= 2.03;
    }
    return sum / norm;
  }
  /** Bruit périodique sur un angle (pas de couture à 0 / 2π). */
  ring(theta: number, freq: number, salt: number): number {
    return this.n3(Math.cos(theta) * freq + salt, Math.sin(theta) * freq - salt, salt * 1.7);
  }
}

// ─── Géométrie ───────────────────────────────────────────────────────────────

type V3 = THREE.Vector3;
type P2 = readonly [number, number];
type SurfaceFn = (u: number, v: number, out: V3) => void;
const UP = new THREE.Vector3(0, 1, 0);

/** Grille paramétrique (u, v) ∈ [0,1]², éventuellement refermée en u. */
function surface(nu: number, nv: number, f: SurfaceFn, wrapU = false): THREE.BufferGeometry {
  const cols = wrapU ? nu : nu + 1;
  const rows = nv + 1;
  const pos = new Float32Array(cols * rows * 3);
  const p = new THREE.Vector3();
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      p.set(0, 0, 0);
      f(i / nu, j / nv, p);
      const o = (j * cols + i) * 3;
      pos[o] = p.x;
      pos[o + 1] = p.y;
      pos[o + 2] = p.z;
    }
  const idx: number[] = [];
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const i1 = wrapU ? (i + 1) % cols : i + 1;
      const a = j * cols + i,
        b = j * cols + i1,
        c = (j + 1) * cols + i,
        d = (j + 1) * cols + i1;
      idx.push(a, c, b, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

function flipWinding(g: THREE.BufferGeometry) {
  const idx = g.index!;
  for (let t = 0; t < idx.count; t += 3) {
    const b = idx.getX(t + 1);
    idx.setX(t + 1, idx.getX(t + 2));
    idx.setX(t + 2, b);
  }
  idx.needsUpdate = true;
}

function signedVolume(g: THREE.BufferGeometry): number {
  const idx = g.index!;
  const pos = g.attributes.position;
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3();
  let vol = 0;
  for (let t = 0; t < idx.count; t += 3) {
    a.fromBufferAttribute(pos, idx.getX(t));
    b.fromBufferAttribute(pos, idx.getX(t + 1));
    c.fromBufferAttribute(pos, idx.getX(t + 2));
    vol += a.dot(b.cross(c));
  }
  return vol / 6;
}

/** Supprime les triangles dégénérés et les sommets inutilisés. */
function compact(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const idx = g.index!;
  const pos = g.attributes.position;
  const nor = g.attributes.normal as THREE.BufferAttribute | undefined;
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3();
  const keep: number[] = [];
  for (let t = 0; t < idx.count; t += 3) {
    const i0 = idx.getX(t),
      i1 = idx.getX(t + 1),
      i2 = idx.getX(t + 2);
    if (i0 === i1 || i1 === i2 || i0 === i2) continue;
    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, i1).sub(a);
    c.fromBufferAttribute(pos, i2).sub(a);
    if (b.cross(c).lengthSq() < 1e-22) continue;
    keep.push(i0, i1, i2);
  }
  return subset(pos as THREE.BufferAttribute, nor, keep);
}

function subset(pos: THREE.BufferAttribute, nor: THREE.BufferAttribute | undefined, tris: number[]): THREE.BufferGeometry {
  const remap = new Map<number, number>();
  const outIdx: number[] = [];
  const p: number[] = [];
  const n: number[] = [];
  for (const vi of tris) {
    let ni = remap.get(vi);
    if (ni === undefined) {
      ni = remap.size;
      remap.set(vi, ni);
      p.push(pos.getX(vi), pos.getY(vi), pos.getZ(vi));
      if (nor) n.push(nor.getX(vi), nor.getY(vi), nor.getZ(vi));
    }
    outIdx.push(ni);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  if (nor) g.setAttribute("normal", new THREE.Float32BufferAttribute(n, 3));
  g.setIndex(outIdx);
  return g;
}

/** Soude les sommets confondus (pôles, coutures), oriente vers l'extérieur, normales lisses. */
function finish(g: THREE.BufferGeometry, outward = false): THREE.BufferGeometry {
  for (const name of Object.keys(g.attributes)) if (name !== "position") g.deleteAttribute(name);
  let out = mergeVertices(g, 1e-7);
  if (!out.index) out = mergeVertices(out, 1e-7);
  out = compact(out);
  if (outward && signedVolume(out) < 0) flipWinding(out);
  out.computeVertexNormals();
  return out;
}

/** Déforme chaque sommet (p modifié sur place, n = normale courante), puis recalcule les normales. */
function deform(g: THREE.BufferGeometry, fn: (p: V3, n: V3) => void) {
  if (!g.attributes.normal) g.computeVertexNormals();
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const p = new THREE.Vector3(),
    n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nor, i);
    fn(p, n);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
}

/** Spline Catmull-Rom centripète : arrondit un profil de points de contrôle. */
function spline(points: P2[], perSeg = 3): P2[] {
  const curve = new THREE.CatmullRomCurve3(
    points.map(([x, y]) => new THREE.Vector3(x, y, 0)),
    false,
    "centripetal",
  );
  const out: P2[] = [];
  const segs = points.length - 1;
  for (let s = 0; s < segs; s++)
    for (let k = 0; k < perSeg; k++) {
      const p = curve.getPoint((s + k / perSeg) / segs);
      out.push([Math.max(0, p.x), p.y]);
    }
  const last = points[points.length - 1];
  out.push([last[0], last[1]]);
  return out;
}

/**
 * Révolution d'un profil (r, y) autour de Y, avec un contour éventuellement non
 * circulaire : outline(θ) multiplie le rayon (tomates lobées, rectangle arrondi…).
 * Le profil doit commencer et finir sur l'axe (r = 0) : le solide est fermé.
 */
function sweep(profile: P2[], segments: number, outline: (theta: number) => number = () => 1): THREE.BufferGeometry {
  const n = profile.length;
  const g = surface(
    segments,
    n - 1,
    (u, v, out) => {
      const th = u * TAU;
      const [r, y] = profile[Math.round(v * (n - 1))];
      const k = r === 0 ? 0 : r * outline(th);
      out.set(k * Math.cos(th), y, k * Math.sin(th));
    },
    true,
  );
  return finish(g, true);
}

/**
 * Feuille mince à épaisseur réelle (laitue, basilic, fromage fondu…) : la surface
 * supérieure f(u, v) est doublée vers le bas et bordée. Pas de matériau double face
 * (non pris en charge par l'export USDZ).
 */
function sheet(nu: number, nv: number, f: SurfaceFn, thickness: number, wrapU = false, up: V3 = UP): THREE.BufferGeometry {
  const top = surface(nu, nv, f, wrapU);
  top.computeVertexNormals();
  const tn = top.attributes.normal;
  const avg = new THREE.Vector3();
  for (let i = 0; i < tn.count; i++) avg.add(new THREE.Vector3(tn.getX(i), tn.getY(i), tn.getZ(i)));
  if (avg.dot(up) < 0) {
    flipWinding(top);
    top.computeVertexNormals();
  }
  const cols = wrapU ? nu : nu + 1;
  const rows = nv + 1;
  const count = cols * rows;
  const pos = top.attributes.position;
  const nor = top.attributes.normal;
  const out = new Float32Array(count * 6);
  const p = new THREE.Vector3(),
    n = new THREE.Vector3();
  const fallback = avg.clone().normalize();
  for (let i = 0; i < count; i++) {
    p.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nor, i);
    if (n.lengthSq() < 0.25) n.copy(fallback);
    out.set([p.x, p.y, p.z], i * 3);
    out.set([p.x - n.x * thickness, p.y - n.y * thickness, p.z - n.z * thickness], (count + i) * 3);
  }
  const topIdx = Array.from(top.index!.array as ArrayLike<number>);
  const idx: number[] = [...topIdx];
  for (let t = 0; t < topIdx.length; t += 3) idx.push(topIdx[t] + count, topIdx[t + 2] + count, topIdx[t + 1] + count);
  // Bordures : orientées vers l'extérieur (comparées à un sommet intérieur voisin).
  const P = (i: number) => new THREE.Vector3(out[i * 3], out[i * 3 + 1], out[i * 3 + 2]);
  const wall = (a: number, b: number, inner: number) => {
    const pa = P(a),
      pb = P(b),
      pa2 = P(a + count);
    const normal = pb.clone().sub(pa).cross(pa2.clone().sub(pa));
    const outward = pa.clone().add(pb).multiplyScalar(0.5).sub(P(inner));
    if (normal.dot(outward) >= 0) idx.push(a, b, a + count, b, b + count, a + count);
    else idx.push(a, a + count, b, b, a + count, b + count);
  };
  for (let i = 0; i < (wrapU ? nu : nu); i++) {
    const i1 = wrapU ? (i + 1) % cols : i + 1;
    wall(i, i1, cols + i);
    wall(nv * cols + i, nv * cols + i1, (nv - 1) * cols + i);
  }
  if (!wrapU)
    for (let j = 0; j < nv; j++) {
      wall(j * cols, (j + 1) * cols, j * cols + 1);
      wall(j * cols + nu, (j + 1) * cols + nu, j * cols + nu - 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(out, 3));
  g.setIndex(idx);
  return finish(g);
}

/** Sphère UV (pôles soudés), utile pour les petits éléments (sésame, grains…). */
function ellipsoid(rx: number, ry: number, rz: number, wSeg = 12, hSeg = 8): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, wSeg, hSeg);
  g.scale(rx, ry, rz);
  return finish(g, true);
}

function icoBlob(radius: number, detail: number): THREE.BufferGeometry {
  return finish(new THREE.IcosahedronGeometry(radius, detail), true);
}

/** Surface ouverte (sauce, goutte…) : retourne les triangles si elle regarde vers le bas. */
function orientUp(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const n = g.attributes.normal;
  let sy = 0;
  for (let i = 0; i < n.count; i++) sy += n.getY(i);
  if (sy < 0) {
    flipWinding(g);
    g.computeVertexNormals();
  }
  return g;
}

/** Sépare les groupes d'une géométrie extrudée (faces / chants), soudés séparément. */
function extrudeParts(g: THREE.BufferGeometry): THREE.BufferGeometry[] {
  const pos = g.attributes.position as THREE.BufferAttribute;
  return g.groups.map((grp) => {
    const tris = Array.from({ length: grp.count }, (_, i) => grp.start + i);
    return finish(subset(pos, undefined, tris));
  });
}

/** Répartit les triangles d'une géométrie entre plusieurs matériaux. */
function splitBy(g: THREE.BufferGeometry, assign: (c: V3, n: V3) => number): Map<number, THREE.BufferGeometry> {
  if (!g.attributes.normal) g.computeVertexNormals();
  const idx = g.index!;
  const pos = g.attributes.position as THREE.BufferAttribute;
  const nor = g.attributes.normal as THREE.BufferAttribute;
  const buckets = new Map<number, number[]>();
  const c = new THREE.Vector3(),
    n = new THREE.Vector3(),
    t = new THREE.Vector3();
  for (let i = 0; i < idx.count; i += 3) {
    c.set(0, 0, 0);
    n.set(0, 0, 0);
    for (let k = 0; k < 3; k++) {
      const vi = idx.getX(i + k);
      c.add(t.fromBufferAttribute(pos, vi));
      n.add(t.fromBufferAttribute(nor, vi));
    }
    c.multiplyScalar(1 / 3);
    n.normalize();
    const key = assign(c, n);
    let list = buckets.get(key);
    if (!list) buckets.set(key, (list = []));
    list.push(idx.getX(i), idx.getX(i + 1), idx.getX(i + 2));
  }
  const out = new Map<number, THREE.BufferGeometry>();
  for (const [k, tris] of buckets) out.set(k, subset(pos, nor, tris));
  return out;
}

/**
 * Découpe le maillage le long de l'iso-ligne field = t (« marching triangles ») :
 * les frontières entre matériaux suivent alors une courbe lisse au lieu des arêtes
 * des triangles (pas d'effet mosaïque). Les sommets créés sur la frontière sont
 * partagés : la surface reste continue et l'ombrage lisse.
 */
type Field = (p: V3, n: V3) => number;

function cut(g: THREE.BufferGeometry, field: Field, t: number): [THREE.BufferGeometry | null, THREE.BufferGeometry | null] {
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const idx = g.index!;
  const P: number[] = [];
  const Nm: number[] = [];
  const F: number[] = [];
  const p = new THREE.Vector3(),
    n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nor, i);
    P.push(p.x, p.y, p.z);
    Nm.push(n.x, n.y, n.z);
    const v = field(p, n) - t;
    F.push(v === 0 ? 1e-12 : v);
  }
  const cache = new Map<number, number>();
  const mid = (a: number, b: number) => {
    const key = a < b ? a * 4194304 + b : b * 4194304 + a;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    const s = F[a] / (F[a] - F[b]);
    const i = F.length;
    for (let k = 0; k < 3; k++) P.push(P[a * 3 + k] + (P[b * 3 + k] - P[a * 3 + k]) * s);
    n.set(
      Nm[a * 3] + (Nm[b * 3] - Nm[a * 3]) * s,
      Nm[a * 3 + 1] + (Nm[b * 3 + 1] - Nm[a * 3 + 1]) * s,
      Nm[a * 3 + 2] + (Nm[b * 3 + 2] - Nm[a * 3 + 2]) * s,
    ).normalize();
    Nm.push(n.x, n.y, n.z);
    F.push(0);
    cache.set(key, i);
    return i;
  };
  const lo: number[] = [],
    hi: number[] = [];
  for (let k = 0; k < idx.count; k += 3) {
    const a = idx.getX(k),
      b = idx.getX(k + 1),
      c = idx.getX(k + 2);
    const sa = F[a] > 0,
      sb = F[b] > 0,
      sc = F[c] > 0;
    if (sa === sb && sb === sc) {
      (sa ? hi : lo).push(a, b, c);
      continue;
    }
    const [x, y, z] = sa !== sb && sa !== sc ? [a, b, c] : sb !== sa && sb !== sc ? [b, c, a] : [c, a, b];
    const xy = mid(x, y),
      xz = mid(x, z);
    const loneHi = F[x] > 0;
    (loneHi ? hi : lo).push(x, xy, xz);
    (loneHi ? lo : hi).push(xy, y, z, xy, z, xz);
  }
  const posAttr = new THREE.Float32BufferAttribute(P, 3);
  const norAttr = new THREE.Float32BufferAttribute(Nm, 3);
  const make = (tris: number[]) => (tris.length ? compact(subset(posAttr, norAttr, tris)) : null);
  return [make(lo), make(hi)];
}

/**
 * Règle d'attribution des matériaux : un matériau, une fonction par triangle
 * (réservée aux mouchetures voulues : sucre glace, grains de vanille…), ou un champ
 * scalaire découpé en bandes par des seuils croissants (une sous-règle par bande).
 */
type Rule = Mat | ((c: V3, n: V3) => Mat) | { f: Field; t: number | number[]; bands: Rule[] };

function applyRule(d: Dish, tag: string, g: THREE.BufferGeometry, rule: Rule, matrix?: THREE.Matrix4) {
  if (rule instanceof THREE.Material) {
    d.add(tag, rule, g, matrix);
    return;
  }
  if (typeof rule === "function") {
    const list: Mat[] = [];
    const parts = splitBy(g, (c, n) => {
      const m = rule(c, n);
      let i = list.indexOf(m);
      if (i < 0) i = list.push(m) - 1;
      return i;
    });
    for (const [k, sub] of parts) d.add(tag, list[k], sub, matrix);
    return;
  }
  let rest: THREE.BufferGeometry | null = g;
  const ts = Array.isArray(rule.t) ? rule.t : [rule.t];
  ts.forEach((t, i) => {
    if (!rest) return;
    const [lo, hi] = cut(rest, rule.f, t);
    if (lo) applyRule(d, tag, lo, rule.bands[i], matrix);
    rest = hi;
  });
  if (rest) applyRule(d, tag, rest, rule.bands[ts.length], matrix);
}

/** Raccourci : deux bandes séparées par un seuil. */
const split2 = (f: Field, t: number, below: Rule, above: Rule): Rule => ({ f, t, bands: [below, above] });

function pose(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, s = 1): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, "YXZ")),
    new THREE.Vector3(s, s, s),
  );
}

/** Repère dont l'axe Y suit `normal` (objets posés sur une surface inclinée). */
function poseOnNormal(position: V3, normal: V3, yaw: number): THREE.Matrix4 {
  const q = new THREE.Quaternion().setFromUnitVectors(UP, normal.clone().normalize());
  q.multiply(new THREE.Quaternion().setFromAxisAngle(UP, yaw));
  return new THREE.Matrix4().compose(position, q, new THREE.Vector3(1, 1, 1));
}

// ─── Matériaux ───────────────────────────────────────────────────────────────

type Mat = THREE.MeshStandardMaterial;
type MatOpts = {
  roughness?: number;
  metalness?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  opacity?: number;
  ior?: number;
  emissive?: number;
};

/** Matériau PBR uni. Physique (vernis, transparence) seulement quand c'est utile. */
function mat(name: string, color: number, o: MatOpts = {}): Mat {
  const base = { name, color, roughness: o.roughness ?? 0.6, metalness: o.metalness ?? 0 };
  const physical = o.clearcoat !== undefined || o.opacity !== undefined || o.ior !== undefined;
  const m: Mat = physical
    ? new THREE.MeshPhysicalMaterial({
        ...base,
        clearcoat: o.clearcoat ?? 0,
        clearcoatRoughness: o.clearcoatRoughness ?? 0.15,
        ior: o.ior ?? 1.5,
      })
    : new THREE.MeshStandardMaterial(base);
  if (o.opacity !== undefined && o.opacity < 1) {
    m.transparent = true;
    m.opacity = o.opacity;
  }
  if (o.emissive !== undefined) m.emissive.setHex(o.emissive);
  return m;
}

/** Céramique blanche émaillée (assiettes). */
const ceramic = () => mat("porcelaine_blanche", 0xf3f1ec, { roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.06 });

// ─── Assemblage d'un plat ────────────────────────────────────────────────────

type Part = { tag: string; mat: Mat; geom: THREE.BufferGeometry };

/** Sonde de hauteur : lancer de rayon vertical sur des pièces déjà construites. */
class Probe {
  private static readonly material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  private readonly meshes: THREE.Mesh[];
  private readonly ray = new THREE.Raycaster();
  private readonly origin = new THREE.Vector3();
  private readonly down = new THREE.Vector3(0, -1, 0);
  constructor(geoms: THREE.BufferGeometry[]) {
    this.meshes = geoms.map((g) => {
      g.computeBoundingBox();
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, Probe.material);
      m.updateMatrixWorld(true);
      return m;
    });
  }
  hit(x: number, z: number): { point: V3; normal: V3 } | null {
    this.origin.set(x, 2, z);
    this.ray.set(this.origin, this.down);
    const hits = this.ray.intersectObjects(this.meshes, false);
    const h = hits[0];
    if (!h || !h.face) return null;
    const normal = h.face.normal.clone();
    if (normal.y < 0) normal.negate();
    return { point: h.point.clone(), normal };
  }
  y(x: number, z: number, fallback = 0): number {
    return this.hit(x, z)?.point.y ?? fallback;
  }
}

class Dish {
  readonly parts: Part[] = [];
  constructor(readonly id: string) {}

  add(tag: string, m: Mat, geom: THREE.BufferGeometry, matrix?: THREE.Matrix4) {
    const g = geom.clone();
    if (!g.attributes.normal) g.computeVertexNormals();
    if (matrix) g.applyMatrix4(matrix);
    for (const name of Object.keys(g.attributes)) if (name !== "position" && name !== "normal") g.deleteAttribute(name);
    this.parts.push({ tag, mat: m, geom: compact(g) });
  }

  addSplit(tag: string, geom: THREE.BufferGeometry, mats: Mat[], assign: (c: V3, n: V3) => number, matrix?: THREE.Matrix4) {
    for (const [k, g] of splitBy(geom, assign)) this.add(tag, mats[k], g, matrix);
  }

  private select(tags?: string[]) {
    return this.parts.filter((p) => !tags || tags.includes(p.tag));
  }

  probe(tags?: string[]): Probe {
    return new Probe(this.select(tags).map((p) => p.geom));
  }

  box(tags?: string[]): THREE.Box3 {
    const b = new THREE.Box3();
    for (const p of this.select(tags)) {
      p.geom.computeBoundingBox();
      b.union(p.geom.boundingBox!);
    }
    return b;
  }

  triangles(): number {
    return this.parts.reduce((s, p) => s + p.geom.index!.count / 3, 0);
  }

  breakdown(): string {
    const byTag = new Map<string, number>();
    for (const p of this.parts) byTag.set(p.tag, (byTag.get(p.tag) ?? 0) + p.geom.index!.count / 3);
    return [...byTag].map(([t, n]) => `${t} ${n}`).join(", ");
  }

  /** Fusionne par matériau, recentre (X/Z) et pose le plat sur Y = 0. */
  toGroup(): THREE.Group {
    const box = this.box();
    const center = box.getCenter(new THREE.Vector3());
    const shift = new THREE.Matrix4().makeTranslation(-center.x, -box.min.y, -center.z);
    const byMat = new Map<Mat, THREE.BufferGeometry[]>();
    for (const p of this.parts) {
      const list = byMat.get(p.mat) ?? [];
      list.push(p.geom);
      byMat.set(p.mat, list);
    }
    const group = new THREE.Group();
    group.name = this.id.replace(/-/g, "_");
    for (const [m, geoms] of byMat) {
      const merged = mergeGeometries(geoms, false);
      if (!merged) throw new Error(`Fusion impossible pour ${m.name}`);
      merged.applyMatrix4(shift);
      const mesh = new THREE.Mesh(merged, m);
      mesh.name = m.name;
      group.add(mesh);
    }
    group.userData = {
      generator: "VoirAvantDeCommander — scripts/generate-demo-models.ts",
      note: "Modèle procédural de démonstration (restaurant fictif), unités en mètres.",
    };
    return group;
  }
}

// ─── Vaisselle ───────────────────────────────────────────────────────────────

/** Assiette plate à aile (céramique blanche). Renvoie la hauteur du fond. */
function rimmedPlate(diameter: number): { geom: THREE.BufferGeometry; floorY: number; wellR: number } {
  const R = diameter / 2;
  const W = R * 0.68; // rayon du fond (marli à partir de là)
  const H = 0.021;
  const floorY = 0.0075;
  const foot = W * 0.7;
  const profile = spline(
    [
      [0, floorY],
      [W * 0.55, floorY],
      [W - 0.008, floorY + 0.0001],
      [W - 0.002, floorY + 0.001],
      [W + 0.004, floorY + 0.0042],
      [W + 0.011, floorY + 0.0082],
      [R - 0.016, H - 0.0018],
      [R - 0.005, H - 0.0002],
      [R - 0.0012, H],
      [R, H - 0.0014],
      [R - 0.0008, H - 0.0028],
      [R - 0.005, H - 0.0042],
      [R - 0.016, H - 0.0068],
      [W + 0.01, 0.0072],
      [W - 0.004, 0.0042],
      [foot + 0.004, 0.0031],
      [foot + 0.0012, 0.0004],
      [foot - 0.001, 0],
      [foot - 0.004, 0],
      [foot - 0.0055, 0.0005],
      [foot - 0.007, 0.0029],
      [foot * 0.5, 0.0034],
      [0, 0.0034],
    ],
    2,
  );
  return { geom: sweep(profile, 96), floorY, wellR: W };
}

/** Assiette creuse « coupe » sans aile (céramique blanche). */
function coupePlate(diameter: number): { geom: THREE.BufferGeometry; floorY: number; flatR: number } {
  const R = diameter / 2;
  const floorY = 0.0072;
  const flatR = R * 0.55;
  const foot = R * 0.46;
  const profile = spline(
    [
      [0, floorY],
      [flatR * 0.6, floorY],
      [flatR, floorY + 0.0003],
      [R * 0.74, floorY + 0.0032],
      [R * 0.88, floorY + 0.0085],
      [R * 0.96, floorY + 0.0135],
      [R - 0.0012, floorY + 0.0168],
      [R, floorY + 0.0156],
      [R - 0.0016, floorY + 0.0142],
      [R * 0.95, floorY + 0.0108],
      [R * 0.86, floorY + 0.0058],
      [R * 0.72, 0.0035],
      [foot + 0.004, 0.0028],
      [foot + 0.001, 0.0003],
      [foot - 0.002, 0],
      [foot - 0.005, 0],
      [foot - 0.0065, 0.0005],
      [foot - 0.008, 0.0027],
      [foot * 0.5, 0.0032],
      [0, 0.0032],
    ],
    2,
  );
  return { geom: sweep(profile, 96), floorY, flatR };
}

// ─── Éléments réutilisables ──────────────────────────────────────────────────

type LeafOpts = {
  length: number;
  width: number;
  /** Profondeur relative des dents (menthe). */
  serration?: number;
  teeth?: number;
  /** Bords relevés (creuse la feuille). */
  cup?: number;
  /** Courbure longitudinale (pointe et pétiole relevés). */
  curl?: number;
  /** Pli de la nervure centrale. */
  crease?: number;
  seed: number;
};

/** Forme locale d'une feuille : x le long de la nervure, z en travers, y vers le haut. */
function leafLocal(o: LeafOpts): SurfaceFn {
  const N = new Noise(o.seed);
  const halfW = o.width / 2;
  // Profil ovale pointu (basilic / menthe), largeur maximale vers 40 % de la longueur.
  const raw = (t: number) => Math.pow(t, 0.62) * Math.pow(1 - t, 0.95);
  let maxRaw = 0;
  for (let i = 0; i <= 100; i++) maxRaw = Math.max(maxRaw, raw(i / 100));
  return (u, v, out) => {
    const s = v * 2 - 1;
    let w = (raw(u) / maxRaw) * halfW;
    if (o.serration && o.teeth) {
      const tooth = (u * o.teeth) % 1;
      w *= 1 - o.serration * Math.pow(tooth, 1.6) * smoothstep(0.05, 0.25, u) * (1 - smoothstep(0.8, 0.98, u));
    }
    w *= 1 + 0.05 * N.n3(u * 4, s * 0.5, 0.3);
    const z = s * w;
    let y = (o.cup ?? 0.12) * Math.pow(Math.abs(s), 2) * w; // bords relevés
    y += (o.crease ?? 0.05) * Math.abs(s) * w * (1 - Math.abs(s)); // pli de nervure
    y += (o.curl ?? 0.1) * o.length * Math.pow(u - 0.4, 2);
    y += 0.0004 * N.n3(u * 6, s * 2, 1.7);
    out.set(u * o.length, y, z);
  };
}

/**
 * Pose une feuille sur les pièces existantes. « rigid » : la feuille garde sa forme
 * et repose sur le point le plus haut ; « drape » : elle épouse la surface (basilic
 * fané sur une pizza chaude).
 */
function placeLeaf(
  d: Dish,
  tag: string,
  m: Mat,
  o: LeafOpts,
  at: { x: number; z: number; yaw: number; pitch?: number },
  probe: Probe,
  mode: "rigid" | "drape" | "soft",
  clearance = 0.0006,
) {
  const local = leafLocal(o);
  const rot = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, at.yaw, at.pitch ?? 0, "YXZ"));
  const nu = 20,
    nv = 8;
  const tmp = new THREE.Vector3();
  const world = (u: number, v: number, out: V3) => {
    local(u, v, tmp);
    tmp.x -= o.length * 0.45;
    tmp.applyMatrix4(rot);
    out.set(tmp.x + at.x, tmp.y, tmp.z + at.z);
  };
  let lift = -Infinity;
  const supports = new Map<string, number>();
  for (let j = 0; j <= nv; j++)
    for (let i = 0; i <= nu; i++) {
      world(i / nu, j / nv, tmp);
      const s = probe.y(tmp.x, tmp.z, 0);
      supports.set(`${i},${j}`, s);
      lift = Math.max(lift, s + clearance - tmp.y);
    }
  const f: SurfaceFn = (u, v, out) => {
    world(u, v, out);
    const s = supports.get(`${Math.round(u * nu)},${Math.round(v * nv)}`) ?? 0;
    const rigidY = out.y + lift;
    const drapeY = s + clearance + out.y * 0.6;
    out.y = mode === "rigid" ? rigidY : mode === "drape" ? drapeY : Math.max(s + clearance, lerp(rigidY, drapeY, 0.7));
  };
  d.add(tag, m, sheet(nu, nv, f, 0.0005));
}

type TomatoVariety = { skin: Mat; flesh: Mat; gel: Mat; core: Mat; seed: Mat };

/**
 * Tranche de tomate (contour lobé), face supérieure découpée en peau, chair,
 * loges de gelée avec pépins, et cœur. Construite dans son repère (base à y = 0).
 */
function tomatoSlice(
  d: Dish,
  tag: string,
  v: TomatoVariety,
  o: { radius: number; thick: number; lobes: number; seed: number; segments?: number; rings?: number },
  matrix: THREE.Matrix4,
) {
  const N = new Noise(o.seed);
  const r = rng(o.seed + 1);
  const phase = range(r, 0, TAU);
  const R = o.radius,
    T = o.thick;
  const outline = (th: number) => 1 + 0.05 * Math.sin(o.lobes * th + phase) + 0.03 * N.ring(th, 1.3, 0.3);
  const rings = o.rings ?? 11;
  const prof: P2[] = [];
  for (let k = 0; k < rings; k++) prof.push([(R * 0.95 * k) / rings, T]);
  prof.push(
    ...spline(
      [
        [R * 0.95, T],
        [R * 0.985, T - 0.0004],
        [R, T - 0.0016],
        [R * 1.004, T * 0.5],
        [R, 0.0015],
        [R * 0.985, 0.0002],
        [R * 0.9, 0],
      ],
      2,
    ),
  );
  prof.push([0, 0]);
  const g = sweep(prof, o.segments ?? 72, outline);
  const lobeAngle = (k: number) => (Math.PI / 2 - phase) / o.lobes + (k * TAU) / o.lobes;
  /** Marge angulaire (rad) à l'intérieur d'une loge : > 0 dedans, continue. */
  const loculeField = (x: number, z: number) => {
    const th = Math.atan2(z, x);
    const s = Math.hypot(x, z) / (R * outline(th));
    let best = Infinity;
    for (let k = 0; k < o.lobes; k++) {
      const dth = Math.atan2(Math.sin(th - lobeAngle(k)), Math.cos(th - lobeAngle(k)));
      best = Math.min(best, Math.abs(dth));
    }
    const halfW = (0.36 * TAU) / o.lobes;
    const prof = Math.sqrt(Math.max(0, 1 - Math.pow((s - 0.56) / 0.28, 2)));
    return halfW * prof * (1 + 0.12 * N.n3(x * 180, z * 180, 2)) - best;
  };
  const locule = (x: number, z: number) => loculeField(x, z) > 0;
  deform(g, (p) => {
    if (p.y < T - 0.0002) return;
    p.y -= 0.0004 * smoothstep(-0.02, 0.06, loculeField(p.x, p.z));
    p.y += 0.00025 * N.n3(p.x * 500, p.z * 500, 4);
  });
  const radial = (c: V3) => Math.hypot(c.x, c.z) / (R * outline(Math.atan2(c.z, c.x)));
  const top = split2(
    radial,
    0.935,
    split2((c) => radial(c) - 0.03 * N.n3(c.x * 120, 1, c.z * 120), 0.16, v.core, split2((c) => loculeField(c.x, c.z), 0, v.flesh, v.gel)),
    v.skin,
  );
  applyRule(d, tag, g, { f: (_c, n) => n.y, t: [-0.5, 0.6], bands: [v.flesh, v.skin, top] }, matrix);
  // Pépins dans les loges.
  const seedGeom = ellipsoid(0.0016, 0.00045, 0.0011, 7, 4);
  for (let k = 0; k < o.lobes; k++) {
    for (let i = 0; i < 3; i++) {
      for (let tries = 0; tries < 12; tries++) {
        const th = lobeAngle(k) + range(r, -0.5, 0.5) * ((0.36 * TAU) / o.lobes);
        const s = range(r, 0.42, 0.7);
        const x = Math.cos(th) * s * R * outline(th),
          z = Math.sin(th) * s * R * outline(th);
        if (!locule(x, z)) continue;
        const m = pose(x, T - 0.00025, z, 0, th + range(r, -0.6, 0.6), 0);
        d.add(tag, v.seed, seedGeom, m.premultiply(matrix));
        break;
      }
    }
  }
}

/**
 * Plan d'appui : pose un disque de rayon `radius` (centré en x, z) sur les pièces
 * sondées, incliné selon la pente moyenne et au-dessus de tous les points d'appui.
 */
function restOn(probe: Probe, x: number, z: number, radius: number, yaw: number, maxTilt = 0.25): THREE.Matrix4 {
  const pts: [number, number, number][] = [];
  for (let k = 0; k <= 24; k++) {
    const rr = k === 0 ? 0 : radius * (k % 2 ? 0.92 : 0.6);
    const th = (k / 24) * TAU;
    const px = x + rr * Math.cos(th),
      pz = z + rr * Math.sin(th);
    pts.push([px - x, pz - z, probe.y(px, pz, 0)]);
  }
  // Moindres carrés : h = a + b·dx + c·dz.
  let sx = 0,
    sz = 0,
    sh = 0,
    sxx = 0,
    szz = 0,
    sxz = 0,
    sxh = 0,
    szh = 0;
  for (const [dx, dz, h] of pts) {
    sx += dx;
    sz += dz;
    sh += h;
    sxx += dx * dx;
    szz += dz * dz;
    sxz += dx * dz;
    sxh += dx * h;
    szh += dz * h;
  }
  const n = pts.length;
  const M = new THREE.Matrix3().set(n, sx, sz, sx, sxx, sxz, sz, sxz, szz);
  const sol = new THREE.Vector3(sh, sxh, szh).applyMatrix3(M.invert());
  const b = clamp(sol.y, -maxTilt, maxTilt),
    c = clamp(sol.z, -maxTilt, maxTilt);
  let a = -Infinity;
  for (const [dx, dz, h] of pts) a = Math.max(a, h - b * dx - c * dz);
  const normal = new THREE.Vector3(-b, 1, -c).normalize();
  return poseOnNormal(new THREE.Vector3(x, a + 0.0002, z), normal, yaw);
}

// ─── Plats ───────────────────────────────────────────────────────────────────

function buildBurger(): Dish {
  const d = new Dish("burger-signature");
  const N = new Noise(101);
  const N2 = new Noise(202);
  const r = rng(7);
  const STACK = ["bun", "patty", "cheese", "lettuce", "tomato", "onion"];

  const slate = mat("ardoise", 0x3a3e42, { roughness: 0.78 });
  const crustDark = mat("brioche_croute_foncee", 0x8f4615, { roughness: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.22 });
  const crust = mat("brioche_croute", 0xb7682a, { roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.25 });
  const crustPale = mat("brioche_flanc", 0xd29a52, { roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.35 });
  const crumb = mat("brioche_mie", 0xf0dbad, { roughness: 0.85 });
  const sesame = mat("sesame", 0xf2e4c0, { roughness: 0.5 });
  const beef = mat("boeuf_saisi", 0x4b2817, { roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.45 });
  const beefDark = mat("boeuf_grille", 0x29150c, { roughness: 0.65, clearcoat: 0.2, clearcoatRoughness: 0.5 });
  const beefLight = mat("boeuf_jus", 0x6b3a21, { roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.4 });
  const cheddar = mat("cheddar_fondu", 0xf2a01c, { roughness: 0.3, clearcoat: 0.4, clearcoatRoughness: 0.25 });
  const lettuce = mat("salade", 0x6aa82c, { roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.3 });
  const lettuceLight = mat("salade_claire", 0x9ccd4a, { roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.3 });
  const onion = mat("oignon_rouge", 0x86295a, { roughness: 0.32, clearcoat: 0.45 });
  const onionPale = mat("oignon_rouge_chair", 0xe9d3e2, { roughness: 0.38, clearcoat: 0.35 });
  const tomato: TomatoVariety = {
    skin: mat("tomate_peau", 0xc0200f, { roughness: 0.28, clearcoat: 0.6 }),
    flesh: mat("tomate_chair", 0xd8361f, { roughness: 0.45, clearcoat: 0.3 }),
    gel: mat("tomate_loges", 0xe8653a, { roughness: 0.15, clearcoat: 0.8 }),
    core: mat("tomate_coeur", 0xe98a63, { roughness: 0.4, clearcoat: 0.3 }),
    seed: mat("tomate_pepins", 0xead9a0, { roughness: 0.4 }),
  };

  // Planche en ardoise Ø 26 cm, bord légèrement irrégulier.
  const boardR = 0.13,
    boardT = 0.011;
  const board = sweep(
    spline(
      [
        [0, boardT],
        [boardR * 0.5, boardT],
        [boardR - 0.006, boardT],
        [boardR - 0.0015, boardT - 0.0005],
        [boardR, boardT - 0.003],
        [boardR, 0.003],
        [boardR - 0.0015, 0.0004],
        [boardR - 0.006, 0],
        [boardR * 0.5, 0],
        [0, 0],
      ],
      2,
    ),
    128,
    (th) => 1 + 0.008 * N.ring(th, 2.5, 0.5) + 0.004 * N.ring(th, 11, 1.5),
  );
  d.add("board", slate, board);
  const y0 = boardT;

  // Pain du bas (brioche).
  const bunR = 0.051;
  const bottomBun = sweep(
    spline(
      [
        [0, y0 + 0.0205],
        [bunR * 0.6, y0 + 0.0205],
        [bunR - 0.002, y0 + 0.0198],
        [bunR + 0.0006, y0 + 0.016],
        [bunR + 0.001, y0 + 0.009],
        [bunR - 0.001, y0 + 0.0035],
        [bunR - 0.006, y0 + 0.0004],
        [bunR - 0.014, y0],
        [0, y0],
      ],
      3,
    ),
    96,
    (th) => 1 + 0.012 * N.ring(th, 2, 3.3),
  );
  deform(bottomBun, (p, n) => p.addScaledVector(n, 0.0006 * N2.fbm(p.x * 90, p.y * 90, p.z * 90, 3)));
  applyRule(
    d,
    "bun",
    bottomBun,
    split2(
      (c) => c.y - 0.002 * N.n3(c.x * 200, 0, c.z * 200),
      y0 + 0.006,
      crust,
      split2((c, n) => Math.min(n.y - 0.75, (c.y - y0 - 0.017) * 100), 0, crustPale, crumb),
    ),
  );

  // Steak haché : bord irrégulier, surface grumeleuse, saisie variable.
  const yp = y0 + 0.0205,
    pR = 0.054,
    pH = 0.016;
  const patty = sweep(
    spline(
      [
        [0, yp + pH],
        [0.02, yp + pH],
        [0.035, yp + pH],
        [pR - 0.009, yp + pH - 0.0002],
        [pR - 0.004, yp + pH - 0.0012],
        [pR - 0.0008, yp + pH - 0.004],
        [pR, yp + pH * 0.5],
        [pR - 0.0008, yp + 0.004],
        [pR - 0.004, yp + 0.0012],
        [pR - 0.009, yp],
        [0, yp],
      ],
      3,
    ),
    100,
    (th) => 1 + 0.03 * N.ring(th, 1.6, 7.1) + 0.012 * N.ring(th, 7, 2.2),
  );
  deform(patty, (p, n) => {
    const craggy = 0.0011 * N.fbm(p.x * 260, p.y * 260, p.z * 260, 3) + 0.0005 * Math.abs(N2.n3(p.x * 700, p.y * 700, p.z * 700));
    p.addScaledVector(n, craggy);
  });
  applyRule(d, "patty", patty, {
    f: (c) => N2.n3(c.x * 85, c.y * 85, c.z * 85),
    t: [-0.22, 0.3],
    bands: [beefDark, beef, beefLight],
  });

  // Cheddar fondu : tranche carrée dont les coins coulent sur le bord du steak.
  const yc = yp + pH + 0.0012;
  const S = 0.094,
    rot = Math.PI / 4,
    Rc = pR - 0.0065,
    rho = 0.0085;
  const cheese = sheet(
    34,
    34,
    (u, v, out) => {
      const lx = (u - 0.5) * S,
        lz = (v - 0.5) * S;
      const x = lx * Math.cos(rot) - lz * Math.sin(rot),
        z = lx * Math.sin(rot) + lz * Math.cos(rot);
      const rr = Math.hypot(x, z) || 1e-9;
      let R2 = rr,
        y = yc + 0.0004 * N.n3(x * 180, 0.5, z * 180);
      if (rr > Rc) {
        const s = rr - Rc,
          a = s / rho;
        if (a <= Math.PI / 2) {
          R2 = Rc + rho * Math.sin(a);
          y = yc - rho * (1 - Math.cos(a));
        } else {
          R2 = Rc + rho + 0.0008 * (a - Math.PI / 2);
          y = yc - rho - (s - (rho * Math.PI) / 2);
        }
        y -= 0.001 * smoothstep(0, 0.015, s) * (1 + N.n3(x * 300, 2, z * 300));
      }
      out.set((x / rr) * R2, y, (z / rr) * R2);
    },
    0.0018,
  );
  d.add("cheese", cheddar, cheese);

  // Salade ondulée (anneau frisé qui déborde du pain).
  const cheeseProbe = d.probe(STACK);
  const yl = yc + 0.0024;
  const lettuceGeom = sheet(
    150,
    7,
    (u, v, out) => {
      const th = u * TAU;
      const Rl = 0.0525 + 0.003 * N.ring(th, 2, 3) + 0.0015 * N.ring(th, 6, 9);
      const rr = lerp(0.026, Rl, v);
      const s = v;
      const amp = 0.0042 * Math.pow(s, 1.7);
      const wave = Math.sin(15 * th + 2.6 * N.ring(th, 1.5, 7)) * (0.75 + 0.25 * N.ring(th, 4, 1));
      const rad = rr + 0.0016 * s * s * Math.cos(15 * th * 0.5 + 1);
      const x = Math.cos(th) * rad,
        z = Math.sin(th) * rad;
      let y = yl + amp * wave - 0.0012 * s * s + 0.0004 * N.n3(x * 300, 0, z * 300);
      y = Math.max(y, cheeseProbe.y(x, z, 0) + 0.0012);
      out.set(x, y, z);
    },
    0.0009,
    true,
  );
  applyRule(d, "lettuce", lettuceGeom, split2((c) => Math.hypot(c.x, c.z) - 0.004 * N.n3(c.x * 150, 3, c.z * 150), 0.05, lettuce, lettuceLight));

  // Tomates (2 tranches) posées sur la salade.
  let support = d.probe(STACK);
  const tomatoes: [number, number, number][] = [
    [-0.017, 0.007, 0.8],
    [0.019, -0.008, 2.4],
  ];
  for (const [i, [tx, tz, yaw]] of tomatoes.entries()) {
    const m = restOn(support, tx, tz, 0.032, yaw, 0.12);
    tomatoSlice(d, "tomato", tomato, { radius: 0.032, thick: 0.0062, lobes: 4, seed: 300 + i, segments: 44, rings: 6 }, m);
    support = d.probe(STACK);
  }

  // Oignon rouge : anneaux aplatis, peau violette à l'extérieur.
  const rings: [number, number, number][] = [
    [0.004, -0.006, 0.026],
    [-0.012, 0.012, 0.019],
    [0.022, 0.01, 0.031],
  ];
  for (const [ox, oz, rad] of rings) {
    const tube = 0.0021;
    const torus = finish(new THREE.TorusGeometry(rad, tube, 8, 56), true);
    torus.rotateX(Math.PI / 2);
    torus.scale(1, 0.6, 1);
    let top = 0;
    for (let k = 0; k < 24; k++) {
      const th = (k / 24) * TAU;
      top = Math.max(top, support.y(ox + rad * Math.cos(th), oz + rad * Math.sin(th), 0));
    }
    const m = pose(ox, top + tube * 0.6 - 0.0004, oz, 0, range(r, 0, TAU), 0);
    applyRule(d, "onion", torus, split2((c, n) => (n.x * c.x + n.z * c.z) / (Math.hypot(c.x, c.z) || 1), 0.35, onionPale, onion), m);
  }

  // Pain du haut : dôme brillant, dorure variable, graines de sésame.
  support = d.probe(STACK);
  let yt = 0;
  for (let k = 0; k < 60; k++) {
    const th = k * 2.39996,
      rr = 0.046 * Math.sqrt(k / 60);
    yt = Math.max(yt, support.y(rr * Math.cos(th), rr * Math.sin(th), 0));
  }
  yt += 0.0004;
  const topR = 0.053,
    Hd = 0.036,
    shoulder = 0.008;
  const dome: [number, number][] = [];
  for (let k = 0; k <= 24; k++) {
    const phi = (Math.PI / 2) * (1 - Math.pow(k / 24, 1.5));
    const h = (Hd - shoulder) * Math.sin(phi);
    const rr = topR * Math.pow(Math.cos(phi), 0.8);
    dome.push([rr, yt + shoulder + h]);
  }
  const topBun = sweep(
    [
      ...dome,
      ...spline(
        [
          [topR, yt + shoulder],
          [topR - 0.0007, yt + 0.004],
          [topR - 0.003, yt + 0.0012],
          [topR - 0.008, yt],
          [0.025, yt + 0.0003],
          [0, yt + 0.0005],
        ],
        2,
      ).slice(1),
    ],
    120,
    (th) => 1 + 0.012 * N.ring(th, 1.8, 4.4),
  );
  deform(topBun, (p, n) => p.addScaledVector(n, 0.0009 * N2.fbm(p.x * 70, p.y * 70, p.z * 70, 3)));
  topBun.applyMatrix4(new THREE.Matrix4().makeRotationX(0.03));
  const browning = (c: V3) => (c.y - yt) / Hd + 0.12 * N.fbm(c.x * 45, c.y * 45, c.z * 45, 3);
  applyRule(d, "topbun", topBun, split2((_c, n) => n.y, -0.4, crumb, { f: browning, t: [0.2, 0.74], bands: [crustPale, crust, crustDark] }));
  const bunProbe = d.probe(["topbun"]);
  const seedGeom = ellipsoid(0.0017, 0.00055, 0.00105, 8, 5);
  deform(seedGeom, (p) => {
    if (p.x > 0) p.z *= 1 - 0.35 * (p.x / 0.0017);
  });
  for (let i = 0; i < 64; i++) {
    const th = range(r, 0, TAU),
      rr = 0.043 * Math.sqrt(r());
    const h = bunProbe.hit(rr * Math.cos(th), rr * Math.sin(th));
    if (!h) continue;
    d.add("topbun", sesame, seedGeom, poseOnNormal(h.point.addScaledVector(h.normal, 0.0002), h.normal, range(r, 0, TAU)));
  }

  // Frites maison en petit tas, à droite de l'ardoise.
  const fry = mat("frites", 0xf2c870, { roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.45 });
  const fryDark = mat("frites_dorees", 0xd9a24a, { roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.45 });
  const pile = new THREE.Vector2(0.083, 0.03);
  const mainYaw = Math.atan2(pile.x, pile.y) + Math.PI / 2;
  let fryProbe = d.probe(["board"]);
  for (let i = 0; i < 24; i++) {
    const len = range(r, 0.05, 0.072);
    const g = fryGeometry(len, 0.0052 * range(r, 0.9, 1.08), N, i);
    for (let attempt = 0; attempt < 30; attempt++) {
      const yaw = mainYaw + range(r, -0.7, 0.7);
      const cx = pile.x + range(r, -0.032, 0.032),
        cz = pile.y + range(r, -0.026, 0.026);
      const ax = Math.sin(yaw),
        az = Math.cos(yaw);
      const ends = [-0.5, 0.5].map((t) => [cx + ax * t * len, cz + az * t * len]);
      if (ends.some(([x, z]) => Math.hypot(x, z) < 0.066 || Math.hypot(x, z) > 0.122)) continue;
      const m = restLine(fryProbe, cx, cz, yaw, len, 0.005, range(r, -0.4, 0.4));
      if (new THREE.Vector3().setFromMatrixPosition(m).y > boardT + 0.02) continue; // tas de 2 à 3 couches au plus
      applyRule(d, "fries", g, split2((c) => Math.abs(c.z) - 0.002 * N.n3(c.x * 400, i, c.y * 400), len / 2 - 0.005, fry, fryDark), m);
      fryProbe = d.probe(["board", "fries"]);
      break;
    }
  }
  return d;
}

/** Frite : bâtonnet à arêtes arrondies, légèrement courbé (axe long = Z local). */
function fryGeometry(len: number, half: number, N: Noise, seed: number): THREE.BufferGeometry {
  const g = finish(new THREE.BoxGeometry(half * 2, half * 2, len, 2, 2, 9), true);
  const rad = half * 0.32;
  const q = new THREE.Vector3();
  const lim = new THREE.Vector3(half - rad, half - rad, len / 2 - rad);
  deform(g, (p) => {
    q.set(clamp(p.x, -lim.x, lim.x), clamp(p.y, -lim.y, lim.y), clamp(p.z, -lim.z, lim.z));
    const dir = p.clone().sub(q);
    if (dir.lengthSq() > 0) p.copy(q).addScaledVector(dir.normalize(), rad);
    p.x += 0.0025 * Math.sin((p.z / len) * Math.PI + seed) * (0.5 + 0.5 * N.n3(seed, 0.3, 0.7));
    p.y += 0.0015 * Math.sin((p.z / len) * Math.PI * 1.3 + seed * 2);
    p.x += 0.00025 * N.n3(p.x * 500 + seed, p.y * 500, p.z * 500);
  });
  return g;
}

/** Pose un objet allongé (axe Z local, demi-épaisseur `half`) sur les pièces sondées. */
function restLine(probe: Probe, cx: number, cz: number, yaw: number, len: number, half: number, roll: number): THREE.Matrix4 {
  const ax = Math.sin(yaw),
    az = Math.cos(yaw);
  const samples: [number, number][] = [];
  for (let k = 0; k <= 8; k++) {
    const t = (k / 8 - 0.5) * len;
    samples.push([t, probe.y(cx + ax * t, cz + az * t, 0)]);
  }
  let st = 0,
    sh = 0,
    stt = 0,
    sth = 0;
  for (const [t, h] of samples) {
    st += t;
    sh += h;
    stt += t * t;
    sth += t * h;
  }
  const n = samples.length;
  const slope = clamp((n * sth - st * sh) / (n * stt - st * st), -0.45, 0.45);
  let y0 = -Infinity;
  for (const [t, h] of samples) y0 = Math.max(y0, h - slope * t);
  return pose(cx, y0 + half * 0.92, cz, -Math.atan(slope), yaw, roll);
}

function buildPizza(): Dish {
  const d = new Dish("pizza-margherita");
  const N = new Noise(501);
  const N2 = new Noise(502);
  const N3 = new Noise(503);
  const r = rng(55);

  const wood = mat("bois_planche", 0xc7ab8a, { roughness: 0.66 });
  const woodEdge = mat("bois_chant", 0xab8a68, { roughness: 0.68 });
  const doughPale = mat("pate_claire", 0xe6bf80, { roughness: 0.75 });
  const doughGold = mat("pate_doree", 0xd29a55, { roughness: 0.7 });
  const doughBrown = mat("pate_brune", 0xaa672c, { roughness: 0.68 });
  const doughChar = mat("pate_grillee", 0x3c2617, { roughness: 0.82 });
  const sauce = mat("sauce_tomate", 0xc0300a, { roughness: 0.72 });
  const sauceDark = mat("sauce_tomate_reduite", 0x9a2208, { roughness: 0.75 });
  const mozz = mat("mozzarella", 0xf5ecd5, { roughness: 0.3, clearcoat: 0.45, clearcoatRoughness: 0.2 });
  const mozzGold = mat("mozzarella_gratinee", 0xe8c98c, { roughness: 0.38, clearcoat: 0.3, clearcoatRoughness: 0.3 });
  const basil = mat("basilic", 0x2f6d1f, { roughness: 0.3, clearcoat: 0.55, clearcoatRoughness: 0.2 });
  const flour = mat("farine", 0xf1e7d2, { roughness: 0.95 });

  // Planche ronde Ø 34 cm avec poignée percée (extrusion biseautée).
  const bevel = 0.0025;
  const R = 0.17 - bevel,
    hw = 0.03,
    handleEnd = 0.17 + 0.105,
    endR = 0.022;
  const a = Math.asin(hw / R) + 0.09;
  const J = new THREE.Vector2(Math.sqrt(R * R - hw * hw), hw);
  const E = new THREE.Vector2(handleEnd - bevel - endR, endR);
  const along = E.clone().sub(J).normalize().multiplyScalar(0.016);
  const shape = new THREE.Shape();
  shape.absarc(0, 0, R, a, TAU - a, false);
  shape.quadraticCurveTo(J.x, -J.y, J.x + along.x, -J.y - along.y);
  shape.lineTo(E.x, -E.y);
  shape.absarc(E.x, 0, endR, -Math.PI / 2, Math.PI / 2, false);
  shape.lineTo(J.x + along.x, J.y + along.y);
  shape.quadraticCurveTo(J.x, J.y, R * Math.cos(a), R * Math.sin(a));
  const hole = new THREE.Path();
  hole.absarc(E.x - 0.002, 0, 0.0075, 0, TAU, true);
  shape.holes.push(hole);
  const boardGeom = new THREE.ExtrudeGeometry(shape, {
    depth: 0.015,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 48,
  });
  boardGeom.rotateX(-Math.PI / 2);
  boardGeom.computeBoundingBox();
  boardGeom.translate(0, -boardGeom.boundingBox!.min.y, 0);
  const [caps, sides] = extrudeParts(boardGeom);
  d.add("board", wood, caps);
  d.add("board", woodEdge, sides);
  const yB = 0.015 + 2 * bevel;

  // Corniche gonflée et irrégulière.
  const Rc = (th: number) => 0.1335 + 0.0025 * N.ring(th, 1.5, 1) + 0.0012 * N.ring(th, 5, 2);
  const A = (th: number) => 0.0125 * (1 + 0.16 * N.ring(th, 2.2, 3) + 0.08 * N.ring(th, 7, 4));
  const B = (th: number) => 0.0165 * (1 + 0.22 * N.ring(th, 1.8, 5) + 0.1 * N.ring(th, 6, 6));
  let crust = surface(
    288,
    30,
    (u, v, out) => {
      const th = u * TAU,
        phi = v * TAU;
      const s = Math.sin(phi);
      const cy = s >= 0 ? B(th) * Math.pow(s, 0.8) : 0.05 * B(th) * s;
      const rad = Rc(th) + A(th) * Math.cos(phi);
      out.set(rad * Math.cos(th), yB + 0.0012 + cy, rad * Math.sin(th));
    },
    true,
  );
  crust = finish(crust, true);
  deform(crust, (p, n) => {
    const up = Math.max(0, n.y);
    const bubble = Math.max(0, N2.n3(p.x * 70, p.y * 70, p.z * 70) - 0.12) * 0.0065 * (0.35 + up);
    p.addScaledVector(n, bubble + 0.0007 * N.fbm(p.x * 220, p.y * 220, p.z * 220, 3));
  });
  // Dorure progressive (plus foncée sur le dessus des bulles) et taches de « léopard ».
  const browning: Field = (c, n) => 0.55 * ((c.y - yB) / 0.02) + 0.3 * n.y + 0.4 * N3.fbm(c.x * 80, c.y * 80, c.z * 80, 3);
  const leopard: Field = (c, n) => Math.min(N3.n3(c.x * 130, c.y * 130, c.z * 130) - 0.47, n.y - 0.4, (c.y - yB) / 0.02 - 0.6);
  applyRule(d, "pizza", crust, split2(leopard, 0, { f: browning, t: [0.36, 0.66], bands: [doughPale, doughGold, doughBrown] }, doughChar));

  // Sauce tomate (bord glissé sous la corniche).
  const sauceY = (x: number, z: number) => yB + 0.0045 + 0.0006 * N.n3(x * 60, 9, z * 60) + 0.0003 * N2.n3(x * 200, 1, z * 200);
  const sauceGeom = orientUp(
    finish(
      surface(
        150,
        20,
        (u, v, out) => {
          const th = u * TAU;
          const rr = (Rc(th) - 0.5 * A(th)) * v;
          const x = rr * Math.cos(th),
            z = rr * Math.sin(th);
          out.set(x, sauceY(x, z) + 0.0025 * Math.pow(v, 8), z);
        },
        true,
      ),
    ),
  );
  applyRule(d, "sauce", sauceGeom, split2((c) => N2.n3(c.x * 70, 4, c.z * 70) + 0.25 * N.n3(c.x * 220, 2, c.z * 220), 0.32, sauce, sauceDark));

  // Mozzarella fondue : flaques irrégulières.
  type Blob = { x: number; z: number; R: number; H: number; outline: (th: number) => number };
  const blobs: Blob[] = [];
  for (let tries = 0; blobs.length < 7 && tries < 800; tries++) {
    const rr = 0.088 * Math.sqrt(r()),
      th = r() * TAU;
    const x = rr * Math.cos(th),
      z = rr * Math.sin(th);
    if (blobs.some((b) => Math.hypot(b.x - x, b.z - z) < 0.06)) continue;
    const seed = blobs.length * 3.7;
    blobs.push({
      x,
      z,
      R: range(r, 0.025, 0.032),
      H: range(r, 0.0026, 0.0036),
      outline: (t) => 1 + 0.24 * N3.ring(t, 1.1, seed) + 0.09 * N3.ring(t, 3.5, seed + 1) + 0.03 * N3.ring(t, 9, seed + 2),
    });
  }
  for (const b of blobs) {
    const g = orientUp(
      finish(
        surface(
          56,
          9,
          (u, v, out) => {
            const th = u * TAU;
            const rr = v * b.R * b.outline(th);
            const x = b.x + rr * Math.cos(th),
              z = b.z + rr * Math.sin(th);
            const h = b.H * Math.pow(Math.max(0, 1 - Math.pow(v, 3.2)), 0.55) - 0.0008 * Math.pow(v, 4);
            out.set(x, sauceY(x, z) + h + 0.00025 * N.n3(x * 400, 3, z * 400), z);
          },
          true,
        ),
      ),
    );
    const inner = (c: V3) => 0.8 - Math.hypot(c.x - b.x, c.z - b.z) / (b.R * b.outline(Math.atan2(c.z - b.z, c.x - b.x)));
    applyRule(d, "mozz", g, split2((c) => Math.min(N2.n3(c.x * 90, 7, c.z * 90) - 0.3, inner(c)), 0, mozz, mozzGold));
  }

  // Basilic frais, légèrement fané par la chaleur.
  const top = d.probe(["sauce", "mozz"]);
  const leaves = [
    { x: -0.035, z: -0.02, yaw: 0.6, length: 0.056 },
    { x: 0.04, z: 0.03, yaw: 2.4, length: 0.05 },
    { x: 0.005, z: 0.065, yaw: -1.2, length: 0.046 },
    { x: -0.07, z: 0.045, yaw: 1.9, length: 0.052 },
    { x: 0.075, z: -0.04, yaw: -2.6, length: 0.048 },
    { x: -0.01, z: -0.075, yaw: 0.2, length: 0.044 },
  ];
  for (const [i, l] of leaves.entries()) {
    placeLeaf(
      d,
      "basil",
      basil,
      { length: l.length, width: l.length * 0.56, cup: 0.18, curl: 0.08, crease: 0.08, seed: 520 + i },
      { x: l.x, z: l.z, yaw: l.yaw },
      top,
      "drape",
      0.0009,
    );
  }

  // Quelques traces de semoule / farine sur la planche.
  const fleck = icoBlob(1, 0);
  for (let i = 0; i < 40; i++) {
    const th = r() * TAU,
      rr = range(r, 0.153, 0.165);
    const s = range(r, 0.0005, 0.001);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(rr * Math.cos(th), yB + 0.0001, rr * Math.sin(th)),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * TAU, 0)),
      new THREE.Vector3(s, s * 0.25, s * 0.8),
    );
    d.add("board", flour, fleck, m);
  }
  return d;
}

/** Framboise : drupéoles autour d'un cœur, cavité du pédoncule en haut (repère local). */
function raspberry(drupe: Mat, core: Mat, seed: number): Part[] {
  const out: Part[] = [];
  const R = 0.0088,
    Hr = 0.0102;
  const coreGeom = ellipsoid(R * 0.85, Hr * 0.88, R * 0.85, 16, 12);
  deform(coreGeom, (p) => {
    if (p.y > 0) p.y -= 0.004 * Math.exp(-(p.x * p.x + p.z * p.z) / (0.004 * 0.004));
  });
  out.push({ tag: "rasp", mat: core, geom: coreGeom });
  const r = rng(seed);
  const n = 50;
  const dr = icoBlob(0.0031, 1);
  dr.scale(1, 1.12, 1);
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    if (y > 0.8) continue;
    const rad = Math.sqrt(1 - y * y);
    const th = i * 2.39996 + seed;
    const dir = new THREE.Vector3(rad * Math.cos(th), y, rad * Math.sin(th));
    const p = new THREE.Vector3(dir.x * R * (1 + 0.12 * y), dir.y * Hr, dir.z * R * (1 + 0.12 * y));
    const s = 0.9 + 0.2 * r();
    const m = poseOnNormal(p, dir, r() * TAU).multiply(new THREE.Matrix4().makeScale(s, s, s));
    const g = dr.clone().applyMatrix4(m);
    out.push({ tag: "rasp", mat: drupe, geom: g });
  }
  return out;
}

function addParts(d: Dish, parts: Part[], matrix: THREE.Matrix4, tag: string) {
  for (const p of parts) d.add(tag, p.mat, p.geom, matrix);
}

/** Pose un ensemble de pièces locales (orientation donnée) avec son point bas sur `floorY`. */
function dropParts(parts: Part[], x: number, z: number, floorY: number, rot: THREE.Euler): THREE.Matrix4 {
  const q = new THREE.Quaternion().setFromEuler(rot);
  const rotM = new THREE.Matrix4().makeRotationFromQuaternion(q);
  const b = new THREE.Box3();
  for (const p of parts) {
    const g = p.geom.clone().applyMatrix4(rotM);
    g.computeBoundingBox();
    b.union(g.boundingBox!);
  }
  return new THREE.Matrix4().makeTranslation(x, floorY - b.min.y, z).multiply(rotM);
}

function coffeeBean(): THREE.BufferGeometry {
  const g = ellipsoid(0.0062, 0.0034, 0.0046, 20, 14);
  deform(g, (p) => {
    if (p.y < 0) p.y *= 0.3; // face plate
    const groove = 0.0012 * Math.exp(-Math.pow((p.z - 0.0005 * Math.sin((p.x / 0.0062) * Math.PI)) / 0.00065, 2)) * (1 - Math.pow(p.x / 0.0064, 2));
    if (p.y < 0.0002) p.y += groove * 0.9;
  });
  return g;
}

function buildFondant(): Dish {
  const d = new Dish("fondant-chocolat");
  const N = new Noise(601);
  const N2 = new Noise(602);
  const N3 = new Noise(603);
  const N4 = new Noise(604);
  const r = rng(66);

  const cake = mat("fondant_croute", 0x3b2115, { roughness: 0.74 });
  const cakeTop = mat("fondant_dessus", 0x4a2a1a, { roughness: 0.68 });
  const molten = mat("chocolat_coulant", 0x241007, { roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 });
  const sugar = mat("sucre_glace", 0xf8f6f1, { roughness: 0.95 });
  const vanilla = mat("glace_vanille", 0xf8eed6, { roughness: 0.48, clearcoat: 0.2, clearcoatRoughness: 0.4 });
  const vanillaSpeck = mat("vanille_grains", 0x3a2a1c, { roughness: 0.6 });
  const rasp = mat("framboise", 0xb2112f, { roughness: 0.26, clearcoat: 0.7, clearcoatRoughness: 0.2 });
  const raspCore = mat("framboise_coeur", 0x6d0a1d, { roughness: 0.5 });
  const mint = mat("menthe", 0x3e902a, { roughness: 0.36, clearcoat: 0.45, clearcoatRoughness: 0.25 });
  const crumble = mat("crumble", 0xb37a3c, { roughness: 0.82 });
  const coulis = mat("coulis_framboise", 0x980c24, { roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03 });

  const plate = rimmedPlate(0.22);
  d.add("plate", ceramic(), plate.geom);
  const yF = plate.floorY;

  // Fondant Ø 8 cm × 5 cm, dessus bombé et craquelé, voile de sucre glace.
  const Rb = 0.04,
    Rt = 0.0386,
    H = 0.0485,
    dome = 0.0035;
  const prof: P2[] = [];
  for (let k = 0; k < 24; k++) {
    const s = k / 24;
    prof.push([s * (Rt - 0.006), yF + H + dome * (1 - s * s)]);
  }
  prof.push(
    ...spline(
      [
        [Rt - 0.006, yF + H],
        [Rt - 0.0022, yF + H - 0.0012],
        [Rt - 0.0002, yF + H - 0.0048],
        [Rt + 0.0006, yF + H - 0.013],
        [Rt + 0.0009, yF + 0.03],
        [Rb - 0.0002, yF + 0.017],
        [Rb, yF + 0.006],
        [Rb - 0.0012, yF + 0.0007],
        [Rb - 0.005, yF],
        [0, yF],
      ],
      3,
    ),
  );
  const cakeGeom = sweep(prof, 160, (th) => 1 + 0.008 * N.ring(th, 2, 1));
  const crackAt = (x: number, z: number) => {
    const wx = x + 0.006 * N2.n3(x * 50, 1.3, z * 50),
      wz = z + 0.006 * N2.n3(x * 50, 4.1, z * 50);
    const v = 1 - Math.abs(N3.n3(wx * 40, 0.7, wz * 40));
    return smoothstep(0.925, 0.985, v) * (1 - smoothstep(0.55, 0.85, Math.hypot(x, z) / Rt));
  };
  deform(cakeGeom, (p, n) => {
    if (p.y > yF + H - 0.003 && n.y > 0.6) {
      p.y -= crackAt(p.x, p.z) * 0.0036;
      p.y += 0.0005 * N.n3(p.x * 150, 2, p.z * 150);
    } else p.addScaledVector(n, 0.00055 * N2.fbm(p.x * 210, p.y * 210, p.z * 210, 3));
  });
  const cakeAt = new THREE.Vector2(-0.02, -0.014);
  // Dessus : fissures nettes (découpe sur iso-ligne), voile de sucre glace moucheté.
  const dusting = (c: V3) => {
    const density = 0.92 * (1 - Math.pow(Math.hypot(c.x, c.z) / Rt, 3)) + 0.18 * N4.n3(c.x * 90, 0.2, c.z * 90);
    return hash3(c.x, c.y, c.z) < density ? sugar : cakeTop;
  };
  const sides = (c: V3, n: V3) => (n.y > 0.3 && c.y > yF + H - 0.008 && hash3(c.x, c.y, c.z) < 0.12 ? sugar : cake);
  applyRule(
    d,
    "cake",
    cakeGeom,
    split2((c, n) => Math.min(n.y - 0.45, (c.y - (yF + H - 0.007)) * 50), 0, sides, split2((c) => crackAt(c.x, c.z), 0.3, dusting, molten)),
    pose(cakeAt.x, 0, cakeAt.y),
  );

  // Lit de crumble, quenelle de glace vanille (grains de vanille), menthe.
  const qAt = new THREE.Vector2(0.038, 0.024);
  const qDir = new THREE.Vector2(0.6, 0.8);
  const qYaw = -Math.atan2(qDir.y, qDir.x);
  const crumbGeom = icoBlob(1, 1);
  for (let i = 0; i < 16; i++) {
    const t = range(r, -0.5, 0.5),
      off = range(r, -1, 1);
    const x = qAt.x + qDir.x * t * 0.05 + -qDir.y * off * 0.012;
    const z = qAt.y + qDir.y * t * 0.05 + qDir.x * off * 0.012;
    const s = range(r, 0.0018, 0.0034);
    const g = crumbGeom.clone();
    const seed = i * 1.37;
    deform(g, (p) => p.multiplyScalar(1 + 0.25 * N.n3(p.x * 2 + seed, p.y * 2, p.z * 2)));
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, yF + s * 0.55, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3)),
      new THREE.Vector3(s, s * 0.75, s * 0.9),
    );
    d.add("crumble", crumble, g, m);
  }
  const L = 0.056,
    Wq = 0.033,
    Hq = 0.026;
  let quenelle = surface(
    60,
    40,
    (u, v, out) => {
      const psi = u * TAU;
      const prof2 = Math.pow(Math.max(0, 1 - Math.pow(2 * v - 1, 2)), 0.6);
      const tri = 1 + 0.07 * Math.cos(3 * psi + 0.5);
      let y = Math.sin(psi) * (Hq / 2) * prof2 * tri;
      const z = Math.cos(psi) * (Wq / 2) * prof2 * tri * (1 + 0.06 * (v - 0.5));
      const base = -Hq * 0.36;
      if (y < base) y = base + (y - base) * 0.15;
      out.set((v - 0.5) * L, y, z);
    },
    true,
  );
  quenelle = finish(quenelle, true);
  deform(quenelle, (p, n) => p.addScaledVector(n, 0.0004 * N2.fbm(p.x * 120, p.y * 120, p.z * 120, 3)));
  quenelle.computeBoundingBox();
  const qLift = yF + 0.0028 - quenelle.boundingBox!.min.y;
  d.add("quenelle", vanilla, quenelle, pose(qAt.x, qLift, qAt.y, 0, qYaw, 0));
  const qProbe = d.probe(["quenelle"]);
  // Grains de vanille : minuscules paillettes posées sur la glace.
  const fleck = ellipsoid(0.00055, 0.00012, 0.0003, 6, 4);
  for (let i = 0; i < 70; i++) {
    const t = range(r, -0.42, 0.42) * L,
      w = range(r, -0.42, 0.42) * Wq;
    const h = qProbe.hit(qAt.x + qDir.x * t - qDir.y * w, qAt.y + qDir.y * t + qDir.x * w);
    if (h) d.add("quenelle", vanillaSpeck, fleck, poseOnNormal(h.point.addScaledVector(h.normal, 0.00002), h.normal, r() * TAU));
  }
  for (const [i, l] of [
    { dx: -0.004, dz: 0.002, yaw: qYaw + 0.9, len: 0.026 },
    { dx: 0.005, dz: -0.003, yaw: qYaw - 2.0, len: 0.022 },
  ].entries())
    placeLeaf(
      d,
      "mint",
      mint,
      { length: l.len, width: l.len * 0.62, serration: 0.1, teeth: 9, cup: 0.22, curl: 0.18, crease: 0.12, seed: 640 + i },
      { x: qAt.x + l.dx, z: qAt.y + l.dz, yaw: l.yaw, pitch: 0.12 },
      qProbe,
      "rigid",
      0.0004,
    );

  // Framboises sur l'assiette.
  const berries: [number, number, THREE.Euler][] = [
    [-0.05, 0.036, new THREE.Euler(1.5, 0.4, 0.2)],
    [-0.03, 0.054, new THREE.Euler(0.15, 1.1, 0)],
    [-0.006, 0.061, new THREE.Euler(1.3, -0.8, 0.4)],
    [-0.068, 0.02, new THREE.Euler(Math.PI, 0.5, 0.2)],
  ];
  for (const [i, [x, z, e]] of berries.entries()) {
    const parts = raspberry(rasp, raspCore, 650 + i);
    addParts(d, parts, dropParts(parts, x, z, yF, e), "rasp");
  }
  // Points de coulis de framboise.
  for (let i = 0; i < 5; i++) {
    const th = -0.25 - i * 0.24,
      rr = 0.059;
    const cx = rr * Math.cos(th),
      cz = rr * Math.sin(th);
    const R2 = 0.0055 - i * 0.0007,
      Hd = 0.0022 - i * 0.0002;
    const g = orientUp(
      finish(
        surface(
          28,
          5,
          (u, v, out) => {
            const t = u * TAU;
            const rr2 = v * R2 * (1 + 0.04 * N.ring(t, 1, i));
            out.set(cx + rr2 * Math.cos(t), yF + Hd * Math.pow(Math.max(0, 1 - v * v), 0.45) - 0.0002, cz + rr2 * Math.sin(t));
          },
          true,
        ),
      ),
    );
    d.add("coulis", coulis, g);
  }
  return d;
}

function buildBurrata(): Dish {
  const d = new Dish("burrata-tomates");
  const N = new Noise(701);
  const N2 = new Noise(702);
  const N3 = new Noise(703);
  const r = rng(77);

  const plate = coupePlate(0.26);
  d.add("plate", ceramic(), plate.geom);
  const skin = mat("burrata_peau", 0xf8f4ec, { roughness: 0.2, clearcoat: 0.6, clearcoatRoughness: 0.15 });
  const stracc = mat("stracciatella", 0xfdf7ec, { roughness: 0.36, clearcoat: 0.45, clearcoatRoughness: 0.25 });
  const basil = mat("basilic", 0x2e6a1e, { roughness: 0.3, clearcoat: 0.55, clearcoatRoughness: 0.2 });
  const oil = mat("huile_olive", 0xb59b1d, { roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, opacity: 0.72 });
  const pepper = mat("poivre_concasse", 0x2a221d, { roughness: 0.7 });
  const salt = mat("fleur_de_sel", 0xf6f6f2, { roughness: 0.3 });
  const seedMat = mat("tomate_pepins", 0xe9dca3, { roughness: 0.4 });
  const varieties: TomatoVariety[] = [
    {
      skin: mat("tomate_rouge_peau", 0xbf1f12, { roughness: 0.28, clearcoat: 0.6 }),
      flesh: mat("tomate_rouge_chair", 0xd6361f, { roughness: 0.45, clearcoat: 0.3 }),
      gel: mat("tomate_rouge_loges", 0xe8653a, { roughness: 0.14, clearcoat: 0.8 }),
      core: mat("tomate_rouge_coeur", 0xe88d68, { roughness: 0.4, clearcoat: 0.3 }),
      seed: seedMat,
    },
    {
      skin: mat("tomate_jaune_peau", 0xe0a10c, { roughness: 0.28, clearcoat: 0.6 }),
      flesh: mat("tomate_jaune_chair", 0xf0b42c, { roughness: 0.45, clearcoat: 0.3 }),
      gel: mat("tomate_jaune_loges", 0xf6cd57, { roughness: 0.14, clearcoat: 0.8 }),
      core: mat("tomate_jaune_coeur", 0xf5d886, { roughness: 0.4, clearcoat: 0.3 }),
      seed: seedMat,
    },
    {
      skin: mat("tomate_noire_peau", 0x6b2a1d, { roughness: 0.3, clearcoat: 0.6 }),
      flesh: mat("tomate_noire_chair", 0x93342a, { roughness: 0.45, clearcoat: 0.3 }),
      gel: mat("tomate_noire_loges", 0xb3543a, { roughness: 0.14, clearcoat: 0.8 }),
      core: mat("tomate_noire_coeur", 0xbc6d55, { roughness: 0.4, clearcoat: 0.3 }),
      seed: seedMat,
    },
  ];

  // Couronne de tranches de tomates anciennes qui se chevauchent.
  let support = d.probe(["plate"]);
  const order = [0, 1, 0, 2, 1, 0, 1];
  for (let i = 0; i < order.length; i++) {
    const th = (i / order.length) * TAU + 0.35;
    const rr = 0.056 + range(r, -0.003, 0.003);
    const radius = range(r, 0.031, 0.036);
    const m = restOn(support, rr * Math.cos(th), rr * Math.sin(th), radius, r() * TAU, 0.3);
    tomatoSlice(d, "tomato", varieties[order[i]], { radius, thick: 0.0075, lobes: 5 + (i % 2), seed: 710 + i, segments: 48, rings: 10 }, m);
    support = d.probe(["plate", "tomato"]);
  }

  // Burrata Ø 9 cm : poche nouée en haut, déchirée sur l'avant, stracciatella qui s'écoule.
  const Rb = 0.045;
  const tear = new THREE.Vector3(0.05, 0.42, 0.9).normalize();
  let body = surface(
    96,
    60,
    (u, v, out) => {
      const th = u * TAU,
        ph = v * Math.PI;
      let rad = Rb * (1 + 0.07 * (ph / Math.PI));
      let y = Math.cos(ph) * Rb * 0.76;
      const k = smoothstep(0.42, 0, ph);
      rad *= 1 - 0.5 * k * k;
      y += 0.006 * k * k;
      rad *= 1 + 0.05 * smoothstep(0.8, 0.12, ph) * Math.sin(9 * th + 2 * N.ring(th, 1, 2));
      const floor = -Rb * 0.76 * 0.6;
      if (y < floor) y = floor + (y - floor) * 0.12;
      out.set(Math.sin(ph) * rad * Math.cos(th), y, Math.sin(ph) * rad * Math.sin(th));
    },
    true,
  );
  body = finish(body, true);
  const opening = (dir: V3) => 1 - dir.angleTo(tear) / (0.6 + 0.14 * N2.n3(dir.x * 5, dir.y * 5, dir.z * 5));
  deform(body, (p, n) => {
    const dir = p.clone().normalize();
    const k = opening(dir);
    if (k > 0) {
      p.addScaledVector(dir, -0.008 * Math.pow(k, 0.6));
      p.addScaledVector(n, 0.0022 * N3.fbm(p.x * 220, p.y * 220, p.z * 220, 3));
    } else if (k > -0.12) p.addScaledVector(n, 0.0016 * (1 + k / 0.12));
    p.addScaledVector(n, 0.0009 * N.fbm(p.x * 40, p.y * 40, p.z * 40, 2));
  });
  body.computeBoundingBox();
  let base = 0;
  const heights: number[] = [];
  for (let k = 0; k < 40; k++) {
    const th = k * 2.39996,
      rr = 0.03 * Math.sqrt((k + 0.5) / 40);
    heights.push(support.y(rr * Math.cos(th), rr * Math.sin(th), plate.floorY));
  }
  heights.sort((a2, b2) => a2 - b2);
  base = heights[Math.floor(heights.length * 0.7)];
  body.translate(0, base - body.boundingBox!.min.y - 0.002, 0);
  // Le dessous, souple, épouse les tranches.
  deform(body, (p, n) => {
    if (p.y > base + 0.012) return;
    const s = support.y(p.x, p.z, plate.floorY) + 0.0004;
    if (n.y < -0.3 || p.y < s) p.y = Math.max(s, n.y < -0.3 ? s : p.y);
  });
  const center = new THREE.Vector3(0, base - body.boundingBox!.min.y - 0.002, 0);
  applyRule(d, "burrata", body, split2((c) => opening(c.clone().sub(center).normalize()), 0.03, skin, stracc));

  // Stracciatella débordant de l'ouverture.
  support = d.probe(["plate", "tomato", "burrata"]);
  const flat = new THREE.Vector3(tear.x, 0, tear.z).normalize();
  const spill: [number, number, number, number][] = [
    [Rb * 0.9, 0.013, 0.008, 0.014],
    [Rb + 0.006, 0.014, 0.0055, 0.016],
    [Rb + 0.017, 0.012, 0.0042, 0.013],
    [Rb + 0.027, 0.008, 0.0032, 0.009],
  ];
  for (const [i, [dist, sx, sy, sz]] of spill.entries()) {
    const g = icoBlob(1, 6);
    deform(g, (p, n) => p.addScaledVector(n, 0.28 * N3.fbm(p.x * 2.6 + i, p.y * 2.6, p.z * 2.6, 4)));
    const side = (i % 2 ? 1 : -1) * range(r, 0.002, 0.006);
    const x = flat.x * dist - flat.z * side,
      z = flat.z * dist + flat.x * side;
    const y = i === 0 ? center.y + tear.y * Rb * 0.45 : support.y(x, z, plate.floorY) + sy * 0.55;
    g.applyMatrix4(
      new THREE.Matrix4().compose(
        new THREE.Vector3(x, y, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.atan2(-flat.z, flat.x) + range(r, -0.4, 0.4), i === 0 ? -0.55 : -0.12)),
        new THREE.Vector3(sx, sy, sz),
      ),
    );
    deform(g, (p) => {
      const s = support.y(p.x, p.z, plate.floorY) + 0.0004;
      if (p.y < s) p.y = s;
    });
    d.add("stracciatella", stracc, g);
  }

  // Basilic : deux feuilles sur la burrata, trois parmi les tomates.
  const all = d.probe(["plate", "tomato", "burrata", "stracciatella"]);
  const basilLeaves = [
    { x: 0.008, z: -0.016, yaw: 2.2, len: 0.04, pitch: 0 },
    { x: -0.012, z: -0.006, yaw: 0.4, len: 0.034, pitch: 0 },
    { x: 0.07, z: 0.035, yaw: 1.2, len: 0.05, pitch: 0 },
    { x: -0.062, z: -0.05, yaw: -0.6, len: 0.046, pitch: 0 },
    { x: 0.045, z: -0.07, yaw: 2.9, len: 0.044, pitch: 0 },
  ];
  for (const [i, l] of basilLeaves.entries())
    placeLeaf(
      d,
      "basil",
      basil,
      { length: l.len, width: l.len * 0.56, cup: 0.2, curl: 0.12, crease: 0.1, seed: 740 + i },
      { x: l.x, z: l.z, yaw: l.yaw, pitch: l.pitch },
      all,
      i < 2 ? "drape" : "rigid",
      0.0005,
    );

  // Gouttes d'huile d'olive, poivre concassé, fleur de sel.
  const food = d.probe(["tomato", "burrata", "stracciatella", "plate"]);
  for (let i = 0; i < 16; i++) {
    const onBurrata = i < 5;
    const th = r() * TAU,
      rr = onBurrata ? range(r, 0.005, 0.03) : range(r, 0.035, 0.085);
    const cx = rr * Math.cos(th),
      cz = rr * Math.sin(th);
    const R2 = range(r, 0.0018, onBurrata ? 0.0045 : 0.006);
    const g = orientUp(
      finish(
        surface(
          18,
          4,
          (u, v, out) => {
            const t = u * TAU;
            const rr2 = v * R2 * (1 + 0.12 * N.ring(t, 1.4, i));
            const x = cx + rr2 * Math.cos(t),
              z = cz + rr2 * Math.sin(t);
            out.set(x, food.y(x, z, plate.floorY) + 0.0003 + 0.0011 * Math.pow(Math.max(0, 1 - v * v), 0.5), z);
          },
          true,
        ),
      ),
    );
    d.add("oil", oil, g);
  }
  const grain = icoBlob(1, 0);
  for (let i = 0; i < 34; i++) {
    const onBurrata = i < 18;
    const th = r() * TAU,
      rr = onBurrata ? range(r, 0, 0.032) : range(r, 0.035, 0.085);
    const h = food.hit(rr * Math.cos(th), rr * Math.sin(th));
    if (!h) continue;
    const isSalt = i % 3 === 0;
    const s = isSalt ? range(r, 0.0008, 0.0013) : range(r, 0.0005, 0.0009);
    const g = grain.clone();
    deform(g, (p) => p.multiplyScalar(1 + 0.3 * N.n3(p.x * 3 + i, p.y * 3, p.z * 3)));
    const m = poseOnNormal(h.point, h.normal, r() * TAU).multiply(new THREE.Matrix4().makeScale(s, s * (isSalt ? 0.35 : 0.8), s * 0.9));
    d.add("garnish", isSalt ? salt : pepper, g, m);
  }
  return d;
}

function buildCocktail(): Dish {
  const d = new Dish("cocktail-agrumes");
  const N = new Noise(801);
  const N2 = new Noise(802);

  const glass = mat("verre", 0x7c878a, { roughness: 0.0, opacity: 0.2, ior: 1.5, clearcoat: 1, clearcoatRoughness: 0 });
  const liquid = mat("cocktail_agrumes", 0xf48a1a, { roughness: 0.2, clearcoat: 0, emissive: 0x5a2400 });
  const rind = mat("orange_zeste", 0xf47f0f, { roughness: 0.4, clearcoat: 0.35 });
  const pith = mat("orange_albedo", 0xf8e9c8, { roughness: 0.6 });
  const flesh = mat("orange_pulpe", 0xfcb240, { roughness: 0.2, clearcoat: 0.7, emissive: 0x2a1000 });
  const fleshDeep = mat("orange_pulpe_vive", 0xf8951e, { roughness: 0.2, clearcoat: 0.7, emissive: 0x2a1000 });

  // Coupe : pied, jambe fine, vasque large. Profil fermé (verre épais de ~2 mm).
  const rimY = 0.136,
    rimR = 0.055,
    footR = 0.038;
  const profile = spline(
    [
      [0, 0.0018],
      [0.02, 0.0012],
      [footR - 0.003, 0.0003],
      [footR - 0.0008, 0],
      [footR, 0.0012],
      [footR - 0.0008, 0.0028],
      [footR - 0.006, 0.0042],
      [0.02, 0.0065],
      [0.009, 0.0105],
      [0.0055, 0.016],
      [0.0042, 0.03],
      [0.004, 0.055],
      [0.0046, 0.072],
      [0.0075, 0.082],
      [0.016, 0.0905],
      [0.028, 0.0985],
      [0.04, 0.1085],
      [0.049, 0.1195],
      [0.0538, 0.1295],
      [rimR, rimY - 0.0012],
      [rimR - 0.0008, rimY],
      [rimR - 0.0022, rimY - 0.001],
      [0.0518, 0.1295],
      [0.0468, 0.1205],
      [0.0385, 0.1105],
      [0.0268, 0.1015],
      [0.0155, 0.0945],
      [0.007, 0.0915],
      [0, 0.0905],
    ],
    3,
  );
  d.add("glass", glass, sweep(profile, 96));

  // Cocktail ambré (niveau à 9 mm sous le buvant, ménisque léger).
  const fill = 0.1268;
  const liquidProfile = spline(
    [
      [0, 0.0909],
      [0.0068, 0.0919],
      [0.0152, 0.0949],
      [0.0264, 0.1019],
      [0.038, 0.1109],
      [0.0462, 0.1209],
      [0.0499, fill + 0.0004],
      [0.0485, fill],
      [0.03, fill - 0.0001],
      [0, fill - 0.0001],
    ],
    3,
  );
  d.add("liquid", liquid, sweep(liquidProfile, 96));

  // Rondelle d'orange fendue, posée à cheval sur le buvant.
  const wR = 0.026,
    wT = 0.005;
  const wheelProf: P2[] = [];
  for (let k = 0; k < 12; k++) wheelProf.push([(wR * 0.965 * k) / 12, wT / 2]);
  wheelProf.push(
    ...spline(
      [
        [wR * 0.965, wT / 2],
        [wR, wT / 2 - 0.0008],
        [wR + 0.0003, 0],
        [wR, -wT / 2 + 0.0008],
        [wR * 0.965, -wT / 2],
      ],
      2,
    ),
  );
  for (let k = 11; k >= 0; k--) wheelProf.push([(wR * 0.965 * k) / 12, -wT / 2]);
  const wheel = sweep(wheelProf, 120, (th) => 1 + 0.01 * N.ring(th, 1.5, 2));
  const SEG = 10;
  /** > 0 sur les membranes entre quartiers et au cœur (champ continu). */
  const membrane = (x: number, z: number) => {
    const th = Math.atan2(z, x) + Math.PI;
    const aa = th % (TAU / SEG);
    const rr = Math.hypot(x, z);
    return Math.max(0.00055 - Math.min(aa, TAU / SEG - aa) * rr, 0.0022 - rr);
  };
  deform(wheel, (p) => {
    const rr = Math.hypot(p.x, p.z) / wR;
    if (Math.abs(p.y) < wT / 2 - 0.0002) return;
    const pulp = smoothstep(0.0004, -0.0006, membrane(p.x, p.z)) * smoothstep(0.87, 0.83, rr);
    p.y -= Math.sign(p.y) * 0.0003 * pulp;
  });
  const beta = Math.PI / 4;
  const radial = new THREE.Vector3(Math.cos(beta), 0, Math.sin(beta));
  const tangent = new THREE.Vector3(-Math.sin(beta), 0, Math.cos(beta));
  const basis = new THREE.Matrix4().makeBasis(radial, tangent, radial.clone().cross(tangent));
  const tilt = new THREE.Matrix4().makeRotationAxis(tangent, -0.22);
  const wheelM = new THREE.Matrix4()
    .makeTranslation(radial.x * (rimR - 0.003), rimY + 0.003, radial.z * (rimR - 0.003))
    .multiply(tilt)
    .multiply(basis);
  const pulp = (c: V3) => (N2.n3(c.x * 900, c.y * 900, c.z * 900) > 0.15 ? fleshDeep : flesh); // vésicules de jus
  applyRule(
    d,
    "garnish",
    wheel,
    split2(
      (_c, n) => Math.abs(n.y),
      0.6,
      rind,
      { f: (c) => Math.hypot(c.x, c.z) / wR, t: [0.86, 0.93], bands: [split2((c) => membrane(c.x, c.z), 0, pulp, pith), pith, rind] },
    ),
    wheelM,
  );
  return d;
}

function buildTiramisu(): Dish {
  const d = new Dish("tiramisu");
  const N = new Noise(901);
  const N2 = new Noise(902);
  const N3 = new Noise(903);
  const r = rng(99);

  const sponge = mat("biscuit_imbibe", 0x704224, { roughness: 0.78 });
  const spongeLight = mat("biscuit_cuillere", 0x9c6a3c, { roughness: 0.8 });
  const cream = mat("creme_mascarpone", 0xf7ead0, { roughness: 0.55, clearcoat: 0.15, clearcoatRoughness: 0.5 });
  const cocoa = mat("cacao_poudre", 0x4b2a19, { roughness: 1 });
  const cocoaDark = mat("cacao_poudre_fonce", 0x3a1f12, { roughness: 1 });
  const bean = mat("grain_de_cafe", 0x3b2213, { roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.2 });

  const plate = rimmedPlate(0.22);
  d.add("plate", ceramic(), plate.geom);
  const yF = plate.floorY;

  // Part rectangulaire 9 × 7 × 6 cm, couches visibles sur les quatre faces coupées.
  const A = 0.045,
    B = 0.035,
    H = 0.06;
  const outline = (th: number) => {
    const n = 10;
    return Math.pow(Math.pow(Math.abs(Math.cos(th) / A), n) + Math.pow(Math.abs(Math.sin(th) / B), n), -1 / n);
  };
  const prof: P2[] = [];
  for (let k = 0; k < 18; k++) prof.push([(0.94 * k) / 18, yF + H]);
  prof.push([0.94, yF + H], [0.972, yF + H - 0.0007], [0.992, yF + H - 0.0024], [1, yF + H - 0.0055]);
  const rows = 38;
  for (let k = 1; k <= rows; k++) prof.push([1, yF + H - 0.0055 - (k * (H - 0.0075)) / rows]);
  prof.push([0.992, yF + 0.0004], [0.96, yF], [0, yF]);
  const g = sweep(prof, 152, outline);
  // Hauteurs (depuis le fond) des interfaces entre couches, légèrement ondulées.
  const bounds = [0.014, 0.031, 0.0445, 0.0575];
  const layerAt = (p: V3) => {
    const h = p.y - yF;
    const w = 0.0012 * N.n3(p.x * 70, h * 10, p.z * 70);
    let i = 0;
    while (i < bounds.length && h > bounds[i] + w) i++;
    return i; // 0 biscuit, 1 crème, 2 biscuit, 3 crème, 4 cacao
  };
  deform(g, (p, n) => {
    if (n.y > 0.7) {
      p.y += 0.0012 * N2.n3(p.x * 40, 1, p.z * 40) + 0.00045 * N3.fbm(p.x * 400, 2, p.z * 400, 2);
      return;
    }
    const layer = layerAt(p);
    const h = p.y - yF;
    const lo = layer === 0 ? 0 : bounds[layer - 1],
      hi = layer < bounds.length ? bounds[layer] : H;
    const mid = Math.sin(clamp((h - lo) / (hi - lo), 0, 1) * Math.PI);
    const bulge = layer === 1 || layer === 3 ? 0.0007 * mid : layer === 4 ? 0 : -0.0003 * mid;
    p.addScaledVector(n, bulge + 0.00035 * N3.fbm(p.x * 300, p.y * 300, p.z * 300, 2));
  });
  // Coupe des biscuits imbibés : bande brune aux bords irréguliers ; sur les grandes
  // faces, fins joints de crème entre les biscuits accolés. Frontières par iso-lignes.
  const sponges = (layer: number): Rule => {
    const lo = layer === 0 ? 0 : bounds[layer - 1];
    const hi = bounds[layer];
    const v = (c: V3) => (c.y - yF - (lo + hi) / 2) / ((hi - lo) / 2);
    const margin: Field = (c) => Math.abs(v(c)) - (0.86 + 0.05 * N3.n3(c.x * 90, c.y * 90, c.z * 90));
    const seam: Field = (c, n) => {
      const P = 0.0235;
      const u = ((((c.x + 0.007 * layer) % P) + P) % P) - P / 2;
      return Math.min((0.0007 - Math.abs(Math.abs(u) - P / 2)) * 1000, Math.abs(v(c)) - 0.25, Math.abs(n.z) - Math.abs(n.x));
    };
    const shade = split2((c) => N2.n3(c.x * 160, c.y * 160, c.z * 160), 0.34, sponge, spongeLight);
    return split2((c, n) => Math.max(margin(c, n), seam(c, n)), 0, shade, cream);
  };
  const layerHeight: Field = (c) => {
    const h = c.y - yF;
    return h - 0.0012 * N.n3(c.x * 70, h * 10, c.z * 70);
  };
  const cocoaBand = (c: V3) => (hash3(c.x, c.y, c.z) < 0.25 ? cocoaDark : cocoa);
  applyRule(
    d,
    "tiramisu",
    g,
    {
      f: (_c, n) => n.y,
      t: [-0.5, 0.6],
      bands: [
        cream,
        { f: layerHeight, t: bounds, bands: [sponges(0), cream, sponges(2), cream, cocoaBand] },
        split2((c) => N.n3(c.x * 150, 5, c.z * 150), 0.25, cocoa, cocoaDark),
      ],
    },
    pose(-0.004, 0, 0.002),
  );

  // Grains de café : deux sur le dessus, deux sur l'assiette.
  const beanGeom = coffeeBean();
  const topProbe = d.probe(["tiramisu"]);
  for (const [x, z, yaw, flip] of [
    [0.004, -0.006, 0.8, 0],
    [-0.012, 0.008, 2.1, 1],
  ]) {
    const h = topProbe.hit(x, z)!;
    const m = poseOnNormal(h.point.addScaledVector(h.normal, flip ? 0.003 : 0.0009), h.normal, yaw);
    if (flip) m.multiply(new THREE.Matrix4().makeRotationX(Math.PI));
    d.add("beans", bean, beanGeom, m);
  }
  for (const [x, z, yaw, flip] of [
    [0.052, 0.034, 0.4, 1],
    [0.06, 0.018, 1.9, 0],
  ]) {
    const m = pose(x, yF + (flip ? 0.0033 : 0.0011), z, flip ? Math.PI : 0, yaw, range(r, -0.05, 0.05));
    d.add("beans", bean, beanGeom, m);
  }
  return d;
}

// ─── Catalogue, export et validation ─────────────────────────────────────────

type Target = { width: number; height: number; depth: number };
type DishSpec = {
  id: string;
  build: () => Dish;
  /** Encombrement total attendu (plat + support), en cm, déduit du cahier des charges. */
  envelope: Target;
  /** Contrôles de cotes des éléments principaux (cm). */
  components: { label: string; tags: string[]; expect: Partial<Target> & { diameter?: number } }[];
};

const DISHES: DishSpec[] = [
  {
    id: "burger-signature",
    build: buildBurger,
    envelope: { width: 26, height: 10, depth: 26 },
    components: [
      { label: "burger", tags: ["bun", "patty", "cheese", "lettuce", "tomato", "onion", "topbun"], expect: { diameter: 11, height: 9 } },
      { label: "planche", tags: ["board"], expect: { diameter: 26 } },
    ],
  },
  {
    id: "pizza-margherita",
    build: buildPizza,
    // planche Ø 34 cm + poignée de 10,5 cm
    envelope: { width: 44.5, height: 4.3, depth: 34 },
    components: [
      { label: "pizza", tags: ["pizza", "sauce", "mozz", "basil"], expect: { diameter: 30 } },
      { label: "planche (sans poignée)", tags: ["board"], expect: { depth: 34 } },
    ],
  },
  {
    id: "fondant-chocolat",
    build: buildFondant,
    envelope: { width: 22, height: 6, depth: 22 },
    components: [
      { label: "fondant", tags: ["cake"], expect: { diameter: 8, height: 5 } },
      { label: "assiette", tags: ["plate"], expect: { diameter: 22 } },
    ],
  },
  {
    id: "burrata-tomates",
    build: buildBurrata,
    envelope: { width: 26, height: 8, depth: 26 },
    components: [
      { label: "burrata", tags: ["burrata"], expect: { diameter: 9 } },
      { label: "assiette", tags: ["plate"], expect: { diameter: 26 } },
    ],
  },
  {
    id: "cocktail-agrumes",
    build: buildCocktail,
    envelope: { width: 11, height: 15, depth: 11 },
    components: [{ label: "coupe", tags: ["glass"], expect: { diameter: 11, height: 15 } }],
  },
  {
    id: "tiramisu",
    build: buildTiramisu,
    envelope: { width: 22, height: 6.8, depth: 22 },
    components: [
      { label: "part de tiramisu", tags: ["tiramisu"], expect: { width: 9, depth: 7, height: 6 } },
      { label: "assiette", tags: ["plate"], expect: { diameter: 22 } },
    ],
  },
];

async function exportGroup(group: THREE.Group): Promise<{ glb: Buffer; usdz: Buffer }> {
  const glb = (await new GLTFExporter().parseAsync(group, { binary: true })) as ArrayBuffer;
  const usdz = await new USDZExporter().parseAsync(group);
  return { glb: Buffer.from(glb), usdz: Buffer.from(usdz) };
}

const within = (value: number, target: number, tol = 0.15) => Math.abs(value - target) <= target * tol;

/**
 * Contrôle complémentaire : analyzeUsdz ne mesure pas la géométrie. La scène USDZ de
 * three.js étant en texte (.usda), on relit les sommets pour vérifier que l'emprise est
 * la même que celle du GLB, et que toutes les transformations sont l'identité.
 */
function usdzBounds(buffer: Buffer): { size: THREE.Vector3; minY: number; identity: boolean } {
  const files = unzipSync(new Uint8Array(buffer));
  const box = new THREE.Box3();
  let identity = true;
  for (const [name, data] of Object.entries(files)) {
    if (!name.endsWith(".usda")) continue;
    const text = strFromU8(data);
    for (const m of text.matchAll(/matrix4d xformOp:transform = \(([^\n]+)\)\n/g)) {
      const nums = m[1].match(/-?[\d.e+-]+/g)!.map(Number);
      if (nums.some((v, i) => Math.abs(v - (i % 5 === 0 ? 1 : 0)) > 1e-9)) identity = false;
    }
    const pts = text.match(/point3f\[\] points = \[([^\]]*)\]/);
    if (!pts) continue;
    const v = new THREE.Vector3();
    for (const t of pts[1].matchAll(/\(([^,]+), ([^,]+), ([^)]+)\)/g)) box.expandByPoint(v.set(+t[1], +t[2], +t[3]));
  }
  return { size: box.getSize(new THREE.Vector3()), minY: box.min.y, identity };
}
const cm = (m: number) => Math.round(m * 1000) / 10;

function validateFiles(spec: DishSpec): boolean {
  const glbPath = path.join(OUT_DIR, `${spec.id}.glb`);
  const usdzPath = path.join(OUT_DIR, `${spec.id}.usdz`);
  const glb = analyzeGlb(fs.readFileSync(glbPath));
  const usdzBuf = fs.readFileSync(usdzPath);
  const usdz = analyzeUsdz(usdzBuf);
  const dims = glb.dimensionsCm!;
  const ub = usdzBounds(usdzBuf);
  const usdzDims = `${cm(ub.size.x)} × ${cm(ub.size.y)} × ${cm(ub.size.z)} cm`;
  const sameAsGlb =
    Math.abs(cm(ub.size.x) - dims.width) <= 0.15 && Math.abs(cm(ub.size.y) - dims.height) <= 0.15 && Math.abs(cm(ub.size.z) - dims.depth) <= 0.15;
  const checks: [string, boolean][] = [
    [`largeur ${dims.width} cm ≈ ${spec.envelope.width}`, within(dims.width, spec.envelope.width)],
    [`hauteur ${dims.height} cm ≈ ${spec.envelope.height}`, within(dims.height, spec.envelope.height)],
    [`profondeur ${dims.depth} cm ≈ ${spec.envelope.depth}`, within(dims.depth, spec.envelope.depth)],
    [`minY ${glb.minYcm} cm`, Math.abs(glb.minYcm ?? 99) <= 0.5],
    [`${glb.triangles} triangles < 60 000`, glb.triangles < 60000],
    [`GLB ${(glb.sizeBytes / 1024).toFixed(0)} Ko < 1,5 Mo`, glb.sizeBytes < 1.5 * 1024 * 1024],
    [`GLB sans avertissement`, glb.warnings.length === 0],
    [`USDZ valide (${(usdz.sizeBytes / 1024).toFixed(0)} Ko, racine ${usdz.rootFile}, metersPerUnit ${usdz.metersPerUnit}, upAxis ${usdz.upAxis})`, usdz.valid],
    [`USDZ : emprise ${usdzDims}, minY ${cm(ub.minY)} cm, identique au GLB`, sameAsGlb && Math.abs(ub.minY) < 0.005 && ub.identity],
  ];
  let ok = true;
  console.log(`\n■ ${spec.id}`);
  for (const [label, pass] of checks) {
    console.log(`  ${pass ? "✔" : "✘"} ${label}`);
    ok &&= pass;
  }
  for (const w of glb.warnings) console.log(`  ⚠ GLB : ${w}`);
  for (const e of usdz.errors) console.log(`  ✘ USDZ : ${e}`);
  for (const w of usdz.warnings) console.log(`  ⚠ USDZ : ${w}`);
  console.log(`  · ${glb.meshes} maillages, ${glb.materials} matériaux, ${glb.vertices} sommets, extensions : ${glb.extensionsUsed.join(", ") || "aucune"}`);
  return ok;
}

function checkComponents(spec: DishSpec, dish: Dish): boolean {
  let ok = true;
  for (const c of spec.components) {
    const size = dish.box(c.tags).getSize(new THREE.Vector3());
    const parts: string[] = [];
    const check = (label: string, value: number, target?: number) => {
      if (target === undefined) return;
      const pass = within(value, target);
      ok &&= pass;
      parts.push(`${pass ? "✔" : "✘"} ${label} ${value} cm (attendu ≈ ${target})`);
    };
    check("Ø", cm(Math.max(size.x, size.z)), c.expect.diameter);
    check("largeur", cm(size.x), c.expect.width);
    check("profondeur", cm(size.z), c.expect.depth);
    check("hauteur", cm(size.y), c.expect.height);
    console.log(`  ${c.label} : ${parts.join(" · ")}`);
  }
  return ok;
}

async function main() {
  installPolyfills();
  const args = process.argv.slice(2);
  const only = args.find((a) => a.startsWith("--only="))?.slice(7).split(",");
  const checkOnly = args.includes("--check");
  const out = args.find((a) => a.startsWith("--out="));
  if (out) OUT_DIR = path.resolve(out.slice(6));
  const specs = DISHES.filter((s) => !only || only.includes(s.id));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let ok = true;
  for (const spec of specs) {
    if (!checkOnly) {
      const t0 = Date.now();
      const dish = spec.build();
      console.log(`\n${spec.id} : ${dish.triangles()} triangles (${dish.breakdown()}), construit en ${Date.now() - t0} ms`);
      ok = checkComponents(spec, dish) && ok;
      const { glb, usdz } = await exportGroup(dish.toGroup());
      fs.writeFileSync(path.join(OUT_DIR, `${spec.id}.glb`), glb);
      fs.writeFileSync(path.join(OUT_DIR, `${spec.id}.usdz`), usdz);
    }
    ok = validateFiles(spec) && ok;
  }
  console.log(ok ? "\nTous les contrôles sont passés." : "\nCertains contrôles ont échoué.");
  if (!ok) process.exitCode = 1;
}

void main();
