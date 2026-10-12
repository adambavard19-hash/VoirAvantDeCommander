"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Inbox, Mail, Phone, Trash2 } from "lucide-react";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { Select, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "./api";

type Lead = {
  id: string;
  type: "DEMO" | "CONTACT";
  status: "NEW" | "CONTACTED" | "WON" | "LOST";
  name: string;
  email: string;
  phone: string | null;
  restaurantName: string | null;
  city: string | null;
  message: string | null;
  notes: string | null;
  createdAt: string;
};

const STATUS = { NEW: "Nouvelle", CONTACTED: "Contacté", WON: "Client", LOST: "Sans suite" } as const;

export function LeadsTable({ leads }: { leads: Lead[] }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState<string | null>(null);

  const patch = async (id: string, body: Partial<Pick<Lead, "status" | "notes">>) => {
    try {
      await api(`/api/admin/leads/${id}`, { method: "PATCH", body });
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Supprimer définitivement cette demande et ses coordonnées ?")) return;
    try {
      await api(`/api/admin/leads/${id}`, { method: "DELETE" });
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  if (!leads.length)
    return (
      <Card>
        <EmptyState icon={<Inbox className="size-5" />} title="Aucune demande pour le moment" description="Les demandes envoyées depuis le site vitrine apparaîtront ici." />
      </Card>
    );

  return (
    <Card>
      <ul className="divide-y divide-stone-100">
        {leads.map((l) => (
          <li key={l.id} className="px-5 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => setOpen(open === l.id ? null : l.id)} className="min-w-0 flex-1 text-start">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{l.name}</span>
                  <Badge tone={l.type === "DEMO" ? "accent" : "neutral"}>{l.type === "DEMO" ? "Démo" : "Contact"}</Badge>
                  {l.status === "NEW" ? <Badge tone="warning">Nouvelle</Badge> : null}
                </span>
                <span className="block text-[13px] text-stone-500">
                  {[l.restaurantName, l.city].filter(Boolean).join(" · ") || l.email} — {new Date(l.createdAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </button>
              <Select value={l.status} onChange={(e) => patch(l.id, { status: e.target.value as Lead["status"] })} className="h-9 w-40 text-[13px]" aria-label="Statut">
                {Object.entries(STATUS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
            {open === l.id ? (
              <div className="mt-3 grid gap-4 rounded-xl bg-stone-50 p-4 md:grid-cols-2">
                <div className="space-y-2 text-[14px]">
                  <a href={`mailto:${l.email}`} className="flex items-center gap-2 hover:underline">
                    <Mail className="size-4 text-stone-400" /> {l.email}
                  </a>
                  {l.phone ? (
                    <a href={`tel:${l.phone}`} className="flex items-center gap-2 hover:underline">
                      <Phone className="size-4 text-stone-400" /> {l.phone}
                    </a>
                  ) : null}
                  {l.message ? <p className="whitespace-pre-line text-stone-700">{l.message}</p> : null}
                </div>
                <div className="space-y-2">
                  <Textarea defaultValue={l.notes ?? ""} rows={3} placeholder="Notes internes…" onBlur={(e) => e.target.value !== (l.notes ?? "") && patch(l.id, { notes: e.target.value })} />
                  <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => remove(l.id)}>
                    <Trash2 className="size-3.5" /> Supprimer (RGPD)
                  </Button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
