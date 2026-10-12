import type { MenuStrings } from "@/lib/i18n/menu-strings";
import { ArIcon } from "./icons";

export function MenuUnavailable({ name, strings }: { name: string; strings: MenuStrings }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-ink px-6 text-center text-cream">
      <div className="max-w-md">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-white/5 text-saffron ring-1 ring-white/10">
          <ArIcon className="size-8" />
        </div>
        <p className="mt-8 text-sm tracking-[.2em] text-white/50 uppercase">{name}</p>
        <h1 className="mt-3 font-serif text-4xl">{strings.notAvailableTitle}</h1>
        <p className="mt-4 leading-relaxed text-white/65">{strings.notAvailableText}</p>
      </div>
    </main>
  );
}
