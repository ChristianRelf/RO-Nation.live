import { describe, expect, it } from "vitest";
import {
  GRACE_MS,
  admissionWindow,
  ticketPhase,
  type TicketPhase,
} from "@/lib/tickets/state";

// ticketPhase() is what four renderers ask "where has this ticket got to", so the
// answers are worth pinning. No database: the function is pure on purpose, and this
// file is the reason to keep it that way - every case below is a fixed clock and a
// pair of plain objects.
//
// `now` is passed explicitly everywhere. A test that leaned on Date.now() would pass
// today and fail on the morning somebody's fixture drifted past a boundary.

const NOW = new Date("2026-07-20T20:00:00Z").getTime();
const at = (iso: string) => new Date(iso);

/** A live, ordinary ticket. Spread over it to make the case you want. */
const held = {
  status: "RESERVED" as const,
  activatedAt: null,
  revokedAt: null,
};

/** Doors 19:00, on at 20:00, no end time - so the window shuts at 20:00 + GRACE_MS. */
const show = {
  doorsAt: at("2026-07-20T19:00:00Z"),
  startsAt: at("2026-07-20T20:00:00Z"),
  endsAt: null,
};

/** Same show, a week out. */
const future = {
  doorsAt: at("2026-07-27T19:00:00Z"),
  startsAt: at("2026-07-27T20:00:00Z"),
  endsAt: null,
};

describe("admissionWindow", () => {
  it("opens at doorsAt when there is one", () => {
    const w = admissionWindow(show, at("2026-07-20T18:59:00Z").getTime());
    expect(w.doorsOpen).toBe(false);

    const open = admissionWindow(show, at("2026-07-20T19:01:00Z").getTime());
    expect(open.doorsOpen).toBe(true);
    expect(open.live).toBe(true);
  });

  it("falls back to startsAt when the organiser set no doors time", () => {
    const noDoors = { ...show, doorsAt: null };
    expect(admissionWindow(noDoors, at("2026-07-20T19:30:00Z").getTime()).doorsOpen).toBe(
      false,
    );
    expect(admissionWindow(noDoors, at("2026-07-20T20:01:00Z").getTime()).doorsOpen).toBe(
      true,
    );
  });

  it("shuts GRACE_MS after the start when there is no endsAt", () => {
    const justInside = show.startsAt.getTime() + GRACE_MS - 60_000;
    const justOutside = show.startsAt.getTime() + GRACE_MS + 60_000;
    expect(admissionWindow(show, justInside).closed).toBe(false);
    expect(admissionWindow(show, justOutside).closed).toBe(true);
  });

  it("prefers a real endsAt over the grace fallback", () => {
    const withEnd = { ...show, endsAt: at("2026-07-20T21:00:00Z") };
    // An hour after the start is inside GRACE_MS but past endsAt. endsAt wins.
    expect(admissionWindow(withEnd, at("2026-07-20T21:30:00Z").getTime()).closed).toBe(
      true,
    );
  });
});

describe("ticketPhase", () => {
  const cases: Array<[string, TicketPhase, Parameters<typeof ticketPhase>]> = [
    [
      "reserved, show a week away",
      "held",
      [held, future, NOW],
    ],
    [
      "activated, show a week away",
      "armed",
      [{ ...held, activatedAt: at("2026-07-19T12:00:00Z") }, future, NOW],
    ],
    [
      "doors open, not activated - still the join moment",
      "open",
      [held, show, at("2026-07-20T19:30:00Z").getTime()],
    ],
    [
      "doors open, activated",
      "open",
      [
        { ...held, activatedAt: at("2026-07-20T18:00:00Z") },
        show,
        at("2026-07-20T19:30:00Z").getTime(),
      ],
    ],
    [
      "checked in beats everything except revocation",
      "checkedIn",
      [{ ...held, status: "CHECKED_IN" }, show, NOW],
    ],
    [
      "checked in, and the show was months ago - still checkedIn, not expired",
      "checkedIn",
      [{ ...held, status: "CHECKED_IN" }, show, at("2026-12-01T00:00:00Z").getTime()],
    ],
    [
      "cancelled by the holder",
      "cancelled",
      [{ ...held, status: "CANCELLED" }, future, NOW],
    ],
    [
      // The case the ticket page got wrong: revoked IS cancelled plus a stamp, so
      // testing status alone swallowed it and served the "reserve again" card.
      "revoked outranks cancelled",
      "revoked",
      [
        { ...held, status: "CANCELLED", revokedAt: at("2026-07-01T00:00:00Z") },
        future,
        NOW,
      ],
    ],
    [
      // The bug GRACE_MS exists to fix: five minutes late is not "you missed it".
      "ten minutes after curtain-up, never activated - still open",
      "open",
      [held, show, at("2026-07-20T20:10:00Z").getTime()],
    ],
    [
      "the morning after - expired",
      "expired",
      [held, show, at("2026-07-21T09:00:00Z").getTime()],
    ],
    [
      "activated but never used, the morning after - expired",
      "expired",
      [
        { ...held, activatedAt: at("2026-07-20T18:00:00Z") },
        show,
        at("2026-07-21T09:00:00Z").getTime(),
      ],
    ],
  ];

  for (const [name, expected, args] of cases) {
    it(name, () => {
      expect(ticketPhase(...args)).toBe(expected);
    });
  }
});
