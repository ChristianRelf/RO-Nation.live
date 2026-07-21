"use client";

import { useState } from "react";
import Link from "next/link";
import { LocalTime } from "@/components/local-time";
import { priceLabel, type TierOffer } from "@/lib/tickets/pricing";

// Step one: pick a tier, accept the terms, go to checkout.
//
// It no longer reserves anything. It is a plain GET form pointed at
// /events/<slug>/checkout, so submitting it is a NAVIGATION - which means the
// whole thing works with JavaScript switched off, and the browser's back button
// behaves. The checkout page is where the reservation actually happens, behind
// the processing modal (see checkout-processing.tsx).
//
// Splitting it this way is also what makes room for Robux. A payment prompt has
// to live on a page of its own - it is a round trip through Roblox, not a form
// submit - and the checkout step is now that page. Today it processes a free
// reservation; the frame does not change when it processes a purchase.
//
// It stays a client component for one reason: the order summary follows the tier
// you have selected. Everything it decides (locked, sold out, price) is computed
// by lib/tickets/pricing.ts - the SAME module the server runs, so the two cannot
// drift - and none of it is trusted. The action re-resolves the tier against the
// event and re-checks the Robux gate on its own. A disabled radio buys a person
// who isn't confused, not security.

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <rect x={4} y={10} width={16} height={10} rx={1.5} />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function CheckoutForm({
  eventTitle,
  startsAt,
  venue,
  offers,
  terms,
  checkoutHref,
  error,
  preferTier,
}: {
  eventTitle: string;
  startsAt: Date | string;
  venue?: string | null;
  offers: TierOffer[];
  terms: string[];
  /** Where this form posts: /events/<slug>/checkout, on whichever host we're on. */
  checkoutHref: string;
  /** A refusal bounced back from the checkout step. */
  error?: string;
  /**
   * The tier they had already chosen, when they are here because something went wrong
   * rather than because they just arrived.
   *
   * A failed checkout used to dump them on a blank form - so somebody whose reservation
   * fell over for a reason that had nothing to do with their choice (a transient error,
   * the whole show selling out) had to pick their tier all over again to find out.
   */
  preferTier?: string;
}) {

  // Default to the tier they came back with, if it is still takeable - and otherwise to
  // the first tier anyone can actually take, so the common case is one click. The
  // "still takeable" half matters: when the failure WAS the tier (it sold out while they
  // were deciding), re-selecting it would hand them back a dead radio and a disabled
  // button, with no clue what to do about it.
  //
  // If every tier is blocked this page never renders - the reserve step redirects to the
  // event with a sold-out notice before it gets here.
  const preferred = preferTier
    ? offers.find((o) => (o.id ?? "") === preferTier && !o.blockedReason)
    : undefined;
  const first = preferred ?? offers.find((o) => !o.blockedReason) ?? offers[0];
  const [selectedId, setSelectedId] = useState<string>(first?.id ?? "");

  const selected =
    offers.find((o) => (o.id ?? "") === selectedId) ?? first ?? null;
  const blocked = !selected || Boolean(selected.blockedReason);

  return (
    // GET, not a server action: submitting navigates to the checkout page, which
    // is a real page load - so the middleware runs and a partner's buyer lands on
    // the partner's checkout, not RNL's. The tier rides in the query string.
    <form
      method="get"
      action={checkoutHref}
      className="grid gap-8 lg:grid-cols-[1fr_23rem]"
    >

      {/* ---- Choose ---- */}
      <div className="space-y-8">
        <section>
          <h2 className="display text-2xl">Choose your ticket</h2>
          <p className="mt-1.5 text-sm text-muted">
            One ticket per Roblox account, per show.
          </p>

          {error ? (
            <p className="mt-4 rounded-brand border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
              {error}
            </p>
          ) : null}

          <div className="mt-5 space-y-3">
            {offers.map((offer) => {
              const id = offer.id ?? "";
              const disabled = Boolean(offer.blockedReason);
              const checked = selectedId === id;

              return (
                <label
                  key={id || "ga"}
                  className={`relative flex gap-4 rounded-brand border p-5 transition-colors ${
                    disabled
                      ? "cursor-not-allowed border-line bg-bg/30 opacity-60"
                      : checked
                        ? "cursor-pointer border-accent bg-accent-soft"
                        : "cursor-pointer border-line bg-bg/40 hover:border-line-strong"
                  }`}
                >
                  {/* The radio IS the submitted field - there is no shadow
                      hidden input to fall out of step with it. A blocked tier is
                      `disabled`, so it submits nothing at all, and the action
                      reads that as "no such tier" and refuses. */}
                  <input
                    type="radio"
                    name="tier"
                    value={id}
                    checked={checked}
                    disabled={disabled}
                    onChange={() => setSelectedId(id)}
                    className="sr-only"
                  />

                  {/* Radio dot */}
                  <span
                    aria-hidden
                    className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${
                      checked ? "border-accent" : "border-line-strong"
                    }`}
                  >
                    {checked ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                    ) : null}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <span className="display text-lg">{offer.name}</span>
                      <span
                        className={`shrink-0 text-sm font-bold ${
                          offer.priceRobux > 0 ? "text-accent" : "text-fg"
                        }`}
                      >
                        {priceLabel(offer.priceRobux)}
                      </span>
                    </span>

                    {offer.description ? (
                      <span className="mt-1 block text-sm text-muted">
                        {offer.description}
                      </span>
                    ) : null}

                    {offer.perks.length ? (
                      <span className="mt-3 flex flex-col gap-1.5">
                        {offer.perks.map((perk) => (
                          <span
                            key={perk}
                            className="flex items-start gap-2 text-xs text-muted"
                          >
                            <span className="mt-[3px] text-accent">✓</span>
                            <span>{perk}</span>
                          </span>
                        ))}
                      </span>
                    ) : null}

                    <span className="mt-3 flex flex-wrap items-center gap-2">
                      {offer.blockedReason === "soldout" ? (
                        <span className="pill border-red-500/30 text-red-400">
                          Sold out
                        </span>
                      ) : offer.blockedReason === "locked" ? (
                        <span className="pill inline-flex items-center gap-1.5 border-accent/30 text-accent">
                          <LockIcon className="h-3 w-3" />
                          Robux payments coming soon
                        </span>
                      ) : /* On sale, but at the booth inside the show rather than
                            here. Said BEFORE they pick it: this used to be
                            discoverable only by choosing the tier, submitting, and
                            being bounced back to ERRORS.payment_required. */
                      offer.inExperienceOnly ? (
                        <span className="pill border-accent/30 text-accent">
                          Sold inside the experience
                        </span>
                      ) : offer.remaining !== null && offer.remaining <= 20 ? (
                        <span className="pill border-amber-400/30 text-amber-300">
                          Only {offer.remaining} left
                        </span>
                      ) : offer.remaining !== null ? (
                        <span className="text-xs text-faint">
                          {offer.remaining} left
                        </span>
                      ) : null}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="display text-2xl">Terms &amp; conditions</h2>
          <ol className="mt-4 space-y-3 text-sm text-muted">
            {terms.map((t, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 shrink-0 font-mono text-xs text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* ---- Summary ---- */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="card p-6">
          <h2 className="display text-xl">Order summary</h2>

          <div className="mt-4 border-b border-line pb-4">
            <p className="display text-lg leading-tight">{eventTitle}</p>
            <p className="mt-1 text-sm text-muted">
              <LocalTime value={startsAt} mode="time" /> · <LocalTime value={startsAt} mode="date" />
            </p>
            {venue ? <p className="text-sm text-muted">{venue}</p> : null}
          </div>

          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="min-w-0 truncate text-muted">
                {selected ? selected.name : "-"} × 1
              </dt>
              <dd className="shrink-0 font-semibold text-fg">
                {selected ? priceLabel(selected.priceRobux) : "-"}
              </dd>
            </div>

            {selected && selected.remaining !== null ? (
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-muted">Spots left</dt>
                <dd className="tnum shrink-0 font-semibold text-fg">
                  {selected.remaining}
                </dd>
              </div>
            ) : null}

            <div className="flex items-baseline justify-between gap-4 border-t border-line pt-3 text-base">
              <dt className="display">Total</dt>
              <dd className="display text-accent">
                {selected ? priceLabel(selected.priceRobux) : "-"}
              </dd>
            </div>
          </dl>

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-brand border border-line bg-bg/40 p-4 text-sm">
            {/* `required` blocks the submit in the browser, and the checkout page
                refuses without it as well - because a required attribute is a
                courtesy, not a gate. The reservation action then demands the
                acceptance a THIRD time, server-side, which is the one that counts. */}
            <input
              type="checkbox"
              name="agreed"
              value="1"
              required
              className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
            />
            <span className="text-muted">
              I have read and agree to the ticket{" "}
              <Link
                href="/legal/terms"
                target="_blank"
                className="text-accent underline-offset-2 hover:underline"
              >
                terms &amp; conditions
              </Link>{" "}
              and{" "}
              <Link
                href="/legal/code-of-conduct"
                target="_blank"
                className="text-accent underline-offset-2 hover:underline"
              >
                code of conduct
              </Link>
              .
            </span>
          </label>

          <button
            className="btn btn-accent mt-4 w-full text-base disabled:cursor-not-allowed disabled:opacity-40"
            disabled={blocked}
          >
            Continue to checkout
          </button>

          <p className="mt-3 text-center text-xs text-faint">
            Tied to your Roblox account · verified at the door
          </p>
        </div>
      </div>
    </form>
  );
}
