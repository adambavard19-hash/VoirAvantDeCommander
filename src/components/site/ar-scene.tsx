"use client";

import { useEffect, useRef, useState } from "react";
import { loadModelViewer } from "@/components/menu/model-stage";

/**
 * Mise en scène de la réalité augmentée : la salle vue à travers l'écran du
 * téléphone, le repère de détection de la table, puis le plat qui s'y pose.
 * La scène se joue quand elle arrive à l'écran.
 */
export function ArScene({ background, model, alt, size }: { background: string; model: string; alt: string; size: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"idle" | "scan" | "placed">("idle");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        setPhase("scan");
        loadModelViewer()
          .then(() => {
            const mv = document.createElement("model-viewer");
            const attrs: Record<string, string> = {
              src: model,
              alt,
              "camera-orbit": "30deg 66deg auto",
              "field-of-view": "24deg",
              "interaction-prompt": "none",
              "shadow-intensity": "1.6",
              "shadow-softness": "0.7",
              "environment-image": "neutral",
              exposure: "0.95",
              "disable-zoom": "",
              "disable-pan": "",
              "touch-action": "pan-y",
              "camera-controls": "",
              style: "width:100%;height:100%;background:transparent;--poster-color:transparent;--progress-bar-color:transparent;",
            };
            for (const [k, v] of Object.entries(attrs)) mv.setAttribute(k, v);
            mv.addEventListener("load", () => {
              timer = setTimeout(() => setPhase("placed"), 1400);
            });
            stage.current?.appendChild(mv);
          })
          .catch(() => {});
      },
      { threshold: 0.35 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [model, alt]);

  return (
    <div ref={ref} className="relative mx-auto aspect-[9/16] w-full max-w-[380px] overflow-hidden rounded-[44px] border border-ivory/15 bg-ink-2 shadow-[0_60px_140px_-40px_rgba(0,0,0,.9)]">
      {/* La salle, vue par la caméra du téléphone. */}
      <img src={background} alt="" className="absolute inset-0 size-full scale-110 object-cover brightness-[.55] grayscale-[.35]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,10,9,.55),transparent_30%,transparent_60%,rgba(11,10,9,.7))]" />

      {/* Repère de détection de la table. */}
      <div
        className={`absolute inset-x-[12%] top-[58%] aspect-[2/1] transition-all duration-1000 ${phase === "placed" ? "scale-110 opacity-0" : phase === "scan" ? "opacity-100" : "opacity-0"}`}
      >
        <div className="absolute inset-0 rounded-[50%] border border-ivory/70 [animation:ar-reticle_2.4s_ease-in-out_infinite]" />
        <div className="absolute inset-[22%] rounded-[50%] border border-ivory/35" />
      </div>

      {/* Le plat, posé sur la table. */}
      <div
        ref={stage}
        className={`absolute inset-x-[2%] top-[34%] h-[44%] transition-all duration-[1600ms] ease-[cubic-bezier(.16,1,.3,1)] ${phase === "placed" ? "translate-y-0 opacity-100" : "-translate-y-6 opacity-0"}`}
      />

      {/* Interface de la caméra : sobre. */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-6 pt-7 text-[11px] tracking-[.22em] text-ivory/75 uppercase">
        <span>Réalité augmentée</span>
        <span className={`transition-opacity duration-700 ${phase === "placed" ? "opacity-100" : "opacity-0"}`}>{size}</span>
      </div>
      <p
        className={`absolute inset-x-0 bottom-9 text-center text-[13px] text-ivory/80 transition-opacity duration-700 ${phase === "scan" ? "opacity-100" : "opacity-0"}`}
      >
        Pointez la table…
      </p>
      <p
        className={`absolute inset-x-0 bottom-9 text-center font-serif text-[22px] text-ivory transition-all duration-1000 ${phase === "placed" ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}
      >
        Servi, avant d&apos;être commandé.
      </p>
    </div>
  );
}
