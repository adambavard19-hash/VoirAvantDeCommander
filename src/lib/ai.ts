import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BetaContentBlockParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { z } from "zod";
import { env } from "@/lib/env";

/**
 * Accès optionnel à Claude (Anthropic) pour :
 *  - extraire un menu d'un PDF scanné ou d'une mise en page complexe ;
 *  - traduire automatiquement les contenus du menu.
 * Sans ANTHROPIC_API_KEY, ces fonctions sont simplement indisponibles :
 * le logiciel reste pleinement utilisable (analyse heuristique, saisie manuelle).
 */

export class AiUnavailableError extends Error {
  constructor() {
    super("Fonction IA non configurée (ANTHROPIC_API_KEY absente).");
  }
}

export class AiRefusalError extends Error {}

let client: Anthropic | null = null;

export function aiAvailable(): boolean {
  return !!env().ANTHROPIC_API_KEY;
}

export function aiModel(): string {
  return env().ANTHROPIC_MODEL || "claude-opus-5-5";
}

function anthropic(): Anthropic {
  if (!aiAvailable()) throw new AiUnavailableError();
  client ??= new Anthropic({ apiKey: env().ANTHROPIC_API_KEY, maxRetries: 3, timeout: 5 * 60 * 1000 });
  return client;
}

/** Repli automatique côté serveur si un classifieur de sécurité refuse la requête (modèles qui le prennent en charge). */
function supportsServerFallback(model: string): boolean {
  return /^claude-(opus-5|fable-5|sonnet-5-5)/.test(model);
}

/**
 * Appel à Claude avec sortie JSON validée par un schéma Zod.
 * Retourne l'objet validé ; lève une erreur explicite sinon.
 */
export async function aiStructured<S extends z.ZodType>(params: {
  schema: S;
  system: string;
  content: BetaContentBlockParam[];
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<z.infer<S>> {
  const model = aiModel();
  const fallback = supportsServerFallback(model);
  const response = await anthropic().beta.messages.parse({
    model,
    max_tokens: params.maxTokens ?? 16000,
    system: params.system,
    messages: [{ role: "user", content: params.content }],
    output_config: { format: betaZodOutputFormat(params.schema), effort: params.effort ?? "medium" },
    ...(fallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
  });
  if (response.stop_reason === "refusal") throw new AiRefusalError("La requête a été refusée par le modèle.");
  if (response.stop_reason === "max_tokens") throw new Error("Réponse IA tronquée (document trop long) : découpez le document.");
  if (!response.parsed_output) throw new Error("Réponse IA illisible.");
  return response.parsed_output as z.infer<S>;
}

export function aiErrorMessage(error: unknown): string {
  if (error instanceof AiUnavailableError || error instanceof AiRefusalError) return error.message;
  if (error instanceof Anthropic.AuthenticationError) return "Clé ANTHROPIC_API_KEY invalide.";
  if (error instanceof Anthropic.RateLimitError) return "Limite de requêtes IA atteinte, réessayez dans un instant.";
  if (error instanceof Anthropic.BadRequestError) return `Requête IA refusée : ${error.message}`;
  if (error instanceof Anthropic.APIError) return `Service IA indisponible (${error.status ?? "réseau"}).`;
  return error instanceof Error ? error.message : "Erreur IA inconnue.";
}
