import { partnerBySlug } from "@/lib/partners/registry";
import { site } from "@/lib/site";

// Whose name is on the ticket.
//
// The mark is the SAME string as the ticket code's prefix - "ST-4K9QW2" carries
// an "ST" badge - so the badge punched through the QR and the serial printed
// under it can never disagree about whose show this is.

/**
 * RNL's wordmark: white, transparent, and wide (roughly 5.6:1).
 *
 * It is drawn on the ticket's issuer bar, which is near-black under every brand
 * - that bar is `--paper-ink`, the colour the ticket's own text is printed in -
 * so a white mark is legible on all of them.
 */
const RNL_LOGO = "/brand/RNL_standard_white_clear_logo.png";

export function ticketBrand(partnerId: string | null | undefined) {
  const partner = partnerBySlug(partnerId ?? null);
  return {
    partner,
    /** Two letters, for the badge in the middle of the QR. */
    mark: partner?.ticketPrefix ?? "RN",
    /** The issuer line along the top of the ticket. */
    name: partner?.name ?? site.name,
    /**
     * The wordmark printed on the ticket's issuer bar, if this issuer has one.
     *
     * NULL falls back to the lettered badge plus the name in type - which is what
     * every partner gets today, because none of them has supplied artwork. That
     * is not a placeholder to be embarrassed about: a partner with no logo (Sleep
     * Token RO has none) is carried by type, and dropping a logo in later is one
     * field in the registry, not a redesign.
     */
    logo: partner ? (partner.logoUrl ?? null) : RNL_LOGO,
  };
}
