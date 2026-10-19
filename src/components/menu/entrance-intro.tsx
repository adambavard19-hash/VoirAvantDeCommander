"use client";

import { useEffect, useRef, useState } from "react";
import { ENTRANCE_SEEN_ATTR as SEEN_ATTR } from "@/lib/menu/entrance";

type Img = { src: string; srcSet?: string };

type Props = {
  /** Clé de mémorisation (une fois par visite et par restaurant). */
  storageKey: string;
  facade: Img | null;
  interior: Img | null;
  /** Vidéo de la rue jusqu'à la salle : jouée en priorité, photos en solution de repli. */
  video?: { src: string; type: string } | null;
  /** Position de la porte sur la devanture (0–1). */
  focus: { x: number; y: number };
  name: string;
  welcome: string;
  skipLabel: string;
  /** Aperçu dans l'administration : ignore la mémorisation et les préférences. */
  preview?: boolean;
  /** Rejouée à chaque ouverture, même si le téléphone réduit les animations (lien de démonstration). */
  always?: boolean;
  onDone?: () => void;
};

const DURATION = 3900;

/**
 * Entrée animée du menu : vidéo (de la rue jusqu'à la salle) si le restaurant
 * en a une, sinon animation des photos — la caméra avance vers la porte de la
 * devanture, « traverse » et arrive dans la salle. Puis le menu apparaît.
 * Interrompable d'un geste, jouée une seule fois par visite.
 */
