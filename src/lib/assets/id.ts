import { randomBytes } from "node:crypto";

/** Identifiant unique, ordonnable dans le temps, sans caractère spécial (utilisable dans une URL). */
export function createId(): string {
  return `a${Date.now().toString(36)}${randomBytes(9).toString("hex")}`;
}
