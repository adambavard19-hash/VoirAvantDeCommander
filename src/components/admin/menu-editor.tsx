"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Box, Copy, Eye, EyeOff, GripVertical, ImageOff, Pencil, Plus, Star, Trash2, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/form";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/components/ui/cn";
import { CategoryIcon } from "@/components/menu/icons";
import { CATEGORY_ICONS, CATEGORY_PRESETS } from "@/lib/categories";
import { centsToInput, formatPrice, parsePrice } from "@/lib/money";
import { api, errorMessage } from "./api";
import { notifyMenuChanged } from "./events";
import { DishEditor } from "./dish-editor";
import type { EditorCategory, EditorDish } from "./menu-types";

type Props = {
  restaurantId: string;
  currency: string;
  locale: string;
  initialCategories: EditorCategory[];
  initialDishes: EditorDish[];
};

function ModelStatus({ dish }: { dish: EditorDish }) {
  if (!dish.glb && !dish.usdz) return null;
  const complete = dish.glb && dish.usdz;
  return (
    <Badge tone={complete ? (dish.scaleStatus === "VALIDATED" ? "success" : "info") : "warning"}>
      <Box className="size-3" />
      {complete ? "3D" : dish.glb ? "GLB seul" : "USDZ seul"}
      {complete && dish.scaleStatus !== "VALIDATED" ? " · échelle ?" : ""}
    </Badge>
  );
}

function PriceInput({ dish, currency, locale, onSave }: { dish: EditorDish; currency: string; locale: string; onSave: (cents: number | null) => void }) {
  const [value, setValue] = useState(centsToInput(dish.priceCents));
  const [prevCents, setPrevCents] = useState(dish.priceCents);
  if (dish.priceCents !== prevCents) {
    setPrevCents(dish.priceCents);
    setValue(centsToInput(dish.priceCents));
  }
  if (dish.priceVariants.length && dish.priceCents === null) {
    return <span className="text-[13px] text-stone-500">{dish.priceVariants.map((v) => formatPrice(v.priceCents, currency, locale)).join(" / ")}</span>;
  }
  const commit = () => {
    const cents = value.trim() ? parsePrice(value) : null;
    if (value.trim() && cents === null) {
      setValue(centsToInput(dish.priceCents));
      return;
    }
    if (cents !== dish.priceCents) onSave(cents);
  };
  return (
    <label className="flex h-9 w-28 items-center rounded-lg bg-white ring-1 ring-stone-200 focus-within:ring-2 focus-within:ring-saffron">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        inputMode="decimal"
        aria-label={`Prix de ${dish.name}`}
        placeholder="—"
        className="h-full w-full min-w-0 bg-transparent ps-2.5 text-end text-[14px] tabular-nums outline-none"
      />
      <span className="pe-2.5 ps-1 text-[13px] text-stone-400">{currency === "EUR" ? "€" : currency}</span>
    </label>
  );
}

