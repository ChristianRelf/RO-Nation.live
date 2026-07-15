"use server";

import { requireCompanyUser } from "@/lib/company";
import { requirePartnerManager } from "@/lib/partners/guard";
import { prisma } from "@/lib/db";
import { gamePassDetails } from "@/lib/roblox-gamepass";

// "Verify pass" - the button that catches a wrong game pass id NOW rather than at the show.
//
// It answers three questions, and each one is a real failure somebody would otherwise find
// out about the hard way:
//
//   Is it real?          A typo'd id is a checkout that sends every buyer to a 404 on
//                        roblox.com. Nobody can pay, and the page they land on does not say
//                        why.
//
//   Is it for sale?      A pass with `IsForSale: false` cannot be bought by anybody. The
//                        tier looks perfect from here and sells nothing, all night.
//
//   Is it ALREADY USED?  The dangerous one. A pass is owned FOREVER. Paste last month's VIP
//                        pass onto this month's show and every single person who bought a
//                        ticket last month walks into this one FREE - verified, waved
//                        through by our own ownership check, which is working exactly as
//                        designed. TicketTier.gamePassId is @unique to make that impossible,
//                        and this button is that constraint asked politely, before the save.
//
// TWO exports, one guard each - the rule actions/venue.ts states plainly. The CLIENT picks
// which one to call, and that is fine: each one independently PROVES the caller's authority
// rather than believing a string they sent. A partner manager calling the company one is
// bounced by requireCompanyUser, and vice versa.

export type VerifyPassState =
  | {
      ok: true;
      name: string;
      /** Null means Roblox gave no price - which is NOT free, it is off-sale. */
      priceRobux: number | null;
      forSale: boolean;
      /** Already on another tier. The expensive mistake. */
      takenBy: string | null;
    }
  | { ok: false; reason: "not_found" | "unavailable" | "empty" };

async function verify(
  gamePassId: string,
  eventId: string,
  // The caller's authorised scope: a partner's slug, or null for RNL/company
  // (authorised platform-wide). Used only to decide whether the clash below may
  // be NAMED - the existence check itself is always global.
  callerScope: string | null,
): Promise<VerifyPassState> {
  const id = gamePassId.trim();
  if (!id) return { ok: false, reason: "empty" };

  // gamePassDetails, NOT assetDetails() from lib/merch/roblox.ts. That one hits
  // economy.roblox.com/v2/assets, which answers for CATALOG assets - and a game pass is not
  // one. Point it at a pass id and it returns `unavailable` for every real, working,
  // correctly-configured pass in existence, and nobody would ever work out why.
  const details = await gamePassDetails(id);
  if (!details.ok) return { ok: false, reason: details.reason };

  // Is any OTHER tier already carrying this pass? Scoped away from this event's own tiers,
  // because a tier that already has the pass saved is not colliding with itself.
  //
  // gamePassId is globally @unique, so this existence check MUST be global - it has
  // to catch a clash on RNL's or another partner's tier. But a partner manager has
  // no business learning another org's event and tier NAMES from it (game-pass ids
  // are public, enumerable integers, so this would otherwise be a cross-tenant
  // metadata probe). Name the clash only when it belongs to the caller's own scope;
  // otherwise report it generically so they still know the id is unusable.
  const clash = await prisma.ticketTier.findFirst({
    where: {
      gamePassId: id,
      ...(eventId ? { eventId: { not: eventId } } : {}),
    },
    select: { name: true, event: { select: { title: true, partnerId: true } } },
  });

  const clashIsOwn =
    clash !== null &&
    (callerScope === null || (clash.event.partnerId ?? null) === callerScope);

  return {
    ok: true,
    name: details.pass.name,
    priceRobux: details.pass.priceRobux,
    forSale: details.pass.forSale,
    takenBy: clash
      ? clashIsOwn
        ? `${clash.event.title} - ${clash.name}`
        : "another show on the platform"
      : null,
  };
}

export async function verifyCompanyGamePass(
  _prev: VerifyPassState | null,
  formData: FormData,
): Promise<VerifyPassState> {
  await requireCompanyUser();
  // RNL/company is authorised platform-wide, so it may see any clash by name.
  return verify(
    String(formData.get("gamePassId") || ""),
    String(formData.get("eventId") || ""),
    null,
  );
}

export async function verifyPartnerGamePass(
  _prev: VerifyPassState | null,
  formData: FormData,
): Promise<VerifyPassState> {
  const user = await requirePartnerManager(String(formData.get("scope") || ""));
  // Scope the clash to the partner the guard actually approved - user.partner.slug,
  // not the raw form string - so a clash on another org's tier is not named back.
  return verify(
    String(formData.get("gamePassId") || ""),
    String(formData.get("eventId") || ""),
    user.partner.slug,
  );
}
