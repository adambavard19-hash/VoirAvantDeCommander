"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, CircleCheck, Languages, LoaderCircle, PenLine, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/components/ui/cn";
import { api, errorMessage } from "./api";
import { notifyMenuChanged } from "./events";

type State = "missing" | "stale" | "auto" | "manual";
type Row = {
  key: string;
  entityType: string;
  entityId: string;
  field: string;
  source: string;
  context: string;
  translations: Record<string, { value: string; state: State }>;
};

type Props = {
  restaurantId: string;
  defaultLocale: string;
  locales: { code: string; label: string; dir: "ltr" | "rtl" }[];
  rows: Row[];
  summary: { locale: string; total: number; missing: number; stale: number; auto: number; manual: number }[];
  provider: "claude" | "deepl" | null;
};

const STATE_BADGE: Record<State, { label: string; tone: "danger" | "warning" | "info" | "success" }> = {
  missing: { label: "À traduire", tone: "danger" },
  stale: { label: "Texte d'origine modifié", tone: "warning" },
  auto: { label: "Automatique", tone: "info" },
  manual: { label: "Vérifiée", tone: "success" },
};

function TranslationCell({
  row,
  locale,
  dir,
  onSave,
}: {
  row: Row;
  locale: string;
  dir: "ltr" | "rtl";
  onSave: (value: string) => Promise<State>;
}) {
  const initial = row.translations[locale]!;
  const [value, setValue] = useState(initial.value);
  const [state, setState] = useState<State>(initial.state);
  const [saving, setSaving] = useState(false);
  const [prev, setPrev] = useState(initial);
  if (prev !== initial) {
    setPrev(initial);
    setValue(initial.value);
    setState(initial.state);
  }
  const badge = STATE_BADGE[state];
  return (
    <div>
      <textarea
        value={value}
        dir={dir}
        lang={locale}
        rows={row.field === "name" || row.field.startsWith("variant") ? 1 : 2}
        onChange={(e) => setValue(e.target.value)}
        onBlur={async () => {
          if (value.trim() === initial.value.trim() && state !== "stale") return;
          setSaving(true);
          try {
            setState(await onSave(value));
          } finally {
            setSaving(false);
          }
        }}
        className={cn(
          "w-full resize-y rounded-xl bg-white px-3 py-2 text-[14px] leading-snug ring-1 outline-none focus:ring-2 focus:ring-saffron",
          state === "missing" ? "ring-red-200" : state === "stale" ? "ring-amber-300" : "ring-stone-200",
        )}
        placeholder="Traduction…"
        aria-label={`Traduction (${locale}) de « ${row.source.slice(0, 40)} »`}
      />
      <div className="mt-1 flex items-center gap-2">
        <Badge tone={badge.tone}>
          {state === "auto" ? <Bot className="size-3" /> : state === "manual" ? <PenLine className="size-3" /> : state === "stale" ? <TriangleAlert className="size-3" /> : null}
          {badge.label}
        </Badge>
        {saving ? <LoaderCircle className="size-3.5 animate-spin text-stone-400" /> : null}
      </div>
    </div>
  );
}

