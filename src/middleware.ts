import { NextRequest, NextResponse } from "next/server";
import { SURVEY_CODE_RE } from "@/lib/utils";
import { partnerByHost, partnerBySlug } from "@/lib/partners/registry";
import { brandForCollection } from "@/lib/merch/collections";
import { USER_COOKIE } from "@/lib/session-cookie";

// Host routing.
//
//   ronation.live/…                       → the public site
//   portal.ronation.live/                 → the backstage landing page → /portal
//   portal.ronation.live/shasha           → the SHASHA staff portal
//   portal.ronation.live/<slug>           → a partner's portal      → /pp/<slug>
//   survey.ronation.live/ABCDE-FGHJKMN-PQR → a survey
//   authorise.ronation.live/…             → sign-in, for all of the above
//   merch.ronation.live/…                 → the shop                → /merch/…
//   shop.ronation.live/…                  → 301 to merch.ronation.live
//   accounts.ronation.live/…              → the STAFF payment system → /accounts/…
//   accounts.ronation.live/document/…     → a document on its share link (served as-is)
//   pay.ronation.live/…                   → the CLIENT payment system → /pay/…
//   <slug>.ronation.live/…                → a partner's site        → /p/<slug>/…
//
// Everything is derived from the request host rather than an env var, because
// Next inlines env into the edge bundle at build time - and the Docker image is
// built without runtime config. Host-derived means it is simply always right.
//
// Partner sites are *rewritten* to an internal /p/<slug> prefix, not redirected,
// so the pretty URL survives - the same trick the survey host already uses for
// /<CODE>. They are not served from a bare /<slug>, because that would reserve
// the whole top-level namespace against every future RNL route.

/**
 * Paths the portal host may serve. Roblox sign-in is included because SHASHA
 * staff authenticate on this host - the session cookie is scoped to it, so the
 * OAuth round trip has to start and end here, exactly as on the survey host.
 */
const PORTAL_PATHS = [
  // The one front door. Every anonymous request to this host lands here - see
  // signInGate() below.
  "/login",
  "/shasha",
  // The backstage launcher - every door a signed-in person holds, in one place. It lives
  // on the portal host and nowhere else (the main site redirects it here, below). See
  // app/hub/page.tsx.
  "/hub",
  // The commercial-partner area - portal.ronation.live/partner. A signed-in partner or
  // potential partner reads the agreements they accept on joining and, once a full partner,
  // the accounting RNL has raised against them. Lives on the portal host and nowhere else
  // (the main site redirects it here, below), and guards on a PartnerAccount grant rather
  // than a group rank - see lib/partner-account.ts. Without this line the portal branch
  // below bounces /partner off to the main site, where the route does not exist.
  "/partner",
  // The internal docs - guides, brand assets, the API reference. They live on the
  // PORTAL host and nowhere else, because everything under here is for staff and
  // partner crew; the pages guard on exactly that (lib/docs-guard.ts). Without
  // this line the portal branch below bounces /docs off to the main site, where
  // the route does not exist.
  "/docs",
  // Gated file downloads - the brand guideline PDFs. Deliberately NOT under
  // /uploads: Caddy serves that prefix straight off the volume, before the
  // request reaches Next, so nothing there can ever check a session. These are
  // streamed by app/files/[id], which checks one on every request.
  "/files",
  "/legal",
  "/api/auth/roblox",
  // The ticket handoff. Every host that can hold a session needs this, because it
  // is where a session is set - see lib/sso.ts.
  "/api/auth/sso",
  // The dev mock login. Inert in production - devLoginEnabled is false the moment
  // ROBLOX_CLIENT_ID is set (lib/env.ts) - and needed here for the same reason
  // PARTNER_PATHS has it: without it, signing in against this host in dev bounces
  // to the main site, where the cookie would be set on the wrong origin.
  "/api/auth/dev",
  "/api/auth/logout",
  "/api/health",
  // Small portal-only endpoints that the pages here call. Today that is the hub's
  // "you were last here at" marker (a render cannot set a cookie in Next 14, so it
  // takes a round trip). Without this line the portal branch below forwards it to
  // the main site, where the fetch would land cross-origin and silently do nothing.
  //
  // It is under /api, so PORTAL_PUBLIC_PATHS already lets it past the sign-in gate
  // - which means the route MUST guard itself. app/api/portal/seen/route.ts does.
  "/api/portal",
];

/**
 * Paths the AUTHORISE host may serve - and it is a short list on purpose.
 *
 * This host mints sessions for every other one. It has no content, no partner
 * brand and nothing to browse: one page, which explains what it is and shows an
 * error if a sign-in went wrong, plus the auth routes themselves. Anything else
 * belongs on the main site, and gets sent there.
 */
const AUTHORISE_PATHS = [
  "/api/auth/sso",
  "/api/auth/roblox",
  "/api/auth/logout",
  "/api/health",
  "/legal",
];

/**
 * Paths the survey host may serve. Roblox sign-in is included because
 * respondents authenticate on this host - the session cookie is scoped to it,
 * so the OAuth round trip has to start and end here.
 */
const SURVEY_PATHS = [
  "/survey",
  "/legal",
  "/api/auth/roblox",
  "/api/auth/sso",
  "/api/auth/logout",
  "/api/health",
  // Attachments for a FILE_UPLOAD question. The respondent's browser posts each
  // file here from the survey page, so it has to be servable on THIS host: the
  // fallback below is a redirect, and a redirected POST arrives at the main site
  // without the body - and without the session, which is a cookie scoped to this
  // host. The same trap as the /api/auth/sso note on the merch list.
  //
  // Note how specific this is. `matches` takes the exact path or a subpath, so
  // this opens /api/uploads/survey and nothing else - the staff image door at
  // /api/uploads stays unreachable from the survey host, which is right: nobody
  // answering a form has any business there.
  "/api/uploads/survey",
];

