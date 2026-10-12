/**
 * Rend les « photos » des plats de démonstration à partir des GLB générés par
 * scripts/generate-demo-models.ts : Chromium sans écran (WebGL logiciel SwiftShader),
 * page three.js servie localement (scripts/demo-render/index.html), puis
 * compression JPEG (sharp / mozjpeg).
 *
 * Usage :
 *   npx tsx scripts/render-demo-photos.ts                  # 6 plats + couverture
 *   npx tsx scripts/render-demo-photos.ts --only=cover,tiramisu
 *   npx tsx scripts/render-demo-photos.ts --quick --out=/tmp/apercu   # aperçu rapide (demi-taille)
 *   npx tsx scripts/render-demo-photos.ts --samples=12 --ss=1 --out=/tmp/apercu   # pleine taille, rapide
 *
 * Chromium : CHROMIUM_PATH si défini, sinon /opt/pw-browsers/chromium s'il existe,
 * sinon le navigateur installé par Playwright.
 */
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const ROOT = path.resolve(__dirname, "..");
const MODELS_URL = "/public/demo/models";
const DEFAULT_OUT = path.join(ROOT, "public", "demo", "photos");
const MAX_BYTES = 350 * 1024;

type Item = { url: string; x?: number; z?: number; rotY?: number };
type RenderOptions = {
  width: number;
  height: number;
  ss: number;
  samples: number;
  items: Item[];
  elevation: number;
  azimuth: number;
  fov?: number;
  marginX?: number;
  marginY?: number;
  offsetY?: number;
  targetY?: number;
  exposure?: number;
  keyAzimuth?: number;
  keyElevation?: number;
  keyPower?: number;
  keySoftness?: number;
  poolSize?: number;
  fillPower?: number;
  rimPower?: number;
  rimAzimuth?: number;
  envPower?: number;
  aperture?: number;
  fogNear?: number;
  fogFar?: number;
  woodRotation?: number;
  seed?: number;
  /** Boîte à cadrer (sinon l'ensemble des plats) : permet de recadrer la couverture. */
  frame?: { min: [number, number, number]; max: [number, number, number] };
};
type Shot = { name: string; options: Omit<RenderOptions, "width" | "height" | "ss" | "samples"> & { width?: number; height?: number } };

const model = (id: string, x = 0, z = 0, rotY = 0): Item => ({ url: `${MODELS_URL}/${id}.glb`, x, z, rotY });

/** Plans de prise de vue : trois-quarts plongeant (35–45°), lumière arrière-gauche. */
const SHOTS: Shot[] = [
  {
    name: "burger-signature",
    options: {
      items: [model("burger-signature")],
      frame: { min: [-0.105, 0, -0.12], max: [0.125, 0.1, 0.09] },
      elevation: 36,
      azimuth: -24,
      marginX: 0.04,
      marginY: 0.04,
    },
  },
  { name: "pizza-margherita", options: { items: [model("pizza-margherita", 0, 0, -30)], elevation: 42, azimuth: -20, marginX: 0.05, marginY: 0.06 } },
  { name: "fondant-chocolat", options: { items: [model("fondant-chocolat")], elevation: 38, azimuth: -22, marginX: 0.06, marginY: 0.06 } },
  { name: "burrata-tomates", options: { items: [model("burrata-tomates")], elevation: 40, azimuth: -22, marginX: 0.06, marginY: 0.06 } },
  { name: "cocktail-agrumes", options: { items: [model("cocktail-agrumes")], elevation: 35, azimuth: -20, marginX: 0.22, marginY: 0.05, fov: 24 } },
  { name: "tiramisu", options: { items: [model("tiramisu", 0, 0, 18)], elevation: 38, azimuth: -24, marginX: 0.06, marginY: 0.06 } },
  {
    name: "cover",
    options: {
      width: 2400,
      height: 1200,
      items: [
        model("pizza-margherita", -0.02, -0.05, 127),
        model("burger-signature", 0.4, -0.12, 0),
        model("burrata-tomates", -0.43, -0.09, 0),
        model("tiramisu", -0.29, 0.23, -20),
        model("fondant-chocolat", 0.21, 0.21, 10),
        model("cocktail-agrumes", 0.47, 0.15, 0),
      ],
      frame: { min: [-0.47, 0, -0.23], max: [0.55, 0.1, 0.3] },
      rimPower: 0.2,
      keyAzimuth: 110,
      elevation: 50,
      azimuth: -4,
      fov: 30,
      marginX: 0,
      marginY: 0,
      poolSize: 1.4,
      aperture: 0.004,
      keySoftness: 12,
    },
  },
];

function findChromium(): string | undefined {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const candidate = "/opt/pw-browsers/chromium";
  return fs.existsSync(candidate) ? candidate : undefined;
}

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".glb": "model/gltf-binary",
  ".json": "application/json",
};

