"use server";

import { revalidatePath } from "next/cache";
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
// ---- Why nothing here calls redirect() -----------------------------------
//
// It cannot. A redirect() from a SERVER ACTION does not run the middleware, and
// the middleware is the only thing that knows <slug>.ronation.live/tickets means
// /p/<slug>/tickets. So on a partner's site the redirect resolves against RNL's
// route tree instead: reserving a Sleep Token RO ticket used to land the buyer
// on RNL's /tickets page — RNL's nav, RNL's footer, still on Sleep Token's
// domain — and any redirect under /events/<slug> 404'd outright, because RNL's
// copy of that route scopes to partnerId: null and the partner's show is not
// RNL's. (Page-level redirects are fine: they are real HTTP 307s, which the
// browser re-requests and the middleware does see. It is only actions.)
//
// So these actions RETURN their outcome, and the client navigates — an ordinary
// client-side navigation, which does run the middleware. Cancelling and
// activating navigate nowhere at all: they revalidate, and the page they are on
// re-renders in place, which is both correct and the better thing to look at.
//
// revalidatePath is the mirror image and needs the opposite care: it matches on
// the INTERNAL route, so it must be handed /p/<slug>/… or it silently refreshes
// nothing at all. See lib/partners/urls.ts.

export type ReserveState =
  /**
   * The ticket's opaque ID — NOT its code.
   *
   * The checkout navigates with this, and the ticket page is addressed by it. The
   * code is what the ticket page withholds until the holder activates, so handing
   * it back here would put it straight into the URL bar and make the seal a lie.
   */
  | { ok: true; id: string }
  | {
      ok: false;
      error:
        | "auth"
        | "terms"
        | "badtier"
        | "payments_off"
        | "unavailable"
        | "past"
        | "soldout"
        | "tier_soldout";
    };

const fail = (error: Extract<ReserveState, { ok: false }>["error"]) =>
  ({ ok: false, error }) as const;

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

/** useFormState signature: the previous state comes in, the next one goes out. */
export async function reserveTicket(
  _prev: ReserveState | null,
  formData: FormData,
): Promise<ReserveState> {
  const eventId = String(formData.get("eventId") || "");
  const tierId = String(formData.get("tierId") || ""); // "" = the implicit tier
  const acceptedTerms = formData.get("terms") === "on";

  const session = await getUserSession();
  if (!session) return fail("auth");

  // The "purchase" gate: you must accept the ticket terms & conditions.
  if (!acceptedTerms) return fail("terms");

  // Whose show is this, and what is on sale? Read outside the transaction — it
  // decides the code's prefix, the Robux gate and which routes to revalidate,
  // none of which needs the lock. The transaction re-reads the event under FOR
  // UPDATE for the parts that do.
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { slug: true, partnerId: true, tiers: true },
  });
  if (!event) return fail("unavailable");

  const partnerId = event.partnerId ?? null;
  const partner = partnerBySlug(partnerId);
  const prefix = partner?.ticketPrefix ?? "RN";

  // Resolve the posted tier against THIS event's tiers. An id from another show,
  // or one that has since been deactivated, matches nothing and is refused —
  // which is why nothing below has to trust the form.
  const tiers = effectiveTiers(event.tiers);
  const tier = tiers.find((t) => (t.id ?? "") === tierId);
  if (!tier) return fail("badtier");

  if (tier.priceRobux > 0) {
    // ---- The paid-ticket wall -------------------------------------------
    //
    // Refusal 1: Robux sales are off. Both keys must be open — the master switch
    // AND the partner's registry grant. Today the master switch is off, so this
    // is the one that fires, and the checkout has already rendered the tier as
    // locked. This branch exists because the checkout's lock is *courtesy*: it
    // stops a person, not a forged POST.
    if (!robuxSalesAllowed(partner, env.robuxTickets)) {
      return fail("payments_off");
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
  let outcome: ReserveState | null = null;
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
        if (!ev || ev.status !== "PUBLISHED") return fail("unavailable");
        if (isPast(ev.startsAt)) return fail("past");

        // Already holding an active ticket? (Under the lock, so a double-submit
        // resolves to the same ticket rather than a unique-constraint error.)
        const existing = await tx.ticket.findUnique({
          where: { eventId_userId: { eventId, userId: session.uid } },
        });
        if (existing && existing.status !== "CANCELLED") {
          return { ok: true, id: existing.id } as const;
        }

        // The room's cap (0 = unlimited).
        if (ev.capacity > 0) {
          const taken = await tx.ticket.count({
            where: { eventId, status: { not: "CANCELLED" } },
          });
          if (taken >= ev.capacity) return fail("soldout");
        }

        // The tier's own cap, on top. The implicit tier has no id and no cap.
        if (tier.id && tier.capacity > 0) {
          const takenInTier = await tx.ticket.count({
            where: { eventId, tierId: tier.id, status: { not: "CANCELLED" } },
          });
          if (takenInTier >= tier.capacity) return fail("tier_soldout");
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
          return { ok: true, id: existing.id } as const;
        }

        const created = await tx.ticket.create({
          data: { eventId, userId: session.uid, code, status: "RESERVED", ...held },
        });
        return { ok: true, id: created.id } as const;
      });
    } catch (err) {
      if (isCodeCollision(err)) continue;
      throw err;
    }
  }

  // Five collisions in a 31^6 space is not bad luck, it is a broken generator.
  // Throw rather than hand back a code no ticket was ever issued under.
  if (!outcome) {
    throw new Error("Could not allocate a unique ticket code after 5 attempts");
  }

  if (outcome.ok) refreshTicketViews(partnerId, event.slug);
  return outcome;
}

/**
 * Cancel, and stay put.
 *
 * The old version redirected to /tickets. It no longer needs to: revalidating
 * re-renders the ticket the holder is looking at, now stamped VOID, which both
 * dodges the action-redirect problem above and shows them the thing they just
 * did instead of a list they have to go looking for it in.
 */
export async function cancelTicket(formData: FormData) {
  const ticketId = String(formData.get("ticketId") || "");
  const session = await getUserSession();
  if (!session) return;

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { event: { select: { slug: true, partnerId: true } } },
  });
  if (!ticket || ticket.userId !== session.uid) return;

  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { status: "CANCELLED" },
  });

  const { partnerId, slug } = ticket.event;
  refreshTicketViews(partnerId, slug);
  revalidatePath(
    partnerId
      ? partnerSiteRoute(partnerId, `/tickets/${ticket.id}`)
      : `/tickets/${ticket.id}`,
  );
}

/**
 * Flip a reserved ticket to "activated" — this reveals the real QR on the stub.
 *
 * Returns whether it fired, so the client can throw the confetti. It used to say
 * so with a ?activated=1 redirect, which is the one thing an action must not do.
 */
export async function activateTicket(
  _prev: { activated: boolean } | null,
  formData: FormData,
): Promise<{ activated: boolean }> {
  const ticketId = String(formData.get("ticketId") || "");
  const session = await getUserSession();
  if (!session) return { activated: false };

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { event: { select: { partnerId: true } } },
  });
  if (!ticket || ticket.userId !== session.uid) return { activated: false };
  if (ticket.status === "CANCELLED") return { activated: false };

  if (!ticket.activatedAt) {
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { activatedAt: new Date() },
    });
  }

  const { partnerId } = ticket.event;
  revalidatePath(
    partnerId
      ? partnerSiteRoute(partnerId, `/tickets/${ticket.id}`)
      : `/tickets/${ticket.id}`,
  );
  return { activated: true };
}
