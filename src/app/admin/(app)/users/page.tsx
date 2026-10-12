import { db } from "@/lib/db";
import { requireSuperAdminPage } from "@/lib/auth/guards";
import { PageHeader } from "@/components/ui/card";
import { UsersManager } from "@/components/admin/users-manager";

export const metadata = { title: "Utilisateurs" };

export default async function UsersPage() {
  const me = await requireSuperAdminPage();
  const [users, restaurants] = await Promise.all([
    db.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, name: true, role: true, isActive: true, lastLoginAt: true, memberships: { select: { restaurantId: true, role: true } } },
    }),
    db.restaurant.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <>
      <PageHeader
        title="Utilisateurs"
        description="Administrateurs principaux (accès complet) et restaurateurs (accès limité à leurs restaurants)."
      />
      <UsersManager
        meId={me.id}
        restaurants={restaurants}
        users={users.map((u) => ({ ...u, lastLoginAt: u.lastLoginAt?.toISOString() ?? null }))}
      />
    </>
  );
}
