import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { isPast } from "@/lib/format";
import { partnerBySlug } from "@/lib/partners/registry";
import { resolveRobloxUser } from "@/lib/roblox-users";
import { generateTicketCode } from "@/lib/utils";
import { effectiveTiers, robuxSalesAllowed } from "@/lib/tickets/pricing";

// The one place that decides whether somebody GETS a ticket.
//
// Its sibling, verify.ts, decides whether a ticket gets somebody through the
// door. Between them they are the whole of ticketing, and both are shared by the
// website and the game API for the same reason: a checkout that oversells a room
// the door then turns people away from is worse than either one being wrong on
// its own. Two copies of a capacity check eventually disagree. There is one.
//
// Everything below runs inside a lock on the event row (SELECT … FOR UPDATE), so
// two people reserving the last seat at the same instant queue rather than both
// reading "1 left". That lock is the reason this file exists as a function and not
// as three copy-pasted transactions.
//
// ---- The three ways a ticket comes into existence -------------------------
//
//   reserve   The holder took it themselves. The website's checkout, and a game
//             server acting for a player who is standing in front of it. Free
//             tiers only.
//
//   gift      Somebody GAVE it to them — a giveaway bot, a crew comp, a player
//             buying one for a friend. May be a paid tier, and no money changes
//             hands: that is what a comp is. It is recorded on the ticket
//             (issuedBy…) so a VIP nobody paid for is never a mystery.
//
//   purchase  Somebody PAID for it, in Robux, inside the experience. See the long
//             note on TicketPurchase in schema.prisma — we cannot verify the
//             payment and we are not pretending to. What we can do, and do, is
//             refuse to honour the same PurchaseId twice.

export type IssueReason =
  | "ok"
  /** No such event — or it is not this key's org's, which is the same answer. */
  | "not_found"
  /** The event exists but is not on sale: DRAFT or ARCHIVED. */
  | "unavailable"
  | "past"
  /** No such tier on this event, or it has been deactivated. */
  | "badtier"
  | "soldout"
  | "tier_soldout"
  /** Roblox does not know this player. */
  | "no_player"
  /** They were revoked from this show. A ban, not a full room. See below. */
  | "revoked"
  /** A priced tier, and Robux sales are off. Nobody can buy this today. */
  | "payments_off"
  /** A priced tier, reached by a path that collects no money. Use /purchase. */
  | "payment_required"
  /** /purchase, but the tier is free. Nothing to pay for — do not charge them. */
  | "not_purchasable";

export type IssueOutcome =
  | {
      ok: true;
      ticketId: string;
      /**
       * True when no new ticket was created — they already held one, or this was
       * a PurchaseId we had already honoured.
       *
       * The caller needs this and must not treat it as a failure. A game server
       * retrying a dropped /purchase call gets `existing: true` and the ticket it
       * paid for, which is precisely what a retry should get.
       */
      existing: boolean;
    }
  | { ok: false; reason: Exclude<IssueReason, "ok"> };

const fail = (reason: Exclude<IssueReason, "ok">) =>
  ({ ok: false, reason }) as const;

/** How the ticket is being handed over. See the note above. */
export type IssueMode =
  | { kind: "reserve" }
  | {
      kind: "gift";
      /** Who gave it. A Roblox id — a player, or a crew member. */
      byRobloxId: string;
      byName: string;
    }
  | {
      kind: "purchase";
      /** Roblox's own PurchaseId, from ProcessReceipt. The idempotency key. */
      purchaseId: string;
      robuxSpent: number;
      placeId?: string | null;
      productId?: string | null;
      /** The key that asserted the payment. The audit trail for that assertion. */
      apiKeyId?: string | null;
    };

export type IssueInput = {
  eventId: string;
  /** Our own User.id (the website has one) — or a Roblox id (the game has that). */
  holder: { userId: string } | { robloxId: string };
  /** null / "" = the implicit free General Admission. */
  tierId?: string | null;
  /**
   * Which org's events this caller may issue for. Same contract as
   * LookupInput.scope in verify.ts:
   *
   *   undefined   don't scope. The root key only.
   *   null        RNL's own shows.
   *   "<slug>"    that partner's, and nothing else.
   *
   * An event outside the scope answers "not_found" — never "not yours", which
   * would confirm the event exists to somebody with no business knowing.
   */
  scope?: string | null;
  mode: IssueMode;
};

