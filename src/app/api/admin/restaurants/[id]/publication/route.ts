import { route } from "@/lib/http";
import { requireRestaurantAccess } from "@/lib/auth/guards";
import { checkReadiness, publicationState } from "@/lib/menu/publish";

export const GET = route<{ id: string }>(async (_request, { id }) => {
  await requireRestaurantAccess(id, "VIEW");
  const state = await publicationState(id);
  const issues = await checkReadiness(id, state.draft);
  return { status: state.status, published: state.published, hasUnpublishedChanges: state.hasUnpublishedChanges, issues };
});