/**
 * Paths a partner host serves as-is, without the /p/<slug> rewrite.
 *
 * Roblox sign-in must run on the partner's own host: the session cookie is
 * scoped to the host it was set on, so the OAuth round trip has to start and
 * end here - the survey host already works this way. /api/v1 is authenticated
 * by key and scoped by that key, not by the host it was called on.
 */
const PARTNER_PATHS = [
  "/legal",
  "/api/auth/roblox",
  "/api/auth/sso",
  // The dev mock login, so <slug>.localhost can be signed into without real
  // Roblox credentials. It is inert in production - devLoginEnabled is false the
  // moment ROBLOX_CLIENT_ID is set. See lib/env.ts.
  "/api/auth/dev",
  "/api/auth/logout",
  "/api/health",
  "/api/v1",
];

/**
 * Paths the MERCH host serves as-is, without the /merch rewrite.
 *
 * The shop itself is public and anonymous - it sells nothing, it shows Roblox's
 * merch and links out to Roblox to buy it - so it needs no session to work. The
 * auth routes are here anyway, and for one specific reason: the merch origin is in
 * knownOrigins() (lib/sso.ts), which means the front door is willing to mint a
 * ticket for this host. Without /api/auth/sso below, that ticket would arrive at a
 * path the merch branch rewrites to /merch/api/auth/sso and 404s - a sign-in that
 * dead-ends on a URL nobody would think to look at. Cheaper to allow it now than to
 * debug it later.
 */
const MERCH_PATHS = [
  "/legal",
  "/api/auth/roblox",
  "/api/auth/sso",
  "/api/auth/dev",
  "/api/auth/logout",
  "/api/health",
  // The clothing-template tiles. The shop's product pages are served ON this host, so
  // this is the host the browser fetches them from - and without this line they rewrite
  // to /merch/api/merch/plate/<token>, which matches no route and 404s.
  //
  // It is precisely the trap the /api/auth/sso note above describes, and it fails in
  // precisely the way that note warns about: nothing throws, the page renders fine, and
  // the character simply never gets dressed. The only clue is eighteen 404s in a network
  // tab nobody had open.
  "/api/merch",
];

/**
 * Paths the ACCOUNTS host serves as-is, without the /accounts rewrite.
 *
 * /document is the important one, and it is here for a reason that is easy to undo by
 * accident: a document's share link is read by a CONTRACTOR, who has no account and never
 * will. Rewriting it under /accounts would bury the one page on this host that is
 * deliberately anonymous inside the prefix where everything else is staff-only - and the
 * sign-in gate below would then be the thing standing between a plumber and their payslip.
 *
 * /login is here because staff authenticate ON this host: the session cookie is host-only
 * (lib/session.ts), so the OAuth round trip has to start and end here, exactly as it does
 * on the portal and the survey hosts.
 */
const ACCOUNTS_PATHS = [
  "/login",
  "/document",
  // The share link's OLD shape, /doc/<token>, with no kind segment. It cannot be rewritten
  // to the new one by pattern - only the database knows what kind a token points at - so
  // the route itself looks it up and redirects (app/doc/[token]/page.tsx). Every document
  // RNL has already sent carries one of these, in somebody else's inbox, forever.
  //
  // Note "/doc" does not swallow "/document": matches() takes the exact path or a subpath,
  // and "/document" is neither "/doc" nor under "/doc/".
  "/doc",
  "/legal",
  "/api/auth/roblox",
  "/api/auth/sso",
  // The dev mock login, so accounts.localhost can be signed into without real Roblox
  // credentials. Inert in production - see lib/env.ts.
  "/api/auth/dev",
  "/api/auth/logout",
  "/api/health",
];

/**
 * Paths the PAY host serves as-is, without the /pay rewrite.
 *
 * Shorter than the accounts list by exactly one entry: there is no /document here. A
 * document has ONE address and it is on the accounts host (lib/accounting/urls.ts), so
 * this host redirects those rather than serving a second copy at a second URL - see the
 * pay branch below.
 */
const PAY_PATHS = [
  "/login",
  "/legal",
  "/api/auth/roblox",
  "/api/auth/sso",
  "/api/auth/dev",
  "/api/auth/logout",
  "/api/health",
  // Small pay-only endpoints the pages here call. Today that is the statement's "you have
  // read this" marker (a render cannot set a cookie in Next 14, so it takes a round trip).
  // Without this line the branch below rewrites it to /pay/api/pay/seen, which matches no
  // route and 404s - and a marker whose fetch silently 404s is a marker that stops
  // advancing with nothing to show for it.
  //
  // It is under /api, so PAY_PUBLIC_PATHS already lets it past the sign-in gate - which
  // means the route MUST guard itself. app/api/pay/seen/route.ts does.
  "/api/pay",
];

const isLocalHost = (host: string) =>
  host === "localhost" ||
  host === "127.0.0.1" ||
  host === "[::1]" ||
  host.endsWith(".localhost") ||
  !host.includes(".");

const isPortalHost = (host: string) => host.startsWith("portal.");
const isSurveyHost = (host: string) => host.startsWith("survey.");
const isAuthoriseHost = (host: string) => host.startsWith("authorise.");
const isMerchHost = (host: string) => host.startsWith("merch.");
const isShopHost = (host: string) => host.startsWith("shop.");
const isAccountsHost = (host: string) => host.startsWith("accounts.");
const isPayHost = (host: string) => host.startsWith("pay.");

/** portal.ronation.live → ronation.live */
const mainSiteHost = (host: string) =>
  host
    .replace(/^portal\./, "")
    .replace(/^survey\./, "")
    .replace(/^authorise\./, "")
    .replace(/^merch\./, "")
    .replace(/^shop\./, "")
    .replace(/^accounts\./, "")
    .replace(/^pay\./, "");

