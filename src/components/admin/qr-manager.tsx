"use client";

import { useState } from "react";
import { Check, Copy, Download, FileText, Link2, Mail, MessageCircle, Printer, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Switch } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/components/ui/cn";
import type { QrStyle } from "@/lib/qr/qr";
import { api, errorMessage } from "./api";

type Props = {
  restaurantId: string;
  restaurantName: string;
  restaurantEmail: string | null;
  published: boolean;
  targetUrl: string;
  currentSlugUrl: string | null;
  downloads: number;
  style: QrStyle;
  defaultAccent: string;
  templates: { key: string; label: string; description: string }[];
};

export function QrManager(props: Props) {
  const toast = useToast();
  const base = `/api/admin/restaurants/${props.restaurantId}/qr`;
  const [style, setStyle] = useState<QrStyle>(props.style);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);
  const [copied, setCopied] = useState(false);
  const [template, setTemplate] = useState(props.templates[0]?.key ?? "table-card");
  const [sharing, setSharing] = useState(false);
  const [links, setLinks] = useState<{ png: string; pdf: string; svg: string } | null>(null);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Copie impossible : sélectionnez le lien manuellement.");
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await api(base, { method: "PATCH", body: style });
      setVersion((v) => v + 1);
      toast.success("Personnalisation enregistrée. L'adresse encodée dans le QR code ne change pas.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const share = async () => {
    setSharing(true);
    try {
      setLinks(await api<{ png: string; pdf: string; svg: string }>(`${base}/share`, { body: { template } }));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSharing(false);
    }
  };

  const message = links
    ? `Bonjour,\n\nVoici le QR code du menu 3D de ${props.restaurantName}.\n\nMenu en ligne : ${props.targetUrl}\n\nÀ imprimer (PDF) : ${links.pdf}\nImage PNG (réseaux sociaux, site) : ${links.png}\nVersion vectorielle SVG (imprimeur) : ${links.svg}\n\nLes liens de téléchargement sont valables 30 jours. Le QR code ne change jamais : vos modifications de menu sont visibles immédiatement après publication.\n\nÀ bientôt,`
    : "";

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <div className="space-y-4">
        <Card className="p-5">
          <div className="overflow-hidden rounded-2xl ring-1 ring-stone-200" style={{ background: style.bg }}>
            <img src={`${base}?format=png&inline=1&v=${version}`} alt={`QR code du menu de ${props.restaurantName}`} className="aspect-square w-full" />
          </div>
          <div className="mt-4 rounded-xl bg-stone-50 p-3">
            <p className="text-[12px] font-medium text-stone-500">Adresse encodée (permanente)</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate text-[13px]">{props.targetUrl}</code>
              <Button size="sm" variant="secondary" onClick={() => copy(props.targetUrl)} aria-label="Copier le lien du menu">
                {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                {copied ? "Copié" : "Copier"}
              </Button>
            </div>
          </div>
          {props.currentSlugUrl ? (
            <p className="mt-3 text-[12.5px] text-stone-500">
              L&apos;adresse du menu a changé depuis la création du QR code : l&apos;ancienne adresse redirige automatiquement vers /menu/{props.currentSlugUrl}.
            </p>
          ) : null}
          {!props.published ? (
            <p className="mt-3 flex gap-2 rounded-xl bg-amber-50 p-3 text-[12.5px] text-amber-900 ring-1 ring-amber-200">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              Le menu n&apos;est pas encore publié : ce QR code affiche pour l&apos;instant « Menu bientôt disponible ». Il fonctionnera dès la publication, sans réimpression.
            </p>
          ) : null}
          <p className="mt-3 text-[12px] text-stone-400">{props.downloads} téléchargement(s)</p>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Télécharger" description="Le QR code ne change jamais, même si vous modifiez le menu, les prix ou les photos." />
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            <a href={`${base}?format=png`} className="flex items-center gap-3 rounded-xl p-3 ring-1 ring-stone-200 transition hover:bg-stone-50">
              <Download className="size-5 text-stone-500" />
              <span>
                <span className="block text-[14px] font-medium">PNG haute définition</span>
                <span className="block text-[12.5px] text-stone-500">2000 × 2000 px — site, réseaux sociaux</span>
              </span>
            </a>
            <a href={`${base}?format=svg`} className="flex items-center gap-3 rounded-xl p-3 ring-1 ring-stone-200 transition hover:bg-stone-50">
              <Download className="size-5 text-stone-500" />
              <span>
                <span className="block text-[14px] font-medium">SVG vectoriel</span>
                <span className="block text-[12.5px] text-stone-500">Pour l&apos;imprimeur, toutes tailles</span>
              </span>
            </a>
          </div>
          <div className="border-t border-stone-100 p-5">
            <p className="mb-3 flex items-center gap-2 text-[14px] font-semibold">
              <Printer className="size-4" /> Supports imprimables (PDF)
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {props.templates.map((t) => (
                <div key={t.key} className={cn("flex items-center gap-3 rounded-xl p-3 ring-1", template === t.key ? "ring-2 ring-ink" : "ring-stone-200")}>
                  <button type="button" onClick={() => setTemplate(t.key)} className="min-w-0 flex-1 text-start">
                    <span className="block text-[14px] font-medium">{t.label}</span>
                    <span className="block text-[12.5px] text-stone-500">{t.description}</span>
                  </button>
                  <a href={`${base}?format=pdf&template=${t.key}&inline=1&v=${version}`} target="_blank" rel="noopener noreferrer" className="grid size-9 place-items-center rounded-lg text-stone-500 hover:bg-stone-100" aria-label={`Aperçu ${t.label}`} title="Aperçu">
                    <FileText className="size-4" />
                  </a>
                  <a href={`${base}?format=pdf&template=${t.key}`} className="grid size-9 place-items-center rounded-lg bg-ink text-white hover:bg-ink-3" aria-label={`Télécharger ${t.label}`} title="Télécharger">
                    <Download className="size-4" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Envoyer au restaurateur" description="Des liens de téléchargement sécurisés, valables 30 jours, sans création de compte." />
          <div className="space-y-4 p-5">
            {!links ? (
              <Button onClick={share} loading={sharing}>
                <Link2 className="size-4" /> Créer les liens d&apos;envoi
              </Button>
            ) : (
              <>
                <textarea readOnly value={message} rows={9} className="w-full rounded-xl bg-stone-50 p-3 text-[13px] leading-relaxed ring-1 ring-stone-200" />
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`mailto:${props.restaurantEmail ?? ""}?subject=${encodeURIComponent(`QR code du menu — ${props.restaurantName}`)}&body=${encodeURIComponent(message)}`}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-medium text-white hover:bg-ink-3"
                  >
                    <Mail className="size-4" /> Envoyer par e-mail
                  </a>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(message)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-medium ring-1 ring-stone-200 hover:bg-stone-50"
                  >
                    <MessageCircle className="size-4" /> WhatsApp
                  </a>
                  <Button variant="secondary" onClick={() => copy(message)}>
                    <Copy className="size-4" /> Copier le message
                  </Button>
                </div>
              </>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Personnaliser" description="Couleurs, logo central et textes des supports imprimables." />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Couleur du QR code" hint="Foncée, pour être lue par tous les téléphones">
              <div className="flex gap-2">
                <input type="color" value={style.fg} onChange={(e) => setStyle({ ...style, fg: e.target.value.toUpperCase() })} className="h-10 w-12 rounded-xl ring-1 ring-stone-200" aria-label="Couleur du QR code" />
                <Input value={style.fg} onChange={(e) => setStyle({ ...style, fg: e.target.value })} className="font-mono" maxLength={7} />
              </div>
            </Field>
            <Field label="Couleur de fond">
              <div className="flex gap-2">
                <input type="color" value={style.bg} onChange={(e) => setStyle({ ...style, bg: e.target.value.toUpperCase() })} className="h-10 w-12 rounded-xl ring-1 ring-stone-200" aria-label="Couleur de fond" />
                <Input value={style.bg} onChange={(e) => setStyle({ ...style, bg: e.target.value })} className="font-mono" maxLength={7} />
              </div>
            </Field>
            <Field label="Couleur d'accent des supports" hint="Par défaut : couleur principale du restaurant">
              <div className="flex gap-2">
                <input type="color" value={style.accent ?? props.defaultAccent} onChange={(e) => setStyle({ ...style, accent: e.target.value.toUpperCase() })} className="h-10 w-12 rounded-xl ring-1 ring-stone-200" aria-label="Couleur d'accent" />
                {style.accent ? (
                  <Button variant="ghost" size="sm" onClick={() => setStyle({ ...style, accent: undefined })}>
                    Par défaut
                  </Button>
                ) : null}
              </div>
            </Field>
            <div className="flex items-end pb-2">
              <Switch checked={style.logo} onChange={(v) => setStyle({ ...style, logo: v })} label="Logo au centre du QR code" description="Si un logo est défini dans les paramètres" />
            </div>
            <Field label="Titre" className="sm:col-span-2">
              <Input value={style.headline} maxLength={80} onChange={(e) => setStyle({ ...style, headline: e.target.value })} />
            </Field>
            <Field label="Consigne" className="sm:col-span-2">
              <Input value={style.subline} maxLength={140} onChange={(e) => setStyle({ ...style, subline: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Button variant="accent" onClick={save} loading={saving}>
                Enregistrer la personnalisation
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
