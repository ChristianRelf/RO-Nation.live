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
        | "not_found";
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

  // Only the slug is needed here, and only to revalidate the right pages
  // afterwards. Everything that DECIDES anything - the tier, the caps, the money
  // wall, the event lock - now lives in lib/tickets/issue.ts, because the game
  // API issues tickets too and a second copy of the capacity check would
  // eventually oversell a room this one thinks is full.
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { slug: true, partnerId: true },
  });
  if (!event) return fail("unavailable");

  const outcome = await issueTicket({
    eventId,
    holder: { userId: session.uid },
    tierId,
    // Unscoped: this is the holder reserving for themselves on whichever site
    // they are standing on, and the event they clicked is by definition theirs to
    // click. Scope is what stops a partner's KEY reaching RNL's shows.
    mode: { kind: "reserve" },
  });

  if (!outcome.ok) {
    // Two of issueTicket's refusals cannot reach a web visitor: `no_player` needs
    // a Roblox id that Roblox has never heard of (this holder is a signed-in
    // session, so they demonstrably exist), and `not_purchasable` is a game
    // server charging for a free tier (this path charges nothing). Neither has a
    // sentence written for it, because nobody will ever read one. Fold them into
    // the generic refusal rather than putting words on a page that cannot render.
    const reason = outcome.reason;
    if (reason === "no_player" || reason === "not_purchasable") {
      return fail("unavailable");
    }
    return fail(reason);
  }

  refreshTicketViews(event.partnerId ?? null, event.slug);
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
