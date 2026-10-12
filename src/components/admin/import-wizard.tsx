"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Box,
  Check,
  CircleAlert,
  CircleCheck,
  FileArchive,
  FileBox,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  ImageIcon,
  LoaderCircle,
  Sparkles,
  TriangleAlert,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Badge, Card, CardHeader } from "@/components/ui/card";
import { Input, Select, Switch, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/components/ui/cn";
import { ALLERGENS, ALLERGEN_CODES } from "@/lib/allergens";
import { centsToInput, formatPrice, parsePrice } from "@/lib/money";
import { categorizeFile } from "@/lib/storage/mime";
import type { ImportDishProposal, ImportMediaLink, ImportProposal, ImportReport, ImportUnmatchedFile } from "@/lib/import/types";
import { api, errorMessage } from "./api";
import { notifyMenuChanged } from "./events";
import { filesFromDataTransfer, uploadFiles, type UploadItem, type UploadProgress } from "./upload";

type Stats = { dishes: number; toCreate: number; toUpdate: number; autoLinked: number; toValidate: number; unmatched: number };
type Slot = "photo" | "glb" | "usdz";

type Props = {
  restaurantId: string;
  aiAvailable: boolean;
  initialJob: { id: string; status: string; files: number } | null;
  initialProposal: ImportProposal | null;
  initialStats: Stats | null;
  existingDishes: { id: string; name: string }[];
  existingCategories: { id: string; name: string }[];
  history: { id: string; appliedAt: string | null; report: Record<string, number> | null }[];
};

const SLOT_LABEL: Record<Slot, string> = { photo: "Photo", glb: "GLB", usdz: "USDZ" };
const KIND_TO_SLOT: Record<ImportUnmatchedFile["kind"], Slot> = { image: "photo", glb: "glb", usdz: "usdz" };

function computeStats(p: ImportProposal): Stats {
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

function needsReview(d: ImportDishProposal): boolean {
  if (d.action === "skip") return false;
  return (
    [d.media.photo, d.media.glb, d.media.usdz].some((l) => l && !l.confirmed) ||
    (!!d.existingMatch && !d.existingMatch.confirmed) ||
    d.flags.length > 0
  );
}

function FileTypeIcon({ name, className }: { name: string; className?: string }) {
  const c = categorizeFile(name);
  if (c === "image") return <ImageIcon className={className} />;
  if (c === "glb") return <Box className={className} />;
  if (c === "usdz") return <FileBox className={className} />;
  if (c === "archive") return <FileArchive className={className} />;
  if (name.toLowerCase().endsWith(".pdf") || name.toLowerCase().endsWith(".txt")) return <FileText className={className} />;
  return <FileSpreadsheet className={className} />;
}

// ─── Étape 1 : dépôt des fichiers ────────────────────────────────────────────

function DropZone({ onFiles, disabled }: { onFiles: (items: UploadItem[]) => void; disabled: boolean }) {
  const [over, setOver] = useState(false);
  const filesInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setOver(false);
        if (disabled) return;
        onFiles(await filesFromDataTransfer(e.dataTransfer));
      }}
      className={cn(
        "relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition",
        over ? "border-saffron bg-amber-50" : "border-stone-300 bg-white",
        disabled && "opacity-60",
      )}
    >
      <div className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-saffron to-coral text-white shadow-lg">
        <Upload className="size-6" />
      </div>
      <h2 className="mt-5 text-lg font-semibold">Déposez tous les fichiers du restaurant en une fois</h2>
      <p className="mt-1.5 max-w-xl text-[14px] text-stone-500">
        Photos (JPEG, PNG, WebP), modèles 3D (.glb et .usdz), menu (PDF, Excel, CSV, texte) — ou une archive .zip, ou un dossier entier. Les
        fichiers d&apos;un même plat sont reconnus par leur nom : <code className="rounded bg-stone-100 px-1">burger-maison.glb</code> +{" "}
        <code className="rounded bg-stone-100 px-1">burger-maison.usdz</code> + <code className="rounded bg-stone-100 px-1">burger-maison.jpg</code>.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button variant="accent" onClick={() => filesInput.current?.click()} disabled={disabled}>
          <Upload className="size-4" /> Choisir des fichiers
        </Button>
        <Button variant="secondary" onClick={() => folderInput.current?.click()} disabled={disabled}>
          <FolderOpen className="size-4" /> Choisir un dossier
        </Button>
      </div>
      <input
        ref={filesInput}
        type="file"
        multiple
        className="hidden"
        accept=".jpg,.jpeg,.png,.webp,.avif,.glb,.usdz,.pdf,.csv,.xlsx,.txt,.zip"
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []).map((file) => ({ file })));
          e.target.value = "";
        }}
      />
      <input
        ref={folderInput}
        type="file"
        multiple
        className="hidden"
        {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
        onChange={(e) => {
          onFiles(
            Array.from(e.target.files ?? [])
              .filter((file) => !file.name.startsWith("."))
              .map((file) => ({ file, path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || undefined })),
          );
          e.target.value = "";
        }}
      />
    </div>
  );
}