const subdomainFor = (prefix: string, host: string) =>
  `${prefix}.${host.replace(/^www\./, "")}`;

const matches = (pathname: string, allowed: string[]) =>
  allowed.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/** "/ABCDE-FGHJKMN-PQR" → "ABCDE-FGHJKMN-PQR", else null. */
function surveyCodeFrom(pathname: string) {
  const code = pathname.slice(1);
  return SURVEY_CODE_RE.test(code) ? code.toUpperCase() : null;
}

/** The internal prefixes: /p/<slug>/… (partner site), /pp/<slug>/… (its portal). */
const INTERNAL_BRAND_RE = /^\/(?:p|pp)\/([a-z0-9-]+)(?=\/|$)/;

/**
 * The internal shop prefix, and the first segment under it: /merch/<collection>/…
 *
 * That segment is what themes the page. A merch collection may borrow a partner's
 * whole identity - /sleeptoken comes out in Sleep Token's palette and Cormorant -
 * and this is where that is decided, on the edge, before any database exists. See
 * lib/merch/collections.ts for why collections are code and products are rows.
 */
const MERCH_BRAND_RE = /^\/merch\/([a-z0-9-]+)(?=\/|$)/;

function areaFor(path: string) {
  if (path.startsWith("/p/")) return "partner";
  if (path.startsWith("/pp/")) return "partner-portal";
  // The shop brings its own chrome - a shop header, a shop footer - so the
  // marketing header and footer are left off, exactly as they are for the portal
  // and the partner sites. Without this line the storefront renders inside RNL's
  // "Book tickets" nav, which is a different product entirely.
  if (path === "/merch" || path.startsWith("/merch/")) return "shop";
  // The docs are portal chrome, not marketing chrome. Without this, /docs/api -
  // a staff-only reference for people holding an API key - renders wrapped in the
  // public site's header and footer, on the portal host.
  //
  // The route group in app/docs/(reader) does not appear in the URL, so /docs/api
  // still matches this prefix.
  if (
    path.startsWith("/shasha") ||
    path === "/portal" ||
    path === "/hub" ||
    // The commercial-partner area. Portal chrome, not marketing chrome - it renders inside
    // its own PartnerShell, exactly as /hub does, rather than under the public "Book tickets"
    // header. The route group in app/partner/(app) does not appear in the URL, so the guarded
    // pages still match this /partner/ prefix.
    path === "/partner" ||
    path.startsWith("/partner/") ||
    // The portal's sign-in page. Portal chrome for the same reason /docs is:
    // without this it renders inside the public site's "Book tickets" header, on
    // the portal host, as the first thing every backstage visitor sees.
    path === "/login" ||
    path === "/authorise" ||
    path === "/docs" ||
    path.startsWith("/docs/")
  ) {
    return "portal";
  }
  // The accounting desk and the documents it issues bring their own chrome, so the
  // marketing header and footer are left off - the same call as the shop and the docs
  // above, for a sharper reason.
  //
  // A document here is a PRINTABLE SHEET. The site header and footer are not marked
  // no-print, so wrapped in them an invoice does not merely look wrong on screen: the
  // "Book tickets" nav and the marketing footer come out on the paper, between RNL's
  // letterhead and a contractor's payroll slip. /document/<kind>/<token> is the same page
  // served to somebody outside the company, which makes it the version that matters most.
  if (
    path === "/accounts" ||
    path.startsWith("/accounts/") ||
    path.startsWith("/document/") ||
    // The old internal paths. Both are redirects now (see the branches below), but a
    // redirect still renders nothing while it decides, and this costs one comparison.
    path === "/company/accounting" ||
    path.startsWith("/company/accounting/") ||
    path.startsWith("/doc/")
  ) {
    return "accounting";
  }
  // The client side of the payment system. Its own area rather than reusing "accounting":
  // both drop the marketing chrome, but they are two different products with two different
  // shells, and one area name for both would mean the root layout could not tell a partner
  // reading their statement from a member of staff writing one.
  if (path === "/pay" || path.startsWith("/pay/")) return "pay";
  if (path.startsWith("/survey")) return "survey";
  return "site";
}

/**
 * The brand a request renders in, derived from the *internal* path - which only
 * this file can produce. Never from anything the client sent.
 */
function brandFor(path: string) {
  const m = INTERNAL_BRAND_RE.exec(path);
  if (m) return partnerBySlug(m[1])?.slug ?? "";

  // A merch collection can borrow a partner's brand, so the shop's themed shelves
  // paint themselves without a stylesheet of their own. Resolved through the
  // registry, never taken from the URL as-is: /merch/<anything> must not be able to
  // name a data-brand value, or the URL bar becomes a theme picker.
  const c = MERCH_BRAND_RE.exec(path);
  if (c) return brandForCollection(c[1]);

  return "";
}

/**
 * Continue, tagging the request with the area it belongs to and the brand it
 * renders in. The root layout reads both: the area to drop the marketing
 * header/footer, the brand to set data-brand on <html>.
 *
 * SECURITY: the header bag starts as a copy of the client's, so all three headers
 * MUST be set on every path through here - including to "". Otherwise
 * `curl -H 'x-ron-brand: sleeptokenro' https://ronation.live/` would reach the
 * layout with a brand it has no claim to. x-ron-brand is presentation only:
 * nothing derives authorization from it (that comes from the partner guard,
 * which re-reads membership from the database). Caddy strips all three on the way
 * in as well - belt and braces.
 *
 * x-ron-path is the EXTERNAL path, as the browser asked for it, while the other
 * two are derived from the internal one after any rewrite. That difference is the
 * point of it: a guard that wants to send somebody back where they were going
 * needs the address they typed, not the one this file rewrote it to. It is read by
 * requirePayUser() (lib/pay.ts) to build the terms gate's returnTo, and whatever
 * reads it must treat it as untrusted and validate - see safeReturnTo().
 */
