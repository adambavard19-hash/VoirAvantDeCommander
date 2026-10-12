import "server-only";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { extensionOf } from "@/lib/storage/mime";
import { matchCategoryPreset } from "@/lib/categories";
import { createAssetFromBuffer, toAssetDto } from "@/lib/assets/service";
import { aiAvailable, aiErrorMessage } from "@/lib/ai";
import type { Prisma } from "@/generated/prisma/client";
import { extractArchive } from "./archive";
import { extractMenuDocument } from "./documents";
import { aiExtractMenu } from "./ai-extract";
import { groupMediaFiles, matchName, type Candidate, type MediaFile } from "./match";
import { normalizeDishName, normalizeName } from "./normalize";
import type {
  ExtractedDish,
  ExtractionResult,
  ImportCategoryProposal,
  ImportDishProposal,
  ImportMediaLink,
  ImportProposal,
  ImportUnmatchedFile,
} from "./types";

const UNSORTED = "À classer";

function sameLabel(a: string, b: string): boolean {
  const na = normalizeDishName(a).key;
  const nb = normalizeDishName(b).key;
  if (na && na === nb) return true;
  const pa = matchCategoryPreset(a);
  const pb = matchCategoryPreset(b);
  return !!pa && pa.key === pb?.key;
}

/** Décompresse les archives ZIP de l'import en fichiers individuels (une seule fois). */
async function expandArchives(restaurantId: string, jobId: string, userId: string | null, warnings: string[]) {
  const archives = await db.asset.findMany({ where: { importJobId: jobId, kind: "DOCUMENT", status: "READY" } });
  for (const archive of archives.filter((a) => extensionOf(a.originalName) === "zip")) {
    const meta = (archive.metadata as { extracted?: boolean } | null) ?? {};
    if (meta.extracted) continue;
    const buffer = await storage().getBuffer(archive.storageKey);
    if (!buffer) continue;
    try {
      const { entries, skipped } = extractArchive(buffer);
      for (const e of entries) {
        await createAssetFromBuffer({ restaurantId, userId, name: e.name, path: `${archive.originalName}/${e.path}`, buffer: e.data, importJobId: jobId });
      }
      if (skipped.length) warnings.push(`${archive.originalName} : ${skipped.length} fichier(s) ignoré(s) (${skipped.slice(0, 5).join(", ")}${skipped.length > 5 ? "…" : ""}).`);
      await db.asset.update({ where: { id: archive.id }, data: { metadata: { extracted: true, files: entries.length } } });
    } catch (error) {
      warnings.push(`${archive.originalName} : ${error instanceof Error ? error.message : "archive illisible"}`);
      await db.asset.update({ where: { id: archive.id }, data: { status: "FAILED", error: "Archive illisible" } });
    }
  }
}

