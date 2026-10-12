import { db } from "@/lib/db";
import { requireRestaurantAccessPage } from "@/lib/auth/guards";
import { ensureQrCode } from "@/lib/menu/publish";
import { parseQrStyle } from "@/lib/qr/qr";
import { PRINT_TEMPLATES } from "@/lib/qr/print";
import { parseTheme } from "@/lib/theme";
import { QrManager } from "@/components/admin/qr-manager";

export const metadata = { title: "QR code" };

export default async function QrPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRestaurantAccessPage(id, "VIEW");
  const restaurant = await db.restaurant.findUniqueOrThrow({ where: { id }, select: { slug: true, name: true, status: true, email: true, phone: true, theme: true } });
  const qr = await ensureQrCode(id, restaurant.slug);
  return (
    <QrManager
      restaurantId={id}
      restaurantName={restaurant.name}
      restaurantEmail={restaurant.email}
      published={restaurant.status === "PUBLISHED"}
      targetUrl={qr.targetUrl}
      currentSlugUrl={qr.targetUrl.endsWith(`/menu/${restaurant.slug}`) ? null : restaurant.slug}
      downloads={qr.downloads}
      style={parseQrStyle(qr.style)}
      defaultAccent={parseTheme(restaurant.theme).primary}
      templates={Object.entries(PRINT_TEMPLATES).map(([key, t]) => ({ key, label: t.label, description: t.description }))}
    />
  );
}
