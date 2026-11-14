"use client";

import { useEffect, useRef, useState } from "react";
import { loadModelViewer } from "@/components/menu/model-stage";

/**
 * Un vrai plat scanné en 3D, qui tourne lentement sous une lumière de salle :
 * la promesse du produit, sans décor superflu. Apparition en fondu une fois chargé
 * (et si les animations sont réduites, le plat ne tourne pas).
 */
export function HeroStage({ model, alt }: { model: string; alt: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let el: HTMLElement | null = null;
    let cancelled = false;
    const start = () =>
      loadModelViewer()
        .then(() => {
          if (cancelled) return;
          el = document.createElement("model-viewer");
          const attrs: Record<string, string> = {
            src: model,
            alt,
            "camera-orbit": "20deg 62deg auto",
            "field-of-view": "19deg",
            "interaction-prompt": "none",
            "shadow-intensity": "1.4",
            "shadow-softness": "1",
            exposure: "1",
            "environment-image": "neutral",
            "rotation-per-second": "9deg",
            "disable-zoom": "",
            "disable-pan": "",
            "touch-action": "pan-y",
            "camera-controls": "",
            style: "width:100%;height:100%;background:transparent;--poster-color:transparent;--progress-bar-color:transparent;",
          };
          if (!reduce) attrs["auto-rotate"] = "";
          for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
          el.addEventListener("load", () => setReady(true));
          container.appendChild(el);
        })
        .catch(() => {});
    const timer = setTimeout(start, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      el?.remove();
    };
  }, [model, alt]);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[640px]">
      {/* Lumière de salle : un halo très doux, sans couleur. */}
      <div className="absolute inset-[8%] rounded-full bg-[radial-gradient(closest-side,rgba(242,238,230,.10),transparent)]" />
      {/* Lignes fines : la table et son plan de réalité augmentée. */}
      <div className="absolute inset-x-[6%] top-[66%] h-[26%] rounded-[50%] border border-ivory/[.12] [transform:perspective(900px)_rotateX(62deg)]" />
      <div className="absolute inset-x-[18%] top-[70%] h-[16%] rounded-[50%] border border-ivory/[.07] [transform:perspective(900px)_rotateX(62deg)]" />
      <div ref={ref} className={`absolute inset-0 transition-opacity duration-[1400ms] ${ready ? "opacity-100" : "opacity-0"}`} />
    </div>
  );
}