export function TranslationEditor({ restaurantId, defaultLocale, locales, rows, summary, provider }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [locale, setLocale] = useState(locales[0]!.code);
  const [filter, setFilter] = useState<"todo" | "all">("todo");
  const [running, setRunning] = useState<string | null>(null);
  const current = locales.find((l) => l.code === locale)!;
  const stats = summary.find((s) => s.locale === locale)!;

  const visible = useMemo(
    () => rows.filter((r) => filter === "all" || ["missing", "stale"].includes(r.translations[locale]?.state ?? "missing")),
    [rows, filter, locale],
  );

  const save = async (row: Row, value: string): Promise<State> => {
    try {
      const res = await api<{ state: State }>(`/api/admin/restaurants/${restaurantId}/translations`, {
        method: "PUT",
        body: { entityType: row.entityType, entityId: row.entityId, field: row.field, locale, value },
      });
      notifyMenuChanged();
      return res.state;
    } catch (error) {
      toast.error(errorMessage(error));
      return row.translations[locale]!.state;
    }
  };

  const auto = async (targets: string[]) => {
    setRunning(targets.join(","));
    try {
      const { report } = await api<{ report: { locale: string; translated: number; skipped: number; errors: string[] }[] }>(
        `/api/admin/restaurants/${restaurantId}/translations/auto`,
        { body: { locales: targets } },
      );
      const translated = report.reduce((s, r) => s + r.translated, 0);
      const skipped = report.reduce((s, r) => s + r.skipped, 0);
      const errors = report.flatMap((r) => r.errors);
      if (errors.length) toast.error(errors[0]!);
      toast.success(`${translated} texte(s) traduit(s)${skipped ? `, ${skipped} écarté(s) (nombres modifiés ou réponse vide) à traduire à la main` : ""}.`);
      notifyMenuChanged();
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setRunning(null);
    }
  };

  const todoAll = summary.reduce((s, x) => s + x.missing + x.stale, 0);

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-[16px] font-semibold">
              <Languages className="size-5" /> Traductions du menu
            </h2>
            <p className="mt-1 max-w-2xl text-[13.5px] text-stone-500">
              Les traductions sont enregistrées : elles ne sont jamais recalculées à la consultation. Les prix ne sont jamais traduits ni modifiés.
              Une traduction n&apos;est affichée aux clients que si elle correspond au texte actuel ; sinon le texte d&apos;origine s&apos;affiche.
            </p>
          </div>
          {provider ? (
            <Button variant="accent" onClick={() => auto(locales.map((l) => l.code))} loading={!!running && running.includes(",")} disabled={!todoAll || !!running}>
              <Bot className="size-4" /> Tout traduire automatiquement ({todoAll})
            </Button>
          ) : (
            <p className="max-w-xs rounded-xl bg-stone-50 p-3 text-[12.5px] text-stone-500 ring-1 ring-stone-200">
              Traduction automatique désactivée : ajoutez ANTHROPIC_API_KEY ou DEEPL_API_KEY dans la configuration du serveur. La saisie manuelle reste disponible.
            </p>
          )}
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {summary.map((s) => {
            const done = s.auto + s.manual;
            const l = locales.find((x) => x.code === s.locale)!;
            return (
              <button
                key={s.locale}
                type="button"
                onClick={() => setLocale(s.locale)}
                className={cn("rounded-xl p-3 text-start ring-1 transition", locale === s.locale ? "ring-2 ring-ink" : "ring-stone-200 hover:ring-stone-400")}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-medium">{l.label}</span>
                  {done === s.total && s.total ? <CircleCheck className="size-4 text-emerald-600" /> : <span className="text-[12px] text-stone-500 tabular-nums">{done}/{s.total}</span>}
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-100">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${s.total ? (done / s.total) * 100 : 0}%` }} />
                </div>
                {s.stale ? <p className="mt-1.5 text-[11.5px] text-amber-700">{s.stale} à revoir</p> : null}
              </button>
            );
          })}
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex gap-1 rounded-xl bg-white p-1 ring-1 ring-stone-200">
          <button type="button" onClick={() => setFilter("todo")} className={cn("rounded-lg px-3 py-1.5 text-[13px] font-medium", filter === "todo" ? "bg-ink text-white" : "text-stone-600 hover:bg-stone-100")}>
            À traduire ({stats.missing + stats.stale})
          </button>
          <button type="button" onClick={() => setFilter("all")} className={cn("rounded-lg px-3 py-1.5 text-[13px] font-medium", filter === "all" ? "bg-ink text-white" : "text-stone-600 hover:bg-stone-100")}>
            Tous les textes ({stats.total})
          </button>
        </nav>
        {provider ? (
          <Button size="sm" variant="secondary" onClick={() => auto([locale])} loading={running === locale} disabled={!(stats.missing + stats.stale) || !!running}>
            <Bot className="size-3.5" /> Traduire en {current.label}
          </Button>
        ) : null}
      </div>

      <Card>
        {visible.length ? (
          <ul className="divide-y divide-stone-100">
            {visible.map((row) => (
              <li key={`${row.key}:${locale}`} className="grid gap-3 px-5 py-4 md:grid-cols-2">
                <div>
                  <p className="text-[11.5px] font-medium tracking-wide text-stone-400 uppercase">{row.context}</p>
                  <p className="mt-1 text-[14px] whitespace-pre-line text-stone-800" lang={defaultLocale}>
                    {row.source}
                  </p>
                </div>
                <TranslationCell row={row} locale={locale} dir={current.dir} onSave={(v) => save(row, v)} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-10 text-center text-[14px] text-stone-500">Tout est traduit en {current.label}.</p>
        )}
      </Card>
    </div>
  );
}
