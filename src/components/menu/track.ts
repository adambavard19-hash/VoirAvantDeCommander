"use client";

export type TrackEvent = "MENU_VIEW" | "DISH_VIEW" | "MODEL_VIEW" | "AR_LAUNCH";

/**
 * Mesure d'audience anonyme : aucun cookie, aucun identifiant, aucune IP
 * conservée. Seuls des compteurs agrégés par jour sont incrémentés. Le signal
 * « Global Privacy Control » et « Do Not Track » sont respectés.
 */
export function track(slug: string, event: TrackEvent, dishId?: string) {
  if (typeof navigator === "undefined") return;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  if (nav.globalPrivacyControl || nav.doNotTrack === "1") return;
  const body = JSON.stringify({ slug, event, dishId });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/public/events", new Blob([body], { type: "application/json" }));
      return;
    }
  } catch {
    // on tente un fetch classique ci-dessous
  }
  fetch("/api/public/events", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(
    () => {},
  );
}