export async function analyzeImport(params: {
  restaurantId: string;
  jobId: string;
  userId: string | null;
  useAi?: boolean;
}): Promise<ImportProposal> {
  const { restaurantId, jobId } = params;
  const warnings: string[] = [];
  await expandArchives(restaurantId, jobId, params.userId, warnings);

  const assets = await db.asset.findMany({ where: { importJobId: jobId }, orderBy: { createdAt: "asc" } });
  const failedFiles = assets
    .filter((a) => a.status === "FAILED" && extensionOf(a.originalName) !== "zip")
    .map((a) => ({ name: a.originalPath ?? a.originalName, error: a.error ?? "Fichier invalide" }));
  const ready = assets.filter((a) => a.status === "READY");

  // ─── 1. Documents de menu ───────────────────────────────────────────────
  const documents: ImportProposal["documents"] = [];
  const extracted: { dish: ExtractedDish; category: string }[] = [];
  for (const doc of ready.filter((a) => a.kind === "DOCUMENT" && extensionOf(a.originalName) !== "zip")) {
    const buffer = await storage().getBuffer(doc.storageKey);
    if (!buffer) continue;
    let result: ExtractionResult | null = null;
    let message: string | null = null;
    try {
      const isPdf = extensionOf(doc.originalName) === "pdf";
      if (isPdf && params.useAi && aiAvailable()) {
        result = await aiExtractMenu(buffer, doc.originalName);
      } else {
        result = await extractMenuDocument(buffer, doc.originalName);
        if (isPdf && aiAvailable() && result.categories.length === 0) {
          // PDF scanné ou mise en page illisible : seconde tentative par IA.
          result = await aiExtractMenu(buffer, doc.originalName);
        }
      }
      message = result.warnings.join(" ") || null;
    } catch (error) {
      message = aiErrorMessage(error);
    }
    const count = result?.categories.reduce((s, c) => s + c.dishes.length, 0) ?? 0;
    documents.push({
      assetId: doc.id,
      name: doc.originalName,
      status: result ? (count ? "parsed" : "empty") : "error",
      method: result?.method,
      dishes: count,
      message,
    });
    for (const c of result?.categories ?? []) for (const d of c.dishes) extracted.push({ dish: d, category: c.name });
  }

  // ─── 2. Brouillon actuel ────────────────────────────────────────────────
  const [existingCategories, existingDishes] = await Promise.all([
    db.category.findMany({ where: { restaurantId }, orderBy: { position: "asc" } }),
    db.dish.findMany({ where: { restaurantId }, orderBy: { position: "asc" } }),
  ]);

  const categories: ImportCategoryProposal[] = existingCategories.map((c) => ({ ref: `c:${c.id}`, name: c.name, existingId: c.id }));
  const categoryRef = (name: string): string => {
    const found = categories.find((c) => sameLabel(c.name, name));
    if (found) return found.ref;
    const preset = matchCategoryPreset(name);
    const label = preset && name === name.toUpperCase() ? preset.name : name;
    const ref = `n:${categories.length}`;
    categories.push({ ref, name: label, existingId: null });
    return ref;
  };

  // ─── 3. Plats extraits des documents ────────────────────────────────────
  const dishes: ImportDishProposal[] = [];
  const existingCandidates: Candidate[] = existingDishes.map((d) => ({ ref: `e:${d.id}`, name: d.name }));
  const current = (id: string) => {
    const d = existingDishes.find((x) => x.id === id)!;
    return { name: d.name, description: d.description, priceCents: d.priceCents, hasPhoto: !!d.photoAssetId, hasGlb: !!d.glbAssetId, hasUsdz: !!d.usdzAssetId };
  };

  for (const { dish, category } of extracted) {
    const norm = normalizeDishName(dish.name);
    // Même plat présent dans deux documents (CSV + PDF) : on fusionne.
    const duplicate = dishes.find((p) => p.action !== "skip" && normalizeDishName(p.name).key === norm.key && norm.key);
    if (duplicate) {
      duplicate.description ??= dish.description;
      duplicate.priceCents ??= dish.priceCents;
      if (!duplicate.allergens.length) duplicate.allergens = dish.allergens;
      continue;
    }
    const match = matchName(norm, existingCandidates);
    const proposal: ImportDishProposal = {
      ref: `d:${dishes.length}`,
      action: "create",
      existingDishId: null,
      existingMatch: null,
      categoryRef: categoryRef(category),
      name: dish.name,
      description: dish.description,
      priceCents: dish.priceCents,
      variants: dish.variants,
      allergens: dish.allergens,
      tags: dish.tags,
      current: null,
      media: { photo: null, glb: null, usdz: null },
      source: dish.source,
      flags: [...dish.flags],
    };
    if (match.status === "exact") {
      const id = match.candidate.ref.slice(2);
      proposal.action = "update";
      proposal.existingDishId = id;
      proposal.current = current(id);
      proposal.categoryRef = `c:${existingDishes.find((d) => d.id === id)!.categoryId}`;
    } else if (match.status === "suggested" && match.score >= 0.75) {
      const id = match.candidate.ref.slice(2);
      proposal.existingMatch = { dishId: id, name: match.candidate.name, score: match.score, confirmed: false };
      proposal.current = current(id);
    }
    dishes.push(proposal);
  }

  // ─── 4. Fichiers : photos et modèles 3D ─────────────────────────────────
  const thumb = new Map(ready.map((a) => [a.id, a.kind === "IMAGE" ? toAssetDto(a).thumbUrl : null]));
  const link = (f: MediaFile, confidence: ImportMediaLink["confidence"], score: number): ImportMediaLink => ({
    assetId: f.assetId,
    name: f.name,
    confidence,
    score,
    confirmed: confidence === "exact" || confidence === "explicit",
    thumbUrl: thumb.get(f.assetId) ?? null,
  });
  const media: MediaFile[] = ready
    .filter((a) => a.kind === "IMAGE" || a.kind === "MODEL_GLB" || a.kind === "MODEL_USDZ")
    .map((a) => ({ assetId: a.id, name: a.originalName, path: a.originalPath, kind: a.kind === "IMAGE" ? "image" : a.kind === "MODEL_GLB" ? "glb" : "usdz" }));
  const used = new Set<string>();
  const slotOf = (kind: MediaFile["kind"]) => (kind === "image" ? "photo" : kind) as "photo" | "glb" | "usdz";

  // 4a. Fichiers explicitement cités dans un tableau (colonnes photo / glb / usdz).
  extracted.forEach(({ dish }) => {
    if (!dish.files) return;
    const proposal = dishes.find((p) => p.name === dish.name);
    if (!proposal) return;
    for (const [slot, fileName] of Object.entries(dish.files) as ["photo" | "glb" | "usdz", string | undefined][]) {
      if (!fileName) continue;
      const wanted = fileName.split(/[\\/]/).pop()!.toLowerCase();
      const file = media.find((m) => !used.has(m.assetId) && m.name.toLowerCase() === wanted && slotOf(m.kind) === slot);
      if (file) {
        proposal.media[slot] = link(file, "explicit", 1);
        used.add(file.assetId);
      } else {
        proposal.flags.push(`Fichier cité introuvable dans l'import : ${fileName}`);
      }
    }
  });

  // 4b. Regroupement par nom puis correspondance avec les plats.
  const groups = groupMediaFiles(media.filter((m) => !used.has(m.assetId)));
  const proposalFor = (ref: string): ImportDishProposal => {
    if (ref.startsWith("d:")) return dishes.find((d) => d.ref === ref)!;
    const id = ref.slice(2);
    let p = dishes.find((d) => d.existingDishId === id && d.action === "update");
    if (!p) {
      const d = existingDishes.find((x) => x.id === id)!;
      p = {
        ref: `d:${dishes.length}`,
        action: "update",
        existingDishId: id,
        existingMatch: null,
        categoryRef: `c:${d.categoryId}`,
        name: d.name,
        description: null,
        priceCents: null,
        variants: [],
        allergens: [],
        tags: [],
        current: current(id),
        media: { photo: null, glb: null, usdz: null },
        source: "Plat existant",
        flags: [],
      };
      dishes.push(p);
    }
    return p;
  };
  const unmatched: ImportUnmatchedFile[] = [];
  const addUnmatched = (f: MediaFile, suggestions: { dishRef: string; score: number }[]) =>
    unmatched.push({ assetId: f.assetId, name: f.name, path: f.path ?? null, kind: f.kind, thumbUrl: thumb.get(f.assetId) ?? null, suggestions });

  for (const group of groups) {
    const files = [group.images[0], group.glbs[0], group.usdzs[0]].filter((f): f is MediaFile => !!f);
    const extras = [...group.images.slice(1), ...group.glbs.slice(1), ...group.usdzs.slice(1)];
    if (group.anonymous) {
      // Aucun indice dans le nom : l'utilisateur choisit le plat.
      for (const f of [...files, ...extras]) addUnmatched(f, []);
      continue;
    }
    const candidates: Candidate[] = [
      ...dishes.filter((d) => d.action === "create").map((d) => ({ ref: d.ref, name: d.name })),
      ...existingCandidates,
    ];
    const name = normalizeName(group.images[0]?.name ?? group.glbs[0]?.name ?? group.usdzs[0]!.name);
    const result = matchName(name, candidates);

    if (result.status === "none") {
      // Aucun plat correspondant : on propose de créer le plat à partir du nom de fichier.
      const folder = group.folder && !/^(photos?|images?|3d|models?|modeles?|glb|usdz|fichiers?|export|menu)$/i.test(group.folder) ? group.folder : null;
      const proposal: ImportDishProposal = {
        ref: `d:${dishes.length}`,
        action: "create",
        existingDishId: null,
        existingMatch: null,
        categoryRef: categoryRef(folder ?? UNSORTED),
        name: group.display,
        description: null,
        priceCents: null,
        variants: [],
        allergens: [],
        tags: [],
        current: null,
        media: { photo: null, glb: null, usdz: null },
        source: "Créé à partir des noms de fichiers",
        flags: ["Nom déduit du fichier : vérifiez-le", "Prix à renseigner"],
      };
      for (const f of files) proposal.media[slotOf(f.kind)] = link(f, "exact", 1);
      for (const f of extras) addUnmatched(f, [{ dishRef: proposal.ref, score: 1 }]);
      dishes.push(proposal);
      continue;
    }

    const target = proposalFor(result.candidate.ref);
    const confidence = result.status === "exact" ? "exact" : "suggested";
    for (const f of files) {
      const slot = slotOf(f.kind);
      if (!target.media[slot]) target.media[slot] = link(f, confidence, result.score);
      else addUnmatched(f, [{ dishRef: target.ref, score: result.score }]);
    }
    const alternatives = result.status === "suggested" ? result.alternatives : [];
    for (const f of extras) addUnmatched(f, [{ dishRef: target.ref, score: result.score }, ...alternatives.map((a) => ({ dishRef: proposalFor(a.candidate.ref).ref, score: a.score }))]);
  }

  // Catégorie « À classer » placée en dernier.
  const unsorted = categories.findIndex((c) => c.name === UNSORTED && !c.existingId);
  if (unsorted >= 0) categories.push(...categories.splice(unsorted, 1));

  if (!extracted.length && !media.length) warnings.push("Aucun document de menu ni fichier exploitable dans cet import.");
  return { version: 1, documents, categories, dishes, unmatched, failedFiles, warnings };
}

/** Résumé chiffré pour l'interface. */
export function proposalStats(p: ImportProposal) {
  const active = p.dishes.filter((d) => d.action !== "skip");
  const links = active.flatMap((d) => [d.media.photo, d.media.glb, d.media.usdz]).filter((l): l is ImportMediaLink => !!l);
  return {
    dishes: active.length,
    toCreate: active.filter((d) => d.action === "create").length,
    toUpdate: active.filter((d) => d.action === "update").length,
    autoLinked: links.filter((l) => l.confirmed).length,
    toValidate: links.filter((l) => !l.confirmed).length + active.filter((d) => d.existingMatch && !d.existingMatch.confirmed).length,
    unmatched: p.unmatched.length,
  };
}

export async function saveProposal(jobId: string, proposal: ImportProposal) {
  await db.importJob.update({ where: { id: jobId }, data: { proposal: proposal as unknown as Prisma.InputJsonValue, status: "REVIEW" } });
}
