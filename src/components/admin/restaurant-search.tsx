"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { api } from "./api";
import { StatusBadge } from "./status-badge";
import type { RestaurantStatus } from "@/generated/prisma/enums";

type Result = { id: string; name: string; slug: string; city: string | null; status: RestaurantStatus };

/** Recherche instantanée d'un restaurant (nom, ville ou adresse du menu). */
export function RestaurantSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!q.trim()) return;
    const t = window.setTimeout(async () => {
      try {
        const data = await api<{ restaurants: Result[] }>(`/api/admin/restaurants?q=${encodeURIComponent(q.trim())}`);
        setResults(data.restaurants.slice(0, 8));
        setActive(0);
      } catch {
        setResults([]);
      }
    }, 180);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => !boxRef.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={boxRef} className="relative max-w-xl">
      <label className="flex h-11 items-center gap-2.5 rounded-xl bg-white px-3.5 ring-1 ring-stone-200 focus-within:ring-2 focus-within:ring-saffron">
        <Search className="size-4.5 text-stone-400" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, results.length - 1));
            if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
            if (e.key === "Enter" && results[active]) router.push(`/admin/restaurants/${results[active].id}`);
          }}
          placeholder="Rechercher un restaurant (nom, ville, adresse du menu)…"
          className="h-full flex-1 bg-transparent text-[14.5px] outline-none placeholder:text-stone-400"
          aria-label="Rechercher un restaurant"
        />
      </label>
      {open && q.trim() ? (
        <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-stone-200">
          {results.length ? (
            <ul>
              {results.map((r, i) => (
                <li key={r.id}>
                  <Link
                    href={`/admin/restaurants/${r.id}`}
                    className={`flex items-center gap-3 px-4 py-2.5 text-[14px] ${i === active ? "bg-stone-50" : ""}`}
                    onMouseEnter={() => setActive(i)}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{r.name}</span>
                      <span className="block truncate text-[12px] text-stone-500">
                        {[r.city, `/menu/${r.slug}`].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <StatusBadge status={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-[13.5px] text-stone-500">Aucun restaurant trouvé.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
