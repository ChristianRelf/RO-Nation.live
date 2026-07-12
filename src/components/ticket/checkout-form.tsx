"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { reserveTicket } from "@/app/actions/tickets";
import { formatDate, formatTime } from "@/lib/format";
import { priceLabel, type TierOffer } from "@/lib/tickets/pricing";

// Checkout. One form: pick a tier, accept the terms, confirm.
//
// It is a client component so the order summary can follow the tier you picked,
// and so a REFUSED reservation says so in place — with your tier still selected —
// instead of bouncing you through ?error= and starting you over. The action
// cannot redirect anyway: a Server Action redirect skips the middleware, and on
// a partner's site that lands the buyer on RNL's routes. See the note in
// app/actions/tickets.ts.
//
// A SUCCESSFUL reservation is not navigated from here. The reserve page redirects
// to the new ticket on its own — the action revalidates, the page re-renders, and
// by then the buyer holds a ticket. That is a page-level redirect, so it is a real
// HTTP 307 and the middleware does run. The `useEffect` below is only a backstop
// for the case where that re-render somehow does not happen; normally this
// component is unmounted by the redirect long before the effect could fire.
//
// Everything it decides (locked, sold out, price) is computed by
// lib/tickets/pricing.ts, the SAME module the server runs, so the two cannot
// drift; and none of it is trusted. The action re-resolves the tier against the
// event and re-checks the Robux gate on its own, so what a disabled radio really
// buys you is a person who isn't confused — not security.

const ERRORS: Record<string, string> = {
  auth: "Your session expired. Sign in again to reserve.",
  terms: "Please accept the ticket terms & conditions to continue.",
  badtier: "That ticket type isn’t available for this show. Pick another.",
  tier_soldout: "That tier sold out while you were deciding. Pick another.",
  payments_off:
    "Paid tickets aren’t switched on yet — that tier can’t be issued.",
  soldout: "This show just sold out.",
  past: "This show has already taken place.",
  unavailable: "This show isn’t available for reservations.",
};

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

function Confirm({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      className="btn btn-accent mt-4 w-full text-base disabled:cursor-not-allowed disabled:opacity-40"
      disabled={disabled || pending}
    >
      {pending ? "Confirming…" : "Confirm reservation"}
    </button>
  );
}

export function CheckoutForm({
  eventId,
  eventTitle,
  startsAt,
  venue,
  offers,
  terms,
}: {
  eventId: string;
  eventTitle: string;
  startsAt: Date | string;
  venue?: string | null;
  offers: TierOffer[];
  terms: string[];
}) {
  const router = useRouter();
  const [state, submit] = useFormState(reserveTicket, null);

  // Default to the first tier anyone can actually take, so the common case is
  // one click. If every tier is blocked the page never renders — the checkout
  // redirects to the event with a sold-out notice before it gets here.
  const first = offers.find((o) => !o.blockedReason) ?? offers[0];
  const [selectedId, setSelectedId] = useState<string>(first?.id ?? "");

  const selected =
    offers.find((o) => (o.id ?? "") === selectedId) ?? first ?? null;
  const blocked = !selected || Boolean(selected.blockedReason);

  // Backstop only — see the note at the top. The reserve page's own redirect is
  // what normally takes them to the ticket, and it unmounts this first.
  useEffect(() => {
    if (state?.ok) router.push(`/tickets/${state.code}?issued=1`);
  }, [state, router]);

  const error = state && !state.ok ? state.error : undefined;

  return (
    <form action={submit} className="grid gap-8 lg:grid-cols-[1fr_23rem]">
      <input type="hidden" name="eventId" value={eventId} />

      {/* ---- Choose ---- */}
      <div className="space-y-8">
        <section>
          <h2 className="display text-2xl">Choose your ticket</h2>
          <p className="mt-1.5 text-sm text-muted">
            One ticket per Roblox account, per show.
          </p>

          {error && ERRORS[error] ? (
            <p className="mt-4 rounded-brand border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
              {ERRORS[error]}
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
                  {/* The radio IS the submitted field — there is no shadow
                      hidden input to fall out of step with it. A blocked tier is
                      `disabled`, so it submits nothing at all, and the action
                      reads that as "no such tier" and refuses. */}
                  <input
                    type="radio"
                    name="tierId"
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
              {formatTime(startsAt)} · {formatDate(startsAt)}
            </p>
            {venue ? <p className="text-sm text-muted">{venue}</p> : null}
          </div>

          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="min-w-0 truncate text-muted">
                {selected ? selected.name : "—"} × 1
              </dt>
              <dd className="shrink-0 font-semibold text-fg">
                {selected ? priceLabel(selected.priceRobux) : "—"}
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
                {selected ? priceLabel(selected.priceRobux) : "—"}
              </dd>
            </div>
          </dl>

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-brand border border-line bg-bg/40 p-4 text-sm">
            <input
              type="checkbox"
              name="terms"
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

          <Confirm disabled={blocked} />

          <p className="mt-3 text-center text-xs text-faint">
            Tied to your Roblox account · verified at the door
          </p>
        </div>
      </div>
    </form>
  );
}
