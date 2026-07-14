"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  claimGamePass,
  startGamePass,
  type StartPassState,
} from "@/app/actions/purchase";

// Paying with Robux, on the web.
//
// The buyer goes to roblox.com, buys a game pass, and comes back. We then ASK ROBLOX whether
// they own it - which is the only question in this entire system that can be answered without
// taking somebody's word for it, and the whole reason this rail exists (see roblox-gamepass.ts).
//
// ---- The one rule this file exists to obey --------------------------------
//
//     NEVER SAY "PAYMENT FAILED".
//
// Roblox's inventory LAGS a purchase by seconds. So for the entire time a buyer is walking
// back to our tab, the honest answer to "do they own the pass?" is "not yet" - and "not yet"
// is `owns: false`, which is the same shape as "no, they never bought it". Render that as an
// error and you have told somebody who is 500 Robux down that they did not pay, at the exact
// moment they are most alarmed by it. So `waiting` is a SPINNER, always, and the words are
// "waiting for Roblox".
//
// The three states that ownsGamePass() keeps apart, and what each one means HERE:
//
//   waiting        Roblox has not seen it yet. Spinner. Poll. This is the normal case.
//   needs_consent  They never let us look, or revoked it. The fix is a BUTTON, not a wait.
//   unavailable    We could not ask. The fix is WAITING. Take nothing, promise nothing, and
//                  above all do not tell them anything about whether they paid.
//
// ---- Polling ---------------------------------------------------------------
//
// Every 2s, AND on `visibilitychange` - because them coming back to our tab IS the signal,
// and it arrives long before the next tick would. The server independently refuses to ask
// Roblox more than once every 4s, and that limiter lives in the DATABASE
// (PurchaseIntent.checkedAt) rather than in a ref here, so hitting refresh or opening a
// second tab cannot reset it.
//
// After two minutes the automatic polling STOPS and a manual button takes over. A tab left
// open all night must not sit there hitting our server forever, and by two minutes the
// buyer has either paid or wandered off.

/** How often we ask OUR server. It asks Roblox at most every 4s - see claimGamePass. */
const POLL_MS = 2000;

/** After this, stop polling by ourselves and let them press the button. */
const GIVE_UP_MS = 2 * 60_000;

