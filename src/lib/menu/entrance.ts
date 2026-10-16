/** Attribut posé sur <html> quand l'entrée animée ne doit pas (ou plus) être jouée. */
export const ENTRANCE_SEEN_ATTR = "data-entrance-seen";

export function entranceStorageKey(slug: string) {
  return `vadc-entree:${slug}`;
}

/**
 * Script exécuté avant l'affichage : masque immédiatement l'entrée si elle a déjà
 * été vue pendant la visite, ou si le téléphone demande de réduire les animations.
 */
export function entranceGateScript(storageKey: string) {
  const key = JSON.stringify(storageKey);
  return `try{if(sessionStorage.getItem(${key})||matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.setAttribute("${ENTRANCE_SEEN_ATTR}","1")}catch(e){}`;
}
