"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { partnerSiteRoute } from "@/lib/partners/urls";

// A member following (or unfollowing) a show for their watchlist.
//
// Public in the sense enquiries.ts is: no rank gate, but a SESSION is required - the follow
// belongs to whoever is signed in, and identity is the whole point. It lives in its own file,
// not actions/company.ts, so nobody adds a guarded write beside an unguarded one by habit.
//
// TWO explicit actions, not one toggle: a toggle flips back on a double-submit, whereas an
// upsert and a deleteMany are each idempotent - the exact property a form retry needs. The
// unique key (userId, eventId) is the backstop under both.
//
// Never redirects: these fire from a public event page that may be on a PARTNER host, where a
// server-action redirect is dropped (see actions/tickets.ts). They revalidate the internal
// path and re-render the button in place.

/** Revalidate the event's public page (RNL or partner) and the member's account hub. */
function revalidateFor(event: { slug: string; partnerId: string | null }) {
  revalidatePath(
    event.partnerId
      ? partnerSiteRoute(event.partnerId, `/events/${event.slug}`)
      : `/events/${event.slug}`,
  );
  revalidatePath("/account");
}

export async function followEvent(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "").trim();
  const session = await getUserSession();
  if (!session || !eventId) return;

  // A burst guard, matching the other public writes. A person does not follow thirty shows in
  // ten minutes; a script does.
  const rl = await rateLimit(`follow:${session.uid}`, {
    limit: 30,
    windowSeconds: 600,
  });
  if (!rl.ok) return;

  // Only a real event - and the lookup doubles as the source of the revalidation path. A bad
  // id would otherwise fail the foreign key; here it simply does nothing.
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { slug: true, partnerId: true },
  });
  if (!event) return;

  await prisma.eventFollow.upsert({
    where: { userId_eventId: { userId: session.uid, eventId } },
    create: { userId: session.uid, eventId },
    update: {},
  });
  revalidateFor(event);
}

export async function unfollowEvent(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "").trim();
  const session = await getUserSession();
  if (!session || !eventId) return;

  await prisma.eventFollow.deleteMany({
    where: { userId: session.uid, eventId },
  });

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { slug: true, partnerId: true },
  });
  if (event) revalidateFor(event);
}
