"use client";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data: unknown,
  ) {
    super(message);
  }
}

/** Appel JSON vers l'API d'administration, avec message d'erreur lisible. */
export async function api<T = unknown>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
    headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    credentials: "same-origin",
  });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const d = data as { error?: string; details?: { path: string; message: string }[] } | null;
    const detail = d?.details?.[0] ? ` (${d.details[0].path ? `${d.details[0].path} : ` : ""}${d.details[0].message})` : "";
    // Session expirée : rechargement complet vers la connexion (l'état client est obsolète).
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (res.status === 401 && path.startsWith("/api/admin/")) window.location.href = "/admin/login";
    throw new ApiError((d?.error ?? `Erreur ${res.status}`) + detail, res.status, data);
  }
  return data as T;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Une erreur est survenue.";
}
