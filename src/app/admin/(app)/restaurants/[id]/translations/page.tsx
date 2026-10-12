import Link from "next/link";
import { requireRestaurantAccessPage } from "@/lib/auth/guards";
import { autoTranslationAvailable, stateOf, translationOverview, translationProvider } from "@/lib/i18n/translate";
import { LOCALES, isLocale, localeDir } from "@/lib/i18n/locales";
import { Card, EmptyState } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { TranslationEditor } from "@/components/admin/translation-editor";
import { Languages } from "lucide-react";

export const metadata = { title: "Traductions" };

export default async function TranslationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRestaurantAccessPage(id, "EDIT");
  const overview = await translationOverview(id);
  if (!overview.locales.length) {
    return (
      <Card>
        <EmptyState
          icon={<Languages className="size-5" />}
          title="Menu proposé dans une seule langue"
          description="Ajoutez des langues dans les paramètres : vos clients étrangers pourront lire le menu dans leur langue."
          action={
            <Link href={`/admin/restaurants/${id}/settings`} className={buttonClasses("accent")}>
              Choisir les langues
            </Link>
          }
        />
      </Card>
    );
  }
  const rows = overview.items.map((item) => ({
    key: item.key,
    entityType: item.entityType,
    entityId: item.entityId,
    field: item.field,
    source: item.source,
    context: item.context,
    translations: Object.fromEntries(
      overview.locales.map((locale) => {
        const t = overview.byKey.get(`${item.key}:${locale}`);
        return [locale, { value: t?.value ?? "", state: stateOf(item, t) }];
      }),
    ),
  }));
  return (
    <TranslationEditor
      restaurantId={id}
      defaultLocale={overview.defaultLocale}
      locales={overview.locales.map((l) => ({ code: l, label: isLocale(l) ? LOCALES[l].label : l, dir: localeDir(l) }))}
      rows={rows}
      summary={overview.summary}
      provider={autoTranslationAvailable() ? translationProvider() : null}
    />
  );
}
