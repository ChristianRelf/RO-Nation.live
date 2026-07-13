import { NextRequest, NextResponse } from "next/server";
import { SURVEY_CODE_RE } from "@/lib/utils";
import { partnerByHost, partnerBySlug } from "@/lib/partners/registry";

// Host routing.
//
//   ronation.live/…                       → the public site
//   portal.ronation.live/shasha           → the SHASHA staff portal
//   portal.ronation.live/<slug>           → a partner's portal      → /pp/<slug>
//   survey.ronation.live/ABCDE-FGHJKMN-PQR → a survey
//   <slug>.ronation.live/…                → a partner's site        → /p/<slug>/…
//
// Everything is derived from the request host rather than an env var, because
// Next inlines env into the edge bundle at build time — and the Docker image is
// built without runtime config. Host-derived means it is simply always right.
//
// Partner sites are *rewritten* to an internal /p/<slug> prefix, not redirected,
// so the pretty URL survives — the same trick the survey host already uses for
// /<CODE>. They are not served from a bare /<slug>, because that would reserve
// the whole top-level namespace against every future RNL route.

/**
 * Paths the portal host may serve. Roblox sign-in is included because SHASHA
 * staff authenticate on this host — the session cookie is scoped to it, so the
 * OAuth round trip has to start and end here, exactly as on the survey host.
 */
const PORTAL_PATHS = [
  "/shasha",
  // The API docs. They live on the PORTAL host and nowhere else, because they are
  // the companion to a key and only somebody who manages an org can mint one —
  // the page guards on exactly that (lib/docs-guard.ts). Without this line the
  // portal branch below bounces /docs off to the main site, where the route does
  // not exist.
  "/docs",
  "/legal",
  "/api/auth/roblox",
  "/api/auth/logout",
  "/api/health",
];

/**
 * Paths the survey host may serve. Roblox sign-in is included because
 * respondents authenticate on this host — the session cookie is scoped to it,
 * so the OAuth round trip has to start and end here.
 */
const SURVEY_PATHS = [
  "/survey",
  "/legal",
  "/api/auth/roblox",
  "/api/auth/logout",
  "/api/health",
];

/**
 * Paths a partner host serves as-is, without the /p/<slug> rewrite.
 *
 * Roblox sign-in must run on the partner's own host: the session cookie is
 * scoped to the host it was set on, so the OAuth round trip has to start and
 * end here — the survey host already works this way. /api/v1 is authenticated
 * by key and scoped by that key, not by the host it was called on.
 */
const PARTNER_PATHS = [
  "/legal",
  "/api/auth/roblox",
  // The dev mock login, so <slug>.localhost can be signed into without real
  // Roblox credentials. It is inert in production — devLoginEnabled is false the
  // moment ROBLOX_CLIENT_ID is set. See lib/env.ts.
  "/api/auth/dev",
  "/api/auth/logout",
  "/api/health",
  "/api/v1",
];

const isLocalHost = (host: string) =>
  host === "localhost" ||
  host === "127.0.0.1" ||
  host === "[::1]" ||
  host.endsWith(".localhost") ||
  !host.includes(".");

const isPortalHost = (host: string) => host.startsWith("portal.");
const isSurveyHost = (host: string) => host.startsWith("survey.");

/** portal.ronation.live → ronation.live */
const mainSiteHost = (host: string) =>
  host.replace(/^portal\./, "").replace(/^survey\./, "");

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

function areaFor(path: string) {
  if (path.startsWith("/p/")) return "partner";
  if (path.startsWith("/pp/")) return "partner-portal";
  if (path.startsWith("/shasha")) return "portal";
  if (path.startsWith("/survey")) return "survey";
  return "site";
}

/**
 * The brand a request renders in, derived from the *internal* path — which only
 * this file can produce. Never from anything the client sent.
 */
function brandFor(path: string) {
  const m = INTERNAL_BRAND_RE.exec(path);
  return m ? (partnerBySlug(m[1])?.slug ?? "") : "";
}

/**
 * Continue, tagging the request with the area it belongs to and the brand it
 * renders in. The root layout reads both: the area to drop the marketing
 * header/footer, the brand to set data-brand on <html>.
 *
 * SECURITY: the header bag starts as a copy of the client's, so both headers
 * MUST be set on every path through here — including to "". Otherwise
 * `curl -H 'x-ron-brand: sleeptokenro' https://ronation.live/` would reach the
 * layout with a brand it has no claim to. x-ron-brand is presentation only:
 * nothing derives authorization from it (that comes from the partner guard,
 * which re-reads membership from the database). Caddy strips both on the way in
 * as well — belt and braces.
 */
