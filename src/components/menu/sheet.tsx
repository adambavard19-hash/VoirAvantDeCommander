"use client";

import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  label: string;
  closeLabel: string;
  children: ReactNode;
  /** Contenu fixé en bas du panneau (bouton d'action principal). */
  footer?: ReactNode;
  size?: "md" | "lg";
  dir?: "ltr" | "rtl";
  style?: React.CSSProperties;
};

/**
 * Exécute `fn` une fois retirée l'entrée d'historique ajoutée par un panneau.
 * Une navigation lancée au moment où le panneau se ferme serait sinon annulée
 * par le `history.back()` de fermeture.
 */
export function afterSheetClosed(fn: () => void) {
  if (!window.history.state?.vadcSheet) {
    fn();
    return;
  }
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    window.removeEventListener("popstate", run);
    window.setTimeout(fn, 0);
  };
  window.addEventListener("popstate", run);
  window.setTimeout(run, 800);
}

/**
 * Panneau : glisse depuis le bas sur téléphone (fermeture par glissement vers
 * le bas), fenêtre centrée sur ordinateur. Gère Échap, le bouton « retour » du
 * téléphone, le blocage du défilement et le piège de focus.
 */
export function Sheet({ open, onClose, label, closeLabel, children, footer, size = "lg", dir, style }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(0);
  const dragStart = useRef<number | null>(null);
  const close = useEffectEvent(() => onClose());
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setDrag(0);
  }

  // Bouton « retour » du téléphone : ferme le panneau au lieu de quitter le menu.
  useEffect(() => {
    if (!open) return;
    window.history.pushState({ vadcSheet: true }, "");
    const onPop = () => close();
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (window.history.state?.vadcSheet) window.history.back();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => panelRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab" && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusables.length) return;
        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: 0 });
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const startDrag = (y: number) => {
    if ((scrollRef.current?.scrollTop ?? 0) <= 0) dragStart.current = y;
  };
  const moveDrag = (y: number) => {
    if (dragStart.current === null) return;
    setDrag(Math.max(0, y - dragStart.current));
  };
  const endDrag = () => {
    if (dragStart.current === null) return;
    dragStart.current = null;
    if (drag > 110) onClose();
    else setDrag(0);
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center md:items-center md:p-6" dir={dir} style={style}>
      {/* Fond cliquable : la fermeture au clavier passe par Échap et le bouton du panneau. */}
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-black/55 backdrop-blur-[3px] animate-[fade-in_.25s_ease-out]" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`m-body relative flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-[var(--m-bg)] text-[var(--m-text)] shadow-[0_-20px_80px_-20px_rgba(0,0,0,.6)] outline-none md:rounded-[28px] ${
          size === "lg" ? "md:max-w-[880px]" : "md:max-w-[480px]"
        } ${drag ? "" : "transition-transform duration-300 ease-out"} animate-[sheet-up_.42s_cubic-bezier(.16,1,.3,1)] md:animate-[fade-up_.35s_cubic-bezier(.16,1,.3,1)]`}
        style={{ transform: drag ? `translateY(${drag}px)` : undefined }}
      >
        <div
          className="absolute inset-x-0 top-0 z-20 flex h-7 cursor-grab touch-none items-start justify-center pt-2.5 md:hidden"
          onTouchStart={(e) => startDrag(e.touches[0]!.clientY)}
          onTouchMove={(e) => moveDrag(e.touches[0]!.clientY)}
          onTouchEnd={endDrag}
          aria-hidden="true"
        >
          <span className="h-1.5 w-11 rounded-full bg-white/45 shadow-sm" />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="absolute end-3 top-3 z-30 grid size-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur-md transition hover:bg-black/60"
        >
          <X className="size-5" />
        </button>
        <div
          ref={scrollRef}
          className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain"
          onTouchStart={(e) => startDrag(e.touches[0]!.clientY)}
          onTouchMove={(e) => {
            if ((scrollRef.current?.scrollTop ?? 0) > 0) dragStart.current = null;
            moveDrag(e.touches[0]!.clientY);
          }}
          onTouchEnd={endDrag}
        >
          {children}
        </div>
        {footer ? <div className="relative z-10 border-t border-[var(--m-border)] bg-[var(--m-bg)] px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