export function GamePassCheckout({
  eventId,
  tierId,
  tierName,
  price,
  eventSlug,
  eventTitle,
  /** Their existing seat hold, on a seated show. "" when there is nothing held. */
  intentToken,
  /** Have they granted `user.inventory-item:read`? Read server-side, per request. */
  hasGrant,
  /** Where to go and grant it. A real link - it is an OAuth round trip, not a fetch. */
  consentHref,
  ticketBase,
  reserveHref,
}: {
  eventId: string;
  tierId: string;
  tierName: string;
  price: string;
  eventSlug: string;
  eventTitle: string;
  intentToken: string;
  hasGrant: boolean;
  consentHref: string;
  ticketBase: string;
  reserveHref: string;
}) {
  const [hold, setHold] = useState<Extract<StartPassState, { ok: true }> | null>(
    null,
  );
  const [status, setStatus] = useState<
    "starting" | "ready" | "waiting" | "consent" | "unavailable" | "done" | "failed"
  >("starting");
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  /** The hold, started once. A promise, not a boolean - see checkout-processing.tsx. */
  const starting = useRef<Promise<StartPassState> | null>(null);
  const startedAt = useRef<number>(0);
  const claiming = useRef(false);

  // ---- Take the hold, once -------------------------------------------------
  useEffect(() => {
    if (!hasGrant) return;

    let alive = true;

    if (!starting.current) {
      const form = new FormData();
      form.set("eventId", eventId);
      form.set("tierId", tierId);
      // Their seat. Carried, never trusted: the action proves the hold is theirs and reads
      // the chair off it server-side, so a seat cannot be edited into this request.
      form.set("intent", intentToken);
      starting.current = startGamePass(null, form);
    }

    starting.current.then((result) => {
      if (!alive) return;
      if (!result.ok) {
        setStatus("failed");
        setError(START_ERRORS[result.error] ?? "We couldn't start that purchase.");
        return;
      }
      setHold(result);
      setStatus("ready");
    });

    return () => {
      alive = false;
    };
  }, [eventId, tierId, intentToken, hasGrant]);

  // ---- Ask whether they have paid -----------------------------------------
  const check = useCallback(async () => {
    if (!hold || claiming.current) return;
    // Guard the overlap: a visibilitychange landing on top of an in-flight tick would send
    // two claims, and the second would be told to wait by the server's own limiter anyway.
    claiming.current = true;

    try {
      const form = new FormData();
      form.set("token", hold.token);
      const result = await claimGamePass(null, form);

      if (result.ok) {
        setStatus("done");
        // A real document navigation, for the same reason the free checkout uses one: on a
        // partner's site only a real navigation runs the middleware, and this is the end of
        // the flow.
        window.location.assign(`${ticketBase}/${result.ticketId}?issued=1`);
        return;
      }

      switch (result.error) {
        case "waiting":
          setStatus("waiting");
          return;
        case "needs_consent":
          setStatus("consent");
          return;
        case "unavailable":
          // NOT an error to the buyer. We could not ask; that is our problem, not theirs.
          setStatus("unavailable");
          return;
        default:
          setStatus("failed");
          setError(CLAIM_ERRORS[result.error] ?? "Something went wrong.");
      }
    } finally {
      claiming.current = false;
    }
  }, [hold, ticketBase]);

  // ---- The loop ------------------------------------------------------------
  useEffect(() => {
    if (!hold || status === "done" || status === "failed") return;

    if (!startedAt.current) startedAt.current = Date.now();

    const tick = () => {
      if (Date.now() - startedAt.current > GIVE_UP_MS) {
        setExpired(true);
        return;
      }
      void check();
    };

    const id = setInterval(tick, POLL_MS);

    // Them coming back to our tab IS the signal, and it beats the next tick by up to two
    // seconds - which is two seconds of a buyer staring at a spinner after the thing they
    // were waiting for has already happened.
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [hold, status, check]);

  // ---- No grant: a button, not a spinner ----------------------------------
  if (!hasGrant) {
    return (
      <Shell title="Connect your Roblox account" event={eventTitle} line={`${tierName} · ${price}`}>
        <p className="mt-3 text-sm text-muted">
          To sell you this ticket we need to be able to check that you actually bought the
          pass. Roblox will ask you to allow that - it lets us read whether you own this one
          item, and nothing else.
        </p>
        {/* A real link. This is an OAuth round trip through roblox.com, not a fetch, and it
            deliberately forces the trip even though they are already signed in: a session
            proves who they are, not what they consented to. */}
        <a href={consentHref} className="btn btn-accent mt-7 w-full">
          Continue with Roblox
        </a>
        <a
          href={reserveHref}
          className="mt-3 block text-center text-sm text-faint transition-colors hover:text-fg"
        >
          Back to checkout
        </a>
      </Shell>
    );
  }

  if (status === "failed") {
    return (
      <Shell title="We couldn't finish that" event={eventTitle} line={`${tierName} · ${price}`} tone="bad">
        <p className="mt-3 text-sm text-muted">{error}</p>
        <a href={reserveHref} className="btn btn-accent mt-7 w-full">
          Back to checkout
        </a>
      </Shell>
    );
  }

  if (status === "consent") {
    return (
      <Shell title="Let us check your purchase" event={eventTitle} line={`${tierName} · ${price}`}>
        <p className="mt-3 text-sm text-muted">
          Roblox won&apos;t let us see whether you own the pass. Reconnect and we&apos;ll pick
          up exactly where you left off - if you have already paid, your ticket is waiting.
        </p>
        <a href={consentHref} className="btn btn-accent mt-7 w-full">
          Reconnect Roblox
        </a>
      </Shell>
    );
  }

  const buying = status === "ready";

  return (
    <Shell
      title={
        status === "done"
          ? "Ticket issued"
          : buying
            ? "Buy your ticket"
            : status === "unavailable"
              ? "Still checking with Roblox"
              : "Waiting for Roblox"
      }
      event={eventTitle}
      line={`${tierName} · ${price}`}
    >
      {buying && hold ? (
        <>
          <p className="mt-3 text-sm text-muted">
            {hold.seatLabel ? (
              <>
                Holding <span className="font-semibold text-fg">{hold.seatLabel}</span> for
                you. Buy the pass on Roblox and come straight back - we&apos;ll spot it and
                issue your ticket.
              </>
            ) : (
              <>
                Buy the pass on Roblox and come straight back - we&apos;ll spot it and issue
                your ticket.
              </>
            )}
          </p>

          {/* window.open, with the link as the fallback rather than the other way round: a
              popup blocker is common and silent, and a buyer staring at a button that
              "does nothing" is a lost sale. The anchor underneath always works. */}
          <button
            type="button"
            onClick={() => {
              window.open(hold.gamePassUrl, "_blank", "noopener,noreferrer");
              setStatus("waiting");
            }}
            className="btn btn-accent mt-7 w-full text-base"
          >
            Buy for {price} on Roblox →
          </button>
          <a
            href={hold.gamePassUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => setStatus("waiting")}
            className="mt-3 block text-center text-xs text-faint underline-offset-2 transition-colors hover:text-fg hover:underline"
          >
            Or open the pass page yourself
          </a>
        </>
      ) : (
        <>
          <Spinner />
          <p className="mt-5 text-sm text-muted">
            {status === "unavailable"
              ? "We're having trouble reaching Roblox. Nothing is wrong with your payment - we'll keep trying."
              : "Roblox can take a few seconds to register a purchase. Leave this open; your ticket appears here the moment it lands."}
          </p>

          {expired ? (
            <>
              <button
                type="button"
                onClick={() => {
                  startedAt.current = Date.now();
                  setExpired(false);
                  void check();
                }}
                className="btn btn-accent mt-7 w-full"
              >
                I&apos;ve paid - check again
              </button>
              <p className="mt-3 text-center text-xs text-faint">
                If you bought the pass and it still isn&apos;t here, your Robux is safe -
                come back to this page later and it will pick it up.
              </p>
            </>
          ) : (
            <p className="mt-4 text-center text-xs text-faint">
              Bought it already? Come back to this tab - we check the moment you do.
            </p>
          )}
        </>
      )}
    </Shell>
  );
}

/** The refusals startGamePass can hand back. */
const START_ERRORS: Record<string, string> = {
  auth: "Your session expired. Sign in again.",
  payments_off: "Robux tickets aren't switched on for this show yet.",
  bad_rail: "This tier can't be bought on the web. It's sold inside the experience.",
  unsellable: "This tier isn't set up for sale yet. Tell the organisers.",
  cannot_gift: "A game pass can't be bought for somebody else. Buy it in-experience instead.",
  already_holds: "You already have a ticket for this show.",
  soldout: "This show just sold out.",
  tier_soldout: "That tier just sold out.",
  seat_taken: "The last seats in that tier have gone.",
  revoked: "Your ticket for this show was revoked. Contact the organisers.",
  past: "This show has already taken place.",
};

/** The refusals that survive a claim - none of which is "you didn't pay". */
const CLAIM_ERRORS: Record<string, string> = {
  auth: "Your session expired. Sign in again.",
  bad_intent: "That purchase is no longer valid. Start again.",
  seat_taken: "Your seat went and the tier is now full. Contact the organisers - you have not been charged twice.",
  soldout: "This show sold out while you were paying. Contact the organisers.",
  tier_soldout: "That tier sold out while you were paying. Contact the organisers.",
  revoked: "Your ticket for this show was revoked. Contact the organisers.",
  past: "This show has already taken place.",
};

function Shell({
  title,
  event,
  line,
  tone,
  children,
}: {
  title: string;
  event: string;
  line: string;
  tone?: "bad";
  children: React.ReactNode;
}) {
  return (
    <div className="shell flex min-h-[70vh] items-center justify-center py-16">
      <div className="card w-full max-w-md p-8 text-center">
        <p className={`kicker ${tone === "bad" ? "text-red-400" : "text-accent"}`}>
          {tone === "bad" ? "Order failed" : "Checkout"}
        </p>
        <h1 className="display mt-4 text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-faint">
          {event} · {line}
        </p>
        {children}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="mx-auto mt-7 grid h-14 w-14 place-items-center">
      <svg viewBox="0 0 50 50" className="h-14 w-14 animate-spin" aria-hidden>
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="text-line"
        />
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="90 126"
          className="text-accent"
        />
      </svg>
    </div>
  );
}