function SortableDishRow({
  dish,
  currency,
  locale,
  categories,
  onEdit,
  onPatch,
  onAvailability,
  onDuplicate,
  onDelete,
  onMove,
}: {
  dish: EditorDish;
  currency: string;
  locale: string;
  categories: EditorCategory[];
  onEdit: () => void;
  onPatch: (patch: Partial<EditorDish>) => void;
  onAvailability: (v: boolean) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (categoryId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: dish.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("flex flex-wrap items-center gap-3 bg-white px-3 py-2.5 sm:flex-nowrap", isDragging && "relative z-10 shadow-lg ring-1 ring-stone-200", !dish.isVisible && "bg-stone-50")}
    >
      <button type="button" className="grid size-8 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-stone-400 hover:bg-stone-100 active:cursor-grabbing" aria-label={`Déplacer ${dish.name}`} {...attributes} {...listeners}>
        <GripVertical className="size-4" />
      </button>
      <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 items-center gap-3 text-start">
        <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-stone-100 ring-1 ring-stone-200">
          {dish.photo?.thumbUrl ? <img src={dish.photo.thumbUrl} alt="" className="size-full object-cover" /> : <ImageOff className="size-4 text-stone-400" />}
        </span>
        <span className="min-w-0">
          <span className={cn("flex items-center gap-1.5 truncate text-[14.5px] font-medium", !dish.isVisible && "text-stone-400 line-through")}>
            {dish.isFeatured ? <Star className="size-3.5 shrink-0 fill-saffron text-saffron" /> : null}
            <span className="truncate">{dish.name}</span>
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <ModelStatus dish={dish} />
            {!dish.photo ? <Badge tone="warning">Sans photo</Badge> : null}
            {!dish.isVisible ? <Badge>Masqué</Badge> : null}
            {dish.allergens.length ? <span className="text-[11.5px] text-stone-400">{dish.allergens.length} allergène(s)</span> : null}
          </span>
        </span>
      </button>
      <div className="ms-11 flex items-center gap-2 sm:ms-0">
        <PriceInput dish={dish} currency={currency} locale={locale} onSave={(priceCents) => onPatch({ priceCents })} />
        <div className="flex w-[118px] items-center" title="Disponibilité (appliquée immédiatement au menu en ligne)">
          <Switch checked={dish.isAvailable} onChange={onAvailability} label={<span className="text-[12.5px] font-normal text-stone-600">{dish.isAvailable ? "Disponible" : "Épuisé"}</span>} />
        </div>
        <button type="button" onClick={() => onPatch({ isVisible: !dish.isVisible })} aria-label={dish.isVisible ? "Masquer du menu" : "Afficher dans le menu"} title={dish.isVisible ? "Masquer du menu" : "Afficher dans le menu"} className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100">
          {dish.isVisible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
        </button>
        <button type="button" onClick={onEdit} aria-label="Modifier" className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100">
          <Pencil className="size-4" />
        </button>
        <details className="relative">
          <summary className="grid size-8 cursor-pointer list-none place-items-center rounded-lg text-stone-500 hover:bg-stone-100" aria-label="Plus d'actions">
            ⋯
          </summary>
          <div className="absolute end-0 z-20 mt-1 w-56 rounded-xl bg-white p-1.5 text-[13.5px] shadow-xl ring-1 ring-stone-200">
            <button type="button" onClick={onDuplicate} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-stone-100">
              <Copy className="size-4" /> Dupliquer
            </button>
            <label className="block px-2.5 pt-2 pb-1 text-[12px] text-stone-500">Déplacer vers</label>
            <Select
              value={dish.categoryId}
              onChange={(e) => onMove(e.target.value)}
              className="h-9 text-[13px]"
              aria-label="Déplacer vers une autre catégorie"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <button type="button" onClick={onDelete} className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-red-600 hover:bg-red-50">
              <Trash2 className="size-4" /> Supprimer
            </button>
          </div>
        </details>
      </div>
    </li>
  );
}

function SortableCategoryItem({ category, count, onClick }: { category: EditorCategory; count: number; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("flex items-center gap-1 rounded-xl bg-white", isDragging && "relative z-10 shadow-lg ring-1 ring-stone-200")}>
      <button type="button" className="grid size-8 shrink-0 cursor-grab touch-none place-items-center text-stone-400" aria-label={`Déplacer la catégorie ${category.name}`} {...attributes} {...listeners}>
        <GripVertical className="size-4" />
      </button>
      <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-center gap-2 py-2 pe-3 text-start text-[13.5px]">
        <CategoryIcon name={category.icon} className="size-4 shrink-0 text-stone-500" />
        <span className={cn("truncate", !category.isVisible && "text-stone-400 line-through")}>{category.name}</span>
        <span className="ms-auto text-[12px] text-stone-400 tabular-nums">{count}</span>
      </button>
    </li>
  );
}

type CategoryDraft = { id?: string; name: string; description: string; icon: string; isVisible: boolean };

