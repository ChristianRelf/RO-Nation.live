import { partnerBySlug } from "@/lib/partners/registry";
import { site } from "@/lib/site";

// Whose name is on the ticket.
//
// The mark is the SAME string as the ticket code's prefix — "ST-4K9QW2" carries
// an "ST" badge — so the badge punched through the QR and the serial printed
// under it can never disagree about whose show this is.

export function ticketBrand(partnerId: string | null | undefined) {
  const partner = partnerBySlug(partnerId ?? null);
  return {
    partner,
    /** Two letters, for the badge in the middle of the QR. */
    mark: partner?.ticketPrefix ?? "RN",
    /** The issuer line along the top of the ticket. */
    name: partner?.name ?? site.name,
  };
}
