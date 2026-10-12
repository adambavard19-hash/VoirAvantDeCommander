"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Sparkles, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/components/ui/cn";
import { FONT_PAIRINGS, THEME_PRESETS, themeTokens, type ThemeSettings } from "@/lib/theme";
import { LOCALES, type Locale } from "@/lib/i18n/locales";
import type { RestaurantSettings } from "@/lib/restaurant-settings";
import { api, errorMessage } from "./api";
import { uploadFiles } from "./upload";

export type RestaurantFormValues = {
  name: string;
  cuisineType: string;
  tagline: string;
  description: string;
  practicalInfo: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  instagram: string;
  facebook: string;
  mapsUrl: string;
  defaultLocale: string;
  locales: string[];
  currency: string;
  theme: ThemeSettings;
  settings: RestaurantSettings;
  logoAssetId: string | null;
  coverAssetId: string | null;
  galleryAssetIds: string[];
};

type ImageSlot = { assetId: string | null; url: string | null; file?: File };

export type RestaurantFormProps = {
  mode: "create" | "edit";
  restaurantId?: string;
  initial: RestaurantFormValues;
  initialImages?: { logo: string | null; cover: string | null; gallery: { id: string; url: string }[] };
};

const CURRENCIES = ["EUR", "CHF", "GBP", "USD", "CAD", "MAD", "XOF", "AED", "JPY"];

/** Couleur dominante (saturée) d'une image, calculée dans le navigateur. */
async function dominantColor(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 48;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, 48, 48);
    const { data } = ctx.getImageData(0, 0, 48, 48);
    let best: { score: number; rgb: [number, number, number] } | null = null;
    const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b, a] = [data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!];
      if (a < 128) continue;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      if (sat < 0.25 || max < 40 || min > 230) continue;
      const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
      const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      bucket.n++;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      buckets.set(key, bucket);
    }
    for (const bucket of buckets.values()) {
      const rgb: [number, number, number] = [bucket.r / bucket.n, bucket.g / bucket.n, bucket.b / bucket.n];
      const max = Math.max(...rgb);
      const min = Math.min(...rgb);
      const score = bucket.n * (0.5 + (max - min) / 255);
      if (!best || score > best.score) best = { score, rgb };
    }
    if (!best) return null;
    return `#${best.rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function ImagePicker({
  label,
  hint,
  slot,
  onPick,
  onClear,
  aspect,
  contain,
}: {
  label: string;
  hint: string;
  slot: ImageSlot;
  onPick: (file: File) => void;
  onClear: () => void;
  aspect: string;
  contain?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <Field label={label} hint={hint}>
      <div className={cn("group relative overflow-hidden rounded-xl bg-stone-100 ring-1 ring-stone-200", aspect)}>
        {slot.url ? (
          <img src={slot.url} alt="" className={cn("absolute inset-0 size-full", contain ? "object-contain p-3" : "object-cover")} />
        ) : (
          <button type="button" onClick={() => inputRef.current?.click()} className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-stone-500 hover:text-stone-800">
            <ImagePlus className="size-6" />
            <span className="text-[13px] font-medium">Choisir une image</span>
          </button>
        )}
        {slot.url ? (
          <div className="absolute inset-x-2 bottom-2 flex justify-end gap-1.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
            <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()}>
              Remplacer
            </Button>
            <Button size="sm" variant="secondary" onClick={onClear} aria-label="Retirer">
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
    </Field>
  );
}

function MenuPreview({ values, logoUrl, coverUrl }: { values: RestaurantFormValues; logoUrl: string | null; coverUrl: string | null }) {
  const t = themeTokens(values.theme);
  return (
    <div className="mx-auto w-[230px] rounded-[34px] bg-stone-900 p-2 shadow-xl">
      <div className="overflow-hidden rounded-[27px]" style={{ background: t.bg, color: t.text, fontFamily: t.fontBody }}>
        <div className="relative h-32">
          {coverUrl ? <img src={coverUrl} alt="" className="absolute inset-0 size-full object-cover" /> : null}
          <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, rgba(0,0,0,.35), transparent 40%, ${t.bg})` }} />
          {logoUrl ? (
            <div className="absolute top-3 left-3 grid size-9 place-items-center rounded-lg bg-white/90 p-1">
              <img src={logoUrl} alt="" className="max-h-full max-w-full object-contain" />
            </div>
          ) : null}
        </div>
        <div className="relative -mt-6 px-4 pb-4">
          {values.cuisineType ? <p className="text-[8px] font-semibold tracking-[.2em] uppercase" style={{ color: t.primary }}>{values.cuisineType}</p> : null}
          <p className="text-[22px] leading-tight font-semibold" style={{ fontFamily: t.fontDisplay }}>
            {values.name || "Nom du restaurant"}
          </p>
          {values.tagline ? <p className="mt-1 line-clamp-2 text-[10px] opacity-75">{values.tagline}</p> : null}
          <div className="mt-3 flex gap-1.5">
            <span className="rounded-full px-2.5 py-1 text-[9px] font-semibold" style={{ background: t.primary, color: t.onPrimary }}>Entrées</span>
            <span className="rounded-full px-2.5 py-1 text-[9px]" style={{ background: t.surface }}>Plats</span>
            <span className="rounded-full px-2.5 py-1 text-[9px]" style={{ background: t.surface }}>Desserts</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[0, 1].map((i) => (
              <div key={i}>
                <div className="aspect-square rounded-xl" style={{ background: `linear-gradient(135deg, ${t.surface2}, ${t.surface})`, border: `1px solid ${t.border}` }} />
                <div className="mt-1 h-1.5 w-3/4 rounded" style={{ background: t.text, opacity: 0.7 }} />
                <div className="mt-1 h-1.5 w-1/3 rounded" style={{ background: t.primary }} />
              </div>
            ))}
          </div>
          <div className="mt-3 flex h-8 items-center justify-center rounded-xl text-[9px] font-semibold" style={{ background: t.primary, color: t.onPrimary }}>
            Voir ce plat sur ma table
          </div>
        </div>
      </div>
    </div>
  );
}

