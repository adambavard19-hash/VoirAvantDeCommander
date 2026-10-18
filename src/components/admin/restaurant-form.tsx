"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DoorOpen, ImagePlus, Play, Sparkles, Trash2, Wand2 } from "lucide-react";
import { EntranceIntro } from "@/components/menu/entrance-intro";
import { suggestAmbiance, type PhotoAnalysis } from "@/lib/ambiance";
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
  facadeAssetId: string | null;
  interiorAssetId: string | null;
  entranceVideoAssetId: string | null;
  galleryAssetIds: string[];
};

type ImageSlot = { assetId: string | null; url: string | null; file?: File };

export type RestaurantFormProps = {
  mode: "create" | "edit";
  restaurantId?: string;
  initial: RestaurantFormValues;
  initialImages?: { logo: string | null; cover: string | null; facade?: string | null; interior?: string | null; entranceVideo?: string | null; gallery: { id: string; url: string }[] };
};

const CURRENCIES = ["EUR", "CHF", "GBP", "USD", "CAD", "MAD", "XOF", "AED", "JPY"];

/** Couleur dominante (saturée) d'une image, calculée dans le navigateur. */
/** Analyse une photo dans le navigateur : luminosité, couleurs marquantes, teinte moyenne. */
async function analyzePhoto(url: string): Promise<PhotoAnalysis | null> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    await img.decode();
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    let lum = 0;
    let n = 0;
    let ar = 0;
    let ag = 0;
    let ab = 0;
    const buckets = new Map<string, { n: number; r: number; g: number; b: number; score: number }>();
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b] = [data[i]!, data[i + 1]!, data[i + 2]!];
      lum += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      ar += r;
      ag += g;
      ab += b;
      n++;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      if (sat < 0.3 || max < 50 || min > 225) continue;
      const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
      const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0, score: 0 };
      bucket.n++;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.score += sat;
      buckets.set(key, bucket);
    }
    const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
    const accents = [...buckets.values()]
      .filter((b) => b.n >= 6)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((b) => hex(b.r / b.n, b.g / b.n, b.b / b.n));
    return { luminance: lum / n, accents, average: hex(ar / n, ag / n, ab / n) };
  } catch {
    return null;
  }
}

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
  focus,
  onFocus,
}: {
  label: string;
  hint: string;
  slot: ImageSlot;
  onPick: (file: File) => void;
  onClear: () => void;
  aspect: string;
  contain?: boolean;
  /** Point d'intérêt réglable d'un appui sur la photo (ex. la porte de la devanture). */
  focus?: { x: number; y: number };
  onFocus?: (f: { x: number; y: number }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <Field label={label} hint={hint}>
      <div className={cn("group relative overflow-hidden rounded-xl bg-stone-100 ring-1 ring-stone-200", aspect)}>
        {slot.url ? (
          <img src={slot.url} alt="" className={cn("absolute inset-0 size-full", contain ? "object-contain p-3" : "object-cover")} />
        ) : null}
        {slot.url && onFocus && focus ? (
          <button
            type="button"
            aria-label="Placer la porte : touchez la photo à l'endroit de l'entrée"
            className="absolute inset-0 cursor-crosshair"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const round = (n: number) => Math.min(1, Math.max(0, Math.round(n * 100) / 100));
              onFocus({ x: round((e.clientX - r.left) / r.width), y: round((e.clientY - r.top) / r.height) });
            }}
          >
            <span
              className="pointer-events-none absolute grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-stone-800 shadow-lg ring-4 ring-saffron/60"
              style={{ left: `${focus.x * 100}%`, top: `${focus.y * 100}%` }}
            >
              <DoorOpen className="size-5" />
            </span>
          </button>
        ) : null}
        {slot.url ? null : (
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
  const [facade, setFacade] = useState<ImageSlot>({ assetId: initial.facadeAssetId, url: initialImages?.facade ?? null });
  const [interior, setInterior] = useState<ImageSlot>({ assetId: initial.interiorAssetId, url: initialImages?.interior ?? null });
  const [entranceVideo, setEntranceVideo] = useState<ImageSlot>({ assetId: initial.entranceVideoAssetId, url: initialImages?.entranceVideo ?? null });
  const videoInput = useRef<HTMLInputElement>(null);
  const [previewIntro, setPreviewIntro] = useState(false);
  const [gallery, setGallery] = useState<ImageSlot[]>(
    initialImages?.gallery.map((g) => ({ assetId: g.id, url: g.url })) ?? [],
  );
  const [logoColor, setLogoColor] = useState<string | null>(null);
  const [ambiance, setAmbiance] = useState<{ busy: boolean; reasons: string[] | null }>({ busy: false, reasons: null });

  /** Ambiance automatique : d'après les photos (devanture, salle, couverture, logo) et le type de cuisine. */
  const autoAmbiance = async () => {
    setAmbiance({ busy: true, reasons: null });
    const urls = [interior.url, facade.url, cover.url, logo.url, ...gallery.slice(0, 3).map((g) => g.url)].filter((u): u is string => !!u);
    const photos = (await Promise.all(urls.map(analyzePhoto))).filter((p): p is PhotoAnalysis => !!p);
    const result = suggestAmbiance({ photos, cuisineType: values.cuisineType, name: values.name });
    setValues((v) => ({ ...v, theme: { ...result.theme, preset: undefined } }));
    setAmbiance({
      busy: false,
      reasons: photos.length ? result.reasons : ["aucune photo analysable : ajoutez une couverture, la devanture ou la salle", ...result.reasons],
    });
  };
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
    if (facade.file) pending.push({ key: "facade", file: facade.file });
    if (interior.file) pending.push({ key: "interior", file: interior.file });
    if (entranceVideo.file) pending.push({ key: "entrance-video", file: entranceVideo.file });
    gallery.forEach((g, i) => g.file && pending.push({ key: `gallery-${i}`, file: g.file }));
    const ids: Record<string, string | null> = {};
    if (pending.length) {
      setSaving("Téléversement des images…");
      const { assets } = await uploadFiles(rid, pending.map((p) => ({ file: p.file, path: p.key })), { accept: ["image", "video"] });
      for (const p of pending) {
        const asset = assets.find((a) => a.path === p.key);
        if (!asset || asset.status !== "READY") throw new Error(`Image « ${p.file.name} » : ${asset?.error ?? "échec du téléversement"}`);
        ids[p.key] = asset.id;
      }
    }
    return {
      logoAssetId: logo.file ? ids.logo! : logo.assetId,
      coverAssetId: cover.file ? ids.cover! : cover.assetId,
      facadeAssetId: facade.file ? ids.facade! : facade.assetId,
      interiorAssetId: interior.file ? ids.interior! : interior.assetId,
      entranceVideoAssetId: entranceVideo.file ? ids["entrance-video"]! : entranceVideo.assetId,
      galleryAssetIds: gallery.map((g, i) => (g.file ? ids[`gallery-${i}`]! : g.assetId!)).filter(Boolean),
    };
  };

  const payload = (assets: { logoAssetId: string | null; coverAssetId: string | null; facadeAssetId: string | null; interiorAssetId: string | null; entranceVideoAssetId: string | null; galleryAssetIds: string[] }) => ({
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
          body: payload({ logoAssetId: null, coverAssetId: null, facadeAssetId: null, interiorAssetId: null, entranceVideoAssetId: null, galleryAssetIds: [] }),
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
        setFacade((c) => ({ ...c, assetId: assets.facadeAssetId, file: undefined }));
        setInterior((c) => ({ ...c, assetId: assets.interiorAssetId, file: undefined }));
        setEntranceVideo((c) => ({ ...c, assetId: assets.entranceVideoAssetId, file: undefined }));
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
          <CardHeader
            title="Entrée animée"
            description="Avant le menu, le client « entre » dans votre restaurant : une vidéo de la rue jusqu'à la salle, ou à défaut la devanture puis la salle en photos. Une fois par visite, et le client peut passer."
            actions={
              entranceVideo.url || (facade.url && interior.url) ? (
                <Button size="sm" variant="secondary" onClick={() => setPreviewIntro(true)}>
                  <Play className="size-3.5" /> Aperçu
                </Button>
              ) : null
            }
          />
          <div className="space-y-5 p-5">
            <Switch
              checked={values.settings.entranceIntro}
              onChange={(v) => setSettings({ entranceIntro: v })}
              label="Jouer l'entrée animée avant le menu"
              description="Active avec une vidéo ou les deux photos. Désactivée automatiquement si le téléphone du client demande moins d'animations."
            />
            <Field
              label="Vidéo d'entrée (recommandée)"
              hint="De la rue jusqu'à la salle, 5 à 12 secondes, filmée au téléphone en marchant doucement (MP4 ou MOV, 60 Mo max). Les photos servent de solution de repli."
            >
              <div className="flex flex-wrap items-center gap-3">
                {entranceVideo.url ? (
                  <video src={entranceVideo.url} muted playsInline loop autoPlay className="h-40 rounded-xl bg-black object-cover ring-1 ring-stone-200" />
                ) : null}
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => videoInput.current?.click()}>
                    <Play className="size-3.5" /> {entranceVideo.url ? "Remplacer la vidéo" : "Choisir une vidéo"}
                  </Button>
                  {entranceVideo.url ? (
                    <Button size="sm" variant="secondary" onClick={() => setEntranceVideo({ assetId: null, url: null })} aria-label="Retirer la vidéo">
                      <Trash2 className="size-3.5" />
                    </Button>
                  ) : null}
                </div>
                <input
                  ref={videoInput}
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setEntranceVideo({ assetId: null, url: URL.createObjectURL(f), file: f });
                    e.target.value = "";
                  }}
                />
              </div>
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <ImagePicker
                label="Devanture"
                hint="Photo prise de face, depuis la rue. Touchez la photo pour placer la porte : la caméra y entrera."
                slot={facade}
                focus={values.settings.entranceFocus}
                onFocus={(entranceFocus) => setSettings({ entranceFocus })}
                onPick={(f) => pickImage(f, setFacade)}
                onClear={() => setFacade({ assetId: null, url: null })}
                aspect="aspect-[3/4]"
              />
              <ImagePicker
                label="Intérieur"
                hint="La salle, vue depuis l'entrée de préférence."
                slot={interior}
                onPick={(f) => pickImage(f, setInterior)}
                onClear={() => setInterior({ assetId: null, url: null })}
                aspect="aspect-[3/4]"
              />
            </div>
          </div>
        </Card>
        {previewIntro && (entranceVideo.url || (facade.url && interior.url)) ? (
          <EntranceIntro
            preview
            storageKey="apercu"
            facade={facade.url ? { src: facade.url } : null}
            interior={interior.url ? { src: interior.url } : null}
            video={entranceVideo.url ? { src: entranceVideo.url, type: entranceVideo.file?.type || "video/mp4" } : null}
            focus={values.settings.entranceFocus}
            name={values.name || "Votre restaurant"}
            welcome="Bienvenue"
            skipLabel="Passer"
            onDone={() => setPreviewIntro(false)}
          />
        ) : null}

        <Card>
          <CardHeader title="Identité visuelle" description="La palette complète et lisible est calculée automatiquement." />
          <div className="space-y-5 p-5">
            <div className="rounded-2xl bg-gradient-to-br from-stone-900 to-stone-800 p-4 text-white">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-[14px] font-semibold">
                    <Sparkles className="size-4 text-amber-300" /> Ambiance automatique
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-white/65">
                    Couleurs, mode clair/sombre et typographie choisis d&apos;après vos photos et votre type de cuisine. Vous pouvez tout ajuster ensuite.
                  </p>
                </div>
                <Button size="sm" variant="accent" onClick={autoAmbiance} loading={ambiance.busy}>
                  <Wand2 className="size-3.5" /> Créer l&apos;ambiance
                </Button>
              </div>
              {ambiance.reasons ? (
                <ul className="mt-3 space-y-1 border-t border-white/10 pt-3 text-[12.5px] text-white/75">
                  {ambiance.reasons.map((r) => (
                    <li key={r}>• {r}</li>
                  ))}
                </ul>
              ) : null}
            </div>
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