// ─── Étape 2 : relecture ─────────────────────────────────────────────────────

function MediaSlot({
  slot,
  link,
  options,
  onConfirm,
  onRemove,
  onAssign,
}: {
  slot: Slot;
  link: ImportMediaLink | null;
  options: ImportUnmatchedFile[];
  onConfirm: () => void;
  onRemove: () => void;
  onAssign: (assetId: string) => void;
}) {
  const tone = !link ? "empty" : link.confirmed ? "ok" : "pending";
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-xl px-2.5 py-2 ring-1",
        tone === "ok" && "bg-emerald-50/60 ring-emerald-200",
        tone === "pending" && "bg-amber-50 ring-amber-300",
        tone === "empty" && "bg-stone-50 ring-stone-200",
      )}
    >
      <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-white ring-1 ring-stone-200">
        {slot === "photo" && link?.thumbUrl ? <img src={link.thumbUrl} alt="" className="size-full object-cover" /> : slot === "photo" ? <ImageIcon className="size-4 text-stone-400" /> : slot === "glb" ? <Box className="size-4 text-stone-400" /> : <FileBox className="size-4 text-stone-400" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold tracking-wide text-stone-500 uppercase">{SLOT_LABEL[slot]}</p>
        {link ? (
          <p className="truncate text-[12.5px] text-stone-800" title={link.name}>
            {link.name}
          </p>
        ) : options.length ? (
          <select
            value=""
            onChange={(e) => e.target.value && onAssign(e.target.value)}
            className="w-full truncate bg-transparent text-[12.5px] text-stone-500 outline-none"
            aria-label={`Associer un fichier ${SLOT_LABEL[slot]}`}
          >
            <option value="">Associer un fichier…</option>
            {options.map((o) => (
              <option key={o.assetId} value={o.assetId}>
                {o.path ?? o.name}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-[12.5px] text-stone-400">—</p>
        )}
      </div>
      {link && !link.confirmed ? (
        <button type="button" onClick={onConfirm} className="grid size-7 place-items-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700" aria-label="Valider l'association" title={`Valider (ressemblance ${Math.round(link.score * 100)} %)`}>
          <Check className="size-3.5" />
        </button>
      ) : null}
      {link ? (
        <button type="button" onClick={onRemove} className="grid size-7 place-items-center rounded-lg text-stone-500 hover:bg-white" aria-label="Dissocier le fichier" title="Dissocier">
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function DishProposalRow({
  dish,
  proposal,
  onChange,
  onMedia,
}: {
  dish: ImportDishProposal;
  proposal: ImportProposal;
  onChange: (patch: Partial<ImportDishProposal>) => void;
  onMedia: (slot: Slot, action: "confirm" | "remove" | { assign: string }) => void;
}) {
  const [price, setPrice] = useState(centsToInput(dish.priceCents));
  const [open, setOpen] = useState(false);
  const skipped = dish.action === "skip";
  const optionsFor = (slot: Slot) => proposal.unmatched.filter((u) => KIND_TO_SLOT[u.kind] === slot);
  const isUpdate = dish.action === "update";

  return (
    <li className={cn("px-4 py-4", skipped && "bg-stone-50 opacity-60")}>
      <div className="flex flex-wrap items-start gap-3">
        <Select value={dish.action} onChange={(e) => onChange({ action: e.target.value as ImportDishProposal["action"] })} className="h-9 w-[150px] text-[13px]" aria-label="Action">
          {isUpdate || dish.existingDishId ? <option value="update">Mettre à jour</option> : <option value="create">Créer</option>}
          <option value="skip">Ignorer</option>
        </Select>
        <div className="min-w-[200px] flex-1">
          {isUpdate ? (
            <p className="flex h-9 items-center text-[14.5px] font-semibold">{dish.current?.name ?? dish.name}</p>
          ) : (
            <Input value={dish.name} onChange={(e) => onChange({ name: e.target.value })} className="h-9 font-semibold" aria-label="Nom du plat" />
          )}
          <p className="mt-1 text-[11.5px] text-stone-400">{dish.source}</p>
        </div>
        <Select
          value={dish.categoryRef}
          onChange={(e) => onChange({ categoryRef: e.target.value })}
          className="h-9 w-[180px] text-[13px]"
          aria-label="Catégorie"
          disabled={isUpdate}
        >
          {proposal.categories.map((c) => (
            <option key={c.ref} value={c.ref}>
              {c.name}
              {c.existingId ? "" : " (nouvelle)"}
            </option>
          ))}
        </Select>
        <label className="flex h-9 w-[120px] items-center rounded-xl bg-white ring-1 ring-stone-200 focus-within:ring-2 focus-within:ring-saffron">
          <input
            value={price}
            inputMode="decimal"
            placeholder={isUpdate && dish.current?.priceCents != null ? centsToInput(dish.current.priceCents) : "Prix"}
            onChange={(e) => setPrice(e.target.value)}
            onBlur={() => {
              const cents = price.trim() ? parsePrice(price) : null;
              if (price.trim() && cents === null) setPrice(centsToInput(dish.priceCents));
              else onChange({ priceCents: cents });
            }}
            className="h-full w-full min-w-0 bg-transparent ps-3 text-end text-[13.5px] tabular-nums outline-none"
            aria-label="Prix"
          />
          <span className="pe-3 ps-1 text-[12px] text-stone-400">€</span>
        </label>
      </div>

      {isUpdate && dish.current && dish.priceCents !== null && dish.priceCents !== dish.current.priceCents ? (
        <p className="mt-2 text-[12.5px] text-sky-800">
          Prix : {dish.current.priceCents !== null ? formatPrice(dish.current.priceCents) : "aucun"} → <strong>{formatPrice(dish.priceCents)}</strong>
        </p>
      ) : null}

      {dish.existingMatch && !dish.existingDishId ? (
        <div className={cn("mt-3 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-[13px] ring-1", dish.existingMatch.confirmed ? "bg-sky-50 ring-sky-200" : "bg-amber-50 ring-amber-300")}>
          <TriangleAlert className="size-4 text-amber-700" />
          <span>
            Ressemble au plat existant « <strong>{dish.existingMatch.name}</strong> » ({Math.round(dish.existingMatch.score * 100)} %).
          </span>
          {dish.existingMatch.confirmed ? (
            <>
              <Badge tone="info">Mise à jour de ce plat</Badge>
              <Button size="sm" variant="ghost" onClick={() => onChange({ existingMatch: { ...dish.existingMatch!, confirmed: false } })}>
                Annuler
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="secondary" onClick={() => onChange({ existingMatch: { ...dish.existingMatch!, confirmed: true } })}>
                C&apos;est le même plat
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onChange({ existingMatch: null })}>
                Non, c&apos;est un nouveau plat
              </Button>
            </>
          )}
        </div>
      ) : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {(["photo", "glb", "usdz"] as const).map((slot) => (
          <MediaSlot
            key={slot}
            slot={slot}
            link={dish.media[slot]}
            options={optionsFor(slot)}
            onConfirm={() => onMedia(slot, "confirm")}
            onRemove={() => onMedia(slot, "remove")}
            onAssign={(assetId) => onMedia(slot, { assign: assetId })}
          />
        ))}
      </div>

      {dish.flags.length ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {dish.flags.map((f) => (
            <li key={f} className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11.5px] text-stone-600">
              {f}
            </li>
          ))}
        </ul>
      ) : null}

      <button type="button" onClick={() => setOpen((o) => !o)} className="mt-2 text-[12.5px] font-medium text-stone-500 hover:text-stone-900">
        {open ? "Masquer les détails" : `Description et allergènes${dish.allergens.length ? ` (${dish.allergens.length})` : ""}`}
      </button>
      {open ? (
        <div className="mt-2 space-y-3">
          <Textarea rows={2} value={dish.description ?? ""} placeholder={isUpdate ? (dish.current?.description ?? "Description inchangée") : "Description"} onChange={(e) => onChange({ description: e.target.value || null })} />
          <div className="flex flex-wrap gap-1.5">
            {ALLERGEN_CODES.map((code) => {
              const on = dish.allergens.includes(code);
              return (
                <button
                  key={code}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onChange({ allergens: on ? dish.allergens.filter((a) => a !== code) : [...dish.allergens, code] })}
                  className={cn("h-7 rounded-full px-2.5 text-[12px] ring-1", on ? "bg-red-50 text-red-800 ring-red-300" : "text-stone-600 ring-stone-200")}
                >
                  {ALLERGENS[code].fr}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </li>
  );
}

// ─── Assistant complet ───────────────────────────────────────────────────────

export function ImportWizard({ restaurantId, aiAvailable, initialJob, initialProposal, existingDishes, history }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [jobId, setJobId] = useState<string | null>(initialJob?.id ?? null);
  const [uploadedCount, setUploadedCount] = useState(initialJob?.files ?? 0);
  const [progress, setProgress] = useState<UploadProgress[]>([]);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [useAi, setUseAi] = useState(false);
  const [proposal, setProposal] = useState<ImportProposal | null>(initialProposal);
  const [filter, setFilter] = useState<"review" | "all" | "unmatched" | "documents">("review");
  const [applying, setApplying] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const saveTimer = useRef<number | null>(null);

  const stats = useMemo(() => (proposal ? computeStats(proposal) : null), [proposal]);

  // Enregistrement automatique des corrections (reprise possible après rechargement).
  const scheduleSave = useCallback(
    (next: ImportProposal) => {
      if (!jobId) return;
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        api(`/api/admin/restaurants/${restaurantId}/imports/${jobId}`, { method: "PUT", body: { proposal: next } }).catch(() => {});
      }, 900);
    },
    [jobId, restaurantId],
  );
  useEffect(() => () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
  }, []);

  const update = (fn: (p: ImportProposal) => ImportProposal) => {
    setProposal((p) => {
      if (!p) return p;
      const next = fn(structuredClone(p));
      scheduleSave(next);
      return next;
    });
  };

  const ensureJob = async () => {
    if (jobId) return jobId;
    const { job } = await api<{ job: { id: string } }>(`/api/admin/restaurants/${restaurantId}/imports`, { body: {} });
    setJobId(job.id);
    return job.id;
  };

  const onFiles = async (items: UploadItem[]) => {
    if (!items.length) return;
    setUploading(true);
    try {
      const id = await ensureJob();
      const { assets, rejected } = await uploadFiles(restaurantId, items, { importJobId: id, onProgress: setProgress, concurrency: 4 });
      setUploadedCount((n) => n + assets.length);
      const failed = assets.filter((a) => a.status !== "READY").length;
      if (rejected.length || failed) toast.error(`${rejected.length + failed} fichier(s) non retenu(s) : voir le détail ci-dessous.`);
      else toast.success(`${assets.length} fichier(s) téléversé(s).`);
      if (proposal) setProposal(null); // de nouveaux fichiers imposent une nouvelle analyse
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUploading(false);
    }
  };

  const analyze = async () => {
    if (!jobId) return;
    setAnalyzing(true);
    try {
      const res = await api<{ proposal: ImportProposal }>(`/api/admin/restaurants/${restaurantId}/imports/${jobId}/analyze`, { body: { useAi } });
      setProposal(res.proposal);
      setFilter(computeStats(res.proposal).toValidate > 0 ? "review" : "all");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setAnalyzing(false);
    }
  };

  const cancel = async () => {
    if (!jobId || !window.confirm("Abandonner cet import ? Les fichiers téléversés non utilisés seront supprimés.")) return;
    await api(`/api/admin/restaurants/${restaurantId}/imports/${jobId}`, { method: "DELETE" }).catch(() => {});
    setJobId(null);
    setProposal(null);
    setProgress([]);
    setUploadedCount(0);
    router.refresh();
  };

  const apply = async () => {
    if (!jobId || !proposal) return;
    const pending = stats?.toValidate ?? 0;
    if (pending && !window.confirm(`${pending} suggestion(s) non validée(s) seront ignorées. Continuer ?`)) return;
    setApplying(true);
    try {
      const res = await api<{ report: ImportReport }>(`/api/admin/restaurants/${restaurantId}/imports/${jobId}/apply`, { body: { proposal } });
      setReport(res.report);
      setProposal(null);
      setJobId(null);
      notifyMenuChanged();
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setApplying(false);
    }
  };

  const updateDish = (ref: string, patch: Partial<ImportDishProposal>) =>
    update((p) => {
      const d = p.dishes.find((x) => x.ref === ref)!;
      Object.assign(d, patch);
      return p;
    });

  const mediaAction = (ref: string, slot: Slot, action: "confirm" | "remove" | { assign: string }) =>
    update((p) => {
      const d = p.dishes.find((x) => x.ref === ref)!;
      const current = d.media[slot];
      if (action === "confirm" && current) current.confirmed = true;
      else if (action === "remove" && current) {
        d.media[slot] = null;
        p.unmatched.push({ assetId: current.assetId, name: current.name, path: null, kind: slot === "photo" ? "image" : slot, thumbUrl: current.thumbUrl ?? null, suggestions: [{ dishRef: ref, score: current.score }] });
      } else if (typeof action === "object") {
        const file = p.unmatched.find((u) => u.assetId === action.assign);
        if (!file) return p;
        if (current) p.unmatched.push({ assetId: current.assetId, name: current.name, path: null, kind: slot === "photo" ? "image" : slot, thumbUrl: current.thumbUrl ?? null, suggestions: [] });
        d.media[slot] = { assetId: file.assetId, name: file.name, confidence: "manual", score: 1, confirmed: true, thumbUrl: file.thumbUrl };
        p.unmatched = p.unmatched.filter((u) => u.assetId !== file.assetId);
      }
      return p;
    });

  const assignUnmatched = (file: ImportUnmatchedFile, dishRef: string) => mediaAction(dishRef, KIND_TO_SLOT[file.kind], { assign: file.assetId });

  const createFromUnmatched = (file: ImportUnmatchedFile) =>
    update((p) => {
      const ref = `d:${p.dishes.length}-${Date.now()}`;
      const unsorted = p.categories.find((c) => c.name === "À classer") ?? (() => {
        const c = { ref: `n:${p.categories.length}`, name: "À classer", existingId: null };
        p.categories.push(c);
        return c;
      })();
      const slot = KIND_TO_SLOT[file.kind];
      p.dishes.push({
        ref,
        action: "create",
        existingDishId: null,
        existingMatch: null,
        categoryRef: unsorted.ref,
        name: file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "),
        description: null,
        priceCents: null,
        variants: [],
        allergens: [],
        tags: [],
        current: null,
        media: { photo: null, glb: null, usdz: null, [slot]: { assetId: file.assetId, name: file.name, confidence: "manual", score: 1, confirmed: true, thumbUrl: file.thumbUrl } },
        source: "Créé manuellement",
        flags: ["Nom à vérifier", "Prix à renseigner"],
      });
      p.unmatched = p.unmatched.filter((u) => u.assetId !== file.assetId);
      return p;
    });

  const confirmAllExact = () =>
    update((p) => {
      for (const d of p.dishes) for (const slot of ["photo", "glb", "usdz"] as const) {
        const l = d.media[slot];
        if (l && !l.confirmed && l.score >= 0.85) l.confirmed = true;
      }
      return p;
    });

  const done = progress.filter((p) => p.status === "done").length;
  const errors = progress.filter((p) => p.status === "error");
  const visibleDishes = proposal
    ? proposal.dishes.filter((d) => (filter === "review" ? needsReview(d) : filter === "all" ? true : false))
    : [];
  const dishLabel = (ref: string) => {
    const d = proposal?.dishes.find((x) => x.ref === ref);
    return d ? (d.current?.name ?? d.name) : ref;
  };

  // ─── Compte rendu après application ───
  if (report) {
    return (
      <Card className="p-8 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
          <CircleCheck className="size-7" />
        </div>
        <h2 className="mt-5 text-xl font-semibold">Import appliqué au brouillon</h2>
        <p className="mx-auto mt-2 max-w-lg text-[14px] text-stone-500">
          {report.dishesCreated} plat(s) créé(s), {report.dishesUpdated} mis à jour, {report.categoriesCreated} catégorie(s) créée(s), {report.mediaAttached} fichier(s)
          associé(s){report.skippedSuggestions ? `, ${report.skippedSuggestions} suggestion(s) ignorée(s)` : ""}. Rien n&apos;est encore visible par les clients.
        </p>
        {report.errors.length ? (
          <ul className="mx-auto mt-4 max-w-lg space-y-1 rounded-xl bg-red-50 p-3 text-start text-[13px] text-red-800 ring-1 ring-red-200">
            {report.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href={`/admin/restaurants/${restaurantId}/menu`} className={buttonClasses("secondary")}>
            Vérifier le menu
          </Link>
          <Link href={`/admin/restaurants/${restaurantId}/translations`} className={buttonClasses("secondary")}>
            Traductions
          </Link>
          <Button variant="ghost" onClick={() => setReport(null)}>
            Nouvel import
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {!proposal ? (
        <>
          <DropZone onFiles={onFiles} disabled={uploading || analyzing} />

          {progress.length ? (
            <Card>
              <CardHeader
                title={uploading ? `Téléversement… ${done}/${progress.length}` : `${done} fichier(s) prêt(s)`}
                description={errors.length ? `${errors.length} fichier(s) en erreur` : "Les images sont optimisées et les modèles 3D mesurés automatiquement."}
              />
              <ul className="max-h-72 divide-y divide-stone-100 overflow-y-auto">
                {progress.map((p, i) => (
                  <li key={i} className="flex items-center gap-3 px-5 py-2 text-[13px]">
                    <FileTypeIcon name={p.name} className="size-4 shrink-0 text-stone-400" />
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    {p.status === "uploading" ? (
                      <span className="w-24">
                        <span className="block h-1.5 overflow-hidden rounded-full bg-stone-100">
                          <span className="block h-full bg-saffron" style={{ width: `${Math.round((p.loaded / Math.max(1, p.total)) * 100)}%` }} />
                        </span>
                      </span>
                    ) : p.status === "processing" ? (
                      <span className="flex items-center gap-1 text-stone-500">
                        <LoaderCircle className="size-3.5 animate-spin" /> analyse
                      </span>
                    ) : p.status === "done" ? (
                      <CircleCheck className="size-4 text-emerald-600" />
                    ) : p.status === "error" ? (
                      <span className="flex items-center gap-1 text-red-600" title={p.error}>
                        <CircleAlert className="size-4" /> <span className="max-w-[260px] truncate">{p.error}</span>
                      </span>
                    ) : (
                      <span className="text-stone-400">en attente</span>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {jobId && uploadedCount > 0 ? (
            <Card className="flex flex-wrap items-center gap-4 p-5">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{uploadedCount} fichier(s) dans cet import</p>
                <p className="text-[13px] text-stone-500">Ajoutez d&apos;autres fichiers si besoin, puis lancez l&apos;analyse automatique.</p>
              </div>
              {aiAvailable ? (
                <Switch checked={useAi} onChange={setUseAi} label={<span className="text-[13px]">Lecture des PDF par IA</span>} description="Pour les menus scannés ou très graphiques" />
              ) : null}
              <Button variant="ghost" onClick={cancel}>
                Abandonner
              </Button>
              <Button variant="accent" size="lg" onClick={analyze} loading={analyzing} disabled={uploading}>
                <Wand2 className="size-4" /> {analyzing ? "Analyse en cours…" : "Analyser et associer"}
              </Button>
            </Card>
          ) : null}

          {history.length ? (
            <Card>
              <CardHeader title="Imports précédents" />
              <ul className="divide-y divide-stone-100 text-[13.5px]">
                {history.map((h) => (
                  <li key={h.id} className="flex flex-wrap gap-x-4 px-5 py-2.5">
                    <span className="text-stone-500">{h.appliedAt ? new Date(h.appliedAt).toLocaleString("fr-FR") : ""}</span>
                    {h.report ? (
                      <span>
                        {h.report.dishesCreated ?? 0} créé(s) · {h.report.dishesUpdated ?? 0} mis à jour · {h.report.mediaAttached ?? 0} fichier(s)
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </>
      ) : (
        <>
          {/* ─── Synthèse ─── */}
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-6 bg-[linear-gradient(110deg,#08080c,#1b1426)] px-6 py-5 text-white">
              <Sparkles className="size-6 text-saffron" />
              <div className="flex flex-wrap gap-x-8 gap-y-2">
                <div>
                  <p className="text-2xl font-semibold">{stats!.dishes}</p>
                  <p className="text-[12px] text-white/60">plats ({stats!.toCreate} nouveaux, {stats!.toUpdate} mis à jour)</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-emerald-300">{stats!.autoLinked}</p>
                  <p className="text-[12px] text-white/60">fichiers associés avec certitude</p>
                </div>
                <div>
                  <p className={cn("text-2xl font-semibold", stats!.toValidate ? "text-amber-300" : "")}>{stats!.toValidate}</p>
                  <p className="text-[12px] text-white/60">à valider</p>
                </div>
                <div>
                  <p className={cn("text-2xl font-semibold", stats!.unmatched ? "text-amber-300" : "")}>{stats!.unmatched}</p>
                  <p className="text-[12px] text-white/60">fichiers non associés</p>
                </div>
              </div>
              <div className="ms-auto flex flex-wrap gap-2">
                <Button variant="ghost" className="text-white/80 hover:bg-white/10" onClick={() => setProposal(null)}>
                  Ajouter des fichiers
                </Button>
                <Button variant="accent" onClick={apply} loading={applying}>
                  Appliquer au brouillon
                </Button>
              </div>
            </div>
            {proposal.warnings.length ? (
              <ul className="space-y-1 border-t border-amber-200 bg-amber-50 px-6 py-3 text-[13px] text-amber-900">
                {proposal.warnings.map((w) => (
                  <li key={w} className="flex gap-2">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {w}
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav className="flex gap-1 rounded-xl bg-white p-1 ring-1 ring-stone-200" aria-label="Filtrer">
              {(
                [
                  ["review", `À vérifier (${proposal.dishes.filter(needsReview).length})`],
                  ["all", `Tous les plats (${proposal.dishes.length})`],
                  ["unmatched", `Fichiers non associés (${proposal.unmatched.length})`],
                  ["documents", `Documents (${proposal.documents.length})`],
                ] as const
              ).map(([key, label]) => (
                <button key={key} type="button" onClick={() => setFilter(key)} className={cn("rounded-lg px-3 py-1.5 text-[13px] font-medium", filter === key ? "bg-ink text-white" : "text-stone-600 hover:bg-stone-100")}>
                  {label}
                </button>
              ))}
            </nav>
            {stats!.toValidate ? (
              <Button size="sm" variant="secondary" onClick={confirmAllExact}>
                <Check className="size-3.5" /> Valider les ressemblances ≥ 85 %
              </Button>
            ) : null}
          </div>

          {filter === "documents" ? (
            <Card>
              <ul className="divide-y divide-stone-100">
                {proposal.documents.length ? (
                  proposal.documents.map((d) => (
                    <li key={d.assetId} className="flex flex-wrap items-center gap-3 px-5 py-3 text-[14px]">
                      <FileTypeIcon name={d.name} className="size-4 text-stone-400" />
                      <span className="font-medium">{d.name}</span>
                      <Badge tone={d.status === "parsed" ? "success" : d.status === "empty" ? "warning" : "danger"}>
                        {d.status === "parsed" ? `${d.dishes} plat(s) reconnu(s)` : d.status === "empty" ? "Aucun plat reconnu" : "Erreur"}
                      </Badge>
                      {d.method ? <span className="text-[12px] text-stone-400">{d.method === "ai" ? "lecture IA" : d.method === "table" ? "tableau" : "texte"}</span> : null}
                      {d.message ? <p className="w-full text-[12.5px] text-stone-500">{d.message}</p> : null}
                    </li>
                  ))
                ) : (
                  <li className="px-5 py-6 text-[13.5px] text-stone-500">Aucun document de menu dans cet import : les plats sont créés à partir des noms de fichiers.</li>
                )}
                {proposal.failedFiles.map((f) => (
                  <li key={f.name} className="flex flex-wrap items-center gap-3 px-5 py-3 text-[13.5px] text-red-700">
                    <CircleAlert className="size-4" /> {f.name} — {f.error}
                  </li>
                ))}
              </ul>
            </Card>
          ) : filter === "unmatched" ? (
            <Card>
              {proposal.unmatched.length ? (
                <ul className="divide-y divide-stone-100">
                  {proposal.unmatched.map((u) => (
                    <li key={u.assetId} className="flex flex-wrap items-center gap-3 px-5 py-3">
                      <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-stone-100 ring-1 ring-stone-200">
                        {u.thumbUrl ? <img src={u.thumbUrl} alt="" className="size-full object-cover" /> : <FileTypeIcon name={u.name} className="size-5 text-stone-400" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium">{u.path ?? u.name}</p>
                        <p className="text-[12px] text-stone-500">{SLOT_LABEL[KIND_TO_SLOT[u.kind]]}</p>
                      </div>
                      {u.suggestions.slice(0, 2).map((s) => (
                        <Button key={s.dishRef} size="sm" variant="secondary" onClick={() => assignUnmatched(u, s.dishRef)}>
                          {dishLabel(s.dishRef)} ({Math.round(s.score * 100)} %)
                        </Button>
                      ))}
                      <Select value="" onChange={(e) => e.target.value && assignUnmatched(u, e.target.value)} className="h-8 w-48 text-[12.5px]" aria-label="Associer à un plat">
                        <option value="">Associer à…</option>
                        {proposal.dishes
                          .filter((d) => d.action !== "skip")
                          .map((d) => (
                            <option key={d.ref} value={d.ref}>
                              {d.current?.name ?? d.name}
                              {d.media[KIND_TO_SLOT[u.kind]] ? " (remplacer)" : ""}
                            </option>
                          ))}
                      </Select>
                      <Button size="sm" variant="ghost" onClick={() => createFromUnmatched(u)}>
                        Nouveau plat
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-8 text-center text-[13.5px] text-stone-500">Tous les fichiers sont associés.</p>
              )}
            </Card>
          ) : (
            <Card>
              {visibleDishes.length ? (
                <ul className="divide-y divide-stone-100">
                  {visibleDishes.map((d) => (
                    <DishProposalRow
                      key={d.ref}
                      dish={d}
                      proposal={proposal}
                      onChange={(patch) => updateDish(d.ref, patch)}
                      onMedia={(slot, action) => mediaAction(d.ref, slot, action)}
                    />
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-8 text-center text-[13.5px] text-stone-500">
                  {filter === "review" ? "Rien à vérifier : toutes les associations sont certaines." : "Aucun plat."}
                </p>
              )}
            </Card>
          )}
          <p className="text-[12.5px] text-stone-500">
            {existingDishes.length} plat(s) déjà au menu. L&apos;application modifie uniquement le brouillon ; vous publiez ensuite quand tout est prêt.
          </p>
        </>
      )}
    </div>
  );
}