export function RestaurantForm({ mode, restaurantId, initial, initialImages }: RestaurantFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState<RestaurantFormValues>(initial);
  const [logo, setLogo] = useState<ImageSlot>({ assetId: initial.logoAssetId, url: initialImages?.logo ?? null });
  const [cover, setCover] = useState<ImageSlot>({ assetId: initial.coverAssetId, url: initialImages?.cover ?? null });
  const [gallery, setGallery] = useState<ImageSlot[]>(
    initialImages?.gallery.map((g) => ({ assetId: g.id, url: g.url })) ?? [],
  );
  const [logoColor, setLogoColor] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof RestaurantFormValues>(key: K, value: RestaurantFormValues[K]) => setValues((v) => ({ ...v, [key]: value }));
  const setTheme = (patch: Partial<ThemeSettings>) => setValues((v) => ({ ...v, theme: { ...v.theme, ...patch, preset: patch.preset ?? undefined } }));
  const setSettings = (patch: Partial<RestaurantSettings>) => setValues((v) => ({ ...v, settings: { ...v.settings, ...patch } }));

  const pickImage = async (file: File, setter: (s: ImageSlot) => void, isLogo = false) => {
    setter({ assetId: null, url: URL.createObjectURL(file), file });
    if (isLogo) setLogoColor(await dominantColor(file));
  };

  const otherLocales = useMemo(() => (Object.keys(LOCALES) as Locale[]).filter((l) => l !== values.defaultLocale), [values.defaultLocale]);

  /** Téléverse les images choisies localement et renvoie les identifiants. */
  const uploadPending = async (rid: string) => {
    const pending: { key: string; file: File }[] = [];
    if (logo.file) pending.push({ key: "logo", file: logo.file });
    if (cover.file) pending.push({ key: "cover", file: cover.file });
    gallery.forEach((g, i) => g.file && pending.push({ key: `gallery-${i}`, file: g.file }));
    const ids: Record<string, string | null> = {};
    if (pending.length) {
      setSaving("Téléversement des images…");
      const { assets } = await uploadFiles(rid, pending.map((p) => ({ file: p.file, path: p.key })), { accept: ["image"] });
      for (const p of pending) {
        const asset = assets.find((a) => a.path === p.key);
        if (!asset || asset.status !== "READY") throw new Error(`Image « ${p.file.name} » : ${asset?.error ?? "échec du téléversement"}`);
        ids[p.key] = asset.id;
      }
    }
    return {
      logoAssetId: logo.file ? ids.logo! : logo.assetId,
      coverAssetId: cover.file ? ids.cover! : cover.assetId,
      galleryAssetIds: gallery.map((g, i) => (g.file ? ids[`gallery-${i}`]! : g.assetId!)).filter(Boolean),
    };
  };

  const payload = (assets: { logoAssetId: string | null; coverAssetId: string | null; galleryAssetIds: string[] }) => ({
    ...values,
    ...assets,
    locales: [values.defaultLocale, ...values.locales.filter((l) => l !== values.defaultLocale)],
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let rid = restaurantId;
      if (mode === "create") {
        setSaving("Création de l'espace du restaurant…");
        const created = await api<{ restaurant: { id: string; slug: string } }>("/api/admin/restaurants", {
          body: payload({ logoAssetId: null, coverAssetId: null, galleryAssetIds: [] }),
        });
        rid = created.restaurant.id;
      }
      const assets = await uploadPending(rid!);
      setSaving("Enregistrement…");
      await api(`/api/admin/restaurants/${rid}`, { method: "PATCH", body: payload(assets) });
      if (mode === "create") {
        toast.success("Restaurant créé : son espace, son menu et son adresse sont prêts.");
        router.push(`/admin/restaurants/${rid}?created=1`);
      } else {
        toast.success("Modifications enregistrées.");
        setLogo((l) => ({ ...l, assetId: assets.logoAssetId, file: undefined }));
        setCover((c) => ({ ...c, assetId: assets.coverAssetId, file: undefined }));
        setGallery((g) => g.map((slot, i) => ({ ...slot, assetId: assets.galleryAssetIds[i] ?? slot.assetId, file: undefined })));
        router.refresh();
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(null);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-6 xl:grid-cols-[1fr_300px]">
      <div className="space-y-6">
        <Card>
          <CardHeader title="Identité" description="Ces informations apparaissent en haut du menu." />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Nom du restaurant *" htmlFor="name" className="sm:col-span-2">
              <Input id="name" required maxLength={120} value={values.name} onChange={(e) => set("name", e.target.value)} placeholder="Le Petit Bistrot" />
            </Field>
            <Field label="Type de cuisine" htmlFor="cuisine" hint="Ex. « Bistronomie », « Pizzeria napolitaine »">
              <Input id="cuisine" maxLength={80} value={values.cuisineType} onChange={(e) => set("cuisineType", e.target.value)} />
            </Field>
            <Field label="Accroche" htmlFor="tagline" hint="Une phrase courte sous le nom">
              <Input id="tagline" maxLength={200} value={values.tagline} onChange={(e) => set("tagline", e.target.value)} />
            </Field>
            <Field label="Présentation" htmlFor="description" className="sm:col-span-2">
              <Textarea id="description" maxLength={2000} value={values.description} onChange={(e) => set("description", e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Logo et photos" description="JPEG, PNG ou WebP. Les images sont optimisées automatiquement pour le mobile." />
          <div className="grid gap-5 p-5 sm:grid-cols-[180px_1fr]">
            <ImagePicker label="Logo" hint="Fond transparent idéalement" slot={logo} onPick={(f) => pickImage(f, setLogo, true)} onClear={() => setLogo({ assetId: null, url: null })} aspect="aspect-square" contain />
            <ImagePicker label="Photo de couverture" hint="Format paysage, 2000 px de large conseillés" slot={cover} onPick={(f) => pickImage(f, setCover)} onClear={() => setCover({ assetId: null, url: null })} aspect="aspect-[16/9]" />
            <div className="sm:col-span-2">
              <Field label="Photos du restaurant" hint="Salle, terrasse, équipe… (facultatif)">
                <div className="flex flex-wrap gap-3">
                  {gallery.map((g, i) => (
                    <div key={i} className="group relative size-24 overflow-hidden rounded-xl ring-1 ring-stone-200">
                      <img src={g.url ?? ""} alt="" className="size-full object-cover" />
                      <button type="button" aria-label="Retirer" onClick={() => setGallery((all) => all.filter((_, j) => j !== i))} className="absolute top-1 right-1 grid size-7 place-items-center rounded-lg bg-white/90 text-stone-700 shadow">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => galleryInput.current?.click()} className="grid size-24 place-items-center rounded-xl border border-dashed border-stone-300 text-stone-500 hover:border-stone-500 hover:text-stone-800">
                    <ImagePlus className="size-5" />
                  </button>
                  <input
                    ref={galleryInput}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []);
                      setGallery((all) => [...all, ...files.map((file) => ({ assetId: null, url: URL.createObjectURL(file), file }))].slice(0, 30));
                      e.target.value = "";
                    }}
                  />
                </div>
              </Field>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Identité visuelle" description="La palette complète et lisible est calculée automatiquement." />
          <div className="space-y-5 p-5">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {Object.entries(THEME_PRESETS).map(([key, preset]) => {
                const t = themeTokens(preset.theme);
                const active = values.theme.preset === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setValues((v) => ({ ...v, theme: { ...preset.theme } }))}
                    className={cn("flex items-center gap-3 rounded-xl p-2.5 text-left ring-1 transition", active ? "ring-2 ring-ink" : "ring-stone-200 hover:ring-stone-400")}
                  >
                    <span className="flex h-10 w-14 shrink-0 items-end gap-1 rounded-lg p-1.5" style={{ background: t.bg }}>
                      <span className="h-full w-2 rounded-sm" style={{ background: t.primary }} />
                      <span className="h-2/3 w-2 rounded-sm" style={{ background: t.secondary }} />
                      <span className="h-1/2 w-2 rounded-sm" style={{ background: t.surface2 }} />
                    </span>
                    <span className="text-[13px] font-medium">{preset.label}</span>
                  </button>
                );
              })}
            </div>
            {logoColor ? (
              <div className="flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 px-4 py-3 text-[13.5px] text-amber-900 ring-1 ring-amber-200">
                <Sparkles className="size-4" />
                <span>Couleur détectée dans le logo :</span>
                <span className="size-5 rounded-md ring-1 ring-black/10" style={{ background: logoColor }} />
                <Button size="sm" variant="secondary" onClick={() => setTheme({ primary: logoColor })}>
                  <Wand2 className="size-3.5" /> Utiliser cette couleur
                </Button>
              </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Ambiance">
                <Select value={values.theme.mode} onChange={(e) => setTheme({ mode: e.target.value as "dark" | "light", background: undefined })}>
                  <option value="dark">Sombre</option>
                  <option value="light">Claire</option>
                </Select>
              </Field>
              <Field label="Couleur principale">
                <div className="flex gap-2">
                  <input type="color" aria-label="Couleur principale" value={values.theme.primary} onChange={(e) => setTheme({ primary: e.target.value.toUpperCase() })} className="h-10 w-12 cursor-pointer rounded-xl ring-1 ring-stone-200" />
                  <Input value={values.theme.primary} onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && setTheme({ primary: e.target.value.toUpperCase() })} className="font-mono" maxLength={7} />
                </div>
              </Field>
              <Field label="Couleur secondaire">
                <div className="flex gap-2">
                  <input type="color" aria-label="Couleur secondaire" value={values.theme.secondary ?? values.theme.primary} onChange={(e) => setTheme({ secondary: e.target.value.toUpperCase() })} className="h-10 w-12 cursor-pointer rounded-xl ring-1 ring-stone-200" />
                  {values.theme.secondary ? (
                    <Button size="sm" variant="ghost" onClick={() => setTheme({ secondary: undefined })}>
                      Retirer
                    </Button>
                  ) : null}
                </div>
              </Field>
              <Field label="Typographie">
                <Select value={values.theme.font} onChange={(e) => setTheme({ font: e.target.value as ThemeSettings["font"] })}>
                  {Object.entries(FONT_PAIRINGS).map(([k, f]) => (
                    <option key={k} value={k}>
                      {f.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Langues" description="Le client choisit sa langue en un geste ; sa langue est détectée automatiquement." />
          <div className="space-y-4 p-5">
            <Field label="Langue principale du menu" className="max-w-xs">
              <Select value={values.defaultLocale} onChange={(e) => set("defaultLocale", e.target.value)}>
                {(Object.keys(LOCALES) as Locale[]).map((l) => (
                  <option key={l} value={l}>
                    {LOCALES[l].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Autres langues proposées">
              <div className="flex flex-wrap gap-2">
                {otherLocales.map((l) => {
                  const on = values.locales.includes(l);
                  return (
                    <button
                      key={l}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set("locales", on ? values.locales.filter((x) => x !== l) : [...values.locales, l])}
                      className={cn("h-9 rounded-full px-3.5 text-[13.5px] font-medium ring-1 transition", on ? "bg-ink text-white ring-ink" : "bg-white text-stone-700 ring-stone-200 hover:ring-stone-400")}
                    >
                      {LOCALES[l].label}
                    </button>
                  );
                })}
              </div>
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" onClick={() => set("locales", Object.keys(LOCALES))}>
                Toutes les langues
              </Button>
              <Button size="sm" variant="ghost" onClick={() => set("locales", [values.defaultLocale])}>
                Aucune autre langue
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Coordonnées et informations pratiques" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Adresse" className="sm:col-span-2">
              <Input value={values.addressLine1} onChange={(e) => set("addressLine1", e.target.value)} placeholder="12 rue des Lilas" />
            </Field>
            <Field label="Complément d'adresse" className="sm:col-span-2">
              <Input value={values.addressLine2} onChange={(e) => set("addressLine2", e.target.value)} />
            </Field>
            <Field label="Code postal">
              <Input value={values.postalCode} onChange={(e) => set("postalCode", e.target.value)} />
            </Field>
            <Field label="Ville">
              <Input value={values.city} onChange={(e) => set("city", e.target.value)} />
            </Field>
            <Field label="Téléphone">
              <Input type="tel" value={values.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>
            <Field label="E-mail">
              <Input type="email" value={values.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label="Site web" hint="https://…">
              <Input type="url" value={values.website} onChange={(e) => set("website", e.target.value)} />
            </Field>
            <Field label="Instagram" hint="@compte ou lien">
              <Input value={values.instagram} onChange={(e) => set("instagram", e.target.value)} />
            </Field>
            <Field label="Lien Google Maps" hint="Facultatif : sinon il est créé à partir de l'adresse" className="sm:col-span-2">
              <Input type="url" value={values.mapsUrl} onChange={(e) => set("mapsUrl", e.target.value)} />
            </Field>
            <Field label="Informations pratiques" hint="Horaires, services, moyens de paiement… (traduites avec le menu)" className="sm:col-span-2">
              <Textarea rows={4} value={values.practicalInfo} onChange={(e) => set("practicalInfo", e.target.value)} placeholder={"Ouvert du mardi au samedi, 12h–14h30 et 19h–22h30\nTerrasse · Accessible PMR"} />
            </Field>
            <Field label="Devise">
              <Select value={values.currency} onChange={(e) => set("currency", e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Affichage du menu" />
          <div className="space-y-4 p-5">
            <Switch checked={values.settings.showUnavailable} onChange={(v) => setSettings({ showUnavailable: v })} label="Afficher les plats indisponibles" description="Grisés avec la mention « Indisponible » (sinon masqués)" />
            <Switch checked={values.settings.enableFavorites} onChange={(v) => setSettings({ enableFavorites: v })} label="Liste « Mes envies »" description="Le client garde ses plats préférés sur son téléphone pour les montrer au serveur" />
            <Switch checked={values.settings.showAllergens} onChange={(v) => setSettings({ showAllergens: v })} label="Afficher les allergènes renseignés" />
            <Field label="Mention sous les allergènes" hint="Laisser vide pour la mention standard traduite automatiquement">
              <Input value={values.settings.allergenNotice ?? ""} maxLength={300} onChange={(e) => setSettings({ allergenNotice: e.target.value || undefined })} />
            </Field>
            <Switch checked={values.settings.showPoweredBy} onChange={(v) => setSettings({ showPoweredBy: v })} label="Mention « Menu 3D par VoirAvantDeCommander »" />
          </div>
        </Card>
      </div>

      <div className="xl:sticky xl:top-8 xl:self-start">
        <p className="mb-3 text-center text-[12px] font-medium tracking-wide text-stone-500 uppercase">Aperçu</p>
        <MenuPreview values={values} logoUrl={logo.url} coverUrl={cover.url} />
        <div className="mt-6 space-y-2">
          <Button type="submit" variant="accent" size="lg" className="w-full" loading={!!saving}>
            {saving ?? (mode === "create" ? "Créer le restaurant" : "Enregistrer")}
          </Button>
          {mode === "create" ? (
            <p className="text-center text-[12px] text-stone-500">Le menu reste en brouillon tant que vous ne l&apos;avez pas publié.</p>
          ) : null}
        </div>
      </div>
    </form>
  );
}
