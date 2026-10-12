import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Concatène des classes Tailwind ; en cas de conflit (w-full / w-40…), la dernière l'emporte. */
export function cn(...values: ClassValue[]) {
  return twMerge(clsx(values));
}
