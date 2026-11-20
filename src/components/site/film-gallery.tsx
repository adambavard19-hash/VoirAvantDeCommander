"use client";

import { useEffect, useRef, useState } from "react";

export type Film = { id: string; number: string; title: string; mood: string; src: string; poster: string };

/**
 * Les films de présentation. Un seul lecteur : choisir un film change la source
 * et lance la lecture (le visiteur a cliqué, donc le son est autorisé).
 */
export function FilmGallery({ films }: { films: Film[] }) {
  const [active, setActive] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const wantsPlay = useRef(false);
  const film = films[active];

  // Après un choix, le nouveau lecteur est monté : on lance la lecture.
  useEffect(() => {
    if (wantsPlay.current) void video.current?.play().catch(() => {});
  }, [active]);

  function choose(i: number) {
    if (i === active) {
      void video.current?.play().catch(() => {});
      return;
    }
    wantsPlay.current = true;
    setActive(i);
  }

  return (
    <div>
      <div className="overflow-hidden rounded-[22px] border border-white/[.08] bg-ink-2">
        <video
          ref={video}
          key={film.id}
          src={film.src}
          poster={film.poster}
          controls
          playsInline
          preload="none"
          aria-label={`Film ${film.number} — ${film.title}`}
          className="aspect-video w-full bg-ink"
        />
      </div>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2" aria-label="Choisir un film">
        {films.map((f, i) => {
          const on = i === active;
          return (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => choose(i)}
                aria-pressed={on}
                className={`group flex w-full items-center gap-4 rounded-[16px] border p-2.5 pr-4 text-left transition-colors ${
                  on ? "border-ivory/35 bg-white/[.05]" : "border-white/[.08] hover:border-white/20"
                }`}
              >
                <span className="relative block aspect-video w-28 shrink-0 overflow-hidden rounded-[10px] bg-ink">
                  <img src={f.poster} alt="" loading="lazy" className={`h-full w-full object-cover transition-opacity ${on ? "opacity-100" : "opacity-70 group-hover:opacity-100"}`} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[10.5px] tracking-[.28em] text-ivory/40 uppercase">{f.number}</span>
                  <span className="mt-1 block font-serif text-[22px] leading-tight text-ivory">{f.title}</span>
                  <span className="mt-0.5 block truncate text-[13px] text-ivory/50">{f.mood}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
