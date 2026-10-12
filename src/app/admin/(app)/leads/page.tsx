import { db } from "@/lib/db";
import { requireSuperAdminPage } from "@/lib/auth/guards";
import { PageHeader } from "@/components/ui/card";
import { LeadsTable } from "@/components/admin/leads-table";

export const metadata = { title: "Demandes" };

export default async function LeadsPage() {
  await requireSuperAdminPage();
  const leads = await db.lead.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return (
    <>
      <PageHeader title="Demandes" description="Demandes de démonstration et messages reçus depuis le site." />
      <LeadsTable
        leads={leads.map((l) => ({
          id: l.id,
          type: l.type,
          status: l.status,
          name: l.name,
          email: l.email,
          phone: l.phone,
          restaurantName: l.restaurantName,
          city: l.city,
          message: l.message,
          notes: l.notes,
          createdAt: l.createdAt.toISOString(),
        }))}
      />
    </>
  );
}