function proceed(req: NextRequest, url?: URL) {
  const headers = new Headers(req.headers);
  const path = url?.pathname ?? req.nextUrl.pathname;

  headers.set("x-ron-area", areaFor(path));
  headers.set("x-ron-brand", brandFor(path));
  headers.set("x-ron-path", req.nextUrl.pathname);

  return url
    ? NextResponse.rewrite(url, { request: { headers } })
    : NextResponse.next({ request: { headers } });
}

/**
 * Paths on the portal host that an anonymous visitor may still reach.
 *
 * Everything else on this host bounces to /login. Kept deliberately short:
 *
 *   /login    the destination itself, or the bounce is a loop.
 *   /api/     the auth round trip lands here (SSO callback, logout, the dev login)
 *             and /api/health is the container's liveness probe - a probe that
 *             302s to a sign-in page reads as "unhealthy" to every orchestrator.
 *   /legal    the privacy and sign-in policies. Roblox links these from its own
 *             consent screen, so they have to be readable by somebody who has not
 *             signed in yet - which is the entire population that sees them.
 */
const PORTAL_PUBLIC_PATHS = ["/login", "/api", "/legal"];

/**
 * The same three, plus the one thing on the accounts host that is anonymous BY DESIGN.
 *
 * A document's share link is a bearer capability handed to somebody with no account - a
 * contractor, a sponsor, a ticket holder owed a refund. Putting /document behind the gate
 * would redirect all of them to a Roblox sign-in they cannot complete, on a link RNL
 * itself sent them. The page guards nothing else: there is no session on it, no action on
 * it, and a wrong token is a flat 404 (app/document/[kind]/[token]/page.tsx).
 */
const ACCOUNTS_PUBLIC_PATHS = ["/login", "/api", "/legal", "/document", "/doc"];

/**
 * The pay host's public list - the portal's three, unchanged.
 *
 * No /document here: this host does not serve documents at all, it forwards them to the
 * accounts host, and that forward happens before the gate runs.
 */
const PAY_PUBLIC_PATHS = ["/login", "/api", "/legal"];

/**
 * THE FRONT DOOR for a host that holds a session. Anonymous request to
 * <host>/anything → /login on that same host, carrying where they were going.
 *
 * Takes its public list as an argument because three hosts now use it - portal, accounts
 * and pay - and they differ by exactly one entry (see ACCOUNTS_PUBLIC_PATHS). Everything
 * else about the gate is identical, and a second copy of it is how one host quietly stops
 * gating.
 *
 * ---- What this is, and what it very deliberately is NOT ------------------
 *
 * It is AUTHENTICATION, and only the cheap half of it: "is there a session cookie
 * on this request". It is NOT authorization, and it does not replace a single
 * guard.
 *
 * Every page behind here still calls its own guard - requirePortalUser,
 * requirePartnerUser, requireScopeUser - and those do the real work: they verify
 * the cookie's signature and then look up a LIVE Roblox group rank, which is why a
 * demotion takes effect without anybody signing out. This only spares an anonymous
 * visitor the round trip of being bounced by whichever guard they happened to hit.
 *
 * So a forged or expired cookie gets past THIS and is refused by the guard, which
 * is the correct division: the middleware cannot verify a JWT it has no business
 * holding the secret for, and the thing that can, does.
 *
 * If you are ever tempted to move an access decision up here, don't. Middleware
 * runs on the edge, before the request reaches anything that knows who this person
 * is beyond a cookie's existence.
 */
function signInGate(
  req: NextRequest,
  pathname: string,
  search: string,
  publicPaths: string[],
) {
  if (matches(pathname, publicPaths)) return null;
  if (req.cookies.has(USER_COOKIE)) return null;

  const url = new URL("/login", req.nextUrl.origin);

  // Where they were going, so signing in resumes it rather than dumping everybody
  // on the hub. `/` has nothing to resume - the gate is the landing for it.
  if (pathname !== "/") url.searchParams.set("returnTo", `${pathname}${search}`);

  return NextResponse.redirect(url);
}

/**
 * portal.<host>/<slug>/… → /pp/<slug>/…, when <slug> names a live partner.
 * Returns null when it does not, so the caller can carry on.
 *
 * Shared by the portal-host branch and the local-dev one, which both need the
 * identical rewrite - see the note in the local-dev branch for why they can't
 * simply be the same branch.
 */
function partnerPortalRewrite(req: NextRequest, pathname: string) {
  const seg = pathname.split("/")[1] ?? "";
  const partner = partnerBySlug(seg);
  if (!partner) return null;

  const url = req.nextUrl.clone();
  url.pathname = `/pp/${partner.slug}${pathname.slice(seg.length + 1)}`;
  return proceed(req, url);
}

/**
 * The whole merch host → /merch/…
 *
 *   merch.ronation.live/            → /merch
 *   merch.ronation.live/sleeptoken  → /merch/sleeptoken
 *
 * The partner-host pattern, and chosen for the same reason: an unrecognised path
 * rewrites to /merch/<junk> and 404s into the SHOP's own not-found, in the shop's
 * chrome - rather than bouncing a would-be customer to RNL's marketing site
 * because they mistyped a collection name.
 *
 * Shared with the local-dev branch, which serves merch.localhost from the same
 * origin as everything else.
 */
function merchRewrite(req: NextRequest, pathname: string) {
  const url = req.nextUrl.clone();
  url.pathname = `/merch${pathname === "/" ? "" : pathname}`;
  return proceed(req, url);
}

