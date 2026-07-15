"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/session";

// Dismissing the change-notices in the modal.
//
// Signed-in only, and it can only ever touch the caller's own rows: the WHERE is pinned to
// `session.uid`, so there is no id from the body to forge. "Got it" marks everything unseen as
// seen at once - the modal shows them together, so acknowledging them together is the honest
// match. The account hub keeps the full list, seen and unseen, as a record.

export async function acknowledgeNotifications() {
  const session = await getUserSession();
  if (!session) return;

  await prisma.memberNotification.updateMany({
    where: { userId: session.uid, seenAt: null },
    data: { seenAt: new Date() },
  });

  // The notifier is mounted in the root layout, so the layout is what has to re-read. The
  // client also router.refresh()es after this resolves; this is the belt to that's braces.
  revalidatePath("/", "layout");
}
