"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { History, PowerOff } from "lucide-react";
import { Card, CardHeader, Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "./api";
import { notifyMenuChanged } from "./events";

type Version = { id: string; number: number; publishedAt: string; note: string | null };

export function VersionHistory({ restaurantId, versions, currentId, canPublish }: { restaurantId: string; versions: Version[]; currentId: string | null; canPublish: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const restore = async (v: Version) => {
    if (!window.confirm(`Remettre en ligne la version ${v.number} ? Le brouillon n'est pas modifié.`)) return;
    setBusy(v.id);
    try {
      await api(`/api/admin/restaurants/${restaurantId}/versions/${v.id}/restore`, { body: {} });
      toast.success(`Version ${v.number} remise en ligne.`);
      notifyMenuChanged();
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const unpublish = async () => {
    if (!window.confirm("Mettre le menu hors ligne ? Le QR code affichera « Menu bientôt disponible » jusqu'à la prochaine publication.")) return;
    setBusy("off");
    try {
      await api(`/api/admin/restaurants/${restaurantId}/unpublish`, { body: {} });
      toast.success("Menu mis hors ligne.");
      notifyMenuChanged();
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader title="Versions publiées" description="Chaque publication est conservée" />
      {versions.length ? (
        <ul className="divide-y divide-stone-100">
          {versions.map((v) => (
            <li key={v.id} className="flex items-center gap-3 px-5 py-2.5 text-[13.5px]">
              <History className="size-4 shrink-0 text-stone-400" />
              <span className="font-medium">v{v.number}</span>
              <span className="truncate text-stone-500">{new Date(v.publishedAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span>
              {v.id === currentId ? (
                <Badge tone="success" className="ms-auto">En ligne</Badge>
              ) : canPublish ? (
                <Button size="sm" variant="ghost" className="ms-auto" loading={busy === v.id} onClick={() => restore(v)}>
                  Restaurer
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-6 text-[13.5px] text-stone-500">Aucune version publiée.</p>
      )}
      {canPublish && currentId ? (
        <div className="border-t border-stone-100 px-5 py-3">
          <Button size="sm" variant="ghost" onClick={unpublish} loading={busy === "off"} className="text-red-600 hover:bg-red-50">
            <PowerOff className="size-3.5" /> Mettre le menu hors ligne
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
