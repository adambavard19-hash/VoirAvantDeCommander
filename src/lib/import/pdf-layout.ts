/**
 * Reconstruction des lignes de texte d'une page PDF à partir des fragments
 * positionnés : regroupe par ligne, gère les prix alignés à droite et les
 * menus en plusieurs colonnes.
 */
export type PositionedText = { str: string; x: number; y: number; width: number; fontSize: number };

const PRICE_ONLY = /^[€$£]?\s?\d{1,4}(?:[.,]\d{1,2})?\s?(?:€|eur(?:os?)?|chf|£|\$)?(?:\d{2})?$/i;

type Segment = { x: number; end: number; text: string };

export function layoutPage(items: PositionedText[]): string[] {
  const parts = items.filter((i) => i.str.trim());
  if (!parts.length) return [];
  const sizes = parts.map((p) => p.fontSize || 10).sort((a, b) => a - b);
  const median = sizes[Math.floor(sizes.length / 2)] ?? 10;
  const pageWidth = Math.max(...parts.map((p) => p.x + p.width));
  const pageLeft = Math.min(...parts.map((p) => p.x));

  // 1. Lignes : fragments de même ordonnée (tolérance liée à la taille de police).
  const sorted = [...parts].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: PositionedText[][] = [];
  for (const p of sorted) {
    const line = lines.find((l) => Math.abs(l[0]!.y - p.y) <= median * 0.45);
    if (line) line.push(p);
    else lines.push([p]);
  }
  lines.sort((a, b) => b[0]!.y - a[0]!.y);

  // 2. Segments : coupure aux grands espaces ; un prix isolé rejoint le segment précédent.
  const columnGap = Math.max(median * 4, (pageWidth - pageLeft) * 0.06);
  const lineSegments: { y: number; segments: Segment[] }[] = lines.map((line) => {
    line.sort((a, b) => a.x - b.x);
    const segments: Segment[] = [];
    for (const p of line) {
      const last = segments[segments.length - 1];
      const gap = last ? p.x - last.end : Infinity;
      if (last && gap < columnGap) {
        last.text += gap > median * 1.6 ? `   ${p.str}` : gap > median * 0.15 && !last.text.endsWith(" ") && !p.str.startsWith(" ") ? ` ${p.str}` : p.str;
        last.end = p.x + p.width;
      } else if (last && PRICE_ONLY.test(p.str.trim())) {
        last.text += `   ${p.str.trim()}`;
        last.end = p.x + p.width;
      } else {
        segments.push({ x: p.x, end: p.x + p.width, text: p.str });
      }
    }
    return { y: line[0]!.y, segments: segments.map((s) => ({ ...s, text: s.text.replace(/\s+$/, "") })) };
  });

  // 3. Colonnes : si des segments commencent nettement plus à droite sur de nombreuses lignes.
  const starts = lineSegments.flatMap((l) => l.segments.slice(1).map((s) => s.x));
  let boundary: number | null = null;
  if (starts.length >= 3) {
    const candidate = starts.sort((a, b) => a - b)[Math.floor(starts.length / 2)]!;
    const multi = lineSegments.filter((l) => l.segments.length > 1).length;
    if (multi >= 3 && candidate > pageLeft + (pageWidth - pageLeft) * 0.3) boundary = candidate - median;
  }
  if (boundary === null) return lineSegments.map((l) => l.segments.map((s) => s.text).join("   "));

  const left: string[] = [];
  const right: string[] = [];
  for (const l of lineSegments) {
    const leftText = l.segments.filter((s) => s.x < boundary!).map((s) => s.text).join("   ");
    const rightText = l.segments.filter((s) => s.x >= boundary!).map((s) => s.text).join("   ");
    if (leftText) left.push(leftText);
    if (rightText) right.push(rightText);
    // Les espacements verticaux importants séparent les blocs.
  }
  return [...left, "", ...right];
}