function proceed(req: NextRequest, url?: URL) {
  const headers = new Headers(req.headers);
  const path = url?.pathname ?? req.nextUrl.pathname;

  headers.set("x-ron-area", areaFor(path));
  headers.set("x-ron-brand", brandFor(path));

  return url
    ? NextResponse.rewrite(url, { request: { headers } })
    : NextResponse.next({ request: { headers } });
}

/**
 * portal.<host>/<slug>/… → /pp/<slug>/…, when <slug> names a live partner.
 * Returns null when it does not, so the caller can carry on.
 *
 * Shared by the portal-host branch and the local-dev one, which both need the
 * identical rewrite — see the note in the local-dev branch for why they can't
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
 * /studio/… and /admin/… → /company/…, or null if this isn't one of them.
 *
 * They were the two authoring doors before /company merged them. Bookmarks, old
 * Discord links and muscle memory all still point at them, and a 404 would look
 * like the tool had been taken away rather than moved.
 *
 * Shared by the main-site branch and the local-dev one, which serves every host
 * from a single origin — without it here, these 404 in dev and the redirect can
 * only ever be tested in production.
 */
function legacyDoorRedirect(req: NextRequest, pathname: string, search: string) {
  const legacy = /^\/(?:studio|admin)(\/.*)?$/.exec(pathname);
  if (!legacy) return null;

  const rest = legacy[1] ?? "";
  // The two old front doors are the exception. /studio/access has moved to
  // /company/access, and /admin/login named a password form that no longer
  // exists at all — mapping either literally would land on a 404. Both mean
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

  // ---- <slug>.ronation.live — a partner site ------------------------
  // Checked before the local-host branch, so <slug>.localhost exercises the real
  // partner routing in dev. Returns null for every host that isn't a registered,
  // active partner, so this whole branch is dead until one is.
  const partner = partnerByHost(host);
  if (partner) {
    if (matches(pathname, PARTNER_PATHS)) return proceed(req);

    // Everything else is theirs. An unknown path rewrites to /p/<slug>/<junk>,
    // which 404s into *their* not-found — in their brand, rather than bouncing
    // the visitor to RNL.
    const url = req.nextUrl.clone();
    url.pathname = `/p/${partner.slug}${pathname === "/" ? "" : pathname}`;
    return proceed(req, url);
  }

  // ---- Local dev: one origin serves everything --------------------
  //
  // This branch has to come before the portal/survey ones, because it also
  // catches `portal.localhost` and `survey.localhost` (both end in .localhost)
  // — and those branches redirect to `https://<main-site-host>`, a hard-coded
  // scheme that would bounce a local request to https://localhost and fail.
  //
  // But a partner's portal is reachable ONLY by rewrite: unlike /shasha, there
  // is no top-level /<slug> route to fall back on. So without the rewrite here,
  // the guard redirects a signed-out dev to /sleeptokenro/login and that 404s —
  // the portal simply cannot be opened locally. Do the same rewrite the portal
  // branch does, minus the https redirects.
  if (!host || isLocalHost(host)) {
    if (isPortalHost(host)) {
      const rewritten = partnerPortalRewrite(req, pathname);
      if (rewritten) return rewritten;
    }

    const code = surveyCodeFrom(pathname);
    if (code) {
      const url = req.nextUrl.clone();
      url.pathname = `/survey/${code}`;
      return proceed(req, url);
    }

    const legacy = legacyDoorRedirect(req, pathname, search);
    if (legacy) return legacy;

    return proceed(req);
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
    // portal.ronation.live/<slug>/… → the partner's own portal.
    const rewritten = partnerPortalRewrite(req, pathname);
    if (rewritten) return rewritten;

    if (pathname === "/") {
      return NextResponse.redirect(new URL("/shasha", req.nextUrl.origin));
    }
    if (!matches(pathname, PORTAL_PATHS)) {
      return NextResponse.redirect(
        new URL(`${pathname}${search}`, `https://${mainSiteHost(host)}`),
      );
    }
    return proceed(req);
  }

  // ---- main site ---------------------------------------------------
  // The subdomains own these paths, so hand them over.
  if (
    pathname === "/shasha" ||
    pathname.startsWith("/shasha/") ||
    pathname === "/docs" ||
    pathname.startsWith("/docs/")
  ) {
    return NextResponse.redirect(
      new URL(`${pathname}${search}`, `https://${subdomainFor("portal", host)}`),
    );
  }

  // The old authoring doors. /studio/events/x → /company/events/x.
  const legacy = legacyDoorRedirect(req, pathname, search);
  if (legacy) return legacy;

  // The internal prefixes are not public URLs. If one leaks — a copied link, a
  // stale revalidatePath — bounce it to where that page actually lives.
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
