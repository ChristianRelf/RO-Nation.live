"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { createIntent, releaseHold, type HoldState } from "@/app/actions/purchase";
import { tierColour } from "@/lib/venue/colors";
import type { VenueLayout } from "@/lib/venue/schema";
import { bounds, sectionCapacity, sectionsForTier } from "@/lib/venue/seats";
import { VenueMap } from "./venue-map";
import { HoldBar } from "./hold-bar";

// The seat picker. The surface the whole venue system exists to put on a screen.
//
// Two panes: the map on the left, the sections and the price legend on the right, hover
// linked in both directions. Click a block to go into it, click a chair to hold it.
//
// ---- The hold is taken the moment they pick, not at checkout ----------------
//
// Clicking a seat CREATES A HOLD, immediately, before they have agreed to anything. That is
// what Ticketmaster does and it is what intents.ts is built for: its "one live hold per
// person per event" rule cancels your previous hold rather than refusing the new one,
// precisely because changing your mind about a seat is the most ordinary thing a person
// does on a seat map. Hold at Continue instead and the ten minutes start after they have
// finished deciding, which is the half of the journey that does not need protecting.
//
// ---- The map is stale, and that is correct ---------------------------------
//
// `taken` and `held` come from seatAvailability(), which is deliberately NOT locked (a
// thousand browsers must not queue behind one person's checkout). So a buyer can click a
// seat that went half a second ago. What happens then is not a double sale: createIntent
// takes the row lock, finds the seat gone, and hands them the next best one - and the bar
// then names the seat they actually got. The staleness costs one surprise. It cannot cost
// anybody a chair.
//
// ---- Best available does not compute anything -------------------------------
//
// The button sends NO seat key, and that is the strongest possible version of the rule that
// it "must call the same bestAvailableOrder() the server uses". It does not call it at all:
// resolveSeat reads a null seat as "give them the best available" and walks that exact
// order, under the lock, against the live taken set. A client-side copy could only ever be
// a second opinion, and a second opinion is a thing that eventually disagrees.

type Tier = { id: string; name: string; priceRobux: number };

type Availability = {
  taken: string[];
  held: string[];
  sections: { key: string; taken: number; capacity: number }[];
};

const ERRORS: Record<string, string> = {
  auth: "Your session expired. Sign in again to pick a seat.",
  seat_taken: "Those seats have just gone. Try another block, or another tier.",
  tier_soldout: "That tier sold out while you were choosing.",
  soldout: "This show just sold out.",
  already_holds: "You already have a ticket for this show.",
  revoked: "Your ticket for this show was revoked. Contact the organisers.",
  past: "This show has already taken place.",
  badtier: "That ticket type isn't available for this show.",
  unavailable: "This show isn't taking reservations right now.",
  not_found: "This show isn't taking reservations right now.",
};

const message = (error: string) =>
  ERRORS[error] ?? "We couldn't hold that seat. Try another.";

