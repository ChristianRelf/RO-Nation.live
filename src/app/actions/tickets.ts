"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getUserSession } from "@/lib/session";
import { generateTicketCode } from "@/lib/utils";
import { isPast } from "@/lib/format";
import { partnerBySlug } from "@/lib/partners/registry";
import { partnerSiteRoute } from "@/lib/partners/urls";
import { effectiveTiers, robuxSalesAllowed } from "@/lib/tickets/pricing";

// Ticketing, for RNL's events and every partner's.
//
// The partner is read from the EVENT, never from the form body. An event knows
// whose show it is, and that cannot be forged by posting a different hidden
// field — so there is nothing extra to validate here: reserving for a Sleep
// Token RO show yields a Sleep Token RO ticket because the event says so.
//
// The TIER is read from the form, and is therefore not trusted: it is looked up
// against that event's own tiers below, so a tier id belonging to another show
// (or an invented one) resolves to nothing and the reservation is refused. It
// never reaches the insert.
//
// The redirect targets below are deliberately unqualified ("/tickets",
// "/events/<slug>"). They need no partner prefix: the browser is already on the
// partner's host, and the middleware rewrites <slug>.ronation.live/tickets to
// /p/<slug>/tickets. The same string is correct on both sites.
//
// revalidatePath is the exception, and the one thing that genuinely needs care:
// it matches on the INTERNAL route, so it must be handed /p/<slug>/… or it
// silently refreshes nothing at all. See lib/partners/urls.ts.

type ReserveError =
  | "unavailable"
  | "past"
  | "soldout"
  | "tier_soldout"
  | "badtier";

type ReserveOutcome = { code: string } | { error: ReserveError };

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
  const tierId = String(formData.get("tierId") || ""); // "" = the implicit tier
  const acceptedTerms = formData.get("terms") === "on";

  const session = await getUserSession();
  if (!session) {
    redirect(`/account?returnTo=${encodeURIComponent(`/events/${slug}/reserve`)}`);
  }

  // The "purchase" gate: you must accept the ticket terms & conditions.
  if (!acceptedTerms) {
    redirect(`/events/${slug}/reserve?error=terms`);
  }

  // Whose show is this, and what is on sale? Read outside the transaction — it
  // decides the code's prefix, the Robux gate and which routes to revalidate,
  // none of which needs the lock. The transaction re-reads the event under FOR
  // UPDATE for the parts that do.
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { partnerId: true, tiers: true },
  });
  if (!event) redirect(`/events/${slug}?error=unavailable`);

  const partnerId = event.partnerId ?? null;
  const partner = partnerBySlug(partnerId);
  const prefix = partner?.ticketPrefix ?? "RN";

  // Resolve the posted tier against THIS event's tiers. An id from another show,
  // or one that has since been deactivated, matches nothing and is refused —
  // which is why nothing below has to trust the form.
  const tiers = effectiveTiers(event.tiers);
  const tier = tiers.find((t) => (t.id ?? "") === tierId);
  if (!tier) {
    redirect(`/events/${slug}/reserve?error=badtier`);
  }

  if (tier.priceRobux > 0) {
    // ---- The paid-ticket wall -------------------------------------------
    //
    // Refusal 1: Robux sales are off. Both keys must be open — the master switch
    // AND the partner's registry grant. Today the master switch is off, so this
    // is the one that fires, and the checkout has already rendered the tier as
    // locked. This branch exists because the checkout's lock is *courtesy*: it
    // stops a person, not a forged POST.
    if (!robuxSalesAllowed(partner, env.robuxTickets)) {
      redirect(`/events/${slug}/reserve?error=payments_off`);
    }

    // Refusal 2: reached only by switching ROBUX_TICKETS_ENABLED on. A flag is
    // not a payment. Nothing in this codebase collects a single Robux — a real
    // charge is a Developer Product prompted inside the Roblox experience and
    // confirmed by ProcessReceipt calling back here, and none of that is built.
    // Falling through would hand out a paid VIP ticket, for free, and look
    // completely healthy doing it.
    //
    // So: fail loudly instead of quietly giving the room away. This throw is the
    // line the payment work deletes — replace it with "mint the ticket PENDING,
    // hand back a purchase prompt, settle on the receipt callback".
    throw new Error(
      "ROBUX_TICKETS_ENABLED is on, but no Robux payment pipeline exists — " +
        "refusing to issue a paid ticket that nobody paid for. See lib/tickets/pricing.ts.",
    );
  }

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
        //
        // The tier counts below are read under this same lock, which is what
        // makes a per-tier cap hold as tightly as the room's own.
        const rows = await tx.$queryRaw<
          { id: string; capacity: number; status: string; startsAt: Date }[]
        >`SELECT id, capacity, status, "startsAt" FROM events WHERE id = ${eventId} FOR UPDATE`;

        const ev = rows[0];
        if (!ev || ev.status !== "PUBLISHED") {
          return { error: "unavailable" } as const;
        }
        if (isPast(ev.startsAt)) {
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

        // The room's cap (0 = unlimited).
        if (ev.capacity > 0) {
          const taken = await tx.ticket.count({
            where: { eventId, status: { not: "CANCELLED" } },
          });
          if (taken >= ev.capacity) {
            return { error: "soldout" } as const;
          }
        }

        // The tier's own cap, on top. The implicit tier has no id and no cap.
        if (tier.id && tier.capacity > 0) {
          const takenInTier = await tx.ticket.count({
            where: {
              eventId,
              tierId: tier.id,
              status: { not: "CANCELLED" },
            },
          });
          if (takenInTier >= tier.capacity) {
            return { error: "tier_soldout" } as const;
          }
        }

        // What they hold is frozen here, not looked up later: renaming or
        // re-pricing the tier tomorrow must not rewrite the ticket they are
        // holding today. See the note on Ticket.tierName in schema.prisma.
        const held = {
          tierId: tier.id,
          tierName: tier.name,
          priceRobux: tier.priceRobux,
          termsAcceptedAt: new Date(),
        };

        // Re-activate a previously cancelled ticket, or create a fresh one.
        // Re-reserving re-picks the tier, so the snapshot is rewritten too.
        if (existing) {
          await tx.ticket.update({
            where: { id: existing.id },
            data: { status: "RESERVED", ...held },
          });
          return { code: existing.code };
        }

        await tx.ticket.create({
          data: {
            eventId,
            userId: session.uid,
            code,
            status: "RESERVED",
            ...held,
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
    // A tier selling out is a checkout problem — send them back to pick another
    // one. The rest are event-level, so they belong on the event page.
    if (outcome.error === "tier_soldout") {
      redirect(`/events/${slug}/reserve?error=tier_soldout`);
    }
    redirect(`/events/${slug}?error=${outcome.error}`);
  }

  refreshTicketViews(partnerId, slug);
  // Land them ON the ticket, not on a list with a banner over it. The ticket is
  // the thing they just came here for.
  redirect(`/tickets/${outcome.code}?issued=1`);
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

// Flip a reserved ticket to "activated" — this reveals the real QR on the ticket
// and drives the confetti moment on the client.
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
