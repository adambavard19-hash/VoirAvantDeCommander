"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

/**
 * Visionneuse 3D / réalité augmentée basée sur <model-viewer> (Google).
 *
 * - Web / Android : GLB, rotation au doigt, zoom ; AR via WebXR ou Scene Viewer.
 * - iPhone / iPad : AR Quick Look avec le fichier USDZ (ou, à défaut, une
 *   conversion automatique du GLB faite par model-viewer).
 * - Taille réelle : si l'échelle du plat a été validée, l'AR est à taille fixe.
 *
 * L'élément est créé impérativement : on contrôle ainsi précisément ses
 * attributs et événements, et la bibliothèque (~1 Mo) n'est chargée qu'au besoin.
 */

type ModelViewerElement = HTMLElement & {
  canActivateAR?: boolean;
  activateAR?: () => Promise<void>;
  dismissPoster?: () => void;
};

export type ArSupport = "unknown" | "available" | "unavailable";

export type ModelStageHandle = { activateAR: () => Promise<boolean> };

let loader: Promise<unknown> | null = null;
/** Charge la bibliothèque model-viewer une seule fois (préchargement possible). */
export function loadModelViewer() {
  if (typeof window === "undefined") return Promise.resolve();
  loader ??= import("@google/model-viewer").catch((err) => {
    loader = null;
    throw err;
  });
  return loader;
}

type Props = {
  glb: string | null;
  usdz: string | null;
  poster?: string | null;
  alt: string;
  scaleValidated: boolean;
  autoRotate?: boolean;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
  onInteract?: () => void;
  onArStatus?: (status: string) => void;
  onArSupport?: (support: ArSupport) => void;
  onProgress?: (progress: number) => void;
};

export const ModelStage = forwardRef<ModelStageHandle, Props>(function ModelStage(
  { glb, usdz, poster, alt, scaleValidated, autoRotate = true, className, onLoad, onError, onInteract, onArStatus, onArSupport, onProgress },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<ModelViewerElement | null>(null);
  const [failed, setFailed] = useState(false);
  const callbacks = useRef({ onLoad, onError, onInteract, onArStatus, onArSupport, onProgress });
  callbacks.current = { onLoad, onError, onInteract, onArStatus, onArSupport, onProgress };

  useImperativeHandle(ref, () => ({
    async activateAR() {
      const el = elementRef.current;
      if (!el?.activateAR || !el.canActivateAR) return false;
      try {
        await el.activateAR();
        return true;
      } catch {
        return false;
      }
    },
  }));

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;
    let interacted = false;

    loadModelViewer()
      .then(() => {
        if (cancelled) return;
        const el = document.createElement("model-viewer") as ModelViewerElement;
        const attrs: Record<string, string> = {
          alt,
          "camera-controls": "",
          "touch-action": "pan-y",
          "interaction-prompt": "none",
          "shadow-intensity": "1.1",
          "shadow-softness": "0.85",
          exposure: "1.05",
          "environment-image": "neutral",
          "tone-mapping": "neutral",
          "camera-orbit": "28deg 62deg auto",
          "min-camera-orbit": "auto 5deg auto",
          "max-camera-orbit": "auto 86deg auto",
          "interpolation-decay": "140",
          "rotation-per-second": "16deg",
          "auto-rotate-delay": "1200",
          loading: "eager",
          reveal: "auto",
          ar: "",
          "ar-modes": "webxr scene-viewer quick-look",
          "ar-placement": "floor",
          "ar-scale": scaleValidated ? "fixed" : "auto",
          style: "width:100%;height:100%;background:transparent;--poster-color:transparent;--progress-bar-color:transparent;",
        };
        if (glb) attrs.src = glb;
        if (usdz) attrs["ios-src"] = usdz;
        if (poster) attrs.poster = poster;
        if (autoRotate) attrs["auto-rotate"] = "";
        for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);

        // Le bouton AR intégré est masqué : l'interface fournit son propre bouton.
        const hiddenArButton = document.createElement("span");
        hiddenArButton.setAttribute("slot", "ar-button");
        hiddenArButton.style.display = "none";
        el.appendChild(hiddenArButton);

        const reportSupport = () => callbacks.current.onArSupport?.(el.canActivateAR ? "available" : "unavailable");
        el.addEventListener("load", () => {
          callbacks.current.onLoad?.();
          reportSupport();
        });
        el.addEventListener("error", () => {
          setFailed(true);
          callbacks.current.onError?.();
        });
        el.addEventListener("progress", (e) => {
          const p = (e as unknown as CustomEvent<{ totalProgress: number }>).detail?.totalProgress;
          if (typeof p === "number") callbacks.current.onProgress?.(p);
        });
        el.addEventListener("camera-change", (e) => {
          if (!interacted && (e as CustomEvent<{ source: string }>).detail?.source === "user-interaction") {
            interacted = true;
            callbacks.current.onInteract?.();
          }
        });
        el.addEventListener("ar-status", (e) => {
          callbacks.current.onArStatus?.((e as CustomEvent<{ status: string }>).detail?.status ?? "");
        });
        container.appendChild(el);
        elementRef.current = el;
        // Sur iOS, Quick Look est disponible avant même la fin du chargement du GLB.
        window.setTimeout(reportSupport, 300);
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          callbacks.current.onError?.();
        }
      });

    return () => {
      cancelled = true;
      elementRef.current?.remove();
      elementRef.current = null;
    };
  }, [glb, usdz, poster, alt, scaleValidated, autoRotate]);

  return <div ref={containerRef} className={className} data-failed={failed || undefined} />;
});
