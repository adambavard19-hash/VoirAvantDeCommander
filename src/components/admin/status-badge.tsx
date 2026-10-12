import { Badge } from "@/components/ui/card";
import type { RestaurantStatus } from "@/generated/prisma/enums";

const LABELS: Record<RestaurantStatus, { label: string; tone: "success" | "warning" | "neutral" | "danger" }> = {
  PUBLISHED: { label: "En ligne", tone: "success" },
  DRAFT: { label: "Brouillon", tone: "warning" },
  SUSPENDED: { label: "Hors ligne", tone: "danger" },
  ARCHIVED: { label: "Archivé", tone: "neutral" },
};

export function StatusBadge({ status }: { status: RestaurantStatus }) {
  const s = LABELS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
