/** Évolution réelle entre deux périodes : null si aucune donnée à comparer. */
export type Change = { kind: "pct"; value: number } | { kind: "new" } | { kind: "count"; value: number; label: string } | null;

export function changeBetween(current: number, previous: number): Change {
  if (previous === 0) return current > 0 ? { kind: "new" } : null;
  return { kind: "pct", value: Math.round(((current - previous) / previous) * 100) };
}
