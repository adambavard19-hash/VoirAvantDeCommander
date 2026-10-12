"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Plus, ShieldCheck, Store, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Field, Input, Select, Switch } from "@/components/ui/form";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "./api";

type Membership = { restaurantId: string; role: "OWNER" | "EDITOR" };
type User = {
  id: string;
  email: string;
  name: string | null;
  role: "SUPER_ADMIN" | "MEMBER";
  isActive: boolean;
  lastLoginAt: string | null;
  memberships: Membership[];
};

type Draft = {
  id?: string;
  email: string;
  name: string;
  role: User["role"];
  isActive: boolean;
  password: string;
  memberships: Membership[];
};

export function UsersManager({ users, restaurants, meId }: { users: User[]; restaurants: { id: string; name: string }[]; meId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const restaurantName = new Map(restaurants.map((r) => [r.id, r.name]));

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      if (draft.id) {
        await api(`/api/admin/users/${draft.id}`, {
          method: "PATCH",
          body: {
            name: draft.name,
            role: draft.role,
            isActive: draft.isActive,
            memberships: draft.role === "MEMBER" ? draft.memberships : [],
            ...(draft.password ? { password: draft.password } : {}),
          },
        });
        toast.success("Compte mis à jour.");
      } else {
        const res = await api<{ temporaryPassword: string | null }>("/api/admin/users", {
          body: { email: draft.email, name: draft.name, role: draft.role, password: draft.password || undefined, memberships: draft.role === "MEMBER" ? draft.memberships : [] },
        });
        if (res.temporaryPassword) setCreated({ email: draft.email, password: res.temporaryPassword });
        else toast.success("Compte créé.");
      }
      setDraft(null);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const toggleMembership = (restaurantId: string) => {
    if (!draft) return;
    const has = draft.memberships.find((m) => m.restaurantId === restaurantId);
    setDraft({
      ...draft,
      memberships: has ? draft.memberships.filter((m) => m.restaurantId !== restaurantId) : [...draft.memberships, { restaurantId, role: "OWNER" }],
    });
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button variant="accent" onClick={() => setDraft({ email: "", name: "", role: "MEMBER", isActive: true, password: "", memberships: [] })}>
          <Plus className="size-4" /> Nouveau compte
        </Button>
      </div>
      <Card>
        <ul className="divide-y divide-stone-100">
          {users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
              <span className="grid size-10 place-items-center rounded-full bg-stone-100 text-stone-500">
                {u.role === "SUPER_ADMIN" ? <ShieldCheck className="size-5" /> : <UserRound className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {u.name || u.email}
                  {u.role === "SUPER_ADMIN" ? <Badge tone="accent">Administrateur principal</Badge> : <Badge>Restaurateur</Badge>}
                  {!u.isActive ? <Badge tone="danger">Désactivé</Badge> : null}
                  {u.id === meId ? <Badge tone="info">Vous</Badge> : null}
                </p>
                <p className="text-[13px] text-stone-500">
                  {u.email}
                  {u.lastLoginAt ? ` · dernière connexion ${new Date(u.lastLoginAt).toLocaleDateString("fr-FR")}` : " · jamais connecté"}
                </p>
                {u.role === "MEMBER" && u.memberships.length ? (
                  <p className="mt-1 flex flex-wrap gap-1.5">
                    {u.memberships.map((m) => (
                      <span key={m.restaurantId} className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[12px] text-stone-600">
                        <Store className="size-3" /> {restaurantName.get(m.restaurantId) ?? "?"} · {m.role === "OWNER" ? "propriétaire" : "éditeur"}
                      </span>
                    ))}
                  </p>
                ) : null}
              </div>
              <Button size="sm" variant="secondary" onClick={() => setDraft({ id: u.id, email: u.email, name: u.name ?? "", role: u.role, isActive: u.isActive, password: "", memberships: u.memberships })}>
                Modifier
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      <Dialog
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? "Modifier le compte" : "Nouveau compte"}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDraft(null)}>
              Annuler
            </Button>
            <Button variant="accent" onClick={save} loading={saving} disabled={!draft?.email}>
              Enregistrer
            </Button>
          </>
        }
      >
        {draft ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="E-mail">
                <Input type="email" value={draft.email} disabled={!!draft.id} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
              </Field>
              <Field label="Nom">
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </Field>
              <Field label="Type de compte">
                <Select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as User["role"] })} disabled={draft.id === meId}>
                  <option value="MEMBER">Restaurateur (accès limité)</option>
                  <option value="SUPER_ADMIN">Administrateur principal (accès complet)</option>
                </Select>
              </Field>
              <Field label={draft.id ? "Nouveau mot de passe" : "Mot de passe"} hint={draft.id ? "Laisser vide pour ne pas le changer" : "Laisser vide pour en générer un"}>
                <Input type="password" autoComplete="new-password" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} />
              </Field>
            </div>
            {draft.id && draft.id !== meId ? <Switch checked={draft.isActive} onChange={(v) => setDraft({ ...draft, isActive: v })} label="Compte actif" description="Un compte désactivé ne peut plus se connecter" /> : null}
            {draft.role === "MEMBER" ? (
              <Field label="Restaurants accessibles" hint="Propriétaire : modifie et publie. Éditeur : modifie le brouillon, sans publier.">
                <ul className="max-h-72 divide-y divide-stone-100 overflow-y-auto rounded-xl ring-1 ring-stone-200">
                  {restaurants.map((r) => {
                    const m = draft.memberships.find((x) => x.restaurantId === r.id);
                    return (
                      <li key={r.id} className="flex items-center gap-3 px-3 py-2">
                        <input type="checkbox" checked={!!m} onChange={() => toggleMembership(r.id)} className="size-4 accent-ink" aria-label={r.name} />
                        <span className="flex-1 text-[14px]">{r.name}</span>
                        {m ? (
                          <Select
                            value={m.role}
                            onChange={(e) => setDraft({ ...draft, memberships: draft.memberships.map((x) => (x.restaurantId === r.id ? { ...x, role: e.target.value as Membership["role"] } : x)) })}
                            className="h-8 w-40 text-[13px]"
                          >
                            <option value="OWNER">Propriétaire</option>
                            <option value="EDITOR">Éditeur</option>
                          </Select>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </Field>
            ) : null}
          </div>
        ) : null}
      </Dialog>

      <Dialog open={!!created} onClose={() => setCreated(null)} title="Compte créé" description="Transmettez ces identifiants de façon sécurisée. Le mot de passe ne sera plus affiché.">
        {created ? (
          <div className="space-y-2 rounded-xl bg-stone-50 p-4 font-mono text-[14px]">
            <p>Adresse : {created.email}</p>
            <p className="flex items-center gap-2">
              <KeyRound className="size-4" /> {created.password}
            </p>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
