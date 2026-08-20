import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../src/middleware";
import { USER_COOKIE } from "@/lib/session-cookie";

// The partner programme host, partner.ronation.live.
//
// It is the only host in this codebase that is PUBLIC at the front and PRIVATE at the
// back, and everything below is an assertion about where that line falls. Get it wrong in
// one direction and an invitee is bounced to a Roblox sign-in before being told what they
// are signing in to; get it wrong in the other and a partner's own area is served to
// anybody who types the URL.
//
// Nothing here touches the database. The middleware runs on the edge and decides from the
// Host header, the path and the presence of a cookie - which is exactly what makes these
// invariants worth pinning: a refactor breaks them silently, because every page still
// renders and nothing throws.

const go = (url: string, opts: { cookie?: boolean } = {}) => {
  const u = new URL(url);
  const req = new NextRequest(u, {
    headers: { host: u.host, ...(opts.cookie ? { cookie: `${USER_COOKIE}=x` } : {}) },
  });
  const res = middleware(req);
  return {
    status: res.status,
    location: res.headers.get("location"),
    rewrite: res.headers.get("x-middleware-rewrite"),
  };
};

describe("partner programme host", () => {
  it("serves the programme at the root", () => {
    const r = go("https://partner.ronation.live/");
    expect(r.rewrite).toBe("https://partner.ronation.live/partner");
  });

  it("lets a stranger read the join form", () => {
    expect(go("https://partner.ronation.live/join/new").rewrite).toBe(
      "https://partner.ronation.live/partner/join/new",
    );
  });

  it("lets a stranger open an invite", () => {
    expect(go("https://partner.ronation.live/invite/abc").rewrite).toBe(
      "https://partner.ronation.live/partner/invite/abc",
    );
  });

  it("lets a stranger open a site brief", () => {
    expect(go("https://partner.ronation.live/onboard/site/tok").rewrite).toBe(
      "https://partner.ronation.live/partner/onboard/site/tok",
    );
  });

  it("gates the hub", () => {
    const r = go("https://partner.ronation.live/hub");
    expect(r.status).toBe(307);
    expect(r.location).toBe("https://partner.ronation.live/login?returnTo=%2Fhub");
  });

  it("gates the guided setup", () => {
    expect(go("https://partner.ronation.live/onboard").status).toBe(307);
  });

  it("serves the hub to a signed-in visitor", () => {
    expect(go("https://partner.ronation.live/hub", { cookie: true }).rewrite).toBe(
      "https://partner.ronation.live/partner/hub",
    );
  });

  it("strips the leaked internal prefix", () => {
    const r = go("https://partner.ronation.live/partner/hub");
    expect(r.location).toBe("https://partner.ronation.live/hub");
  });

  it("serves the Open Graph card image to an anonymous bot", () => {
    // A link-preview bot has no session. Behind the gate this 307s to /login and every
    // link anybody pastes into a chat comes out as a blank rectangle - invisible in a
    // browser, because the page itself renders perfectly.
    const r = go("https://partner.ronation.live/opengraph-image");
    expect(r.status).toBe(200);
    expect(r.location).toBeNull();
    expect(r.rewrite).toBeNull();
  });

  it("serves robots.txt to an anonymous crawler", () => {
    // Behind the gate this would 307 to /login, and a robots.txt that answers with a
    // sign-in page reads as no robots.txt at all - on the one host holding bearer links.
    const r = go("https://partner.ronation.live/robots.txt");
    expect(r.status).toBe(200);
    expect(r.location).toBeNull();
  });

  it("does not treat the programme host as a tenant site", () => {
    expect(go("https://partner.ronation.live/").rewrite).not.toContain("/p/partner");
  });
});

describe("the old partner-area addresses", () => {
  it("forwards from the portal host", () => {
    expect(go("https://portal.ronation.live/partner", { cookie: true }).location).toBe(
      "https://partner.ronation.live/hub",
    );
  });

  it("keeps the sub-path", () => {
    expect(
      go("https://portal.ronation.live/partner/documents", { cookie: true }).location,
    ).toBe("https://partner.ronation.live/hub/documents");
  });

  it("maps /partner/access to /access, not /hub/access", () => {
    expect(
      go("https://portal.ronation.live/partner/access", { cookie: true }).location,
    ).toBe("https://partner.ronation.live/access");
  });

  it("forwards from the main site", () => {
    expect(go("https://ronation.live/partner").location).toBe(
      "https://partner.ronation.live/hub",
    );
  });
});

describe("the other hosts still work", () => {
  it("portal root still goes to the hub", () => {
    expect(go("https://portal.ronation.live/", { cookie: true }).location).toBe(
      "https://portal.ronation.live/hub",
    );
  });
  it("accounts host is untouched", () => {
    expect(go("https://accounts.ronation.live/books", { cookie: true }).rewrite).toBe(
      "https://accounts.ronation.live/accounts/books",
    );
  });
});

describe("the join flow's own paths", () => {
  it("rewrites /join/thanks for an anonymous visitor", () => {
    const r = go("https://partner.ronation.live/join/thanks");
    expect(r.status).toBe(200);
    expect(r.location).toBeNull();
    expect(r.rewrite).toBe("https://partner.ronation.live/partner/join/thanks");
  });
});
