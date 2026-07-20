"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { partnerSiteRoute } from "@/lib/partners/urls";
import { isPast } from "@/lib/format";

// A member joining (or leaving) the queue for a sold-out show.
//
// Modelled on actions/follows.ts, and for the same reasons: a SESSION but no rank
// gate, two idempotent actions rather than one toggle (a form retry must not flip
// the state back), and NEVER a redirect - these fire from a public event page that
// may be on a partner host, where a server-action redirect is dropped (see
// actions/tickets.ts). They revalidate the internal path and re-render in place.
//
// Joining reserves nothing - see the Waitlist model note. It only puts them in line
// for the "a spot opened" notice that lib/waitlist.ts sends when a seat frees.

function revalidateFor(event: { slug: string; partnerId: string | null }) {
  revalidatePath(
    event.partnerId
      ? partnerSiteRoute(event.partnerId, `/events/${event.slug}`)
      : `/events/${event.slug}`,
  );
  revalidatePath("/account");
}

export async function joinWaitlist(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "").trim();
  const session = await getUserSession();
  if (!session || !eventId) return;

  const rl = await rateLimit(`waitlist:${session.uid}`, {
    limit: 30,
    windowSeconds: 600,
  });
  if (!rl.ok) return;

  // Only a real, still-upcoming show. There is no point queueing for one that has
  // already happened, and a bad id would otherwise fail the foreign key.
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { slug: true, partnerId: true, status: true, startsAt: true },
  });
  if (!event || event.status !== "PUBLISHED" || isPast(event.startsAt)) return;

  // Upsert, not create: joining twice is not an error, and a fresh join after a
  // previous notify should start them waiting again (notifiedAt back to null) so a
  // later freed seat can reach them once more.
  await prisma.waitlist.upsert({
    where: { userId_eventId: { userId: session.uid, eventId } },
    create: { userId: session.uid, eventId },
    update: { notifiedAt: null },
  });
  revalidateFor(event);
}

export async function leaveWaitlist(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "").trim();
  const session = await getUserSession();
  if (!session || !eventId) return;

  await prisma.waitlist.deleteMany({
    where: { userId: session.uid, eventId },
  });

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { slug: true, partnerId: true },
  });
  if (event) revalidateFor(event);
}