const isCodeCollision = (err: any) =>
  err?.code === "P2002" && err?.meta?.target?.includes?.("code");

const isPurchaseReplay = (err: any) =>
  err?.code === "P2002" && err?.meta?.target?.includes?.("purchaseId");

const isDuplicateUser = (err: any) =>
  err?.code === "P2002" && err?.meta?.target?.includes?.("robloxId");

/**
 * Find, or create, the User row a ticket will hang off.
 *
 * The website always has one — you cannot reach the checkout without signing in.
 * The GAME does not: a player standing in a partner's experience may never have
 * opened ronation.live in their life, and refusing them a ticket on that basis
 * would be absurd. So their Roblox profile is resolved and a User row is created
 * for them, exactly as the OAuth callback would have.
 *
 * Resolved against Roblox rather than trusted from the request: the game sends an
 * id, and the username we store must be the one Roblox says goes with it, not one
 * the caller typed. Falls back to whatever we already hold if Roblox is having a
 * bad minute — a stale display name is not a reason to refuse somebody a ticket.
 *
 * The create RACES, and has to survive it. Two game servers greeting the same
 * first-time player at the same instant — or Roblox re-delivering one receipt while
 * the first is still in flight — both read "no such user" and both insert. One
 * wins; the other must pick up the winner's row rather than dying on the unique
 * constraint and handing a 500 to somebody who has already paid.
 */
async function resolveHolderUserId(
  holder: { userId: string } | { robloxId: string },
): Promise<string | null> {
  if ("userId" in holder) return holder.userId;

  const robloxId = String(holder.robloxId).trim();
  if (!/^\d{1,20}$/.test(robloxId)) return null;

  const existing = await prisma.user.findUnique({ where: { robloxId } });
  if (existing) return existing.id;

  const profile = await resolveRobloxUser(robloxId);
  if (!profile) return null; // Roblox has never heard of them.

  try {
    const created = await prisma.user.create({
      data: {
        robloxId,
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        profileUrl: `https://www.roblox.com/users/${robloxId}/profile`,
      },
    });
    return created.id;
  } catch (err) {
    // Lost the race. The row we were about to write now exists, written by
    // somebody else, and it is exactly the row we wanted. Take theirs.
    if (isDuplicateUser(err)) {
      const raced = await prisma.user.findUnique({ where: { robloxId } });
      if (raced) return raced.id;
    }
    throw err;
  }
}

/**
 * Issue a ticket.
 *
 * Every refusal is a `reason`, never a throw — the callers are a form and a game
 * server, and neither of them can do anything useful with a stack trace. The one
 * exception is a code generator that cannot find a free code in five tries, which
 * is a broken generator and not a user error.
 */
