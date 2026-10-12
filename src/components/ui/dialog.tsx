"use client";

import { useEffect, useEffectEvent, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "./cn";

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const close = useEffectEvent(() => onClose());

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>("input, textarea, select, button[data-autofocus]");
      (first ?? panelRef.current)?.focus();
    }, 20);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-stone-950/40 backdrop-blur-[2px] animate-[fade-in_.2s_ease-out]" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          "relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl outline-none animate-[fade-up_.25s_ease-out] sm:rounded-2xl",
          size === "sm" && "sm:max-w-md",
          size === "md" && "sm:max-w-lg",
          size === "lg" && "sm:max-w-3xl",
          size === "xl" && "sm:max-w-6xl",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-stone-100 px-5 py-4">
          <div>
            <h2 className="text-[16px] font-semibold text-stone-900">{title}</h2>
            {description ? <p className="mt-0.5 text-[13px] text-stone-500">{description}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="grid size-8 place-items-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700">
            <X className="size-4.5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-stone-100 bg-stone-50/60 px-5 py-3.5">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
