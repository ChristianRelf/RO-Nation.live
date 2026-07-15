import { getUserSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { NotifierModal } from "./notifier-modal";

// The bridge between "who is signed in" and the modal.
//
// A server component, mounted in the root layout, so it runs on every member-facing page load
// - which is exactly what "a modal appears when the user next visits" needs. It short-circuits
// hard: no session, or nothing unseen, and it renders nothing and the visitor never knows it
// was there. Only a signed-in member with an unread change-notice ever sees the dialog.

export async function MemberNotifier() {
  const session = await getUserSession();
  if (!session) return null;

  const notices = await prisma.memberNotification.findMany({
    where: { userId: session.uid, seenAt: null },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, title: true, body: true, url: true },
  });
  if (notices.length === 0) return null;

  return <NotifierModal notices={notices} />;
}