export async function issueTicket(input: IssueInput): Promise<IssueOutcome> {
  const { eventId, mode } = input;

  // ---- A payment we have already honoured -------------------------------
  //
  // Checked FIRST, before anything else can refuse it. ProcessReceipt is
  // at-least-once: Roblox re-delivers a receipt until the game says it granted,
  // and a game server that crashed mid-call will send the same PurchaseId again.
  // By then the show may be sold out, or past, or the tier deactivated — and none
  // of that is a reason to tell somebody who has already been charged that they
  // have no ticket. They have one. Hand it back.
  if (mode.kind === "purchase") {
    const settled = await prisma.ticketPurchase.findUnique({
      where: { purchaseId: mode.purchaseId },
      select: { ticketId: true },
    });
    if (settled) return { ok: true, ticketId: settled.ticketId, existing: true };
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, partnerId: true, tiers: true },
  });
  if (!event) return fail("not_found");

  // Scope. An event belonging to another org is "not_found", full stop — see the
  // note on IssueInput.scope.
  const partnerId = event.partnerId ?? null;
  if (input.scope !== undefined && partnerId !== input.scope) {
    return fail("not_found");
  }

  const partner = partnerBySlug(partnerId);
  const prefix = partner?.ticketPrefix ?? "RN";

  // The tier is resolved against THIS event's own tiers, so an id from another
  // show — or an invented one — matches nothing and never reaches the insert.
  const tiers = effectiveTiers(event.tiers);
  const tier = tiers.find((t) => (t.id ?? "") === (input.tierId ?? ""));
  if (!tier) return fail("badtier");

  // ---- The money wall ----------------------------------------------------
  const robuxAllowed = robuxSalesAllowed(partner, env.robuxTickets);

  if (tier.priceRobux > 0) {
    // A priced tier, and Robux sales are off — globally, or for this partner.
    // Nobody may have this tier today, by any route. Not even a gift: a comped
    // VIP seat to a tier that is not supposed to exist yet is still a VIP seat.
    if (!robuxAllowed) return fail("payments_off");

    // A priced tier reached by a path that collects nothing. The website's
    // checkout lands here, and the answer is: this is bought in the experience,
    // through /purchase, because Robux cannot be charged from a web page.
    //
    // This branch replaces the throw that used to live in app/actions/tickets.ts
    // — the one whose comment said "this throw is the line the payment work
    // deletes". This is that deletion. Gifts pass, because a gift is a comp and
    // charges nobody.
    if (mode.kind === "reserve") return fail("payment_required");
  } else if (mode.kind === "purchase") {
    // Free tier, and somebody says they paid for it. Something is wrong on the
    // game's side — refuse rather than take the money and issue what they could
    // have had for nothing.
    return fail("not_purchasable");
  }

  const userId = await resolveHolderUserId(input.holder);
  if (!userId) return fail("no_player");

  // What they hold is frozen at issue and never looked up again: renaming or
  // re-pricing the tier tomorrow must not rewrite the ticket they hold today.
  const held = {
    tierId: tier.id,
    tierName: tier.name,
    priceRobux: tier.priceRobux,
    termsAcceptedAt: new Date(),
    ...(mode.kind === "gift"
      ? { issuedByRobloxId: mode.byRobloxId, issuedByName: mode.byName }
      : {}),
  };

  // The code is minted outside the transaction, and a collision retries the whole
  // thing. It cannot be retried *inside*: in Postgres a failed statement aborts
  // the surrounding transaction, so the second attempt would die on the poisoned
  // transaction rather than on the duplicate code.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateTicketCode(prefix);
    try {
      return await prisma.$transaction(async (tx) => {
        // Take a write lock on the event row and hold it to commit. Everyone
        // reserving for this event now queues here, so no two requests can both
        // read `capacity - 1` and both insert. It serialises per event, so other
        // events are unaffected — and unlike a Serializable transaction there is
        // no retry loop to get wrong. The tier counts below are read under this
        // same lock, which is what makes a per-tier cap hold as tightly as the
        // room's own.
        const rows = await tx.$queryRaw<
          { id: string; capacity: number; status: string; startsAt: Date }[]
        >`SELECT id, capacity, status, "startsAt" FROM events WHERE id = ${eventId} FOR UPDATE`;

        const ev = rows[0];
        if (!ev || ev.status !== "PUBLISHED") return fail("unavailable");
        if (isPast(ev.startsAt)) return fail("past");

        const existing = await tx.ticket.findUnique({
          where: { eventId_userId: { eventId, userId } },
        });

        // ---- Revoked --------------------------------------------------
        //
        // The stamp survives cancellation precisely so it can be read here. This
        // person was thrown off this show by name, and handing them a fresh
        // ticket the moment they ask again would make the revoke a gesture.
        // Un-revoking is a deliberate act in the portal, not a side effect of
        // them clicking Reserve.
        if (existing?.revokedAt) return fail("revoked");

        // ---- They already hold one ------------------------------------
        if (existing && existing.status !== "CANCELLED") {
          // A purchase is not a no-op. They have been CHARGED. Silently handing
          // back the ticket they already had would be taking Robux for nothing —
          // so the payment lands on the ticket they hold, upgrading its tier. It
          // is the same ticket (one per person per event, always), now VIP.
          if (mode.kind === "purchase") {
            await tx.ticket.update({
              where: { id: existing.id },
              data: { tierId: tier.id, tierName: tier.name, priceRobux: tier.priceRobux },
            });
            await tx.ticketPurchase.create({
              data: {
                purchaseId: mode.purchaseId,
                ticketId: existing.id,
                robuxSpent: mode.robuxSpent,
                apiKeyId: mode.apiKeyId ?? null,
                placeId: mode.placeId ?? null,
                productId: mode.productId ?? null,
              },
            });
            return { ok: true as const, ticketId: existing.id, existing: true };
          }

          // Reserve and gift are idempotent instead: you cannot hold two tickets
          // to one show, and asking twice is not an error. Under the lock, so a
          // double-submit resolves to the same ticket rather than a unique-
          // constraint explosion.
          return { ok: true as const, ticketId: existing.id, existing: true };
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

        // Re-activate a cancelled ticket, or create a fresh one. Re-reserving
        // re-picks the tier, so the frozen snapshot is rewritten with it.
        const ticketId = existing
          ? (
              await tx.ticket.update({
                where: { id: existing.id },
                data: { status: "RESERVED", ...held },
              })
            ).id
          : (
              await tx.ticket.create({
                data: { eventId, userId, code, status: "RESERVED", ...held },
              })
            ).id;

        if (mode.kind === "purchase") {
          await tx.ticketPurchase.create({
            data: {
              purchaseId: mode.purchaseId,
              ticketId,
              robuxSpent: mode.robuxSpent,
              apiKeyId: mode.apiKeyId ?? null,
              placeId: mode.placeId ?? null,
              productId: mode.productId ?? null,
            },
          });
        }

        return { ok: true as const, ticketId, existing: false };
      });
    } catch (err) {
      // Two calls with the same PurchaseId, racing. One committed; this one lost
      // on the unique constraint, which is the constraint doing its job. Re-read
      // and hand back the ticket the winner created.
      if (isPurchaseReplay(err) && mode.kind === "purchase") {
        const settled = await prisma.ticketPurchase.findUnique({
          where: { purchaseId: mode.purchaseId },
          select: { ticketId: true },
        });
        if (settled) {
          return { ok: true, ticketId: settled.ticketId, existing: true };
        }
      }
      if (isCodeCollision(err)) continue;
      throw err;
    }
  }

  // Five collisions in a 31^6 space is not bad luck, it is a broken generator.
  // Throw rather than hand back a code no ticket was ever issued under.
  throw new Error("Could not allocate a unique ticket code after 5 attempts");
}

