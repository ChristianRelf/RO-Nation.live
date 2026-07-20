"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ticketPulse } from "@/app/actions/tickets";

// WATCHING FOR THE DOOR. Renders nothing; its whole job is to notice.
//
// Check-in on this site is silent - the holder joins the experience, the game
// server redeems their ticket by Roblox id, and nothing about that round trip
// touches the page they left open. So this asks, every ten seconds, whether the
// answer changed, and hands the decision straight back to the server when it has.
//
// ---- Why polling, and why this shape ------------------------------------
//
// There is no websocket, SSE or push channel anywhere in this codebase, and one
// ticket page is a poor reason to introduce the first. The pattern is lifted from
// gamepass-checkout.tsx, which waits on Roblox the same way: an interval, a
// give-up deadline, and a visibilitychange listener.
//
// It does NOT render the result. When something changes it calls router.refresh()
// and lets the page work out what this holder may now see - the server already owns
// the reveal rules (see `revealed` in ticket-detail.tsx), and a client that drew
// "you're in" itself would be a second, dumber copy of them.

/**
 * Ten seconds.
 *
 * gamepass-checkout.tsx polls at two, because it is racing a Roblox inventory
 * write with a buyer watching a spinner. Nothing here is racing: a door scan is a
 * human walking into a show, and ten seconds after it happens is still "instantly"
 * to the person it happened to. Tab focus covers the rest.
 */
const POLL_MS = 10_000;

/**
 * Forty-five minutes, then stop.
 *
 * Same reasoning as the give-up in gamepass-checkout.tsx and a much larger number,
 * for the opposite reason: that one is bounded by how long a purchase can plausibly
 * take, this one by how long a tab can plausibly be forgotten. A phone left on the
 * ticket page overnight must not poll until morning.
 */
const GIVE_UP_MS = 45 * 60_000;

export function TicketPulse({
  ticketId,
  /**
   * The status the server just rendered. ANY departure from it is the signal -
   * not just a check-in.
   *
   * Watching the whole status rather than a checkedIn boolean costs nothing and
   * catches the other thing that can happen to a live ticket while its holder is
   * looking at it: the crew voiding or revoking it from /company. That holder
   * should stop being told to walk in.
   */
  status,
}: {
  ticketId: string;
  status: "RESERVED" | "CHECKED_IN" | "CANCELLED";
}) {
  const router = useRouter();
  const startedAt = useRef(0);
  const inFlight = useRef(false);

  useEffect(() => {
    // Nothing left to wait for. The server decides whether to mount this at all;
    // this is the second lock on the same door, covering the render between a
    // check-in and the refresh that follows it.
    if (status !== "RESERVED") return;

    startedAt.current = Date.now();
    let stopped = false;

    const tick = async () => {
      if (stopped || inFlight.current) return;
      if (Date.now() - startedAt.current > GIVE_UP_MS) {
        stopped = true;
        return;
      }

      inFlight.current = true;
      try {
        const pulse = await ticketPulse(ticketId);
        // null means the session went away or the ticket did. Neither is worth a
        // refresh - the next real navigation will surface it properly.
        if (pulse && pulse.status !== status) {
          stopped = true;
          router.refresh();
        }
      } catch {
        // A failed poll is not news. The next tick asks again; a network blip must
        // not kill the watch, for the same reason the checkout loop swallows its own.
      } finally {
        inFlight.current = false;
      }
    };

    const id = setInterval(tick, POLL_MS);

    // Them picking the phone back up IS the signal, and it beats the next tick by
    // up to ten seconds - which is ten seconds of somebody standing inside the show
    // looking at a page that still says they aren't.
    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ticketId, status, router]);

  return null;
}
