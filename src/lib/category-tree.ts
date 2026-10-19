/**
 * Sous-catégories (un seul niveau) : « Plats › Burgers ».
 * Ordre d'affichage : chaque catégorie principale suivie de ses sous-catégories.
 */
export type TreeItem = { id: string; parentId?: string | null; position: number };

export function orderCategoryTree<T extends TreeItem>(categories: T[], opts: { dropOrphans?: boolean } = {}): T[] {
  const ids = new Set(categories.map((c) => c.id));
  const byPos = (a: T, b: T) => a.position - b.position;
  // Une sous-catégorie dont la parente est absente (masquée, supprimée) : retirée ou remontée.
  const isRoot = (c: T) => !c.parentId || !ids.has(c.parentId);
  const roots = categories.filter((c) => isRoot(c) && !(opts.dropOrphans && c.parentId)).sort(byPos);
  return roots.flatMap((root) => [root, ...categories.filter((c) => c.parentId === root.id).sort(byPos)]);
}

/** Libellé complet d'une catégorie : « Plats › Burgers ». */
export function categoryPath(c: { name: string; parentId?: string | null }, all: { id: string; name: string }[]): string {
  const parent = c.parentId ? all.find((p) => p.id === c.parentId) : null;
  return parent ? `${parent.name} › ${c.name}` : c.name;
}
