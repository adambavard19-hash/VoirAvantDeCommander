"use client";

import { useState } from "react";
import { CircleCheck, LoaderCircle, Send } from "lucide-react";
import { cn } from "@/components/ui/cn";

type Mode = "DEMO" | "CONTACT";

const input =
  "h-12 w-full border-b border-ivory/20 bg-transparent px-0 text-[15.5px] text-ivory outline-none transition-colors placeholder:text-ivory/30 focus:border-ivory";

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
      <div className="flex flex-col items-center border-y border-white/[.08] px-6 py-16 text-center">
        <CircleCheck className="size-10 text-ivory" strokeWidth={1.2} />
        <h3 className="mt-6 font-serif text-[34px] text-ivory">{mode === "DEMO" ? "Demande envoyée" : "Message envoyé"}</h3>
        <p className="mt-3 max-w-sm text-ivory/55">Merci ! Nous revenons vers vous très rapidement.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <div className="mb-10 inline-flex gap-7 text-[13.5px]" role="tablist">
        {(
          [
            ["DEMO", "Demande de démonstration"],
            ["CONTACT", "Autre question"],
          ] as const
        ).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={mode === key} onClick={() => setMode(key)} className={cn("border-b pb-1.5 tracking-wide transition-colors", mode === key ? "border-ivory text-ivory" : "border-transparent text-ivory/45 hover:text-ivory/75")}>
            {label}
          </button>
        ))}
      </div>
      <div className="grid gap-x-8 gap-y-7 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-[12px] tracking-[.18em] text-ivory/45 uppercase">Nom et prénom *</span>
          <input name="name" required maxLength={120} autoComplete="name" className={input} />
        </label>
        <label className="space-y-1.5">
          <span className="text-[12px] tracking-[.18em] text-ivory/45 uppercase">E-mail *</span>
          <input name="email" type="email" required maxLength={200} autoComplete="email" className={input} />
        </label>
        <label className="space-y-1.5">
          <span className="text-[12px] tracking-[.18em] text-ivory/45 uppercase">Téléphone</span>
          <input name="phone" type="tel" maxLength={40} autoComplete="tel" className={input} />
        </label>
        <label className="space-y-1.5">
          <span className="text-[12px] tracking-[.18em] text-ivory/45 uppercase">Restaurant {mode === "DEMO" ? "*" : ""}</span>
          <input name="restaurantName" required={mode === "DEMO"} maxLength={160} autoComplete="organization" className={input} />
        </label>
        {mode === "DEMO" ? (
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-[12px] tracking-[.18em] text-ivory/45 uppercase">Ville</span>
            <input name="city" maxLength={120} autoComplete="address-level2" className={input} />
          </label>
        ) : null}
        <label className="space-y-1.5 sm:col-span-2">
          <span className="text-[12px] tracking-[.18em] text-ivory/45 uppercase">{mode === "DEMO" ? "Votre projet (facultatif)" : "Votre message *"}</span>
          <textarea name="message" required={mode === "CONTACT"} maxLength={3000} rows={4} className={cn(input, "h-auto py-3")} placeholder={mode === "DEMO" ? "Nombre de plats, type de cuisine, échéance…" : ""} />
        </label>
        {/* Champ invisible anti-robots */}
        <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
        <label className="flex items-start gap-3 text-[13px] leading-snug text-ivory/50 sm:col-span-2">
          <input type="checkbox" name="consent" required className="mt-0.5 size-4 rounded accent-[#f2eee6]" />
          <span>
            J&apos;accepte que mes informations soient utilisées pour me recontacter au sujet de Voir avant de commander. Elles ne sont ni cédées ni utilisées à
            d&apos;autres fins. <a href="/confidentialite" className="underline hover:text-ivory">En savoir plus</a>
          </span>
        </label>
      </div>
      {error ? <p role="alert" className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-[14px] text-red-300 ring-1 ring-red-500/30">{error}</p> : null}
      <button type="submit" disabled={status === "sending"} className="mt-10 inline-flex h-13 w-full items-center justify-center gap-2 rounded-full bg-ivory px-8 text-[14.5px] font-medium text-ink transition-transform duration-300 hover:-translate-y-0.5 disabled:opacity-60 sm:w-auto">
        {status === "sending" ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" strokeWidth={1.6} />}
        {mode === "DEMO" ? "Demander ma démonstration" : "Envoyer le message"}
      </button>
    </form>
  );
}
