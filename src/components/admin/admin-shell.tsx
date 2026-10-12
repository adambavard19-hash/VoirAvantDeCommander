"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Inbox, LayoutDashboard, LogOut, Menu, Store, Users, X } from "lucide-react";
import { BrandLogo } from "@/components/brand";
import { cn } from "@/components/ui/cn";
import { api } from "./api";

type Props = {
  user: { email: string; name: string | null; superAdmin: boolean };
  newLeads: number;
  children: React.ReactNode;
};

export function AdminShell({ user, newLeads, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const nav = [
    { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
    { href: "/admin/restaurants", label: "Restaurants", icon: Store },
    ...(user.superAdmin
      ? [
          { href: "/admin/leads", label: "Demandes", icon: Inbox, badge: newLeads },
          { href: "/admin/users", label: "Utilisateurs", icon: Users },
        ]
      : []),
  ];

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/admin/login");
    router.refresh();
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link href="/admin" className="px-5 pt-6 pb-8" onClick={() => setOpen(false)}>
        <BrandLogo />
      </Link>
      <nav className="flex-1 space-y-1 px-3">
        {nav.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition",
                active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white",
              )}
            >
              <item.icon className="size-4.5" />
              <span className="flex-1">{item.label}</span>
              {"badge" in item && item.badge ? (
                <span className="rounded-full bg-saffron px-1.5 text-[11px] font-bold text-ink">{item.badge}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="px-3 py-2">
          <p className="truncate text-[13px] font-medium text-white">{user.name ?? "Administrateur"}</p>
          <p className="truncate text-[12px] text-white/50">{user.email}</p>
        </div>
        <button type="button" onClick={logout} className="flex h-9 w-full items-center gap-3 rounded-xl px-3 text-[13.5px] text-white/60 transition hover:bg-white/5 hover:text-white">
          <LogOut className="size-4" /> Se déconnecter
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-stone-50 font-sans text-stone-900">
      <aside className="fixed inset-y-0 left-0 hidden w-64 bg-ink lg:block">{sidebar}</aside>
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between bg-ink px-4 lg:hidden">
        <Link href="/admin">
          <BrandLogo />
        </Link>
        <button type="button" onClick={() => setOpen(true)} aria-label="Ouvrir le menu" className="grid size-10 place-items-center rounded-lg text-white">
          <Menu className="size-5" />
        </button>
      </div>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-ink shadow-2xl">
            <button type="button" onClick={() => setOpen(false)} aria-label="Fermer le menu" className="absolute top-5 right-3 grid size-9 place-items-center rounded-lg text-white/70">
              <X className="size-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      ) : null}
      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</div>
      </main>
    </div>
  );
}
