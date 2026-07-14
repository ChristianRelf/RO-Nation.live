import { formatRobux } from "@/lib/tickets/pricing";

/**
 * A price, in words.
 *
 * Four states, and collapsing any two of them is a lie:
 *
 *   forSale === false   priced, but not currently buyable.
 *   priceRobux === null Roblox gives no price at all - unpurchasable, NOT free.
 *   0                   genuinely free.
 *   n                   "5 R$".
 *
 * It lives here rather than in product-card.tsx because the product PAGE needs it
 * too, and a page importing a card component purely to format a number is how a
 * client boundary ends up somewhere nobody intended.
 */
export function priceLabel(p: {
  priceRobux: number | null;
  forSale: boolean;
}) {
  if (!p.forSale) return "Off sale";
  if (p.priceRobux === null) return "Not for sale";
  return p.priceRobux > 0 ? formatRobux(p.priceRobux) : "Free";
}
