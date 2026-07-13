import "server-only";
import { randomUUID } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { env } from "./env";
import { prisma } from "./db";
import { activePartners } from "./partners/registry";
import { partnerOrigin } from "./partners/urls";
import type { UserSession } from "./session";

// One front door: authorise.ronation.live.
//
// ---- The problem it solves ----------------------------------------
//
// There has only ever been ONE identity here — a Roblox account — and one kind of
// session cookie. What was duplicated was the ROUND TRIP. `ron_session` is
// host-only (lib/session.ts explains why, and that is still the right call), and
// redirect_uri is built from the incoming Host header (lib/origin.ts), so every
// host that could be signed into had to run its own OAuth dance and have its own
// callback URL registered with Roblox. Four hosts, four registrations, four
// separate sign-ins for the same person — and a fifth subdomain meant a fifth of
// each, forever.
//
// ---- What replaces it ---------------------------------------------
//
// `authorise.ronation.live` is now the only host Roblox has ever heard of. Every
// other host sends people there and gets back a TICKET, which it exchanges for a
// session cookie of its own:
//
//   1. portal.ronation.live/api/auth/roblox/login?returnTo=/docs
//        → 302 authorise.../api/auth/sso/authorize?to=https://portal…&returnTo=/docs
//   2. authorise has its own ron_session cookie? If not, it runs the Roblox round
//      trip — the ONLY one in the system — and comes back here.
//   3. It mints a ticket for `to` and bounces the browser to
//        https://portal…/api/auth/sso/callback?ticket=…&returnTo=/docs
//   4. The portal verifies the ticket, sets ITS OWN host-only cookie, and lands
//      the user on /docs.
//
// Step 2 is what makes this single sign-on: once authorise knows who you are,
// every other host picks it up with two invisible redirects and no clicking.
//
// ---- Why a ticket rather than one cookie for *.ronation.live ------
//
// A `Domain=.ronation.live` cookie would be a tenth of this code. It would also
// be readable by every subdomain that will ever exist — including the
// partner-branded hosts, and including anything ever CNAME'd to a third party. One
// XSS anywhere under the domain would hand over the session EVERYWHERE. The whole
// point of the tickets is that cookies stay host-only: the portal's session and a
// partner site's session remain different secrets living on different origins.
//
// ---- What makes a ticket safe in a URL ----------------------------
//
// It rides in a query string, so assume it will be logged, kept in history, and
// leaked in a Referer. Four things:
//
//   • 60 seconds to live.
//   • Bound to ONE audience. A ticket minted for the portal is inert on a partner
//     host, and vice versa — so a leaked ticket cannot be replayed somewhere else.
//   • Single use. The jti is burned in the database on redemption (SsoTicket).
//   • A different signing key from the session cookie, so the two token types can
//     never be swapped for one another — a session JWT presented as a ticket does
//     not verify, and a ticket dropped into a cookie jar does not either.

/**
 * Tickets are signed with a key DERIVED from the session key, never with the
 * session key itself.
 *
 * Both are HS256 JWTs carrying the same claims, so with one key a ticket and a
 * session cookie would be interchangeable strings. They are not the same thing and
 * must not be substitutable for one another: this is what enforces that, in one
 * line, rather than a `typ` claim somebody has to remember to check on both sides.
 */
const ticketKey = new TextEncoder().encode(`${env.authSecret}:sso-ticket`);

/** A ticket is worth 60 seconds. It only has to survive two redirects. */
const TICKET_TTL_SECONDS = 60;

// ------------------------------------------------------------------
// The origins this system knows about.
// ------------------------------------------------------------------

function subOrigin(prefix: string) {
  const url = new URL(env.siteUrl);
  url.hostname = `${prefix}.${url.hostname.replace(/^www\./, "")}`;
  return url.origin;
}

/** https://authorise.ronation.live — derived, so dev and prod agree by construction. */
export function authoriseOrigin() {
  return subOrigin("authorise");
}

