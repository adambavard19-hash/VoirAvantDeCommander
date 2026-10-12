"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "./api";

export function DangerZone({
  restaurantId,
  name,
  slug,
  baseUrl,
  redirects,
  archived,
}: {
  restaurantId: string;
  name: string;
  slug: string;
  baseUrl: string;
  redirects: string[];
  archived: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [newSlug, setNewSlug] = useState(slug);
  const [busy, setBusy] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");

  const saveSlug = async () => {
    setBusy("slug");
    try {
      await api(`/api/admin/restaurants/${restaurantId}/slug`, { body: { slug: newSlug } });
      toast.success("Adresse modifiée. L'ancienne adresse redirige vers la nouvelle : les QR codes imprimés fonctionnent toujours.");
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const archive = async () => {
    if (!window.confirm("Archiver ce restaurant ? Son menu sera hors ligne, ses données conservées.")) return;
    setBusy("archive");
    try {
      await api(`/api/admin/restaurants/${restaurantId}`, { method: "DELETE" });
      toast.success("Restaurant archivé.");
      router.push("/admin/restaurants");
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(null);
    }
  };

  const destroy = async () => {
    setBusy("delete");
    try {
      await api(`/api/admin/restaurants/${restaurantId}?permanent=1&confirm=${encodeURIComponent(confirmName)}`, { method: "DELETE" });
      toast.success("Restaurant supprimé définitivement.");
      router.push("/admin/restaurants");
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(null);
    }
  };

  return (
    <Card className="ring-red-200">
      <CardHeader title="Adresse du menu et zone sensible" description="Réservé à l'administrateur principal" />
      <div className="space-y-6 p-5">
        <div>
          <Field
            label="Adresse du menu (slug)"
            hint="Évitez de la changer après impression des QR codes. Si vous la changez, l'ancienne adresse reste active et redirige."
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[13px] text-stone-500">{baseUrl.replace(/^https?:\/\//, "")}/menu/</span>
              <Input value={newSlug} onChange={(e) => setNewSlug(e.target.value.toLowerCase())} className="max-w-xs font-mono" />
              <Button variant="secondary" onClick={saveSlug} loading={busy === "slug"} disabled={newSlug === slug}>
                Modifier
              </Button>
            </div>
          </Field>
          {redirects.length ? <p className="mt-2 text-[12.5px] text-stone-500">Anciennes adresses redirigées : {redirects.map((r) => `/menu/${r}`).join(", ")}</p> : null}
        </div>
        <div className="flex flex-wrap gap-3 border-t border-stone-100 pt-5">
          {!archived ? (
            <Button variant="secondary" onClick={archive} loading={busy === "archive"}>
              Archiver le restaurant
            </Button>
          ) : null}
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            Supprimer définitivement
          </Button>
        </div>
      </div>
      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Supprimer définitivement"
        description="Menu, plats, photos, modèles 3D, traductions, statistiques et QR code seront supprimés. Action irréversible."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              Annuler
            </Button>
            <Button variant="danger" onClick={destroy} loading={busy === "delete"} disabled={confirmName !== name}>
              Supprimer
            </Button>
          </>
        }
      >
        <Field label={<>Saisissez <strong>{name}</strong> pour confirmer</>}>
          <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
        </Field>
      </Dialog>
    </Card>
  );
}
