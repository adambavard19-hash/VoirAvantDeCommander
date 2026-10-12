import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function sha256(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hmac(secret: string, data: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Jeton signé et daté : base64url(payload JSON).signature.
 * Utilisé pour les URL de téléversement en stockage local.
 */
export function signPayload(secret: string, payload: Record<string, unknown>, ttlSeconds: number): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString(
    "base64url",
  );
  return `${body}.${hmac(secret, body)}`;
}

export function verifyPayload<T extends Record<string, unknown>>(secret: string, token: string): T | null {
  const [body, sig] = token.split(".");
  if (!body || !sig || !safeEqual(sig, hmac(secret, body))) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & { exp: number };
    if (typeof data.exp !== "number" || data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}
