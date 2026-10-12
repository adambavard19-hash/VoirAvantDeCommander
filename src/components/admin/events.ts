"use client";

/** Signale qu'une modification du brouillon a eu lieu (met à jour le bouton « Publier »). */
export function notifyMenuChanged() {
  window.dispatchEvent(new Event("vadc:menu-changed"));
}
