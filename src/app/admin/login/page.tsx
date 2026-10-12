import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { BrandLogo } from "@/components/brand";
import { LoginForm } from "@/components/admin/login-form";

export const metadata: Metadata = { title: "Connexion", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect(next?.startsWith("/admin") ? next : "/admin");
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-ink px-5 py-12 text-white">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,181,71,.22),transparent)]" />
      <div className="pointer-events-none absolute -bottom-40 -left-20 h-[420px] w-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(155,123,255,.18),transparent)]" />
      <div className="relative w-full max-w-sm">
        <Link href="/" className="inline-block">
          <BrandLogo />
        </Link>
        <h1 className="mt-10 font-display text-3xl font-semibold tracking-tight">Espace administration</h1>
        <p className="mt-2 text-[14.5px] text-white/60">Gérez vos restaurants, menus 3D et QR codes.</p>
        <LoginForm next={next?.startsWith("/admin") ? next : "/admin"} />
      </div>
    </main>
  );
}
