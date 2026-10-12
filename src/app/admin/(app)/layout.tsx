import type { Metadata } from "next";
import { requireUserPage, isSuperAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { ToastProvider } from "@/components/ui/toast";
import { AdminShell } from "@/components/admin/admin-shell";

export const metadata: Metadata = { title: "Administration", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUserPage();
  const newLeads = isSuperAdmin(user) ? await db.lead.count({ where: { status: "NEW" } }) : 0;
  return (
    <ToastProvider>
      <AdminShell user={{ email: user.email, name: user.name, superAdmin: isSuperAdmin(user) }} newLeads={newLeads}>
        {children}
      </AdminShell>
    </ToastProvider>
  );
}
