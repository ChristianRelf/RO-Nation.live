import { describe, expect, it } from "vitest";
import { defaultTicketTerms, ticketTermsFor } from "@/lib/tickets/terms";

// The terms used to be a hardcoded array in two files that drifted apart. These
// pin the two things that stopped that being possible: the resolution order, and
// the clause about how you actually get in.
//
// Pure - the snapshot-freezing half is a database fact and is asserted separately.

const RNL = { name: "RO. Nation LIVE" };
const PARTNER = {
  name: "Sleep Token",
  disclaimer: "Sleep Token is an unofficial, fan-run Roblox event series.",
};

describe("defaultTicketTerms", () => {
  it("names the organiser in the cancellation clause", () => {
    expect(defaultTicketTerms(RNL).join("\n")).toContain(
      "RO. Nation LIVE may cancel",
    );
    expect(defaultTicketTerms(PARTNER).join("\n")).toContain(
      "Sleep Token may cancel",
    );
  });

  it("appends a partner's disclaimer last, and omits it when there is none", () => {
    const partner = defaultTicketTerms(PARTNER);
    expect(partner.at(-1)).toBe(PARTNER.disclaimer);
    expect(partner).toHaveLength(defaultTicketTerms(RNL).length + 1);
  });

  it("describes the door that actually exists", () => {
    const text = defaultTicketTerms(RNL).join("\n");

    // Check-in is by Roblox id when you join - lib/tickets/verify.ts. Both old
    // copies of these terms promised a code check at a door instead.
    expect(text).toContain("when you join the experience");
    expect(text).not.toContain("Have it ready");
  });
});

describe("ticketTermsFor", () => {
  it("falls back to the issuer's default when the show sets none", () => {
    expect(ticketTermsFor({ ticketTerms: [] }, RNL)).toEqual(
      defaultTicketTerms(RNL),
    );
  });

  it("uses the show's own terms when it has them, and does not merge", () => {
    const own = ["Bring nothing.", "Leave quietly."];
    // Wholesale replacement, not an append: an organiser who writes their own
    // terms has written ALL of them, and quietly bolting five more underneath
    // would put clauses in front of a buyer that nobody chose to show them.
    expect(ticketTermsFor({ ticketTerms: own }, RNL)).toEqual(own);
  });
});