/**
 * The whole accounts host → /accounts/…, and the whole pay host → /pay/…
 *
 *   accounts.ronation.live/          → /accounts        the desk
 *   accounts.ronation.live/books     → /accounts/books
 *   accounts.ronation.live/<id>      → /accounts/<id>   one document, staff view
 *   pay.ronation.live/               → /pay             the statement
 *   pay.ronation.live/make-payment   → /pay/make-payment
 *
 * The merch pattern, and chosen for the same reason it was there: an unrecognised path
 * rewrites to /accounts/<junk> and 404s inside the ACCOUNTING chrome, rather than bouncing
 * somebody mid-task onto RNL's marketing site because they mistyped a document id.
 *
 * Shared with the local-dev branch, which serves both hosts from the one origin.
 */
function prefixRewrite(req: NextRequest, pathname: string, prefix: string) {
  const url = req.nextUrl.clone();
  url.pathname = `${prefix}${pathname === "/" ? "" : pathname}`;
  return proceed(req, url);
}

/**
 * A document link that arrived on the wrong host → the accounts host, path intact.
 *
 * A document has exactly ONE address (lib/accounting/urls.ts), and this is what keeps
 * that true when a link is retyped, pasted from memory, or reached by a partner who was
 * already on pay.ronation.live and only changed the path. Serving a second copy here
 * instead would give every document two URLs, and then "which one did I send them?"
 * becomes a question somebody has to answer.
 *
 * Built by cloning nextUrl and swapping only the hostname, so the scheme AND THE PORT come
 * along - which is what makes this work unchanged on accounts.localhost:3000. The
 * shop → merch redirect in the dev branch already does it this way.
 */
function documentHostRedirect(req: NextRequest, host: string, pathname: string) {
  if (pathname !== "/document" && !pathname.startsWith("/document/")) return null;

  const url = req.nextUrl.clone();
  url.hostname = subdomainFor("accounts", mainSiteHost(host));
  return NextResponse.redirect(url);
}

/**
 * The accounting desk's OLD addresses → its new host.
 *
 *   /company/accounting          → https://accounts.<host>/
 *   /company/accounting/new?…    → https://accounts.<host>/new?…
 *   /company/accounting/<id>     → https://accounts.<host>/<id>
 *
 * The whole staff payment system used to be a section inside /company, reachable on the
 * main site and linked from the company sidebar. It is now a portal of its own. These are
 * URLs people have bookmarked, pasted at each other and linked from Discord, and a 404
 * on one reads as "the accounting tool has been taken away" rather than "it moved" - the
 * same call, and the same reasoning, as legacyDoorRedirect() below.
 *
 * Returns null when the path is not one of these, so the caller carries on. Shared by the
 * main-site branch, the portal branch and the local-dev one - without it in all three, the
 * redirect is a line of production-only code that can never be tested locally.
 */
function accountingDoorRedirect(req: NextRequest, host: string, pathname: string) {
  const legacy = /^\/company\/accounting(\/.*)?$/.exec(pathname);
  if (!legacy) return null;

  // Cloned rather than composed from `https://` + host, so the scheme and port survive
  // and this same function works on accounts.localhost:3000 - see documentHostRedirect
  // above, which had to learn the same lesson. The query comes along inside the clone.
  const url = req.nextUrl.clone();
  url.hostname = subdomainFor("accounts", mainSiteHost(host));
  url.pathname = legacy[1] ?? "/";
  return NextResponse.redirect(url);
}

// `/` on the portal host used to rewrite to a static "backstage portal" landing
// page. The rewrite went first; the page itself (app/portal/page.tsx) has now been
// deleted too, having sat unreachable behind the redirects below.
//
// That page existed to greet a visitor who might be anybody: it named the host,
// said "staff and partners only", and offered one link to /hub. Both halves of its
// job now belong somewhere better - a signed-OUT visitor is met by /login, which
// can actually do something about it, and a signed-IN one goes straight to /hub,
// which lists the doors they hold. An interstitial that says "this is a door" in
// front of the door is a click, not a landing.
//
// /portal still redirects to `/` on this host (and the main site still bounces
// /portal here), so old links resolve rather than 404.

/**
 * /studio/… and /admin/… → /company/…, or null if this isn't one of them.
 *
 * They were the two authoring doors before /company merged them. Bookmarks, old
 * Discord links and muscle memory all still point at them, and a 404 would look
 * like the tool had been taken away rather than moved.
 *
 * Shared by the main-site branch and the local-dev one, which serves every host
 * from a single origin - without it here, these 404 in dev and the redirect can
 * only ever be tested in production.
 */
