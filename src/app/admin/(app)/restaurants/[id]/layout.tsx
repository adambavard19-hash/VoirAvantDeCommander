import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink, Eye } from "lucide-react";
import { db } from "@/lib/db";
import { checkRestaurantAccess, requireRestaurantAccessPage } from "@/lib/auth/guards";
import { appUrl } from "@/lib/env";
import { StatusBadge } from "@/components/admin/status-badge";
import { RestaurantTabs } from "@/components/admin/restaurant-tabs";
import { PublishButton } from "@/components/admin/publish-button";
import { buttonClasses } from "@/components/ui/button";

export default async function RestaurantLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireRestaurantAccessPage(id, "VIEW");
  const restaurant = await db.restaurant.findUnique({ where: { id }, select: { id: true, name: true, slug: true, status: true } });
  if (!restaurant) notFound();
  const canPublish = await checkRestaurantAccess(user, id, "PUBLISH");
  const menuUrl = `${appUrl()}/menu/${restaurant.slug}`;

  return (
    <>
      <Link href="/admin/restaurants" className="mb-3 inline-flex items-center gap-1 text-[13px] text-stone-500 hover:text-stone-900">
        <ChevronLeft className="size-4" /> Restaurants
      </Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{restaurant.name}</h1>
            <StatusBadge status={restaurant.status} />
          </div>
          <a href={`/menu/${restaurant.slug}`} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 font-mono text-[12.5px] text-stone-500 hover:text-stone-900">
            {menuUrl.replace(/^https?:\/\//, "")} <ExternalLink className="size-3" />
          </a>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href={`/menu/${restaurant.slug}?preview=1`} target="_blank" rel="noopener noreferrer" className={buttonClasses("secondary")}>
            <Eye className="size-4" /> Prévisualiser
          </a>
          <PublishButton restaurantId={restaurant.id} canPublish={canPublish} />
        </div>
      </div>
      <RestaurantTabs restaurantId={restaurant.id} />
      <div className="mt-6">{children}</div>
    </>
  );
}
