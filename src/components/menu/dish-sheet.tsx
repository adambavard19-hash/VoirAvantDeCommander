"use client";

import { useEffect, useRef, useState } from "react";
import { Heart, Ruler, Smartphone, TriangleAlert } from "lucide-react";
import type { DishView, MenuView } from "@/lib/menu/view";
import { Sheet } from "./sheet";
import { ModelStage, type ArSupport, type ModelStageHandle } from "./model-stage";
import { ArIcon } from "./icons";
import { TagIcon } from "./tag-icon";
import { DishImage } from "./dish-image";
import { detectDevice, type DeviceInfo } from "./device";
import { track } from "./track";

type Props = {
  view: MenuView;
  dish: DishView | null;
  dishesById: Map<string, DishView>;
  onClose: () => void;
  onOpenDish: (id: string) => void;
  favorite: boolean;
  onToggleFavorite: (id: string) => void;
};

export function DishSheet({ view, dish, dishesById, onClose, onOpenDish, favorite, onToggleFavorite }: Props) {
  const s = view.strings;
  const stageRef = useRef<ModelStageHandle>(null);
  const [mode, setMode] = useState<"3d" | "photo">(dish?.model ? "3d" : "photo");
  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [modelFailed, setModelFailed] = useState(false);
  const [arSupport, setArSupport] = useState<ArSupport>("unknown");
  const [arMessage, setArMessage] = useState<string | null>(null);
  const [device] = useState<DeviceInfo>(detectDevice);

  // Nouveau plat affiché : on repart d'un état propre.
  const [prevDish, setPrevDish] = useState(dish);
  if (dish !== prevDish) {
    setPrevDish(dish);
    setMode(dish?.model ? "3d" : "photo");
    setLoaded(false);
    setProgress(0);
    setModelFailed(false);
    setArSupport("unknown");
    setArMessage(null);
  }

  useEffect(() => {
    if (dish && !view.preview) track(view.restaurant.slug, "DISH_VIEW", dish.id);
  }, [dish, view.preview, view.restaurant.slug]);

  if (!dish) return <Sheet open={false} onClose={onClose} label="" closeLabel={s.close}>{null}</Sheet>;

  const hasModel = !!dish.model && (!!dish.model.glb || !!dish.model.usdz) && !modelFailed;
  const show3d = hasModel && mode === "3d";
  const recommendations = dish.recommendations.map((id) => dishesById.get(id)).filter((d): d is DishView => !!d);

  const launchAR = async () => {
    setArMessage(null);
    if (device?.inApp) {
      setArMessage(s.arInApp);
      return;
    }
    if (!device?.mobile) {
      setArMessage(s.arDesktop);
      return;
    }
    if (mode !== "3d") setMode("3d");
    const ok = await stageRef.current?.activateAR();
    if (ok) {
      if (!view.preview) track(view.restaurant.slug, "AR_LAUNCH", dish.id);
    } else {
      setArMessage(arSupport === "unavailable" ? s.arUnsupported : s.arFailed);
    }
  };

  const arButton = hasModel ? (
    <div className="space-y-2">
      <button
        type="button"
        onClick={launchAR}
        className="group relative flex h-14 w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-[var(--m-primary)] px-5 text-[15px] font-semibold text-[var(--m-on-primary)] shadow-[0_10px_40px_-10px_var(--m-glow)] transition active:scale-[.98]"
      >
        <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_25%,rgba(255,255,255,.35)_50%,transparent_75%)] bg-[length:200%_100%] animate-shimmer opacity-60" />
        <ArIcon className="relative size-6" />
        <span className="relative">{s.viewOnTable}</span>
      </button>
      {arMessage ? (
        <p role="status" className="flex items-start gap-2 rounded-xl bg-[var(--m-surface)] px-3 py-2.5 text-[13px] leading-snug text-[var(--m-muted)]">
          {device?.mobile ? <TriangleAlert className="mt-0.5 size-4 shrink-0" /> : <Smartphone className="mt-0.5 size-4 shrink-0" />}
          {arMessage}
        </p>
      ) : (
        <p className="text-center text-[12px] text-[var(--m-muted)]">{s.arHowTo}</p>
      )}
    </div>
  ) : null;

  return (
    <Sheet
      open={!!dish}
      onClose={onClose}
      label={dish.name}
      closeLabel={s.close}
      footer={arButton}
      dir={view.dir}
      style={view.themeVars as React.CSSProperties}
    >
      <div className="md:grid md:grid-cols-[1.1fr_1fr]">
        {/* ─── Média : 3D ou photo ─── */}
        <div className="relative aspect-square w-full overflow-hidden bg-[radial-gradient(120%_90%_at_50%_30%,var(--m-surface-2)_0%,var(--m-bg)_75%)] md:aspect-auto md:min-h-[560px]">
          {show3d ? (
            <>
              <ModelStage
                ref={stageRef}
                glb={dish.model!.glb}
                usdz={dish.model!.usdz}
                poster={dish.photo?.src ?? null}
                alt={dish.name}
                scaleValidated={dish.model!.scaleValidated}
                className="absolute inset-0"
                onLoad={() => setLoaded(true)}
                onProgress={setProgress}
                onError={() => {
                  setModelFailed(true);
                  setMode("photo");
                }}
                onInteract={() => !view.preview && track(view.restaurant.slug, "MODEL_VIEW", dish.id)}
                onArSupport={setArSupport}
                onArStatus={(status) => {
                  if (status === "failed") setArMessage(s.arFailed);
                }}
              />
              {!loaded ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-6 flex flex-col items-center gap-2 text-[12px] text-[var(--m-muted)]">
                  <div className="h-1 w-40 overflow-hidden rounded-full bg-[var(--m-border)]">
                    <div className="h-full rounded-full bg-[var(--m-primary)] transition-[width] duration-300" style={{ width: `${Math.max(6, progress * 100)}%` }} />
                  </div>
                  {s.loading3d}
                </div>
              ) : (
                <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-[11px] tracking-wide text-[var(--m-muted)] opacity-80">
                  {s.rotateHint}
                </p>
              )}
            </>
          ) : dish.photo ? (
            <DishImage image={dish.photo} alt={dish.name} sizes="(min-width: 768px) 480px, 100vw" className="absolute inset-0 size-full object-cover" priority />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-[var(--m-muted)]">
              <span className="m-display px-8 text-center text-2xl opacity-60">{dish.name}</span>
            </div>
          )}

          {hasModel && dish.photo ? (
            <div className="absolute start-4 top-4 z-10 flex rounded-full bg-black/45 p-1 text-[12px] font-semibold text-white backdrop-blur-md" role="tablist">
              {(["3d", "photo"] as const).map((m) => (
                <button
                  key={m}
                  role="tab"
                  type="button"
                  aria-selected={mode === m}
                  onClick={() => setMode(m)}
                  className={`rounded-full px-3.5 py-1.5 transition ${mode === m ? "bg-white text-black" : "text-white/85"}`}
                >
                  {m === "3d" ? s.model : s.photo}
                </button>
              ))}
            </div>
          ) : null}

          {!dish.available ? (
            <span className="absolute bottom-4 start-4 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">{s.unavailable}</span>
          ) : null}
        </div>

        {/* ─── Informations ─── */}
        <div className="px-5 pt-5 pb-6 md:px-7 md:pt-14">
          <div className="flex items-start justify-between gap-4">
            <h2 className="m-display text-[28px] leading-[1.1] font-semibold tracking-tight md:text-[34px]">{dish.name}</h2>
            {view.restaurant.settings.enableFavorites ? (
              <button
                type="button"
                onClick={() => onToggleFavorite(dish.id)}
                aria-pressed={favorite}
                aria-label={favorite ? s.removeFavorite : s.addFavorite}
                className={`grid size-11 shrink-0 place-items-center rounded-full border transition ${
                  favorite ? "border-transparent bg-[var(--m-primary)] text-[var(--m-on-primary)]" : "border-[var(--m-border)] text-[var(--m-text)]"
                }`}
              >
                <Heart className={`size-5 ${favorite ? "fill-current" : ""}`} />
              </button>
            ) : null}
          </div>

          {dish.price || dish.variants.length ? (
            <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              {dish.price ? <span className="text-2xl font-semibold text-[var(--m-primary)] tabular-nums" dir="ltr">{dish.price}</span> : null}
              {dish.variants.map((v) => (
                <span key={v.label} className="text-[15px] text-[var(--m-muted)]">
                  {v.label} <span className="font-semibold text-[var(--m-text)] tabular-nums" dir="ltr">{v.price}</span>
                </span>
              ))}
            </div>
          ) : null}

          {dish.tags.length ? (
            <ul className="mt-4 flex flex-wrap gap-2">
              {dish.tags.map((t) => (
                <li key={t.code} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--m-border)] px-3 py-1 text-[12.5px] font-medium">
                  <TagIcon code={t.code} className="size-3.5 text-[var(--m-primary)]" />
                  {t.label}
                </li>
              ))}
            </ul>
          ) : null}

          {dish.description ? <p className="mt-5 text-[15.5px] leading-relaxed text-[var(--m-text)]/85 whitespace-pre-line">{dish.description}</p> : null}

          {hasModel && dish.model?.dimensions ? (
            <p className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--m-surface)] px-3 py-2 text-[13px] text-[var(--m-muted)]">
              <Ruler className="size-4 text-[var(--m-primary)]" />
              {dish.model.scaleValidated ? s.realSize : s.approxSize} · <span dir="ltr">{dish.model.dimensions}</span>
            </p>
          ) : null}

          {view.restaurant.settings.showAllergens ? (
            <section className="mt-7">
              <h3 className="text-[12px] font-semibold tracking-[.14em] text-[var(--m-muted)] uppercase">{s.allergens}</h3>
              {dish.allergens.length ? (
                <ul className="mt-2.5 flex flex-wrap gap-1.5">
                  {dish.allergens.map((a) => (
                    <li key={a.code} className="rounded-lg bg-[var(--m-surface-2)] px-2.5 py-1 text-[13px]">
                      {a.label}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[13.5px] text-[var(--m-muted)]">{s.allergensNone}</p>
              )}
              <p className="mt-2.5 text-[12px] leading-snug text-[var(--m-muted)]">
                {view.restaurant.settings.allergenNotice || s.allergensAsk}
              </p>
            </section>
          ) : null}

          {recommendations.length ? (
            <section className="mt-8">
              <h3 className="m-display text-lg font-semibold">{s.pairsWith}</h3>
              <ul className="no-scrollbar -mx-5 mt-3 flex snap-x gap-3 overflow-x-auto px-5 pb-1">
                {recommendations.map((r) => (
                  <li key={r.id} className="w-36 shrink-0 snap-start">
                    <button type="button" onClick={() => onOpenDish(r.id)} className="w-full text-start">
                      <div className="relative aspect-square overflow-hidden rounded-2xl bg-[var(--m-surface)]">
                        {r.photo ? <DishImage image={r.photo} alt={r.name} sizes="144px" className="size-full object-cover" /> : null}
                        {r.model ? (
                          <span className="absolute start-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">
                            {s.badge3d}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 line-clamp-2 text-[13.5px] leading-tight font-medium">{r.name}</p>
                      {r.price ? <p className="mt-0.5 text-[13px] text-[var(--m-primary)] tabular-nums" dir="ltr">{r.price}</p> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </Sheet>
  );
}
