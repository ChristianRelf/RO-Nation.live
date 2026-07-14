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
  const clash = await prisma.ticketTier.findFirst({
    where: {
      gamePassId: id,
      ...(eventId ? { eventId: { not: eventId } } : {}),
    },
    select: { name: true, event: { select: { title: true } } },
  });

  return {
    ok: true,
    name: details.pass.name,
    priceRobux: details.pass.priceRobux,
    forSale: details.pass.forSale,
    takenBy: clash ? `${clash.event.title} - ${clash.name}` : null,
  };
}

export async function verifyCompanyGamePass(
  _prev: VerifyPassState | null,
  formData: FormData,
): Promise<VerifyPassState> {
  await requireCompanyUser();
  return verify(
    String(formData.get("gamePassId") || ""),
    String(formData.get("eventId") || ""),
  );
}

export async function verifyPartnerGamePass(
  _prev: VerifyPassState | null,
  formData: FormData,
): Promise<VerifyPassState> {
  await requirePartnerManager(String(formData.get("scope") || ""));
  return verify(
    String(formData.get("gamePassId") || ""),
    String(formData.get("eventId") || ""),
  );
}