// ---- Taking a ticket away --------------------------------------------------

export type VoidOutcome =
  | { ok: true; ticketId: string; banned: boolean; alreadyVoid: boolean }
  | { ok: false; reason: "not_found" | "checked_in" };

/**
 * Void a ticket, or revoke it.
 *
 * They are the same write plus one column, and the difference is entirely in what
 * happens NEXT — which is why they are one function and not two:
 *
 *   void    (ban: false)  Cancel it. The undo. Issued to the wrong player, a
 *                         duplicate, a change of plan. They may reserve again
 *                         immediately, exactly as if they had cancelled it
 *                         themselves.
 *
 *   revoke  (ban: true)   Cancel it AND stamp revokedAt, which issueTicket()
 *                         reads and refuses over. The problem is the person, not
 *                         the ticket. It bans them from THIS SHOW — a standing
 *                         ban across every show is the blacklist, which is a
 *                         different question with a different answer.
 *
 * A CHECKED_IN ticket is refused. They are already inside the room; cancelling
 * the ticket does not get them out of it, and it would leave the door's own
 * record saying somebody who never came in did. Whoever is asking for this wants
 * security, not a database write.
 */
export async function voidTicket(input: {
  ticketId: string;
  ban: boolean;
  reason?: string | null;
  actorName: string;
}): Promise<VoidOutcome> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: input.ticketId },
    select: { id: true, status: true, revokedAt: true },
  });
  if (!ticket) return { ok: false, reason: "not_found" };
  if (ticket.status === "CHECKED_IN") return { ok: false, reason: "checked_in" };

  const alreadyVoid = ticket.status === "CANCELLED";

  await prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      status: "CANCELLED",
      // Revoking an already-voided ticket upgrades it to a ban, which is a real
      // thing somebody will want to do. Voiding an already-REVOKED one does NOT
      // silently lift the ban — clearing it is its own deliberate act.
      ...(input.ban
        ? {
            revokedAt: ticket.revokedAt ?? new Date(),
            revokedReason: input.reason?.trim() || null,
            revokedByName: input.actorName,
          }
        : {}),
    },
  });

  return {
    ok: true,
    ticketId: ticket.id,
    banned: input.ban || Boolean(ticket.revokedAt),
    alreadyVoid,
  };
}

/** Lift a revocation. The holder may reserve again; the ticket stays cancelled. */
export async function unrevokeTicket(ticketId: string) {
  await prisma.ticket.updateMany({
    where: { id: ticketId },
    data: { revokedAt: null, revokedReason: null, revokedByName: null },
  });
}