export function SeatPicker({
  eventId,
  layout,
  seatMode,
  tierId,
  tierName,
  price,
  tiers,
  availability,
  checkoutHref,
  reserveHref,
}: {
  eventId: string;
  layout: VenueLayout;
  seatMode: "SECTION" | "SEAT";
  /** "" is the implicit General Admission tier, the same string its radio submits. */
  tierId: string;
  tierName: string;
  price: string;
  /** Every tier, for the legend. The colour is the price band. */
  tiers: Tier[];
  availability: Availability;
  /** /events/<slug>/checkout, on whichever host we are standing on. */
  checkoutHref: string;
  reserveHref: string;
}) {
  const router = useRouter();

  const [hold, setHold] = useState<Extract<HoldState, { ok: true }> | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const taken = useMemo(() => new Set(availability.taken), [availability.taken]);
  const held = useMemo(() => new Set(availability.held), [availability.held]);

  const load = useMemo(
    () => new Map(availability.sections.map((s) => [s.key, s])),
    [availability.sections],
  );

  // The colour of a price band is its INDEX among the tiers, so the legend and the map
  // cannot disagree about which blue means twenty Robux. Keyed by tier id; the implicit
  // tier has no id and no colour, and its sections fall back to --seat-free-rgb.
  const tierIndex = useMemo(
    () => new Map(tiers.filter((t) => t.id).map((t, i) => [t.id, i])),
    [tiers],
  );

  // The sections this buyer's tier actually owns. Everything else on the map is drawn, and
  // dimmed, and inert - they can see the shape of the room without being able to click a
  // chair the allocator would refuse them.
  const mine = useMemo(
    () => sectionsForTier(layout, tierId || null),
    [layout, tierId],
  );

  const mineKeys = useMemo(() => new Set(mine.map((s) => s.key)), [mine]);

  const dimmed = useMemo(
    () =>
      new Set(
        layout.shapes
          .filter(
            (s) =>
              (s.kind === "SEATED_SECTION" || s.kind === "STANDING_AREA") &&
              !mineKeys.has(s.key),
          )
          .map((s) => s.key),
      ),
    [layout.shapes, mineKeys],
  );

  // Zoomed into a block: the viewBox becomes that block's own bounds, padded. Without the
  // padding the outermost chairs sit exactly on the edge of the picture and are impossible
  // to click.
  const view = useMemo(() => {
    if (!focused) return null;
    const shape = layout.shapes.find((s) => s.key === focused);
    if (!shape) return null;

    const b = bounds(shape.geom);
    const pad = Math.max(b.w, b.h) * 0.14;
    return { x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 };
  }, [focused, layout.shapes]);

  /** Take a hold. The one path to a held seat - the map, the list and the button share it. */
  async function take(opts: { seat?: string; section?: string }) {
    setBusy(true);
    setError(null);

    const form = new FormData();
    form.set("eventId", eventId);
    form.set("tierId", tierId);
    if (opts.seat) form.set("seat", opts.seat);
    if (opts.section) form.set("section", opts.section);

    const result = await createIntent(null, form);

    if (!result.ok) {
      setError(message(result.error));
      setBusy(false);
      // The map is why they clicked a dead seat. Re-read it, so the next click is aimed at
      // something that is still there.
      router.refresh();
      return;
    }

    setHold(result);
    // The seat they were GIVEN, which is not always the seat they asked for - the block it
    // is in is the one to be looking at.
    if (result.sectionKey) setFocused(result.sectionKey);
    setBusy(false);
    router.refresh();
  }

  async function release() {
    if (!hold) return;
    setBusy(true);

    const form = new FormData();
    form.set("token", hold.token);
    await releaseHold(form);

    setHold(null);
    setBusy(false);
    router.refresh();
  }

  /**
   * Their hold ran out while they were sitting here.
   *
   * The row is already dead on the server; this only has to stop the page pretending
   * otherwise. Clearing it and re-reading the map is the honest thing - the seat is
   * genuinely somebody else's to take now, and it may already be gone.
   */
  function expire() {
    setHold(null);
    setError("Your hold expired and the seat went back on sale. Pick another.");
    router.refresh();
  }

  function go() {
    if (!hold) return;
    setBusy(true);

    // A real document navigation, not a router push - the checkout page is the end of this
    // flow and on a partner's site only a real navigation runs the middleware. Same choice,
    // and the same reason, as the end of checkout-processing.tsx.
    const url = `${checkoutHref}?tier=${encodeURIComponent(tierId)}&agreed=1&intent=${encodeURIComponent(hold.token)}`;
    window.location.assign(url);
  }

  return (
    <div>
      {error ? (
        <p className="mb-5 rounded-brand border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        {/* ---- The map ---- */}
        <div className="card relative overflow-hidden p-2 sm:p-4">
          <div className="aspect-[10/7] w-full">
            <VenueMap
              layout={layout}
              tierIndex={tierIndex}
              taken={taken}
              held={held}
              selected={hold?.seatKey ?? null}
              focused={seatMode === "SEAT" ? focused : null}
              sellable={mineKeys}
              dimmed={dimmed}
              view={view}
              onSectionHover={setHovered}
              onSectionClick={(key) => {
                if (busy) return;
                // SEAT mode: a click on a block goes INTO it. The chairs only mount when a
                // section is focused, which is the one rule that keeps a 2,000-seat room
                // smooth - see venue-map.tsx.
                if (seatMode === "SEAT") {
                  setFocused(key);
                  return;
                }
                // SECTION mode: there are no chairs. The block IS the thing you buy.
                void take({ section: key });
              }}
              onSeatClick={(seatKey) => {
                if (busy) return;
                if (taken.has(seatKey) || held.has(seatKey)) return;
                void take({ seat: seatKey });
              }}
            />
          </div>

          {focused ? (
            <button
              type="button"
              onClick={() => setFocused(null)}
              className="absolute left-4 top-4 rounded-brand border border-line bg-bg/90 px-3 py-1.5 text-xs font-semibold backdrop-blur transition-colors hover:border-accent"
            >
              ← Whole venue
            </button>
          ) : null}
        </div>

        {/* ---- The list ---- */}
        <div className="space-y-5">
          <div className="card p-5">
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-kicker text-faint">
                  Your ticket
                </p>
                <p className="display truncate text-lg">{tierName}</p>
              </div>
              <p className="shrink-0 text-sm font-bold text-accent">{price}</p>
            </div>

            <a
              href={reserveHref}
              className="mt-2 inline-block text-xs text-faint underline-offset-2 transition-colors hover:text-fg hover:underline"
            >
              Change ticket type
            </a>

            <button
              type="button"
              onClick={() => void take({})}
              disabled={busy}
              className="btn btn-accent mt-4 w-full disabled:cursor-not-allowed disabled:opacity-40"
            >
              Best available
            </button>
            <p className="mt-2 text-center text-xs text-faint">
              The best seat left in this tier, chosen for you.
            </p>
          </div>

          <div className="card p-5">
            <p className="text-[10px] font-bold uppercase tracking-kicker text-faint">
              {seatMode === "SEAT" ? "Blocks" : "Areas"}
            </p>

            {mine.length === 0 ? (
              <p className="mt-3 text-sm text-muted">
                No seats are mapped for this tier.
              </p>
            ) : (
              <ul className="mt-3 space-y-1">
                {mine.map((s) => {
                  const capacity = sectionCapacity(s);
                  const gone = load.get(s.key)?.taken ?? 0;
                  const left = capacity > 0 ? Math.max(0, capacity - gone) : null;
                  const full = left === 0;
                  const isHot = hovered === s.key || focused === s.key;

                  return (
                    <li key={s.key}>
                      <button
                        type="button"
                        disabled={busy || full}
                        onMouseEnter={() => setHovered(s.key)}
                        onMouseLeave={() => setHovered(null)}
                        onClick={() =>
                          seatMode === "SEAT"
                            ? setFocused(s.key)
                            : void take({ section: s.key })
                        }
                        className={cn(
                          "flex w-full items-center gap-3 rounded-brand border px-3 py-2.5 text-left transition-colors",
                          full
                            ? "cursor-not-allowed border-line opacity-50"
                            : isHot
                              ? "border-accent bg-accent-soft"
                              : "border-line hover:border-line-strong",
                        )}
                      >
                        <span
                          aria-hidden
                          className="h-3 w-3 shrink-0 rounded-sm"
                          style={{
                            // The section's own price band, straight off the CSS channel -
                            // never a hex. A partner's theme repaints this for free.
                            background: s.tierId
                              ? tierColour(tierIndex.get(s.tierId) ?? 0)
                              : "rgb(var(--seat-free-rgb))",
                          }}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {s.name}
                        </span>
                        <span className="tnum shrink-0 text-xs text-muted">
                          {full ? "Full" : left === null ? "Open" : `${left} left`}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {tiers.length > 1 ? (
            <div className="card p-5">
              <p className="text-[10px] font-bold uppercase tracking-kicker text-faint">
                Prices
              </p>
              <ul className="mt-3 space-y-2">
                {tiers.map((t) => (
                  <li
                    key={t.id || "ga"}
                    className={cn(
                      "flex items-center gap-3 text-sm",
                      (t.id ?? "") === tierId ? "text-fg" : "text-faint",
                    )}
                  >
                    <span
                      aria-hidden
                      className="h-3 w-3 shrink-0 rounded-sm"
                      style={{
                        background: t.id
                          ? tierColour(tierIndex.get(t.id) ?? 0)
                          : "rgb(var(--seat-free-rgb))",
                      }}
                    />
                    <span className="min-w-0 flex-1 truncate">{t.name}</span>
                    <span className="tnum shrink-0">
                      {t.priceRobux > 0 ? `${t.priceRobux} R$` : "Free"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      {hold ? (
        <HoldBar
          seatLabel={hold.seatLabel}
          tierName={tierName}
          price={price}
          expiresAt={hold.expiresAt}
          onExpire={expire}
          onRelease={release}
          onContinue={go}
          busy={busy}
        />
      ) : null}
    </div>
  );
}