/**
 * Every origin that may be handed a ticket.
 *
 * Derived from the site URL and the partner registry, and NEVER from anything in
 * the request. This is the single most important check in the file: `to` decides
 * where a browser carrying a freshly minted ticket is sent, so an unvalidated one
 * turns this route into an oracle that mints RNL sessions and posts them to
 * whatever host an attacker names.
 *
 * Adding a subdomain means adding it here (and to DNS and the Caddyfile). It does
 * NOT mean touching the Roblox OAuth app — that was the whole point.
 */
export function knownOrigins(): string[] {
  return [
    new URL(env.siteUrl).origin,
    subOrigin("portal"),
    subOrigin("survey"),
    authoriseOrigin(),
    ...activePartners().map((p) => partnerOrigin(p.slug)),
  ];
}

export function isKnownOrigin(origin: string) {
  return knownOrigins().includes(origin);
}

/**
 * Is this request already ON the front door?
 *
 * In local dev every host is served from one origin, and env.siteUrl IS that
 * origin — so this is true on localhost:3000 and the whole flow runs same-origin
 * for the main site, while portal.localhost and <slug>.localhost still exercise
 * the real cross-host handoff. That is deliberate: the interesting path is the one
 * you can actually test.
 */
export function isAuthoriseOrigin(origin: string) {
  return origin === authoriseOrigin();
}

// ------------------------------------------------------------------
// Tickets.
// ------------------------------------------------------------------

/** Where the front door sends somebody who needs signing in. */
export function authorizeUrlFor(to: string, returnTo: string) {
  const url = new URL("/api/auth/sso/authorize", authoriseOrigin());
  url.searchParams.set("to", to);
  url.searchParams.set("returnTo", returnTo);
  return url.toString();
}

/** Mint a ticket that ONLY `aud` can spend, and only for the next minute. */
export async function mintTicket(session: UserSession, aud: string) {
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setAudience(aud)
    .setJti(randomUUID())
    .setExpirationTime(`${TICKET_TTL_SECONDS}s`)
    .sign(ticketKey);
}

/**
 * Verify a ticket and spend it. Returns the session it carries, or null.
 *
 * Null covers every failure — bad signature, expired, minted for somebody else,
 * already spent — on purpose. The caller has nothing useful to do with the
 * difference, and neither does anybody probing it.
 */
export async function redeemTicket(
  token: string,
  expectedAudience: string,
): Promise<UserSession | null> {
  let payload;
  try {
    // `audience` is checked BY jose, inside the verify — not by us afterwards,
    // where a forgotten `if` would be a silent hole. An expired ticket fails here
    // too.
    ({ payload } = await jwtVerify(token, ticketKey, {
      audience: expectedAudience,
    }));
  } catch {
    return null;
  }

  const { jti, exp, uid, robloxId, username, displayName, avatarUrl } =
    payload as Record<string, unknown>;

  if (
    typeof jti !== "string" ||
    typeof exp !== "number" ||
    typeof uid !== "string" ||
    typeof robloxId !== "string" ||
    typeof username !== "string" ||
    typeof displayName !== "string"
  ) {
    return null;
  }

  // Spend it. The INSERT is the check: jti is the primary key, so a replay is a
  // unique-constraint violation and there is no window between "have we seen this
  // one?" and "mark it seen" for two concurrent requests to slip through.
  try {
    await prisma.ssoTicket.create({
      data: { jti, expiresAt: new Date(exp * 1000) },
    });
  } catch {
    return null; // already spent, or the database said no. Either way: no session.
  }

  // Opportunistic sweep. These rows are worthless the moment they expire — the
  // ticket they name is refused on its exp claim anyway — so the table stays the
  // size of one minute of sign-ins and needs no cron.
  void prisma.ssoTicket
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => {});

  return {
    uid,
    robloxId,
    username,
    displayName,
    avatarUrl: typeof avatarUrl === "string" ? avatarUrl : undefined,
  };
}
