export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-5 pt-36 pb-24 sm:px-8">
      <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
      <p className="mt-3 text-[14px] text-white/45">Dernière mise à jour : {updated}</p>
      <div className="mt-10 space-y-6 text-[16px] leading-relaxed text-white/70 [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-white [&_strong]:text-white">{children}</div>
    </article>
  );
}

/** Champ à compléter par l'éditeur du site (jamais d'information inventée). */
export function ToFill({ children }: { children: React.ReactNode }) {
  return <mark className="rounded bg-amber-400/15 px-1.5 py-0.5 text-amber-200">[À compléter : {children}]</mark>;
}
