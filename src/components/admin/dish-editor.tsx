"use client";

import { useMemo, useRef, useState } from "react";
import { Box, CircleCheck, CircleDashed, FileBox, ImagePlus, Plus, Ruler, Trash2, TriangleAlert, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/form";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/components/ui/cn";
import { ModelStage } from "@/components/menu/model-stage";
import { ALLERGENS, ALLERGEN_CODES } from "@/lib/allergens";
import { DISH_TAGS, DISH_TAG_CODES } from "@/lib/tags";
import { centsToInput, parsePrice } from "@/lib/money";
import type { AssetDto } from "@/lib/assets/service";
import { api, errorMessage } from "./api";
import { uploadFiles } from "./upload";
import { usdzFromGlb } from "./glb-to-usdz";
import type { EditorCategory, EditorDish } from "./menu-types";

type Props = {
  restaurantId: string;
  currency: string;
  dish: EditorDish | null;
  defaultCategoryId: string;
  categories: EditorCategory[];
  allDishes: EditorDish[];
  onClose: () => void;
  onSaved: () => void;
};

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(bytes > 10 * 1024 * 1024 ? 0 : 1)} Mo`;
const fmtCm = (n: number | null | undefined) => (n === null || n === undefined ? "?" : `${(Math.round(n * 10) / 10).toString().replace(".", ",")}`);

function AssetSlot({
  label,
  accept,
  category,
  asset,
  restaurantId,
  onChange,
  icon,
}: {
  label: string;
  accept: string;
  category: "image" | "glb" | "usdz";
  asset: AssetDto | null;
  restaurantId: string;
  onChange: (asset: AssetDto | null) => void;
  icon: React.ReactNode;
}) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const upload = async (file: File) => {
    setProgress(0);
    try {
      const { assets, rejected } = await uploadFiles(restaurantId, [{ file }], {
        accept: [category],
        onProgress: (p) => setProgress(p[0] ? p[0].loaded / Math.max(1, p[0].total) : 0),
      });
      if (rejected[0]) throw new Error(rejected[0].reason);
      const a = assets[0];
      if (!a) throw new Error("Échec du téléversement.");
      if (a.status !== "READY") throw new Error(a.error ?? "Fichier invalide.");
      onChange(a);
    } catch (error) {
      toast.error(`${file.name} : ${errorMessage(error)}`);
    } finally {
      setProgress(null);
    }
  };

  const warnings = category === "glb" ? (asset?.glb?.warnings ?? []) : category === "usdz" ? (asset?.usdz?.warnings ?? []) : [];

  return (
    <div className="rounded-xl ring-1 ring-stone-200">
      <div className="flex items-center gap-3 p-3">
        <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-stone-100 text-stone-400">
          {category === "image" && asset?.thumbUrl ? <img src={asset.thumbUrl} alt="" className="size-full object-cover" /> : icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-stone-800">{label}</p>
          {progress !== null ? (
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full rounded-full bg-saffron transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          ) : asset ? (
            <p className="truncate text-[12.5px] text-stone-500">
              {asset.name} · {mb(asset.sizeBytes)}
              {asset.glb?.triangles ? ` · ${asset.glb.triangles.toLocaleString("fr-FR")} triangles` : ""}
            </p>
          ) : (
            <p className="text-[12.5px] text-stone-400">Aucun fichier</p>
          )}
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()} disabled={progress !== null}>
            <Upload className="size-3.5" /> {asset ? "Remplacer" : "Ajouter"}
          </Button>
          {asset ? (
            <Button size="sm" variant="ghost" onClick={() => onChange(null)} aria-label={`Retirer ${label}`}>
              <X className="size-3.5" />
            </Button>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
      </div>
      {warnings.length ? (
        <ul className="space-y-1 border-t border-amber-100 bg-amber-50/70 px-3 py-2">
          {warnings.map((w) => (
            <li key={w} className="flex gap-1.5 text-[12px] text-amber-900">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> {w}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function DishEditor({ restaurantId, currency, dish, defaultCategoryId, categories, allDishes, onClose, onSaved }: Props) {
  const toast = useToast();
  const [form, setForm] = useState(() => ({
    categoryId: dish?.categoryId ?? defaultCategoryId,
    name: dish?.name ?? "",
    description: dish?.description ?? "",
    price: centsToInput(dish?.priceCents ?? null),
    variants: (dish?.priceVariants ?? []).map((v) => ({ label: v.label, price: centsToInput(v.priceCents) })),
    photo: dish?.photo ?? null,
    glb: dish?.glb ?? null,
    usdz: dish?.usdz ?? null,
    allergens: dish?.allergens ?? [],
    tags: dish?.tags ?? [],
    isAvailable: dish?.isAvailable ?? true,
    isVisible: dish?.isVisible ?? true,
    isFeatured: dish?.isFeatured ?? false,
    realWidthCm: dish?.realWidthCm ?? null,
    realDepthCm: dish?.realDepthCm ?? null,
    realHeightCm: dish?.realHeightCm ?? null,
    scaleStatus: dish?.scaleStatus ?? ("UNVERIFIED" as "UNVERIFIED" | "VALIDATED"),
    recommendationIds: dish?.recommendationIds ?? [],
  }));
  const [saving, setSaving] = useState(false);
  const [rescaling, setRescaling] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const measured = form.glb?.glb?.dimensionsCm ?? null;
  const declaredWidth = form.realWidthCm;
  const mismatch = measured && declaredWidth ? Math.abs(measured.width - declaredWidth) / declaredWidth > 0.03 : false;
  const otherDishes = useMemo(() => allDishes.filter((d) => d.id !== dish?.id), [allDishes, dish?.id]);

  const setGlb = (asset: AssetDto | null) => {
    setForm((f) => ({
      ...f,
      glb: asset,
      // Nouveau modèle : l'échelle doit être revalidée ; on propose les dimensions mesurées.
      scaleStatus: "UNVERIFIED",
      realWidthCm: asset?.glb?.dimensionsCm?.width ?? f.realWidthCm,
      realDepthCm: asset?.glb?.dimensionsCm?.depth ?? f.realDepthCm,
      realHeightCm: asset?.glb?.dimensionsCm?.height ?? f.realHeightCm,
    }));
  };

  const rescale = async () => {
    if (!dish || !form.realWidthCm) return;
    setRescaling(true);
    try {
      // Le GLB doit d'abord être enregistré sur le plat pour être mis à l'échelle côté serveur.
      if (form.glb?.id !== dish.glb?.id) await api(`/api/admin/restaurants/${restaurantId}/dishes/${dish.id}`, { method: "PATCH", body: { glbAssetId: form.glb?.id ?? null } });
      const res = await api<{ asset: AssetDto; factor: number }>(`/api/admin/restaurants/${restaurantId}/dishes/${dish.id}/rescale`, {
        body: { targetCm: form.realWidthCm, axis: "width" },
      });
      const d = res.asset.glb?.dimensionsCm;
      setForm((f) => ({ ...f, glb: res.asset, realWidthCm: d?.width ?? f.realWidthCm, realDepthCm: d?.depth ?? f.realDepthCm, realHeightCm: d?.height ?? f.realHeightCm, scaleStatus: "UNVERIFIED" }));
      toast.success(`Modèle GLB mis à l'échelle (×${res.factor.toFixed(res.factor < 1 ? 4 : 2)}). Vérifiez aussi le USDZ sur iPhone avant de valider.`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setRescaling(false);
    }
  };

  // ─── Bord d'assiette régularisé (aperçu avant / après, l'original reste disponible) ───
  type RimPreview = { original: AssetDto; corrected: AssetDto; info: { maxMoveMm: number; diameterCm: number } };
  const [rim, setRim] = useState<RimPreview | null>(null);
  const [rimBusy, setRimBusy] = useState<"compute" | "apply" | null>(null);
  const computeRim = async () => {
    if (!dish) return;
    setRimBusy("compute");
    try {
      // Le GLB affiché doit être celui du plat enregistré.
      if (form.glb?.id !== dish.glb?.id) await api(`/api/admin/restaurants/${restaurantId}/dishes/${dish.id}`, { method: "PATCH", body: { glbAssetId: form.glb?.id ?? null } });
      setRim(await api<RimPreview>(`/api/admin/restaurants/${restaurantId}/dishes/${dish.id}/plate-rim`, { body: {} }));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setRimBusy(null);
    }
  };
  const applyRim = async () => {
    if (!rim?.corrected.url) return;
    setRimBusy("apply");
    try {
      let usdz: AssetDto | null = null;
      try {
        const file = await usdzFromGlb(rim.corrected.url, rim.corrected.name.replace(/\.glb$/i, ".usdz"));
        const { assets } = await uploadFiles(restaurantId, [{ file }], { accept: ["usdz"] });
        if (assets[0]?.status === "READY") usdz = assets[0];
      } catch {
        usdz = null;
      }
      setForm((f) => ({ ...f, glb: rim.corrected, usdz: usdz ?? f.usdz }));
      setRim(null);
      if (usdz) toast.success("Bord corrigé (3D et iPhone). Enregistrez le plat pour publier la version corrigée.");
      else toast.error("Bord corrigé pour la 3D et Android, mais le fichier iPhone n'a pas pu être recréé : l'ancien est conservé.");
    } finally {
      setRimBusy(null);
    }
  };

  const save = async () => {
    const priceCents = form.price.trim() ? parsePrice(form.price) : null;
    if (form.price.trim() && priceCents === null) {
      toast.error("Prix invalide (ex. 12,50).");
      return;
    }
    const variants = [];
    for (const v of form.variants) {
      if (!v.label.trim() && !v.price.trim()) continue;
      const cents = parsePrice(v.price);
      if (!v.label.trim() || cents === null) {
        toast.error("Chaque déclinaison doit avoir un libellé et un prix valide.");
        return;
      }
      variants.push({ label: v.label.trim(), priceCents: cents });
    }
    const body = {
      categoryId: form.categoryId,
      name: form.name,
      description: form.description || null,
      priceCents,
      priceVariants: variants,
      photoAssetId: form.photo?.id ?? null,
      glbAssetId: form.glb?.id ?? null,
      usdzAssetId: form.usdz?.id ?? null,
      allergens: form.allergens,
      tags: form.tags,
      isVisible: form.isVisible,
      isFeatured: form.isFeatured,
      realWidthCm: form.realWidthCm,
      realDepthCm: form.realDepthCm,
      realHeightCm: form.realHeightCm,
      scaleStatus: form.scaleStatus,
      recommendationIds: form.recommendationIds,
      ...(dish ? {} : { isAvailable: form.isAvailable }),
    };
    setSaving(true);
    try {
      if (dish) {
        await api(`/api/admin/restaurants/${restaurantId}/dishes/${dish.id}`, { method: "PATCH", body });
        if (dish.isAvailable !== form.isAvailable)
          await api(`/api/admin/restaurants/${restaurantId}/dishes/${dish.id}/availability`, { body: { available: form.isAvailable } });
      } else {
        await api(`/api/admin/restaurants/${restaurantId}/dishes`, { body });
      }
      toast.success(dish ? "Plat enregistré dans le brouillon." : "Plat ajouté au brouillon.");
      onSaved();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  const dimInput = (key: "realWidthCm" | "realDepthCm" | "realHeightCm", label: string) => (
    <Field label={label}>
      <div className="flex items-center rounded-xl bg-white ring-1 ring-stone-200 focus-within:ring-2 focus-within:ring-saffron">
        <input
          inputMode="decimal"
          value={form[key] === null ? "" : String(form[key]).replace(".", ",")}
          onChange={(e) => {
            const v = e.target.value.replace(",", ".");
            set(key, v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : form[key]);
            set("scaleStatus", "UNVERIFIED");
          }}
          className="h-10 w-full min-w-0 bg-transparent px-3 text-[14px] tabular-nums outline-none"
        />
        <span className="pe-3 text-[13px] text-stone-400">cm</span>
      </div>
    </Field>
  );

  return (
    <Dialog
      open
      onClose={onClose}
      size="xl"
      title={dish ? `Modifier « ${dish.name} »` : "Nouveau plat"}
      description="Les modifications sont enregistrées dans le brouillon et visibles après publication."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="accent" onClick={save} loading={saving} disabled={!form.name.trim()}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
            <Field label="Nom du plat *">
              <Input value={form.name} maxLength={140} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Catégorie">
              <Select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Description">
            <Textarea rows={3} maxLength={1200} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Ingrédients, préparation, origine des produits…" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
            <Field label={`Prix (${currency})`} hint="Ex. 14,50">
              <Input value={form.price} inputMode="decimal" onChange={(e) => set("price", e.target.value)} />
            </Field>
            <Field label="Déclinaisons de prix" hint="Ex. Verre / Bouteille, Petite / Grande">
              <div className="space-y-2">
                {form.variants.map((v, i) => (
                  <div key={i} className="flex gap-2">
                    <Input value={v.label} placeholder="Libellé" onChange={(e) => set("variants", form.variants.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                    <Input value={v.price} placeholder="Prix" inputMode="decimal" className="w-28" onChange={(e) => set("variants", form.variants.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
                    <Button variant="ghost" onClick={() => set("variants", form.variants.filter((_, j) => j !== i))} aria-label="Retirer la déclinaison">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                {form.variants.length < 8 ? (
                  <Button size="sm" variant="ghost" onClick={() => set("variants", [...form.variants, { label: "", price: "" }])}>
                    <Plus className="size-3.5" /> Ajouter une déclinaison
                  </Button>
                ) : null}
              </div>
            </Field>
          </div>

          <Field label="Allergènes" hint="Ne cochez que les allergènes confirmés par le restaurateur.">
            <div className="flex flex-wrap gap-1.5">
              {ALLERGEN_CODES.map((code) => {
                const on = form.allergens.includes(code);
                return (
                  <button key={code} type="button" aria-pressed={on} onClick={() => set("allergens", toggle(form.allergens, code))} className={cn("h-8 rounded-full px-3 text-[12.5px] ring-1 transition", on ? "bg-red-50 font-medium text-red-800 ring-red-300" : "text-stone-600 ring-stone-200 hover:bg-stone-50")}>
                    {ALLERGENS[code].fr}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Pictogrammes">
            <div className="flex flex-wrap gap-1.5">
              {DISH_TAG_CODES.map((code) => {
                const on = form.tags.includes(code);
                return (
                  <button key={code} type="button" aria-pressed={on} onClick={() => set("tags", toggle(form.tags, code))} className={cn("h-8 rounded-full px-3 text-[12.5px] ring-1 transition", on ? "bg-ink text-white ring-ink" : "text-stone-600 ring-stone-200 hover:bg-stone-50")}>
                    {DISH_TAGS[code].fr}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Recommandations « Parfait avec… »" hint="Jusqu'à 6 plats complémentaires suggérés sur la fiche (dessert, boisson, accompagnement…)">
            <div className="flex flex-wrap gap-1.5">
              {form.recommendationIds.map((id) => {
                const d = allDishes.find((x) => x.id === id);
                return d ? (
                  <span key={id} className="inline-flex items-center gap-1 rounded-full bg-violet-50 py-1 ps-3 pe-1 text-[12.5px] text-violet-800 ring-1 ring-violet-200">
                    {d.name}
                    <button type="button" onClick={() => set("recommendationIds", form.recommendationIds.filter((x) => x !== id))} className="grid size-5 place-items-center rounded-full hover:bg-violet-100" aria-label={`Retirer ${d.name}`}>
                      <X className="size-3" />
                    </button>
                  </span>
                ) : null;
              })}
              {form.recommendationIds.length < 6 ? (
                <Select
                  value=""
                  onChange={(e) => e.target.value && set("recommendationIds", [...form.recommendationIds, e.target.value])}
                  className="h-8 w-auto text-[12.5px]"
                  aria-label="Ajouter une recommandation"
                >
                  <option value="">+ Ajouter un plat</option>
                  {otherDishes
                    .filter((d) => !form.recommendationIds.includes(d.id))
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                </Select>
              ) : null}
            </div>
          </Field>

          <div className="grid gap-3 rounded-xl bg-stone-50 p-4 sm:grid-cols-3">
            <Switch checked={form.isAvailable} onChange={(v) => set("isAvailable", v)} label="Disponible" description="Sinon « Indisponible »" />
            <Switch checked={form.isVisible} onChange={(v) => set("isVisible", v)} label="Visible" description="Sinon masqué du menu" />
            <Switch checked={form.isFeatured} onChange={(v) => set("isFeatured", v)} label="Incontournable" description="Mis en avant en haut" />
          </div>
        </div>

        <div className="space-y-4">
          <AssetSlot label="Photo" accept="image/jpeg,image/png,image/webp,image/avif" category="image" asset={form.photo} restaurantId={restaurantId} onChange={(a) => set("photo", a)} icon={<ImagePlus className="size-5" />} />
          <AssetSlot label="Modèle 3D GLB (Android, web)" accept=".glb,model/gltf-binary" category="glb" asset={form.glb} restaurantId={restaurantId} onChange={setGlb} icon={<Box className="size-5" />} />
          <AssetSlot label="Modèle 3D USDZ (iPhone, iPad)" accept=".usdz,model/vnd.usdz+zip" category="usdz" asset={form.usdz} restaurantId={restaurantId} onChange={(a) => set("usdz", a)} icon={<FileBox className="size-5" />} />

          {form.glb?.url ? (
            <div className="overflow-hidden rounded-xl bg-[radial-gradient(circle_at_50%_35%,#2a2420,#0d0b0a)] ring-1 ring-stone-200">
              <div className="relative h-64">
                <ModelStage glb={form.glb.url} usdz={form.usdz?.url ?? null} alt={form.name || "Plat"} scaleValidated={form.scaleStatus === "VALIDATED"} className="absolute inset-0" />
              </div>
            </div>
          ) : null}

          {form.glb?.url ? (
            <div className="flex flex-wrap items-center gap-3 rounded-xl p-4 ring-1 ring-stone-200">
              <CircleDashed className="size-5 shrink-0 text-stone-500" />
              <div className="min-w-0 flex-1 text-[12.5px] text-stone-600">
                <p className="text-[13.5px] font-semibold text-stone-900">Bord de l&apos;assiette</p>
                Assiettes rondes : rend le contour régulier et efface les bosses du scan. Aperçu avant / après, l&apos;original reste disponible.
              </div>
              {dish ? (
                <Button size="sm" variant="secondary" loading={rimBusy === "compute"} onClick={computeRim}>
                  Corriger le bord
                </Button>
              ) : (
                <p className="text-[12px] text-stone-500">Enregistrez d&apos;abord le plat.</p>
              )}
            </div>
          ) : null}

          {form.glb || form.usdz ? (
            <div className="space-y-3 rounded-xl p-4 ring-1 ring-stone-200">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-[13.5px] font-semibold">
                  <Ruler className="size-4" /> Taille réelle en AR
                </p>
                {form.scaleStatus === "VALIDATED" ? <Badge tone="success">Validée</Badge> : <Badge tone="warning">À valider</Badge>}
              </div>
              {measured ? (
                <p className="text-[12.5px] text-stone-600">
                  Le GLB mesure <strong>{fmtCm(measured.width)} × {fmtCm(measured.depth)} cm</strong>, hauteur {fmtCm(measured.height)} cm (largeur × profondeur, unités glTF = mètres).
                </p>
              ) : null}
              <div className="grid grid-cols-3 gap-2">
                {dimInput("realWidthCm", "Largeur / Ø")}
                {dimInput("realDepthCm", "Profondeur")}
                {dimInput("realHeightCm", "Hauteur")}
              </div>
              <p className="text-[12px] leading-snug text-stone-500">
                Saisissez les dimensions réelles du plat servi (assiette comprise), mesurées en salle. Elles ne sont jamais inventées : tant
                qu&apos;elles ne sont pas validées, le client peut redimensionner le plat en AR.
              </p>
              {mismatch && dish ? (
                <div className="rounded-lg bg-amber-50 p-3 text-[12.5px] text-amber-900 ring-1 ring-amber-200">
                  <p>
                    Le modèle ({fmtCm(measured?.width)} cm) ne correspond pas à la largeur indiquée ({fmtCm(declaredWidth)} cm).
                  </p>
                  <Button size="sm" variant="secondary" className="mt-2" loading={rescaling} onClick={rescale}>
                    Corriger l&apos;échelle du GLB
                  </Button>
                </div>
              ) : null}
              {mismatch && !dish ? <p className="text-[12px] text-amber-800">Enregistrez le plat pour pouvoir corriger l&apos;échelle du modèle.</p> : null}
              {form.usdz ? (
                <p className="text-[12px] text-stone-500">Le fichier USDZ ne peut pas être mesuré automatiquement : vérifiez sa taille sur un iPhone avant de valider.</p>
              ) : form.glb ? (
                <p className="text-[12px] text-stone-500">Sans USDZ, l&apos;iPhone utilisera une conversion automatique du GLB (qualité variable : un USDZ dédié est recommandé).</p>
              ) : null}
              <Button
                size="sm"
                variant={form.scaleStatus === "VALIDATED" ? "secondary" : "primary"}
                disabled={!form.realWidthCm || !form.realDepthCm || !form.realHeightCm || mismatch}
                onClick={() => set("scaleStatus", form.scaleStatus === "VALIDATED" ? "UNVERIFIED" : "VALIDATED")}
              >
                <CircleCheck className="size-3.5" />
                {form.scaleStatus === "VALIDATED" ? "Annuler la validation" : "Je confirme la taille réelle"}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
      <Dialog
        open={!!rim}
        onClose={() => setRim(null)}
        title="Bord de l'assiette : avant / après"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRim(null)} disabled={rimBusy === "apply"}>
              Garder l&apos;original
            </Button>
            <Button variant="accent" onClick={applyRim} loading={rimBusy === "apply"}>
              Utiliser la version corrigée
            </Button>
          </>
        }
      >
        {rim ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["Avant", rim.original],
                  ["Après", rim.corrected],
                ] as const
              ).map(([label, asset]) => (
                <div key={label} className="overflow-hidden rounded-xl bg-[radial-gradient(circle_at_50%_35%,#2a2420,#0d0b0a)] ring-1 ring-stone-200">
                  <p className="px-3 pt-2 text-[12px] font-semibold tracking-wide text-white/70 uppercase">{label}</p>
                  <div className="relative h-64">
                    {asset.url ? <ModelStage glb={asset.url} usdz={null} alt={`${form.name} — ${label}`} scaleValidated={false} className="absolute inset-0" /> : null}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[12.5px] text-stone-600">
              Assiette de Ø {rim.info.diameterCm} cm, bord déplacé de {rim.info.maxMoveMm} mm au plus. Le plat et les textures ne changent pas. Faites
              tourner les deux modèles pour comparer le contour et le dessous de l&apos;assiette. Le fichier iPhone sera recréé à partir de la version
              corrigée.
            </p>
          </div>
        ) : null}
      </Dialog>
    </Dialog>
  );
}