/** Petit serveur statique limité aux fichiers nécessaires au rendu. */
function serve(): Promise<http.Server> {
  const allowed = ["/node_modules/three/", `${MODELS_URL}/`, "/scripts/demo-render/"];
  const server = http.createServer((req, res) => {
    let url = decodeURIComponent((req.url ?? "/").split("?")[0]);
    if (url === "/") url = "/scripts/demo-render/index.html";
    url = path.posix.normalize(url); // « ../ » résolus avant la liste blanche
    const file = path.join(ROOT, url);
    if (!allowed.some((p) => url.startsWith(p)) || !file.startsWith(ROOT) || !fs.existsSync(file)) {
      res.writeHead(404).end("introuvable");
      return;
    }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

function vignette(width: number, height: number): Buffer {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs><radialGradient id="v" cx="50%" cy="48%" r="72%">
        <stop offset="50%" stop-color="#ffffff"/><stop offset="100%" stop-color="#8a8580"/>
      </radialGradient></defs>
      <rect width="100%" height="100%" fill="url(#v)"/></svg>`,
  );
}

async function toJpeg(png: Buffer, width: number, height: number): Promise<Buffer> {
  const base = await sharp(png)
    .resize(width, height, { kernel: "lanczos3" })
    .composite([{ input: vignette(width, height), blend: "multiply" }])
    .toBuffer();
  for (let q = 84; q >= 60; q -= 4) {
    const jpg = await sharp(base).jpeg({ quality: q, mozjpeg: true, chromaSubsampling: "4:2:0" }).toBuffer();
    if (jpg.length <= MAX_BYTES || q <= 60) return jpg;
  }
  throw new Error("compression impossible");
}

/** Détecte un rendu vide (canvas uni) : écart-type de luminance trop faible. */
async function assertNotBlank(name: string, png: Buffer) {
  const stats = await sharp(png).stats();
  const spread = Math.max(...stats.channels.slice(0, 3).map((c) => c.stdev));
  const mean = stats.channels.slice(0, 3).reduce((s, c) => s + c.mean, 0) / 3;
  if (spread < 8 || mean < 6) throw new Error(`${name} : rendu vide ou trop sombre (écart-type ${spread.toFixed(1)}, moyenne ${mean.toFixed(1)})`);
  return { spread, mean };
}

async function main() {
  const args = process.argv.slice(2);
  const only = args.find((a) => a.startsWith("--only="))?.slice(7).split(",");
  const quick = args.includes("--quick");
  const outDir = path.resolve(args.find((a) => a.startsWith("--out="))?.slice(6) ?? DEFAULT_OUT);
  const samplesArg = args.find((a) => a.startsWith("--samples="));
  const samples = samplesArg ? Number(samplesArg.slice(10)) : quick ? 10 : 40;
  const ssArg = args.find((a) => a.startsWith("--ss="));
  const ss = ssArg ? Number(ssArg.slice(5)) : quick ? 1 : 1.5;
  const shots = SHOTS.filter((s) => !only || only.includes(s.name));
  for (const s of shots)
    for (const it of s.options.items) {
      const file = path.join(ROOT, it.url);
      if (!fs.existsSync(file)) throw new Error(`${file} manquant : lancez d'abord scripts/generate-demo-models.ts`);
    }
  fs.mkdirSync(outDir, { recursive: true });

  const server = await serve();
  const port = (server.address() as AddressInfo).port;
  const browser = await chromium.launch({
    executablePath: findChromium(),
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    page.on("console", (m) => {
      if ((m.type() === "error" || m.type() === "warning") && !m.text().includes("404")) console.log(`  [page] ${m.text()}`);
    });
    page.on("pageerror", (e) => console.log(`  [page] ${e.message}`));
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true, null, { timeout: 30000 });
    for (const shot of shots) {
      const width = shot.options.width ?? 1600;
      const height = shot.options.height ?? 1200;
      const options: RenderOptions = {
        ...shot.options,
        width: quick ? Math.round(width / 2) : width,
        height: quick ? Math.round(height / 2) : height,
        ss,
        samples,
      };
      const result = await page.evaluate(
        (o) => (window as unknown as { renderScene: (o: RenderOptions) => Promise<{ url: string; ms: number }> }).renderScene(o),
        options,
      );
      const png = Buffer.from(result.url.split(",")[1], "base64");
      const { spread, mean } = await assertNotBlank(shot.name, png);
      const jpg = await toJpeg(png, options.width, options.height);
      const file = path.join(outDir, `${shot.name}.jpg`);
      fs.writeFileSync(file, jpg);
      console.log(
        `${shot.name}.jpg : ${options.width}×${options.height}, ${(jpg.length / 1024).toFixed(0)} Ko, ${samples} passes en ${(result.ms / 1000).toFixed(1)} s (luminance moy. ${mean.toFixed(0)}, écart-type ${spread.toFixed(0)})`,
      );
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
