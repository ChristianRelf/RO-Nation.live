import { priceLabel, type TierOffer } from "@/lib/tickets/pricing";

// The line-up of what's on sale, on the event page's reserve panel.
//
// Renders NOTHING for an event that just has the implicit free admission — which
// is every event that predates tiers. Adding tiers to the schema should not make
// a plain free show suddenly grow a price list that says "General Admission —
// Free" at it.

export function TierSummary({ offers }: { offers: TierOffer[] }) {
  const implicitOnly = offers.length === 1 && offers[0].id === null;
  if (implicitOnly) return null;

  return (
    <ul className="mb-4 space-y-2 border-b border-line pb-4">
      {offers.map((o) => (
        <li
          key={o.id ?? "ga"}
          className={`flex items-baseline justify-between gap-3 text-sm ${
            o.blockedReason ? "opacity-55" : ""
          }`}
        >
          <span className="min-w-0 truncate text-muted">{o.name}</span>

          <span className="flex shrink-0 items-center gap-2">
            {o.blockedReason === "soldout" ? (
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-red-400">
                Sold out
              </span>
            ) : o.blockedReason === "locked" ? (
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
                Soon
              </span>
            ) : null}
            <span
              className={`font-semibold ${
                o.priceRobux > 0 ? "text-accent" : "text-fg"
              }`}
            >
              {priceLabel(o.priceRobux)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
