"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const EVENT = "vadc:favorites";

function read(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? "[]";
  } catch {
    return "[]"; // stockage indisponible (navigation privée)
  }
}

/** Favoris « Mes envies » : stockés uniquement sur l'appareil du client. */
export function useFavorites(slug: string) {
  const storageKey = `vadc:favorites:${slug}`;
  const raw = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("storage", onChange);
      window.addEventListener(EVENT, onChange);
      return () => {
        window.removeEventListener("storage", onChange);
        window.removeEventListener(EVENT, onChange);
      };
    },
    () => read(storageKey),
    () => "[]",
  );
  const ids = useMemo(() => {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  }, [raw]);

  const persist = useCallback(
    (next: string[]) => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // ignoré
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [storageKey],
  );

  const toggle = useCallback((id: string) => persist(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]), [ids, persist]);

  return { ids, has: (id: string) => ids.includes(id), toggle, clear: () => persist([]) };
}
