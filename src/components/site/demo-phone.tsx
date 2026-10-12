"use client";

import { useEffect, useRef, useState } from "react";

/** Le vrai menu de démonstration, interactif, dans un téléphone (chargé à l'approche). */
export function DemoPhone({ src }: { src: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "300px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className="relative mx-auto w-[330px] rounded-[52px] bg-gradient-to-b from-[#2d2d36] to-[#101015] p-[11px] shadow-[0_80px_160px_-40px_rgba(0,0,0,.95),inset_0_0_0_1px_rgba(255,255,255,.14)]">
      <div className="relative h-[680px] overflow-hidden rounded-[42px] bg-black">
        <div className="pointer-events-none absolute top-2.5 left-1/2 z-10 h-7 w-28 -translate-x-1/2 rounded-full bg-black" />
        {visible ? (
          <iframe src={src} title="Menu de démonstration interactif" className="size-full border-0" allow="xr-spatial-tracking; fullscreen" />
        ) : (
          <div className="grid size-full place-items-center text-white/40">Chargement de la démo…</div>
        )}
      </div>
    </div>
  );
}
