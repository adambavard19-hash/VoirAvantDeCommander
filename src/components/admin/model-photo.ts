"use client";

import { loadModelViewer } from "@/components/menu/model-stage";

type ModelViewerElement = HTMLElement & {
  toBlob: (opts?: { mimeType?: string; qualityArgument?: number; idealAspect?: boolean }) => Promise<Blob>;
  jumpCameraToGoal: () => void;
};

/** Zone non transparente d'une image (le plat), pour le recentrer. */
function opaqueBounds(bitmap: ImageBitmap) {
  const c = document.createElement("canvas");
  c.width = bitmap.width;
  c.height = bitmap.height;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (data[(y * width + x) * 4 + 3]! > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
  return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

const WIDTH = 1200;
const HEIGHT = 900;

/**
 * Crée une photo de plat à partir de son modèle 3D, dans le navigateur :
 * rendu model-viewer hors écran (vue de trois-quarts), posé sur un fond sombre
 * dégradé avec une ombre douce, exporté en JPEG.
 */
export async function photoFromModel(glbUrl: string): Promise<Blob> {
  await loadModelViewer();
  const mv = document.createElement("model-viewer") as ModelViewerElement;
  mv.setAttribute("src", glbUrl);
  mv.setAttribute("camera-orbit", "-28deg 62deg auto");
  mv.setAttribute("field-of-view", "28deg");
  mv.setAttribute("shadow-intensity", "1.1");
  mv.setAttribute("shadow-softness", "0.8");
  mv.setAttribute("exposure", "1.05");
  mv.setAttribute("environment-image", "neutral");
  mv.setAttribute("interaction-prompt", "none");
  // model-viewer ne charge et ne dessine que ce qui est à l'écran : élément présent mais invisible.
  mv.setAttribute("loading", "eager");
  mv.setAttribute("reveal", "auto");
  mv.style.cssText = `position:fixed;left:0;top:0;width:${WIDTH / 2}px;height:${HEIGHT / 2}px;opacity:0;z-index:-1;background:transparent;pointer-events:none`;
  document.body.appendChild(mv);
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Le modèle 3D met trop de temps à charger.")), 60_000);
      mv.addEventListener("load", () => (clearTimeout(timer), resolve()), { once: true });
      mv.addEventListener("error", () => (clearTimeout(timer), reject(new Error("Modèle 3D illisible."))), { once: true });
    });
    // Caméra directement à sa place finale, puis quelques images pour l'ombre et l'éclairage.
    mv.jumpCameraToGoal();
    for (let i = 0; i < 4; i++) await new Promise((r) => requestAnimationFrame(r));
    const png = await mv.toBlob({ mimeType: "image/png", idealAspect: false });
    const bitmap = await createImageBitmap(png);

    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext("2d")!;
    const bg = ctx.createRadialGradient(WIDTH * 0.5, HEIGHT * 0.42, 40, WIDTH * 0.5, HEIGHT * 0.5, WIDTH * 0.75);
    bg.addColorStop(0, "#3a3029");
    bg.addColorStop(1, "#120e0b");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    // Le plat (ombre comprise) est recadré puis centré : ~82 % de la largeur ou de la hauteur.
    const box = opaqueBounds(bitmap) ?? { x: 0, y: 0, w: bitmap.width, h: bitmap.height };
    const scale = Math.min((WIDTH * 0.82) / box.w, (HEIGHT * 0.82) / box.h);
    const w = box.w * scale;
    const h = box.h * scale;
    ctx.drawImage(bitmap, box.x, box.y, box.w, box.h, (WIDTH - w) / 2, (HEIGHT - h) / 2 + HEIGHT * 0.02, w, h);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Export impossible."))), "image/jpeg", 0.9));
  } finally {
    mv.remove();
  }
}
