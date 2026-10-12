import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

/** Erreur métier transformée en réponse JSON par `handle`. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) => new HttpError(400, message, details);
export const unauthorized = (message = "Authentification requise.") => new HttpError(401, message);
export const forbidden = (message = "Accès refusé.") => new HttpError(403, message);
export const notFound = (message = "Introuvable.") => new HttpError(404, message);
export const conflict = (message: string) => new HttpError(409, message);
export const tooMany = (message = "Trop de tentatives, réessayez plus tard.") => new HttpError(429, message);

/** Exécute un gestionnaire d'API et convertit les erreurs en réponses JSON homogènes. */
export async function handle(fn: () => Promise<Response | unknown>): Promise<Response> {
  try {
    const result = await fn();
    if (result instanceof Response) return result;
    return NextResponse.json(result ?? { ok: true });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message, details: error.details }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Données invalides.",
          details: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
        { status: 400 },
      );
    }
    console.error("[api] erreur inattendue", error);
    return NextResponse.json({ error: "Erreur interne. Réessayez." }, { status: 500 });
  }
}

/**
 * Défense CSRF en profondeur (en plus des cookies SameSite=Lax) : une requête
 * modifiante doit provenir du même site.
 */
export function assertSameOrigin(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const origin = request.headers.get("origin");
  if (!origin) return; // clients non navigateur (tests, scripts) : le cookie SameSite protège déjà
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw forbidden("Origine invalide.");
  }
  if (!host || originHost !== host) throw forbidden("Origine non autorisée.");
}

export async function readJson<T = unknown>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw badRequest("Corps JSON invalide.");
  }
}

/** Adresse IP du client (première entrée de X-Forwarded-For derrière un proxy de confiance). */
export function clientIp(request: Request): string | null {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return request.headers.get("x-real-ip");
}

/**
 * Fabrique un gestionnaire de route : contrôle d'origine + gestion d'erreurs
 * homogène + paramètres d'URL déjà résolus.
 */
export function route<P extends Record<string, string> = Record<string, never>>(
  handler: (request: Request, params: P) => Promise<Response | unknown>,
) {
  return async (request: Request, ctx: { params: Promise<P> }) =>
    handle(async () => {
      assertSameOrigin(request);
      return handler(request, await ctx.params);
    });
}
