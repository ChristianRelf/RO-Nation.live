"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/session";
import { partnerSiteRoute } from "@/lib/partners/urls";
import { issueTicket } from "@/lib/tickets/issue";

// Ticketing, for RNL's events and every partner's - the WEBSITE's half of it.
//
// The deciding is not here. Reserving a ticket - resolving the tier, taking the
// lock on the event, counting the room, refusing a paid tier, refusing a revoked
// player - lives in lib/tickets/issue.ts, and the game API calls exactly the same
// function. That is not a refactor for tidiness: a checkout that oversells a room
// the door then turns people away from is worse than either being wrong alone, and
// two copies of a capacity check are two copies that eventually disagree.
//
// What is left here is what is genuinely the website's: the session, the terms
// checkbox, and revalidating the pages the visitor is looking at.
//
// ---- Why nothing here calls redirect() -----------------------------------
//
// It cannot. A redirect() from a SERVER ACTION does not run the middleware, and
// the middleware is the only thing that knows <slug>.ronation.live/tickets means
// /p/<slug>/tickets. So on a partner's site the redirect resolves against RNL's
// route tree instead: reserving a Sleep Token ticket used to land the buyer
// on RNL's /tickets page - RNL's nav, RNL's footer, still on Sleep Token's
// domain - and any redirect under /events/<slug> 404'd outright, because RNL's
// copy of that route scopes to partnerId: null and the partner's show is not
// RNL's. (Page-level redirects are fine: they are real HTTP 307s, which the
// browser re-requests and the middleware does see. It is only actions.)
//
// So these actions RETURN their outcome, and the client navigates - an ordinary
// client-side navigation, which does run the middleware. Cancelling and
// activating navigate nowhere at all: they revalidate, and the page they are on
// re-renders in place, which is both correct and the better thing to look at.
//
// revalidatePath is the mirror image and needs the opposite care: it matches on
// the INTERNAL route, so it must be handed /p/<slug>/… or it silently refreshes
// nothing at all. See lib/partners/urls.ts.

export type ReserveState =
  /**
   * The ticket's opaque ID - NOT its code.
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
        | "payment_required"
        | "revoked"
        | "unavailable"
        | "past"
        | "soldout"
        | "tier_soldout"
        | "not_found"
        /** Their seat hold went stale or was spent. Send them back to the map. */
        | "bad_intent"
        /** The seat went, and the tier has nothing left to move them to. */
        | "seat_taken";
    };

const fail = (error: Extract<ReserveState, { ok: false }>["error"]) =>
  ({ ok: false, error }) as const;

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

// ---- Why reserveTicket does NOT call the function above -------------------
//
// It used to, and it is what made the checkout modal flash past in a fraction of a
// second instead of running its course.
//
// revalidatePath() inside a SERVER ACTION does not merely mark a page stale. It busts the
// client Router Cache and makes Next re-render THE ROUTE THE CALLER IS STANDING ON, and
// ship that re-render back in the action's own response. The caller here is the checkout
// modal, and the route it is standing on is /events/<slug>/checkout - whose server
// component opens with:
//
//     const existing = await prisma.ticket.findUnique({ ...eventId_userId... });
//     if (existing && existing.status !== "CANCELLED") redirect(`/tickets/${existing.id}`);
//
// The reservation had just created that ticket. So the moment the action resolved - a few
// hundred milliseconds in - the page re-rendered, found the ticket, redirected, and the
// router navigated away, tearing the modal down mid-animation. The buyer lost the two
// stages they were meant to watch AND the `?issued=1` on the destination, which is what
// throws the confetti. The whole flow, gone, because a page revalidated itself.
//
// The reserve page's own comment describes this mechanism exactly, and says it was
// removed - "the action revalidated, this page re-rendered, the buyer now held a ticket,
// and this redirect fired. It was a clever trick and it is gone." It was not gone. When
// reserve and checkout were split, the redirect moved to the checkout page and the
// revalidation stayed here, so the trick kept firing one page over.
//
// ---- And it was buying nothing anyway --------------------------------------
//
// Every page it targeted - /events/[slug], /tickets, and both partner equivalents - is
// `export const dynamic = "force-dynamic"`. There is no server cache on any of them to
// invalidate, so it was a no-op on that side.
//
// And on the client side, checkout ends with `window.location.assign()` - a real document
// navigation, chosen deliberately (see checkout-processing.tsx) - which tears down the
// entire JavaScript application. There is no Router Cache left to be stale.
//
// So: no server cache to bust, no client cache to bust, and one very expensive side
// effect. cancelTicket and activateTicket still call it, and must - they revalidate and
// STAY PUT, which is the case revalidatePath is actually for.

