import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireSuperAdminPage } from "@/lib/auth/guards";
import { PageHeader } from "@/components/ui/card";
import { RestaurantForm } from "@/components/admin/restaurant-form";
import { emptyRestaurantValues } from "@/lib/restaurant-form-values";

export const metadata = { title: "Créer un restaurant" };

export default async function NewRestaurantPage() {
  await requireSuperAdminPage();
  return (
    <>
      <Link href="/admin/restaurants" className="mb-3 inline-flex items-center gap-1 text-[13px] text-stone-500 hover:text-stone-900">
        <ChevronLeft className="size-4" /> Restaurants
      </Link>
      <PageHeader
        title="Créer un restaurant"
        description="Un espace indépendant est créé automatiquement : menu, fichiers, paramètres, adresse stable et QR code."
      />
      <RestaurantForm mode="create" initial={emptyRestaurantValues()} />
    </>
  );
}
