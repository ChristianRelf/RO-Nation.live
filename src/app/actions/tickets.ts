"use server";

import { revalidatePath } from "next/cache";
import type { TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/session";
import {
  partnerSiteRoute,
  partnerPortalUrl,
  partnerOrigin,
} from "@/lib/partners/urls";
import { issueTicket } from "@/lib/tickets/issue";
import { notify } from "@/lib/notify";
import { notifyNextWaiter } from "@/lib/waitlist";
import { rateLimit } from "@/lib/rate-limit";
import { sendTicketReservationEmail } from "@/lib/email";
import { env } from "@/lib/env";

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
        | "seat_taken"
        /** Too many reservation attempts from this holder in a short window. */
        | "rate_limited";
    };

const fail = (error: Extract<ReserveState, { ok: false }>["error"]) =>
  ({ ok: false, error }) as const;

/**
 * A shape check, nothing more - the same one HTML's own `type="email"` uses.
 * There is no verification step and none is worth adding: this address is
 * volunteered for a courtesy email, not an account, so the cost of a typo is a
 * bounce, not a locked-out holder. An invalid shape is simply dropped rather
 * than failing the checkout over a field nothing else in this system requires.
 */
const isValidEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

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

  // Optional, and never trusted for anything but where to send a courtesy
  // email - it plays no part in who the ticket belongs to or whether they get
  // one. A bad shape is dropped rather than refusing a checkout over it.
  const emailInput = String(formData.get("email") || "").trim();
  const email = emailInput && isValidEmail(emailInput) ? emailInput : null;

  const session = await getUserSession();
  if (!session) return fail("auth");

  // A burst guard, keyed on the holder. Reserving is a once-per-show act for a real
  // person, so a generous ceiling only ever catches a script hammering the endpoint -
  // it never touches a genuine buyer working through the modal. See lib/rate-limit.ts.
  const rl = await rateLimit(`reserve:${session.uid}`, {
    limit: 10,
    windowSeconds: 60,
  });
  if (!rl.ok) return fail("rate_limited");

  // The "purchase" gate: you must accept the ticket terms & conditions.
  if (!acceptedTerms) return fail("terms");

  // Everything that DECIDES anything - the tier, the caps, the money wall, the event
  // lock - lives in lib/tickets/issue.ts, because the game API issues tickets too and a
  // second copy of the capacity check would eventually oversell a room this one thinks is
  // full. issueTicket takes the id, so this lookup exists only to prove the show is real
  // before we bother it.
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    // title + partnerId are for the reservation notification below; startsAt +
    // venue are for the confirmation email; issueTicket still does all the
    // deciding from the id alone.
    select: {
      id: true,
      title: true,
      partnerId: true,
      startsAt: true,
      venue: true,
    },
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
    email,
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
    //   already_owned      the paid double-sell guard. Only `purchase` and `game_pass` can
    //                      trip it; `reserve` re-hands an existing ticket instead of refusing.
    const reason = outcome.reason;
    if (
      reason === "no_player" ||
      reason === "not_purchasable" ||
      reason === "not_paid" ||
      reason === "verify_unavailable" ||
      reason === "needs_consent" ||
      reason === "already_owned" ||
      // Presale: the button is hidden and the reserve page redirects, so a web
      // visitor should never reach this - fold it into the generic "unavailable"
      // rather than adding a web error state nothing renders. The game API still
      // gets the precise `not_on_sale` reason through issueTicket.
      reason === "not_on_sale"
    ) {
      return fail("unavailable");
    }
    return fail(reason);
  }

  // They got in - so they are no longer waiting. Drop any waitlist row they held for
  // this show, both to keep the queue clean and so a later freed seat does not ping
  // somebody who already has a ticket. Best-effort; never block the checkout on it.
  await prisma.waitlist
    .deleteMany({ where: { userId: session.uid, eventId } })
    .catch(() => {});

  // Tell the box office a seat just went. Routes to the event's partner channel
  // when it has one, else RNL's; the link points at where staff manage that show -
  // the partner's shows list on the portal host, RNL's per-event attendees page.
  // Fire-and-forget, exactly like the other public writes: notify() never throws
  // and is not awaited, so it adds nothing to the checkout the buyer is watching.
  void notify({
    partnerId: event.partnerId,
    title: `Ticket reserved · ${event.title}`,
    url: event.partnerId
      ? partnerPortalUrl(event.partnerId, "/shows")
      : `/company/events/${event.id}/attendees`,
    fields: [
      {
        name: "Holder",
        value: `${session.displayName} (@${session.username})`,
        inline: true,
      },
    ],
  });

  // The "you're going" confirmation - only when they typed one in, and only on a
  // genuinely NEW reservation. `existing` covers the double-submit case (see
  // issueTicket): re-sending on every retry of an already-reserved ticket would
  // mail somebody once per refresh. Fire-and-forget and swallows every failure
  // itself - see lib/email.ts - so a bounce or a missing Resend key can never
  // turn a successful reservation into an error the buyer sees.
  if (email && !outcome.existing) {
    void sendTicketReservationEmail({
      to: email,
      eventTitle: event.title,
      eventStartsAt: event.startsAt,
      venue: event.venue,
      ticketUrl: `${event.partnerId ? partnerOrigin(event.partnerId) : env.siteUrl}/tickets/${outcome.ticketId}`,
    });
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
    include: {
      event: { select: { slug: true, partnerId: true, startsAt: true } },
    },
  });
  if (!ticket || ticket.userId !== session.uid) return;

  // ---- What may actually be cancelled --------------------------------------
  //
  // Ownership was the ONLY thing checked here, and ownership is not enough. The
  // detail page hides this button once the holder is through the door or the show
  // has started - but a hidden button is not an enforcement, it is a decoration on
  // one of several ways to reach this action.
  //
  // Cancelling a CHECKED_IN ticket is the one that actually costs something: it
  // overwrites the status that says they turned up and NULLs the seat they were
  // sitting in, so an attendance record becomes a void ticket with no way back.
  // checkedInAt survives, which is the only reason the damage is recoverable at all.
  //
  // And a show that has already started is not a spot anyone can be given, so
  // "freeing it for someone else" is not true after curtain-up.
  //
  // The status guard also doubles as the lock, same as in redeemTicket(): put it in
  // the WHERE and two concurrent submits produce one cancellation, not two.
  if (ticket.status !== "RESERVED") return;
  if (ticket.event.startsAt.getTime() <= Date.now()) return;

  const { count } = await prisma.ticket.updateMany({
    where: { id: ticket.id, status: "RESERVED" },
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

  // Lost the race - somebody else's submit got there first. Nothing changed, so
  // there is nothing to revalidate.
  if (count === 0) return;

  // A seat just came back. Tell the next person waiting for this show - best-effort,
  // and never allowed to turn a successful cancel into an error the holder sees.
  await notifyNextWaiter(ticket.eventId).catch(() => {});

  const { partnerId, slug } = ticket.event;
  refreshTicketViews(partnerId, slug);
  revalidatePath(
    partnerId
      ? partnerSiteRoute(partnerId, `/tickets/${ticket.id}`)
      : `/tickets/${ticket.id}`,
  );
}

/**
 * "Has anything happened to my ticket?" - asked on a loop by the holder's own page
 * while doors are open.
 *
 * ---- Why this exists at all ----------------------------------------------
 *
 * CHECK-IN IS SILENT. The holder does nothing: they join the experience, the game
 * server calls /api/v1/tickets/redeem with their Roblox id, and the row flips to
 * CHECKED_IN somewhere they cannot see. Their ticket page - server-rendered once,
 * with no live channel of any kind on this site - goes on saying "doors are open"
 * for as long as the tab stays open. The one moment the ticket does its job is the
 * one moment the ticket never mentions.
 *
 * ---- Why it returns almost nothing ---------------------------------------
 *
 * This is a read a hostile caller can hammer, and unlike the page it has no
 * rendering to hide behind - whatever it returns, it returns in full, in JSON, on
 * demand. So it returns the smallest true thing: two facts that the caller, who by
 * definition owns this ticket, could already see by refreshing.
 *
 * NEVER the code, the seal, or the reason for anything. The moment the answer needs
 * to be richer than this, the right move is to let the PAGE re-render - it already
 * knows how to decide what this holder may see - which is exactly what the client
 * does with router.refresh() when the answer here changes.
 */
export async function ticketPulse(
  ticketId: string,
): Promise<{ status: TicketStatus; checkedIn: boolean } | null> {
  const session = await getUserSession();
  if (!session) return null;

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { userId: true, status: true, checkedInAt: true },
  });

  // Same ownership rule as every other action here, and the same answer for "not
  // yours" as for "not there": null. A poller that could tell the two apart would
  // be a way to ask whether a ticket id exists.
  if (!ticket || ticket.userId !== session.uid) return null;

  return { status: ticket.status, checkedIn: Boolean(ticket.checkedInAt) };
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