export function MenuEditor({ restaurantId, currency, locale, initialCategories, initialDishes }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [categories, setCategories] = useState(initialCategories);
  const [dishes, setDishes] = useState(() => new Map(initialDishes.map((d) => [d.id, d])));
  const [editing, setEditing] = useState<{ dish: EditorDish | null; categoryId: string } | null>(null);
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft | null>(null);
  const [deleteCategory, setDeleteCategory] = useState<EditorCategory | null>(null);
  const [moveTo, setMoveTo] = useState("");
  const [busy, setBusy] = useState(false);

  // Données rechargées par le serveur (router.refresh) : elles remplacent l'état local.
  const [prevInitial, setPrevInitial] = useState({ initialCategories, initialDishes });
  if (prevInitial.initialCategories !== initialCategories || prevInitial.initialDishes !== initialDishes) {
    setPrevInitial({ initialCategories, initialDishes });
    setCategories(initialCategories);
    setDishes(new Map(initialDishes.map((d) => [d.id, d])));
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const allDishes = useMemo(() => [...dishes.values()], [dishes]);

  const refresh = () => {
    notifyMenuChanged();
    router.refresh();
  };

  const saveOrder = async (next: EditorCategory[]) => {
    setCategories(next);
    try {
      await api(`/api/admin/restaurants/${restaurantId}/menu/reorder`, {
        body: { categories: next.map((c) => ({ id: c.id, dishIds: c.dishIds })) },
      });
      notifyMenuChanged();
    } catch (error) {
      toast.error(errorMessage(error));
      router.refresh();
    }
  };

  const onCategoryDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = categories.findIndex((c) => c.id === active.id);
    const to = categories.findIndex((c) => c.id === over.id);
    saveOrder(arrayMove(categories, from, to));
  };

  const onDishDragEnd = (categoryId: string) => ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    saveOrder(
      categories.map((c) => {
        if (c.id !== categoryId) return c;
        const from = c.dishIds.indexOf(String(active.id));
        const to = c.dishIds.indexOf(String(over.id));
        return { ...c, dishIds: arrayMove(c.dishIds, from, to) };
      }),
    );
  };

  const patchDish = async (dish: EditorDish, patch: Partial<EditorDish>) => {
    setDishes((m) => new Map(m).set(dish.id, { ...dish, ...patch }));
    try {
      await api(`/api/admin/restaurants/${restaurantId}/dishes/${dish.id}`, { method: "PATCH", body: patch });
      notifyMenuChanged();
    } catch (error) {
      setDishes((m) => new Map(m).set(dish.id, dish));
      toast.error(errorMessage(error));
    }
  };

  const setAvailability = async (dish: EditorDish, available: boolean) => {
    setDishes((m) => new Map(m).set(dish.id, { ...dish, isAvailable: available }));
    try {
      await api(`/api/admin/restaurants/${restaurantId}/dishes/${dish.id}/availability`, { body: { available } });
      toast.success(available ? `« ${dish.name} » de nouveau disponible.` : `« ${dish.name} » indiqué comme épuisé sur le menu en ligne.`);
      notifyMenuChanged();
    } catch (error) {
      setDishes((m) => new Map(m).set(dish.id, dish));
      toast.error(errorMessage(error));
    }
  };

  const moveDish = async (dish: EditorDish, categoryId: string) => {
    if (categoryId === dish.categoryId) return;
    try {
      await api(`/api/admin/restaurants/${restaurantId}/dishes/${dish.id}`, { method: "PATCH", body: { categoryId } });
      toast.success(`« ${dish.name} » déplacé.`);
      refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const duplicateDish = async (dish: EditorDish) => {
    try {
      await api(`/api/admin/restaurants/${restaurantId}/dishes/${dish.id}/duplicate`, { body: {} });
      toast.success("Plat dupliqué (masqué tant que vous ne l'affichez pas).");
      refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const deleteDish = async (dish: EditorDish) => {
    if (!window.confirm(`Supprimer « ${dish.name} » du brouillon ? Pour le retirer temporairement, utilisez plutôt « Masquer ».`)) return;
    try {
      await api(`/api/admin/restaurants/${restaurantId}/dishes/${dish.id}`, { method: "DELETE" });
      toast.success("Plat supprimé du brouillon.");
      refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const saveCategory = async () => {
    if (!categoryDraft) return;
    setBusy(true);
    try {
      const body = { name: categoryDraft.name, description: categoryDraft.description || null, icon: categoryDraft.icon, isVisible: categoryDraft.isVisible };
      if (categoryDraft.id) await api(`/api/admin/restaurants/${restaurantId}/categories/${categoryDraft.id}`, { method: "PATCH", body });
      else await api(`/api/admin/restaurants/${restaurantId}/categories`, { body });
      setCategoryDraft(null);
      refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const confirmDeleteCategory = async (mode: "move" | "delete" | "empty") => {
    if (!deleteCategory) return;
    setBusy(true);
    try {
      const qs = mode === "move" ? `?moveTo=${moveTo}` : mode === "delete" ? "?withDishes=1" : "";
      await api(`/api/admin/restaurants/${restaurantId}/categories/${deleteCategory.id}${qs}`, { method: "DELETE" });
      toast.success("Catégorie supprimée.");
      setDeleteCategory(null);
      refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const existingNames = new Set(categories.map((c) => c.name.toLowerCase()));
  const suggestions = CATEGORY_PRESETS.filter((p) => !existingNames.has(p.name.toLowerCase())).slice(0, 10);

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <Card className="p-2">
          <p className="px-2 pt-1.5 pb-2 text-[12px] font-semibold tracking-wide text-stone-500 uppercase">Catégories</p>
          <DndContext id="dnd-categories" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onCategoryDragEnd}>
            <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-0.5">
                {categories.map((c) => (
                  <SortableCategoryItem
                    key={c.id}
                    category={c}
                    count={c.dishIds.length}
                    onClick={() => document.getElementById(`edit-cat-${c.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 w-full justify-start"
            onClick={() => setCategoryDraft({ name: "", description: "", icon: "utensils", isVisible: true })}
          >
            <Plus className="size-4" /> Nouvelle catégorie
          </Button>
        </Card>
        <p className="mt-3 px-2 text-[12px] leading-relaxed text-stone-500">
          Glissez-déposez pour réordonner. Les changements restent en brouillon jusqu&apos;à la publication, sauf la disponibilité, appliquée immédiatement.
        </p>
      </aside>

      <div className="space-y-6">
        {categories.length === 0 ? (
          <Card>
            <EmptyState
              icon={<UtensilsCrossed className="size-5" />}
              title="Aucune catégorie"
              description="Créez vos catégories, ou importez directement un menu PDF, Excel ou CSV : les catégories seront créées automatiquement."
              action={
                <Button variant="accent" onClick={() => setCategoryDraft({ name: "", description: "", icon: "utensils", isVisible: true })}>
                  <Plus className="size-4" /> Nouvelle catégorie
                </Button>
              }
            />
          </Card>
        ) : null}

        {categories.map((c) => {
          const list = c.dishIds.map((id) => dishes.get(id)).filter((d): d is EditorDish => !!d);
          return (
            <Card key={c.id} id={`edit-cat-${c.id}`} className="scroll-mt-6 overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 border-b border-stone-100 px-4 py-3">
                <span className="grid size-9 place-items-center rounded-xl bg-stone-100 text-stone-600">
                  <CategoryIcon name={c.icon} className="size-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className={cn("truncate text-[16px] font-semibold", !c.isVisible && "text-stone-400 line-through")}>{c.name}</h2>
                  {c.description ? <p className="truncate text-[12.5px] text-stone-500">{c.description}</p> : null}
                </div>
                {!c.isVisible ? <Badge>Masquée</Badge> : null}
                <Button size="sm" variant="ghost" onClick={() => setCategoryDraft({ id: c.id, name: c.name, description: c.description ?? "", icon: c.icon ?? "utensils", isVisible: c.isVisible })}>
                  <Pencil className="size-3.5" /> Modifier
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setDeleteCategory(c); setMoveTo(categories.find((x) => x.id !== c.id)?.id ?? ""); }} aria-label={`Supprimer ${c.name}`}>
                  <Trash2 className="size-3.5" />
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setEditing({ dish: null, categoryId: c.id })}>
                  <Plus className="size-3.5" /> Plat
                </Button>
              </div>
              {list.length ? (
                <DndContext id={`dnd-dishes-${c.id}`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDishDragEnd(c.id)}>
                  <SortableContext items={c.dishIds} strategy={verticalListSortingStrategy}>
                    <ul className="divide-y divide-stone-100">
                      {list.map((d) => (
                        <SortableDishRow
                          key={d.id}
                          dish={d}
                          currency={currency}
                          locale={locale}
                          categories={categories}
                          onEdit={() => setEditing({ dish: d, categoryId: c.id })}
                          onPatch={(patch) => patchDish(d, patch)}
                          onAvailability={(v) => setAvailability(d, v)}
                          onDuplicate={() => duplicateDish(d)}
                          onDelete={() => deleteDish(d)}
                          onMove={(categoryId) => moveDish(d, categoryId)}
                        />
                      ))}
                    </ul>
                  </SortableContext>
                </DndContext>
              ) : (
                <p className="px-5 py-6 text-[13.5px] text-stone-500">Aucun plat dans cette catégorie.</p>
              )}
            </Card>
          );
        })}
      </div>

      {editing ? (
        <DishEditor
          restaurantId={restaurantId}
          currency={currency}
          dish={editing.dish}
          defaultCategoryId={editing.categoryId}
          categories={categories}
          allDishes={allDishes}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      ) : null}

      <Dialog
        open={!!categoryDraft}
        onClose={() => setCategoryDraft(null)}
        title={categoryDraft?.id ? "Modifier la catégorie" : "Nouvelle catégorie"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCategoryDraft(null)}>
              Annuler
            </Button>
            <Button variant="accent" onClick={saveCategory} loading={busy} disabled={!categoryDraft?.name.trim()}>
              Enregistrer
            </Button>
          </>
        }
      >
        {categoryDraft ? (
          <div className="space-y-4">
            {!categoryDraft.id && suggestions.length ? (
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((p) => (
                  <button key={p.key} type="button" onClick={() => setCategoryDraft({ ...categoryDraft, name: p.name, icon: p.icon })} className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1.5 text-[12.5px] hover:bg-stone-200">
                    <CategoryIcon name={p.icon} className="size-3.5" /> {p.name}
                  </button>
                ))}
              </div>
            ) : null}
            <Field label="Nom">
              <Input value={categoryDraft.name} maxLength={80} onChange={(e) => setCategoryDraft({ ...categoryDraft, name: e.target.value })} />
            </Field>
            <Field label="Description (facultatif)">
              <Textarea rows={2} value={categoryDraft.description} maxLength={400} onChange={(e) => setCategoryDraft({ ...categoryDraft, description: e.target.value })} />
            </Field>
            <Field label="Icône">
              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    aria-label={icon}
                    aria-pressed={categoryDraft.icon === icon}
                    onClick={() => setCategoryDraft({ ...categoryDraft, icon })}
                    className={cn("grid size-9 place-items-center rounded-lg ring-1", categoryDraft.icon === icon ? "bg-ink text-white ring-ink" : "ring-stone-200 hover:bg-stone-100")}
                  >
                    <CategoryIcon name={icon} className="size-4" />
                  </button>
                ))}
              </div>
            </Field>
            <Switch checked={categoryDraft.isVisible} onChange={(v) => setCategoryDraft({ ...categoryDraft, isVisible: v })} label="Visible dans le menu" />
          </div>
        ) : null}
      </Dialog>

      <Dialog open={!!deleteCategory} onClose={() => setDeleteCategory(null)} title={`Supprimer « ${deleteCategory?.name ?? ""} »`}>
        {deleteCategory ? (
          deleteCategory.dishIds.length ? (
            <div className="space-y-4 text-[14px]">
              <p>Cette catégorie contient {deleteCategory.dishIds.length} plat(s). Que voulez-vous en faire ?</p>
              {categories.length > 1 ? (
                <div className="flex flex-wrap items-end gap-2">
                  <Field label="Déplacer les plats vers" className="flex-1">
                    <Select value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                      {categories.filter((x) => x.id !== deleteCategory.id).map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Button onClick={() => confirmDeleteCategory("move")} loading={busy} disabled={!moveTo}>
                    Déplacer et supprimer
                  </Button>
                </div>
              ) : null}
              <div className="border-t border-stone-100 pt-4">
                <Button variant="danger" onClick={() => confirmDeleteCategory("delete")} loading={busy}>
                  Supprimer la catégorie et ses plats
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDeleteCategory(null)}>
                Annuler
              </Button>
              <Button variant="danger" onClick={() => confirmDeleteCategory("empty")} loading={busy}>
                Supprimer
              </Button>
            </div>
          )
        ) : null}
      </Dialog>
    </div>
  );
}
