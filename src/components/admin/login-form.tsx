"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { api, errorMessage } from "./api";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api("/api/auth/login", { body: { email, password } });
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  };

  const input =
    "h-12 w-full rounded-xl bg-white/[.06] px-4 text-[15px] text-white ring-1 ring-white/12 outline-none transition placeholder:text-white/35 focus:ring-2 focus:ring-saffron";
  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-[13px] font-medium text-white/75">
          E-mail
        </label>
        <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="password" className="text-[13px] font-medium text-white/75">
          Mot de passe
        </label>
        <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
      </div>
      {error ? (
        <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-[13.5px] text-red-300 ring-1 ring-red-500/30">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={loading}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-saffron text-[15px] font-semibold text-ink transition hover:brightness-105 disabled:opacity-60"
      >
        {loading ? <LoaderCircle className="size-4 animate-spin" /> : null}
        Se connecter
      </button>
    </form>
  );
}
