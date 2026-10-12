"use client";

import { useState } from "react";
import { CircleCheck, LoaderCircle, Send } from "lucide-react";
import { cn } from "@/components/ui/cn";

type Mode = "DEMO" | "CONTACT";

const input =
  "h-12 w-full rounded-2xl bg-white/[.05] px-4 text-[15px] text-white ring-1 ring-white/12 outline-none transition placeholder:text-white/35 focus:bg-white/[.08] focus:ring-2 focus:ring-saffron";

export function LeadForm({ initialMode = "DEMO" }: { initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    setStatus("sending");
    try {
      const res = await fetch("/api/public/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, type: mode, consent: data.consent === "on" }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; details?: { message: string }[] };
      if (!res.ok) throw new Error(body.details?.[0]?.message ?? body.error ?? "Envoi impossible. Réessayez.");
      setStatus("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi impossible.");
      setStatus("idle");
    }
  };

  if (status === "sent") {
    return (
      <div className="flex flex-col items-center rounded-[28px] border border-white/10 bg-white/[.04] px-6 py-14 text-center">
        <CircleCheck className="size-12 text-[#7cf5e1]" />
        <h3 className="mt-5 font-display text-2xl font-semibold text-white">{mode === "DEMO" ? "Demande envoyée" : "Message envoyé"}</h3>
        <p className="mt-2 max-w-sm text-white/60">Merci ! Nous revenons vers vous très rapidement.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-[28px] border border-white/10 bg-white/[.04] p-6 backdrop-blur sm:p-8">
      <div className="mb-6 inline-flex rounded-full bg-white/5 p-1 text-[13.5px]" role="tablist">
        {(
          [
            ["DEMO", "Demande de démonstration"],
            ["CONTACT", "Autre question"],
          ] as const
        ).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={mode === key} onClick={() => setMode(key)} className={cn("rounded-full px-4 py-2 font-medium transition", mode === key ? "bg-white text-ink" : "text-white/70")}>
            {label}
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-[13px] text-white/70">Nom et prénom *</span>
          <input name="name" required maxLength={120} autoComplete="name" className={input} />
        </label>
        <label className="space-y-1.5">
          <span className="text-[13px] text-white/70">E-mail *</span>
          <input name="email" type="email" required maxLength={200} autoComplete="email" className={input} />
        </label>
        <label className="space-y-1.5">
          <span className="text-[13px] text-white/70">Téléphone</span>
          <input name="phone" type="tel" maxLength={40} autoComplete="tel" className={input} />
        </label>
        <label className="space-y-1.5">
          <span className="text-[13px] text-white/70">Restaurant {mode === "DEMO" ? "*" : ""}</span>
          <input name="restaurantName" required={mode === "DEMO"} maxLength={160} autoComplete="organization" className={input} />
        </label>
        {mode === "DEMO" ? (
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-[13px] text-white/70">Ville</span>
            <input name="city" maxLength={120} autoComplete="address-level2" className={input} />
          </label>
        ) : null}
        <label className="space-y-1.5 sm:col-span-2">
          <span className="text-[13px] text-white/70">{mode === "DEMO" ? "Votre projet (facultatif)" : "Votre message *"}</span>
          <textarea name="message" required={mode === "CONTACT"} maxLength={3000} rows={4} className={cn(input, "h-auto py-3")} placeholder={mode === "DEMO" ? "Nombre de plats, type de cuisine, échéance…" : ""} />
        </label>
        {/* Champ invisible anti-robots */}
        <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
        <label className="flex items-start gap-3 text-[13px] leading-snug text-white/60 sm:col-span-2">
          <input type="checkbox" name="consent" required className="mt-0.5 size-4 rounded accent-saffron" />
          <span>
            J&apos;accepte que mes informations soient utilisées pour me recontacter au sujet de VoirAvantDeCommander. Elles ne sont ni cédées ni utilisées à
            d&apos;autres fins. <a href="/confidentialite" className="underline hover:text-white">En savoir plus</a>
          </span>
        </label>
      </div>
      {error ? <p role="alert" className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-[14px] text-red-300 ring-1 ring-red-500/30">{error}</p> : null}
      <button type="submit" disabled={status === "sending"} className="mt-6 inline-flex h-13 w-full items-center justify-center gap-2 rounded-full bg-saffron px-8 text-[15px] font-semibold text-ink shadow-[0_10px_40px_-10px_rgba(255,181,71,.7)] transition hover:brightness-105 disabled:opacity-60 sm:w-auto">
        {status === "sending" ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
        {mode === "DEMO" ? "Demander ma démonstration" : "Envoyer le message"}
      </button>
    </form>
  );
}