function legacyDoorRedirect(req: NextRequest, pathname: string, search: string) {
  const legacy = /^\/(?:studio|admin)(\/.*)?$/.exec(pathname);
  if (!legacy) return null;

  const rest = legacy[1] ?? "";
  // The two old front doors are the exception. /studio/access has moved to
  // /company/access, and /admin/login named a password form that no longer
  // exists at all - mapping either literally would land on a 404. Both mean
  // "you need to sign in", which is what /company/access now says.
  const to =
    rest === "" || rest === "/login" || rest === "/access"
      ? "/company/access"
      : `/company${rest}`;

  return NextResponse.redirect(new URL(`${to}${search}`, req.nextUrl.origin));
}

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") || "").split(":")[0].toLowerCase();
  const { pathname, search } = req.nextUrl;

  // ---- <slug>.ronation.live - a partner site ------------------------
  // Checked before the local-host branch, so <slug>.localhost exercises the real
  // partner routing in dev. Returns null for every host that isn't a registered,
  // active partner, so this whole branch is dead until one is.
  const partner = partnerByHost(host);
  if (partner) {
    if (matches(pathname, PARTNER_PATHS)) return proceed(req);

    // Everything else is theirs. An unknown path rewrites to /p/<slug>/<junk>,
    // which 404s into *their* not-found - in their brand, rather than bouncing
    // the visitor to RNL.
    const url = req.nextUrl.clone();
    url.pathname = `/p/${partner.slug}${pathname === "/" ? "" : pathname}`;
    return proceed(req, url);
  }

  // ---- Local dev: one origin serves everything --------------------
  //
  // This branch has to come before the portal/survey ones, because it also
  // catches `portal.localhost` and `survey.localhost` (both end in .localhost)
  // - and those branches redirect to `https://<main-site-host>`, a hard-coded
  // scheme that would bounce a local request to https://localhost and fail.
  //
  // But a partner's portal is reachable ONLY by rewrite: unlike /shasha, there
  // is no top-level /<slug> route to fall back on. So without the rewrite here,
  // the guard redirects a signed-out dev to /sleeptokenro/login and that 404s -
  // the portal simply cannot be opened locally. Do the same rewrite the portal
  // branch does, minus the https redirects.
  if (!host || isLocalHost(host)) {
    if (isPortalHost(host)) {
      // The same gate, in the same position, for the same reason - a dev whose
      // portal lets them straight in is a dev who cannot see what everybody else
      // sees. Runs before the partner rewrite here too.
      const gated = signInGate(req, pathname, search, PORTAL_PUBLIC_PATHS);
      if (gated) return gated;

      if (pathname === "/") {
        return NextResponse.redirect(new URL("/hub", req.nextUrl.origin));
      }

      const rewritten = partnerPortalRewrite(req, pathname);
      if (rewritten) return rewritten;
    }

    // accounts.localhost and pay.localhost, gated and rewritten exactly as production
    // does it. Both are here rather than left to fall through to the main site because a
    // payment system that can only be opened in production is a payment system nobody
    // will test - and the gate in particular has to be exercised locally, or "it let me
    // straight in" is indistinguishable from "it is broken".
    if (isAccountsHost(host)) {
      const gated = signInGate(req, pathname, search, ACCOUNTS_PUBLIC_PATHS);
      if (gated) return gated;
      if (!matches(pathname, ACCOUNTS_PATHS)) {
        return prefixRewrite(req, pathname, "/accounts");
      }
    }

    if (isPayHost(host)) {
      const doc = documentHostRedirect(req, host, pathname);
      if (doc) return doc;

      const gated = signInGate(req, pathname, search, PAY_PUBLIC_PATHS);
      if (gated) return gated;
      if (!matches(pathname, PAY_PATHS)) {
        return prefixRewrite(req, pathname, "/pay");
      }
    }

    // authorise.localhost gets its page too, so the sign-in host in dev is the
    // same shape as the one in production rather than the main site's homepage
    // wearing its name.
    if (isAuthoriseHost(host) && pathname === "/") {
      const url = req.nextUrl.clone();
      url.pathname = "/authorise";
      return proceed(req, url);
    }

    // shop.localhost → merch.localhost, so the canonical-host redirect is exercised
    // locally rather than being a line of production-only code nobody has ever run.
    //
    // 307, not the 301 production sends. A permanent redirect is cached hard and
    // per-origin: one visit to shop.localhost while this was misconfigured and a
    // developer's browser would keep bouncing them for the rest of the project, with
    // no server involved and nothing in the logs to explain it.
    if (isShopHost(host)) {
      const url = req.nextUrl.clone();
      url.hostname = `merch.${mainSiteHost(host)}`;
      return NextResponse.redirect(url, 307);
    }

    // merch.localhost serves the shop. Same rewrite the production branch does -
    // without it, the shop's URLs (/sleeptoken, /babymetal/pentagram-tee) resolve
    // against the main site's routes, where they do not exist, and the entire
    // storefront is unreachable in dev.
    if (isMerchHost(host)) {
      if (!matches(pathname, MERCH_PATHS)) return merchRewrite(req, pathname);
    }

    const code = surveyCodeFrom(pathname);
    if (code) {
      const url = req.nextUrl.clone();
      url.pathname = `/survey/${code}`;
      return proceed(req, url);
    }

    const moved = accountingDoorRedirect(req, host, pathname);
    if (moved) return moved;

    const legacy = legacyDoorRedirect(req, pathname, search);
    if (legacy) return legacy;

    return proceed(req);
  }

  // ---- authorise.ronation.live -------------------------------------
  // The front door. It mints the sessions every other host runs on, and it holds
  // nothing else: one page saying what it is, and the auth routes. See lib/sso.ts.
  if (isAuthoriseHost(host)) {
    // The page. Rewritten from `/`, exactly like the portal's landing page and for
    // the same reason: `/` is this host's canonical URL, and /authorise is an
    // internal path with no business having a URL of its own.
    if (pathname === "/") {
      const url = req.nextUrl.clone();
      url.pathname = "/authorise";
      return proceed(req, url);
    }
    if (pathname === "/authorise" || pathname.startsWith("/authorise/")) {
      return NextResponse.redirect(new URL("/", req.nextUrl.origin));
    }

    if (matches(pathname, AUTHORISE_PATHS)) return proceed(req);

    // Nothing else lives here. There is no content on this host to fall back to,
    // so anything unrecognised belongs to the main site.
    return NextResponse.redirect(
      new URL(`${pathname}${search}`, `https://${mainSiteHost(host)}`),
    );
  }

  // ---- survey.ronation.live ---------------------------------------
  if (isSurveyHost(host)) {
    // The pretty URL. Rewritten, not redirected, so the code stays in the bar.
    const code = surveyCodeFrom(pathname);
    if (code) {
      const url = req.nextUrl.clone();
      url.pathname = `/survey/${code}`;
      return proceed(req, url);
    }

    if (matches(pathname, SURVEY_PATHS)) return proceed(req);

    // Anything else on this host belongs to the main site.
    return NextResponse.redirect(
      new URL(pathname === "/" ? "/" : `${pathname}${search}`, `https://${mainSiteHost(host)}`),
    );
  }

  // ---- portal.ronation.live ---------------------------------------
  if (isPortalHost(host)) {
    // ---- The gate, and it runs FIRST ------------------------------------
    //
    // Before the partner rewrite, deliberately. That rewrite turns
    // /<slug>/vip into /pp/<slug>/vip for any slug in the registry, so a gate
    // placed after it would send signed-out visitors into a partner's portal to
    // be bounced by the partner's own guard - the scattered-login behaviour this
    // replaces. One door, and every anonymous request arrives at it.
    const gated = signInGate(req, pathname, search, PORTAL_PUBLIC_PATHS);
    if (gated) return gated;

    // The accounting desk moved off this host too - it was reachable here as
    // /company/accounting before it became a portal of its own. Sent straight to the
    // accounts host rather than left to bounce off the main site first, which would be
    // two redirects to arrive in the same place.
    const moved = accountingDoorRedirect(req, host, pathname);
    if (moved) return moved;

    // Signed in, at the root. /hub is the landing that is actually worth showing:
    // it asks the real guards and lists every door this person holds. The old
    // static "backstage portal" page told them the host existed and offered one
    // link to here - a step that only ever existed because there was nothing to
    // show a signed-OUT visitor, which is now /login's job.
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/hub", req.nextUrl.origin));
    }

    // portal.ronation.live/<slug>/… → the partner's own portal.
    const rewritten = partnerPortalRewrite(req, pathname);
    if (rewritten) return rewritten;

    // The deleted landing page's old path. Kept as a redirect rather than left to
    // 404, because it was a real URL people bookmarked and pasted at each other -
    // and `/` sends them on to /hub, which is where they were trying to get.
    if (pathname === "/portal" || pathname.startsWith("/portal/")) {
      return NextResponse.redirect(new URL("/", req.nextUrl.origin));
    }
    if (!matches(pathname, PORTAL_PATHS)) {
      return NextResponse.redirect(
        new URL(`${pathname}${search}`, `https://${mainSiteHost(host)}`),
      );
    }
    return proceed(req);
  }

  // ---- shop.ronation.live → merch.ronation.live --------------------
  //
  // Both names are RNL's and both hold a certificate, but only ONE of them serves
  // anything. Two hostnames answering with the same catalogue would be the same shop
  // at two addresses: split link equity, duplicate content, and every URL anybody
  // generates having to decide which host it belongs to. So `shop` is a doorway, not
  // a door - it forwards, with the path and the query intact, and the answer to
  // "which URL is the product on?" stays a single string.
  //
  // 301 rather than 302: permanent is what it is, and it lets browsers and search
  // engines collapse the two without asking again.
  if (isShopHost(host)) {
    return NextResponse.redirect(
      new URL(
        `${pathname}${search}`,
        `https://${subdomainFor("merch", mainSiteHost(host))}`,
      ),
      301,
    );
  }

  // ---- merch.ronation.live - the shop ------------------------------
  if (isMerchHost(host)) {
    // The internal prefix is not a public URL. If one leaks - a copied link, a
    // stale revalidatePath - strip it rather than serving /merch/merch, which would
    // 404 on a URL that looks like it ought to work.
    if (pathname === "/merch" || pathname.startsWith("/merch/")) {
      return NextResponse.redirect(
        new URL(
          `${pathname.slice("/merch".length) || "/"}${search}`,
          req.nextUrl.origin,
        ),
      );
    }

    if (matches(pathname, MERCH_PATHS)) return proceed(req);

    // Everything else is the shop's. Note there is no bounce to the main site here,
    // unlike the portal and survey hosts: an unknown path is a mistyped collection,
    // and it belongs in the shop's own 404.
    return merchRewrite(req, pathname);
  }

  // ---- accounts.ronation.live - the STAFF payment system -----------
  //
  // Payroll, invoicing, receipts, credit notes, the books, and the queue of requests
  // coming off the client side. It is a self-contained portal: reachable from
  // portal.ronation.live/hub, and equally reachable by typing the name.
  //
  // Everything here except the document share links is behind the company guard, which
  // each page calls for itself. The gate below is only the cheap half - see the note on
  // signInGate().
  if (isAccountsHost(host)) {
    // The internal prefix is not a public URL. If one leaks - a copied link, a stale
    // revalidatePath - strip it rather than serving /accounts/accounts, which would 404
    // on a URL that looks like it ought to work. The merch host does the same.
    if (pathname === "/accounts" || pathname.startsWith("/accounts/")) {
      return NextResponse.redirect(
        new URL(
          `${pathname.slice("/accounts".length) || "/"}${search}`,
          req.nextUrl.origin,
        ),
      );
    }

    // The desk's old address, in case somebody types it at the new host.
    const moved = accountingDoorRedirect(req, host, pathname);
    if (moved) return moved;

    // The gate. AFTER the two redirects above, so a signed-out person following an old
    // link is corrected to the right URL and then asked to sign in - rather than signing
    // in and being dumped on a path that is about to move under them.
    const gated = signInGate(req, pathname, search, ACCOUNTS_PUBLIC_PATHS);
    if (gated) return gated;

    if (matches(pathname, ACCOUNTS_PATHS)) return proceed(req);

    // Everything else is the desk's. No bounce to the main site, deliberately - the same
    // call the merch host makes. Somebody deep in a document who mistypes an id belongs in
    // the accounting area's own 404, not on RNL's marketing homepage.
    return prefixRewrite(req, pathname, "/accounts");
  }

  // ---- pay.ronation.live - the CLIENT payment system ---------------
  //
  // Statements, and the two request forms. Same identity as the portal - one Roblox
  // account, minted by authorise.ronation.live - and the same host-only cookie rule, so
  // signing in on the portal makes signing in here two invisible redirects. See lib/sso.ts.
  if (isPayHost(host)) {
    // A document link that landed here goes to the host that owns documents.
    const doc = documentHostRedirect(req, host, pathname);
    if (doc) return doc;

    if (pathname === "/pay" || pathname.startsWith("/pay/")) {
      return NextResponse.redirect(
        new URL(`${pathname.slice("/pay".length) || "/"}${search}`, req.nextUrl.origin),
      );
    }

    const gated = signInGate(req, pathname, search, PAY_PUBLIC_PATHS);
    if (gated) return gated;

    if (matches(pathname, PAY_PATHS)) return proceed(req);

    return prefixRewrite(req, pathname, "/pay");
  }

  // ---- main site ---------------------------------------------------
  // /portal is the landing page's internal path, and the portal host serves it
  // at `/` - so hand the whole thing over to that host's root, not to /portal on
  // it, which would only bounce back here.
  if (pathname === "/portal" || pathname.startsWith("/portal/")) {
    return NextResponse.redirect(
      new URL("/", `https://${subdomainFor("portal", host)}`),
    );
  }

  // Same again for the front door's internal path.
  if (pathname === "/authorise" || pathname.startsWith("/authorise/")) {
    return NextResponse.redirect(
      new URL("/", `https://${subdomainFor("authorise", host)}`),
    );
  }

  // The subdomains own these paths, so hand them over. /files is here with the
  // rest because a download link pasted into a Discord as ronation.live/files/<id>
  // would otherwise 404 for somebody perfectly entitled to the file: the session
  // cookie is host-only, and on this host it does not exist.
  if (
    pathname === "/shasha" ||
    pathname.startsWith("/shasha/") ||
    pathname === "/hub" ||
    // The commercial-partner area. Belongs to the portal host for the same host-only-cookie
    // reason as /hub: ronation.live/partner is what a partner will type, so forward it rather
    // than 404.
    pathname === "/partner" ||
    pathname.startsWith("/partner/") ||
    // The backstage sign-in. It belongs to the portal host - the session cookie is
    // host-only, so a sign-in completed HERE would set a cookie on the apex and
    // leave the portal exactly as signed-out as before. Forwarded rather than
    // 404'd because ronation.live/login is what somebody will type.
    pathname === "/login" ||
    pathname === "/docs" ||
    pathname.startsWith("/docs/") ||
    pathname === "/files" ||
    pathname.startsWith("/files/")
  ) {
    return NextResponse.redirect(
      new URL(`${pathname}${search}`, `https://${subdomainFor("portal", host)}`),
    );
  }

  // The payment system lives on two hosts of its own, and every path that used to reach
  // it - or that somebody would reasonably guess - is sent there rather than 404'd.
  //
  //   /company/accounting/…   where the staff desk used to be. Handled by
  //                           accountingDoorRedirect, which strips the prefix.
  //   /accounts/… , /pay/…    the internal prefixes. Not public URLs, but they are the
  //                           obvious thing to type on the apex, and a leaked one (a
  //                           copied link, a stale revalidatePath) should resolve.
  //   /document/… , /doc/…    document share links. The old /doc/<token> shape has no
  //                           kind segment, so it cannot be rewritten here - it is
  //                           forwarded intact and app/doc/[token] looks the document up
  //                           and redirects to its canonical URL. See that route.
  const moved = accountingDoorRedirect(req, host, pathname);
  if (moved) return moved;

  const accounting = /^\/(?:accounts|document|doc)(\/.*)?$/.exec(pathname);
  if (accounting) {
    return NextResponse.redirect(
      new URL(
        `${pathname}${search}`,
        `https://${subdomainFor("accounts", host)}`,
      ),
    );
  }

  const paying = /^\/pay(\/.*)?$/.exec(pathname);
  if (paying) {
    return NextResponse.redirect(
      new URL(
        `${paying[1] ?? "/"}${search}`,
        `https://${subdomainFor("pay", host)}`,
      ),
    );
  }

  // The shop lives on its own host, and people will guess otherwise - /merch is the
  // obvious thing to type, /shop is the other obvious thing, and both are wrong. Send
  // them on rather than 404ing somebody who was trying to give RNL money.
  //
  // The prefix is dropped, not kept: the shop's URLs have no /merch in them (that is
  // an internal path), so ronation.live/merch/sleeptoken belongs at
  // merch.ronation.live/sleeptoken.
  const shop = /^\/(?:merch|shop)(\/.*)?$/.exec(pathname);
  if (shop) {
    return NextResponse.redirect(
      new URL(
        `${shop[1] ?? "/"}${search}`,
        `https://${subdomainFor("merch", host)}`,
      ),
    );
  }

  // The old authoring doors. /studio/events/x → /company/events/x.
  const legacy = legacyDoorRedirect(req, pathname, search);
  if (legacy) return legacy;

  // The internal prefixes are not public URLs. If one leaks - a copied link, a
  // stale revalidatePath - bounce it to where that page actually lives.
  const site = /^\/p\/([a-z0-9-]+)(\/.*)?$/.exec(pathname);
  if (site) {
    const target = partnerBySlug(site[1]);
    if (target) {
      return NextResponse.redirect(
        new URL(
          `${site[2] ?? "/"}${search}`,
          `https://${subdomainFor(target.slug, host)}`,
        ),
      );
    }
  }
  const portal = /^\/pp(\/.*)?$/.exec(pathname);
  if (portal) {
    return NextResponse.redirect(
      new URL(
        `${portal[1] ?? "/"}${search}`,
        `https://${subdomainFor("portal", host)}`,
      ),
    );
  }

  // /survey/<code> and a bare /<code> both belong on the survey subdomain.
  const code =
    surveyCodeFrom(pathname) ??
    (pathname.startsWith("/survey/")
      ? surveyCodeFrom(pathname.slice("/survey".length))
      : null);
  if (code) {
    return NextResponse.redirect(
      new URL(`/${code}`, `https://${subdomainFor("survey", host)}`),
    );
  }

  return proceed(req);
}

export const config = {
  // Skip Next internals and anything that looks like a static file.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
};
