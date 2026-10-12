"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck, Rocket, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "./api";
import type { ReadinessIssue } from "@/lib/menu/publish";

type State = {
  status: string;
  published: { number: number; publishedAt: string } | null;
  hasUnpublishedChanges: boolean;
  issues: ReadinessIssue[];
};

export function PublishButton({ restaurantId, canPublish }: { restaurantId: string; canPublish: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [state, setState] = useState<State | null>(null);
  const [open, setOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setState(await api<State>(`/api/admin/restaurants/${restaurantId}/publication`));
    } catch {
      // l'état sera rechargé à la prochaine modification
    }
  }, [restaurantId]);

  useEffect(() => {
    let cancelled = false;
    api<State>(`/api/admin/restaurants/${restaurantId}/publication`)
      .then((s) => !cancelled && setState(s))
      .catch(() => {});
    const onChange = () => refresh();
    window.addEventListener("vadc:menu-changed", onChange);
    return () => {
      cancelled = true;
      window.removeEventListener("vadc:menu-changed", onChange);
    };
  }, [refresh, restaurantId]);

  const publish = async () => {
    setPublishing(true);
    try {
      const res = await api<{ version: { number: number } }>(`/api/admin/restaurants/${restaurantId}/publish`, { body: {} });
      toast.success(`Menu publié (version ${res.version.number}). Le QR code affiche déjà cette version.`);
      setOpen(false);
      await refresh();
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPublishing(false);
    }
  };

  const blocking = state?.issues.filter((i) => i.level === "blocking") ?? [];
  const warnings = state?.issues.filter((i) => i.level === "warning") ?? [];
  const upToDate = state && state.status === "PUBLISHED" && !state.hasUnpublishedChanges;

  if (!canPublish) {
    return state?.hasUnpublishedChanges ? <span className="text-[13px] text-amber-700">Modifications en attente de publication</span> : null;
  }

  return (
    <>
      <Button variant={upToDate ? "secondary" : "accent"} onClick={() => setOpen(true)} disabled={!state}>
        {upToDate ? <CircleCheck className="size-4 text-emerald-600" /> : <Rocket className="size-4" />}
        {upToDate ? "À jour" : state?.published ? "Publier les modifications" : "Publier le menu"}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={state?.published ? "Publier les modifications" : "Publier le menu"}
        description="Les clients verront immédiatement cette version via le QR code, qui ne change jamais."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button variant="accent" onClick={publish} loading={publishing} disabled={blocking.length > 0}>
              <Rocket className="size-4" /> Publier maintenant
            </Button>
          </>
        }
      >
        {state ? (
          <div className="space-y-4 text-[14px]">
            {state.published ? (
              <p className="text-stone-600">
                Version en ligne : <strong>v{state.published.number}</strong> du {new Date(state.published.publishedAt).toLocaleString("fr-FR")}.
                {state.hasUnpublishedChanges ? " Le brouillon contient des modifications non publiées." : " Aucune modification depuis."}
              </p>
            ) : (
              <p className="text-stone-600">Ce menu n&apos;a encore jamais été publié.</p>
            )}
            {blocking.length ? (
              <ul className="space-y-1.5 rounded-xl bg-red-50 p-3 ring-1 ring-red-200">
                {blocking.map((i, k) => (
                  <li key={k} className="flex gap-2 text-red-800">
                    <CircleAlert className="mt-0.5 size-4 shrink-0" /> {i.message}
                  </li>
                ))}
              </ul>
            ) : null}
            {warnings.length ? (
              <div>
                <p className="mb-2 font-medium text-stone-800">Points à vérifier ({warnings.length}) — la publication reste possible :</p>
                <ul className="max-h-64 space-y-1.5 overflow-y-auto rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200">
                  {warnings.map((i, k) => (
                    <li key={k} className="flex gap-2 text-[13.5px] text-amber-900">
                      <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {i.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              !blocking.length && (
                <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-emerald-800 ring-1 ring-emerald-200">
                  <CircleCheck className="size-4" /> Tout est prêt.
                </p>
              )
            )}
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
