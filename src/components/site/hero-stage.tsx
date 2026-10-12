"use client";

import { useEffect, useRef, useState } from "react";
import { Heart, Ruler } from "lucide-react";
import { loadModelViewer } from "@/components/menu/model-stage";
import { ArIcon } from "@/components/menu/icons";

/** Plat 3D qui tourne au-dessus du téléphone : la promesse du produit en une image. */
function HeroModel({ src }: { src: string }) {
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
            src,
            alt: "Burger signature en 3D",
            "camera-orbit": "35deg 68deg auto",
            "interaction-prompt": "none",
            "shadow-intensity": "1.2",
            "shadow-softness": "0.9",
            exposure: "1.1",
            "environment-image": "neutral",
            "rotation-per-second": "22deg",
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
    // Chargement après l'affichage de la page pour ne pas retarder le premier rendu.
    const timer = setTimeout(start, 700);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      el?.remove();
    };
  }, [src]);
  return (
    <div className="relative size-full">
      <div ref={ref} className={`absolute inset-0 transition-opacity duration-1000 ${ready ? "opacity-100" : "opacity-0"}`} />
    </div>
  );
}

export function HeroStage() {
  return (
    <div className="relative mx-auto h-[600px] w-full max-w-[560px] [perspective:1800px] sm:h-[660px]">
      {/* Halo et sol holographique */}
      <div className="absolute top-[52%] left-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,181,71,.32),rgba(155,123,255,.12)_55%,transparent)] blur-2xl" />

      {/* Téléphone */}
      <div className="absolute top-14 left-1/2 w-[270px] -translate-x-[62%] [transform:rotateY(18deg)_rotateX(4deg)_rotateZ(-2deg)] sm:w-[290px]">
        <div className="animate-float rounded-[46px] bg-gradient-to-b from-[#2b2b33] to-[#111116] p-[10px] shadow-[0_60px_120px_-30px_rgba(0,0,0,.9),inset_0_0_0_1px_rgba(255,255,255,.12)]">
          <div className="relative overflow-hidden rounded-[37px] bg-[#0d0a08]">
            <div className="absolute top-2 left-1/2 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-black" />
            <div className="relative h-[230px]">
              <img src="/demo/photos/cover.jpg" alt="" className="absolute inset-0 size-full object-cover" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.35),transparent_40%,#0d0a08)]" />
            </div>
            <div className="relative -mt-14 px-5 pb-6 text-[#f7f1e8]">
              <p className="text-[9px] font-semibold tracking-[.22em] text-[#d9a55b] uppercase">Restaurant de démonstration</p>
              <p className="font-serif text-[27px] leading-tight">Atelier Saveurs</p>
              <div className="mt-3 flex gap-1.5 text-[10px]">
                <span className="rounded-full bg-[#d9a55b] px-3 py-1.5 font-semibold text-black">Plats</span>
                <span className="rounded-full bg-white/8 px-3 py-1.5">Desserts</span>
                <span className="rounded-full bg-white/8 px-3 py-1.5">Boissons</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                {[
                  ["burger-signature", "Burger signature", "19 €"],
                  ["fondant-chocolat", "Fondant au chocolat", "9 €"],
                ].map(([img, name, price]) => (
                  <div key={img}>
                    <div className="relative aspect-square overflow-hidden rounded-2xl bg-white/5">
                      <img src={`/demo/photos/${img}.jpg`} alt="" className="size-full object-cover" />
                      <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[8px] font-bold backdrop-blur">
                        <ArIcon className="size-2.5" /> 3D
                      </span>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-tight font-semibold">{name}</p>
                    <p className="text-[10px] text-[#d9a55b]">{price}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex h-10 items-center justify-center gap-2 rounded-2xl bg-[#d9a55b] text-[11px] font-semibold text-black">
                <ArIcon className="size-4" /> Voir ce plat sur ma table
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Plat en 3D qui « sort » de l'écran */}
      <div className="absolute top-[18%] right-[-4%] h-[330px] w-[330px] sm:right-[-6%] sm:h-[380px] sm:w-[380px]">
        <div className="absolute inset-x-[12%] bottom-[8%] h-[22%] rounded-[50%] border border-[#7cf5e1]/40 bg-[radial-gradient(closest-side,rgba(124,245,225,.22),transparent)] [transform:rotateX(70deg)]" />
        <div className="absolute inset-x-[22%] bottom-[11%] h-[14%] rounded-[50%] border border-[#7cf5e1]/25 [transform:rotateX(70deg)]" />
        <HeroModel src="/demo/models/burger-signature.glb" />
      </div>

      {/* Puces d'interface flottantes */}
      <div className="absolute top-[12%] right-[2%] flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-2 text-[12px] font-medium text-white shadow-2xl backdrop-blur-xl sm:right-[4%]">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#7cf5e1] opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-[#7cf5e1]" />
        </span>
        Réalité augmentée
      </div>
      <div className="absolute right-[6%] bottom-[16%] flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3.5 py-2.5 text-[12px] text-white shadow-2xl backdrop-blur-xl">
        <Ruler className="size-4 text-saffron" /> Taille réelle · Ø 26 cm
      </div>
      <div className="absolute bottom-[6%] left-[4%] flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3.5 py-2.5 text-[12px] text-white shadow-2xl backdrop-blur-xl">
        <Heart className="size-4 fill-coral text-coral" /> Ajouté à « Mes envies »
      </div>
    </div>
  );
}