export function EntranceIntro({ storageKey, facade, interior, video, focus, name, welcome, skipLabel, preview, always, onDone }: Props) {
  const replay = preview || always;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mode, setMode] = useState<"video" | "photos">(video ? "video" : "photos");
  const rootRef = useRef<HTMLDivElement>(null);
  const facadeRef = useRef<HTMLImageElement>(null);
  const interiorRef = useRef<HTMLImageElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(false);
  const animations = useRef<Animation[]>([]);
  const finishing = useRef(false);

  const finish = (fast: boolean) => {
    if (finishing.current) return;
    finishing.current = true;
    if (!replay) {
      try {
        sessionStorage.setItem(storageKey, "1");
      } catch {}
      document.documentElement.setAttribute(SEEN_ATTR, "1");
    }
    const root = rootRef.current;
    const end = () => {
      animations.current.forEach((a) => a.cancel());
      document.body.style.overflow = "";
      setDone(true);
      onDone?.();
    };
    if (!root || !fast) return end();
    const fade = root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, easing: "ease-out", fill: "forwards" });
    fade.onfinish = end;
  };

  useEffect(() => {
    // Déjà vue (ou animations réduites) : le CSS la masque déjà, rien à jouer.
    if (!replay && document.documentElement.hasAttribute(SEEN_ATTR)) return;
    // Compatibilité : navigateur sans Web Animations, mode « économie de données »
    // ou connexion très lente → on va directement au menu.
    const nav = navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string }; deviceMemory?: number };
    if (
      typeof HTMLElement.prototype.animate !== "function" ||
      (!replay && (nav.connection?.saveData || nav.connection?.effectiveType === "2g" || nav.connection?.effectiveType === "slow-2g"))
    ) {
      finish(false);
      return;
    }
    // Téléphones modestes : pas de flou (coûteux à calculer), animation plus fluide.
    const lowEnd = (nav.deviceMemory ?? 8) <= 2 || (navigator.hardwareConcurrency ?? 8) <= 4;
    const blur = (px: number) => (lowEnd ? "none" : `blur(${px}px)`);
    document.body.style.overflow = "hidden";
    let cancelled = false;

    const showTitle = (delay: number) => {
      const t = titleRef.current;
      if (!t) return;
      animations.current.push(
        t.animate(
          [
            { opacity: 0, transform: "translateY(14px)", letterSpacing: "0.02em" },
            { opacity: 1, transform: "translateY(0)", letterSpacing: "0.06em", offset: 0.3 },
            { opacity: 1, transform: "translateY(0)", letterSpacing: "0.08em", offset: 0.8 },
            { opacity: 0, transform: "translateY(-10px)", letterSpacing: "0.1em" },
          ],
          { delay, duration: 2200, easing: "ease-out", fill: "both" },
        ),
      );
    };

    // ─── Vidéo ───
    const v = videoRef.current;
    if (video && v) {
      let started = false;
      const fallback = () => {
        if (cancelled || started) return;
        cancelled = true;
        if (facade && interior) {
          // Repli sur l'animation des photos (lecture automatique bloquée, vidéo indisponible…).
          cancelled = false;
          setMode("photos");
          requestAnimationFrame(() => requestAnimationFrame(runPhotos));
        } else finish(true);
      };
      const startTimer = setTimeout(fallback, 5000);
      v.addEventListener(
        "playing",
        () => {
          started = true;
          clearTimeout(startTimer);
          showTitle(300);
        },
        { once: true },
      );
      v.addEventListener("error", fallback, { once: true });
      v.addEventListener("ended", () => finish(true), { once: true });
      // Sécurité : fin forcée si la vidéo se fige.
      v.addEventListener(
        "loadedmetadata",
        () => {
          if (Number.isFinite(v.duration)) setTimeout(() => finish(true), (v.duration + 1.5) * 1000);
        },
        { once: true },
      );
      v.muted = true;
      v.play().catch(fallback);
      return () => {
        cancelled = true;
        clearTimeout(startTimer);
        animations.current.forEach((a) => a.cancel());
        document.body.style.overflow = "";
      };
    }

    runPhotos();

    function runPhotos() {
      const ready = (img: HTMLImageElement | null) =>
        img ? (img.complete && img.naturalWidth ? Promise.resolve() : img.decode().catch(() => undefined)) : Promise.resolve();
      const timeout = new Promise<"timeout">((r) => setTimeout(() => r("timeout"), 4000));

      Promise.race([Promise.all([ready(facadeRef.current), ready(interiorRef.current)]), timeout]).then((result) => {
        if (cancelled) return;
        if (result === "timeout" || !facadeRef.current?.naturalWidth || !interiorRef.current?.naturalWidth) return finish(true);
        const f = facadeRef.current;
        const i = interiorRef.current;
        const t = titleRef.current!;
        const flash = flashRef.current!;
        const root = rootRef.current!;
        const opts = (delay: number, duration: number, easing: string): KeyframeAnimationOptions => ({ delay, duration, easing, fill: "both" });

        animations.current = [
          // Approche puis passage de la porte.
          f.animate(
            [
              { transform: "scale(1.04)", filter: blur(0) },
              { transform: "scale(1.5)", filter: blur(0), offset: 0.55 },
              { transform: "scale(3.2)", filter: blur(10) },
            ],
            opts(0, 1900, "cubic-bezier(.55,.05,.7,.4)"),
          ),
          f.animate([{ opacity: 1 }, { opacity: 0 }], opts(1500, 450, "ease-in")),
          // Lueur au seuil.
          flash.animate([{ opacity: 0 }, { opacity: 0.55 }, { opacity: 0 }], opts(1450, 700, "ease-in-out")),
          // Arrivée dans la salle.
          i.animate(
            [
              { transform: "scale(1.45)", filter: blur(12), opacity: 0 },
              { transform: "scale(1.12)", filter: blur(0), opacity: 1, offset: 0.4 },
              { transform: "scale(1.02)", filter: blur(0), opacity: 1 },
            ],
            opts(1550, 2350, "cubic-bezier(.2,.7,.2,1)"),
          ),
          // Nom du restaurant.
          t.animate(
            [
              { opacity: 0, transform: "translateY(14px)", letterSpacing: "0.02em" },
              { opacity: 1, transform: "translateY(0)", letterSpacing: "0.06em", offset: 0.35 },
              { opacity: 1, transform: "translateY(0)", letterSpacing: "0.08em", offset: 0.75 },
              { opacity: 0, transform: "translateY(-10px)", letterSpacing: "0.1em" },
            ],
            opts(150, 1500, "ease-out"),
          ),
          // Le menu apparaît.
          root.animate([{ opacity: 1 }, { opacity: 0 }], opts(DURATION - 600, 600, "ease-in-out")),
        ];
        animations.current.at(-1)!.onfinish = () => finish(false);
      });
    }

    return () => {
      cancelled = true;
      animations.current.forEach((a) => a.cancel());
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animation jouée une seule fois au montage
  }, []);

  if (done) return null;

  const origin = `${Math.round(focus.x * 100)}% ${Math.round(focus.y * 100)}%`;
  return (
    <div
      ref={rootRef}
      data-entrance=""
      className={`${replay ? "" : "vadc-entrance "}fixed inset-0 z-[100] overflow-hidden bg-black`}
      role="presentation"
      onClick={() => finish(true)}
    >
      {video && mode === "video" ? (
        <video
          ref={videoRef}
          className="absolute inset-0 size-full object-cover"
          muted
          playsInline
          preload="auto"
          poster={facade?.src}
          disablePictureInPicture
          disableRemotePlayback
          aria-hidden="true"
        >
          <source src={video.src} type={video.type === "video/quicktime" ? "video/mp4" : video.type} />
        </video>
      ) : null}
      {facade && interior && mode === "photos" ? (
        <>
          <img
            ref={interiorRef}
            src={interior.src}
            srcSet={interior.srcSet}
            sizes="100vw"
            alt=""
            decoding="async"
            className="absolute inset-0 size-full object-cover opacity-0 will-change-transform"
            style={{ transformOrigin: "50% 55%" }}
          />
          <img
            ref={facadeRef}
            src={facade.src}
            srcSet={facade.srcSet}
            sizes="100vw"
            alt=""
            decoding="async"
            fetchPriority="high"
            className="absolute inset-0 size-full object-cover will-change-transform"
            style={{ transformOrigin: origin }}
          />
        </>
      ) : null}
      <div
        ref={flashRef}
        className="pointer-events-none absolute inset-0 opacity-0"
        style={{ background: `radial-gradient(circle at ${origin}, rgba(255,236,200,.9), rgba(255,200,140,.25) 35%, transparent 70%)` }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,.55))]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/75 to-transparent" />
      <div ref={titleRef} className="pointer-events-none absolute inset-x-6 bottom-[18%] text-center text-white opacity-0">
        <p className="text-[12px] font-medium tracking-[0.35em] text-white/70 uppercase">{welcome}</p>
        <p className="m-display mt-2 text-[clamp(30px,8vw,56px)] leading-tight font-semibold drop-shadow-[0_4px_24px_rgba(0,0,0,.5)]">{name}</p>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          finish(true);
        }}
        className="absolute end-4 top-[max(1rem,env(safe-area-inset-top))] rounded-full bg-black/40 px-4 py-2 text-[13px] font-medium text-white ring-1 ring-white/25 backdrop-blur-md transition hover:bg-black/60"
      >
        {skipLabel}
      </button>
    </div>
  );
}
