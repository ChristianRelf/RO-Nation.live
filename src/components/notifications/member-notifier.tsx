import { getUserSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { NotifierModal } from "./notifier-modal";
import { UpgradeModal } from "./upgrade-modal";

// The bridge between "who is signed in" and the modal.
//
// A server component, mounted in the root layout, so it runs on every member-facing page load
// - which is exactly what "a modal appears when the user next visits" needs. It short-circuits
// hard: no session, or nothing unseen, and it renders nothing and the visitor never knows it
// was there. Only a signed-in member with an unread change-notice ever sees the dialog.
//
// ---- Two dialogs, one at a time --------------------------------------------
//
// An upgrade gets its own, and it goes FIRST and ALONE. Not because it is more important -
// a cancelled show matters far more than a better seat - but because the two cannot share a
// frame. The ordinary notice is a list you read and acknowledge; the upgrade is one piece of
// good news with confetti over it. Put "you've been upgraded to VIP" in a bulleted list under
// "Neon Nights has been cancelled" and you have built something that celebrates at somebody
// while telling them their night is off.
//
// So they queue. The celebration acknowledges only its own rows, refreshes, and this runs
// again - and the reschedule that was waiting behind it opens in the ordinary dialog. Nothing
// is lost and nothing is read in the wrong voice.

export async function MemberNotifier() {
  const session = await getUserSession();
  if (!session) return null;

  const notices = await prisma.memberNotification.findMany({
    where: { userId: session.uid, seenAt: null },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, kind: true, title: true, body: true, url: true },
  });
  if (notices.length === 0) return null;

  // `kind` is the only thing that tells these apart, which is why it is selected here and
  // written by exactly one function (diffTicketChange in lib/member-notify.ts).
  const upgrades = notices.filter((n) => n.kind === "TICKET_UPGRADED");
  if (upgrades.length > 0) return <UpgradeModal notices={upgrades} />;

  return <NotifierModal notices={notices} />;
}
