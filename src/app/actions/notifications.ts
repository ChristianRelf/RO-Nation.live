"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/session";

// Dismissing the change-notices in the modal.
//
// Signed-in only, and it can only ever touch the caller's own rows: the WHERE is pinned to
// `session.uid`. That pin is the whole security model here and it does not move - `ids` below
// can only ever NARROW it, so a forged id belonging to somebody else matches `id IN (...)`
// and then fails `userId`, and marks nothing.
//
// "Got it" marks everything unseen as seen at once - the modal shows them together, so
// acknowledging them together is the honest match. The account hub keeps the full list, seen
// and unseen, as a record.

export async function acknowledgeNotifications(ids?: string[]) {
  const session = await getUserSession();
  if (!session) return;

  await prisma.memberNotification.updateMany({
    where: {
      userId: session.uid,
      seenAt: null,
      // ---- Why acknowledging a SUBSET is a thing ---------------------------
      //
      // There are two dialogs now, and an upgrade is shown in its own. So "the modal shows
      // them together" stopped being true the moment a member could have an upgrade AND a
      // rescheduled show waiting at the same time: the celebration acknowledges only itself,
      // refreshes, and the ordinary notice for the reschedule opens behind it.
      //
      // Marking the lot seen from the upgrade dialog would eat that reschedule silently -
      // the member would be told they got upgraded and never told the show moved. The one
      // notice that matters most would be the one destroyed by the happiest one.
      //
      // Omitted (the ordinary modal, which really does show everything) still means all.
      ...(ids?.length ? { id: { in: ids } } : {}),
    },
    data: { seenAt: new Date() },
  });

  // The notifier is mounted in the root layout, so the layout is what has to re-read. The
  // client also router.refresh()es after this resolves; this is the belt to that's braces.
  revalidatePath("/", "layout");
}
