"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { cn } from "./cn";

type Toast = { id: number; tone: "success" | "error" | "info"; message: string };
type ToastApi = { success: (m: string) => void; error: (m: string) => void; info: (m: string) => void };

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((tone: Toast["tone"], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, tone, message }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 7000 : 3800);
  }, []);
  const api: ToastApi = {
    success: (m) => push("success", m),
    error: (m) => push("error", m),
    info: (m) => push("info", m),
  };
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:pe-6" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl px-4 py-3 text-[14px] shadow-lg ring-1 animate-[fade-up_.3s_ease-out]",
              t.tone === "success" && "bg-white text-stone-900 ring-emerald-200",
              t.tone === "error" && "bg-white text-stone-900 ring-red-200",
              t.tone === "info" && "bg-white text-stone-900 ring-stone-200",
            )}
          >
            {t.tone === "success" ? <CircleCheck className="mt-0.5 size-4.5 shrink-0 text-emerald-600" /> : null}
            {t.tone === "error" ? <CircleAlert className="mt-0.5 size-4.5 shrink-0 text-red-600" /> : null}
            {t.tone === "info" ? <Info className="mt-0.5 size-4.5 shrink-0 text-sky-600" /> : null}
            <span className="flex-1">{t.message}</span>
            <button type="button" aria-label="Fermer" onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))} className="text-stone-400 hover:text-stone-700">
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast doit être utilisé dans ToastProvider");
  return ctx;
}