/** useFormState signature: the previous state comes in, the next one goes out. */
export async function reserveTicket(
  _prev: ReserveState | null,
  formData: FormData,
): Promise<ReserveState> {
  const eventId = String(formData.get("eventId") || "");
  const tierId = String(formData.get("tierId") || ""); // "" = the implicit tier
  const acceptedTerms = formData.get("terms") === "on";

  // The seat hold, on a seated show. "" on an unseated one - and NOT trusted here for a
  // moment: issueTicket re-reads it, checks it is this event's, this tier's and this
  // person's, and refuses it otherwise. A token in a form field is not evidence of
  // anything, exactly like the tier id sitting next to it.
  const intentToken = String(formData.get("intent") || "");

  const session = await getUserSession();
  if (!session) return fail("auth");

  // The "purchase" gate: you must accept the ticket terms & conditions.
  if (!acceptedTerms) return fail("terms");

  // Everything that DECIDES anything - the tier, the caps, the money wall, the event
  // lock - lives in lib/tickets/issue.ts, because the game API issues tickets too and a
  // second copy of the capacity check would eventually oversell a room this one thinks is
  // full. issueTicket takes the id, so this lookup exists only to prove the show is real
  // before we bother it.
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!event) return fail("unavailable");

  const outcome = await issueTicket({
    eventId,
    holder: { userId: session.uid },
    tierId,
    // Unscoped: this is the holder reserving for themselves on whichever site
    // they are standing on, and the event they clicked is by definition theirs to
    // click. Scope is what stops a partner's KEY reaching RNL's shows.
    //
    // The hold, on a seated show. It is what has been keeping their chair warm since
    // they clicked it on the map, and spending it here is what turns it into a seat.
    // Empty on an unseated show, where there is nothing to hold.
    mode: { kind: "reserve", intentToken: intentToken || null },
  });

  if (!outcome.ok) {
    // Some of issueTicket's refusals cannot reach a web visitor, and folding them into
    // the generic one is better than putting words on a page that can never render:
    //
    //   no_player          needs a Roblox id Roblox has never heard of. This holder is a
    //                      signed-in session, so they demonstrably exist.
    //   not_purchasable    a caller charging for a free tier. This path charges nothing.
    //   not_paid,          the game-pass rail's answers. This is `reserve` - it never asks
    //   verify_unavailable, Roblox anything, because there is nothing to verify.
    //   needs_consent
    const reason = outcome.reason;
    if (
      reason === "no_player" ||
      reason === "not_purchasable" ||
      reason === "not_paid" ||
      reason === "verify_unavailable" ||
      reason === "needs_consent"
    ) {
      return fail("unavailable");
    }
    return fail(reason);
  }

  // NO refreshTicketViews() HERE. See the long note above the function - revalidating from
  // this action re-renders the checkout page the buyer is standing on, which redirects to
  // the ticket that was just created, which kills the modal mid-flow. The hard navigation
  // at the end of checkout-processing.tsx already resets everything a revalidation would.
  return { ok: true, id: outcome.ticketId };
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
    data: {
      status: "CANCELLED",

      // GIVE THE CHAIR BACK. See the long note on the identical line in voidTicket()
      // (lib/tickets/issue.ts) - this is the second of exactly two writers, and both of
      // them have to do it.
      //
      // @@unique([eventId, seatKey]) binds cancelled rows too, so a cancelled ticket that
      // keeps its seatKey keeps its SEAT: unsellable for the life of the show, rendering
      // as taken on the map, with nobody in it and nothing on any screen to explain why.
      //
      // seatLabel stays. The stub still says where they were going to sit.
      seatKey: null,
      sectionKey: null,
    },
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
 * Flip a reserved ticket to "activated" - this reveals the real QR on the stub.
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
