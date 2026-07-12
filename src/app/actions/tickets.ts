"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/session";
import { generateTicketCode } from "@/lib/utils";
import { isPast } from "@/lib/format";
import { partnerBySlug } from "@/lib/partners/registry";
import { partnerSiteRoute } from "@/lib/partners/urls";

// Ticketing, for RNL's events and every partner's.
//
// The partner is read from the EVENT, never from the form body. An event knows
// whose show it is, and that cannot be forged by posting a different hidden
// field — so there is nothing extra to validate here: reserving for a Sleep
// Token RO show yields a Sleep Token RO ticket because the event says so.
//
// The redirect targets below are deliberately unqualified ("/tickets",
// "/events/<slug>"). They need no partner prefix: the browser is already on the
// partner's host, and the middleware rewrites <slug>.ronation.live/tickets to
// /p/<slug>/tickets. The same string is correct on both sites.
//
// revalidatePath is the exception, and the one thing that genuinely needs care:
// it matches on the INTERNAL route, so it must be handed /p/<slug>/… or it
// silently refreshes nothing at all. See lib/partners/urls.ts.

type ReserveOutcome =
  | { code: string }
  | { error: "unavailable" | "past" | "soldout" };

const isCodeCollision = (err: any) =>
  err?.code === "P2002" && err?.meta?.target?.includes?.("code");

/** Refresh the event page and the ticket wallet, on whichever site they live. */
function refreshTicketViews(partnerId: string | null, slug: string) {
  if (partnerId) {
    revalidatePath(partnerSiteRoute(partnerId, `/events/${slug}`));
    revalidatePath(partnerSiteRoute(partnerId, "/tickets"));
    return;
  }
  revalidatePath(`/events/${slug}`);
  revalidatePath("/tickets");
}

export async function reserveTicket(formData: FormData) {
  const eventId = String(formData.get("eventId") || "");
  const slug = String(formData.get("slug") || "");
  const acceptedTerms = formData.get("terms") === "on";

  const session = await getUserSession();
  if (!session) {
    redirect(`/account?returnTo=${encodeURIComponent(`/events/${slug}/reserve`)}`);
  }

  // The "purchase" gate: you must accept the ticket terms & conditions.
  if (!acceptedTerms) {
    redirect(`/events/${slug}/reserve?error=terms`);
  }

  // Whose show is this? Read outside the transaction — it decides the code's
  // prefix and which routes to revalidate, neither of which needs the lock. The
  // transaction re-reads the event under FOR UPDATE for the parts that do.
  const owner = await prisma.event.findUnique({
    where: { id: eventId },
    select: { partnerId: true },
  });
  const partnerId = owner?.partnerId ?? null;
  const prefix = partnerId
    ? (partnerBySlug(partnerId)?.ticketPrefix ?? "RN")
    : "RN";

  // The code is minted outside the transaction, and a collision retries the
  // whole thing. It cannot be retried *inside*: in Postgres a failed statement
  // aborts the surrounding transaction, so the second attempt would die on the
  // poisoned transaction rather than on the duplicate code.
  let outcome: ReserveOutcome | null = null;
  for (let attempt = 0; attempt < 5 && !outcome; attempt++) {
    const code = generateTicketCode(prefix);
    try {
      outcome = await prisma.$transaction(async (tx) => {
        // Take a write lock on the event row and hold it to commit. Everyone
        // reserving for this event now queues here, so no two requests can both
        // read `capacity - 1` and both insert. It serialises per event, so
        // other events are unaffected — and unlike a Serializable transaction,
        // there is no retry loop to get wrong.
        const rows = await tx.$queryRaw<
          { id: string; capacity: number; status: string; startsAt: Date }[]
        >`SELECT id, capacity, status, "startsAt" FROM events WHERE id = ${eventId} FOR UPDATE`;

        const event = rows[0];
        if (!event || event.status !== "PUBLISHED") {
          return { error: "unavailable" } as const;
        }
        if (isPast(event.startsAt)) {
          return { error: "past" } as const;
        }

        // Already holding an active ticket? (Under the lock, so a double-submit
        // resolves to the same ticket rather than a unique-constraint error.)
        const existing = await tx.ticket.findUnique({
          where: { eventId_userId: { eventId, userId: session.uid } },
        });
        if (existing && existing.status !== "CANCELLED") {
          return { code: existing.code };
        }

        // Capacity (0 = unlimited).
        if (event.capacity > 0) {
          const taken = await tx.ticket.count({
            where: { eventId, status: { not: "CANCELLED" } },
          });
          if (taken >= event.capacity) {
            return { error: "soldout" } as const;
          }
        }

        // Re-activate a previously cancelled ticket, or create a fresh one.
        if (existing) {
          await tx.ticket.update({
            where: { id: existing.id },
            data: { status: "RESERVED", termsAcceptedAt: new Date() },
          });
          return { code: existing.code };
        }

        await tx.ticket.create({
          data: {
            eventId,
            userId: session.uid,
            code,
            status: "RESERVED",
            termsAcceptedAt: new Date(),
          },
        });
        return { code };
      });
    } catch (err) {
      if (isCodeCollision(err)) continue;
      throw err;
    }
  }

  // Five collisions in a 31^6 space is not bad luck, it is a broken generator.
  // Throw rather than redirect to a code no ticket was ever issued under.
  if (!outcome) {
    throw new Error("Could not allocate a unique ticket code after 5 attempts");
  }

  if ("error" in outcome) {
    redirect(`/events/${slug}?error=${outcome.error}`);
  }

  refreshTicketViews(partnerId, slug);
  redirect(`/tickets?new=${outcome.code}`);
}

export async function cancelTicket(formData: FormData) {
  const ticketId = String(formData.get("ticketId") || "");
  const session = await getUserSession();
  if (!session) redirect("/account");

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { event: { select: { slug: true, partnerId: true } } },
  });
  if (ticket && ticket.userId === session.uid) {
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: "CANCELLED" },
    });
    refreshTicketViews(ticket.event.partnerId, ticket.event.slug);
  }
  redirect("/tickets");
}

// Flip a reserved ticket to "activated" — this reveals the decorative QR on the
// ticket detail page and drives the confetti moment on the client.
export async function activateTicket(formData: FormData) {
  const ticketId = String(formData.get("ticketId") || "");
  const session = await getUserSession();
  if (!session) redirect("/account?returnTo=/tickets");

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { event: { select: { slug: true, partnerId: true } } },
  });
  if (!ticket || ticket.userId !== session.uid) redirect("/tickets");
  if (ticket.status === "CANCELLED") redirect(`/tickets/${ticket.code}`);

  if (!ticket.activatedAt) {
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { activatedAt: new Date() },
    });
  }

  const { partnerId } = ticket.event;
  revalidatePath(
    partnerId
      ? partnerSiteRoute(partnerId, `/tickets/${ticket.code}`)
      : `/tickets/${ticket.code}`,
  );
  redirect(`/tickets/${ticket.code}?activated=1`);
}
