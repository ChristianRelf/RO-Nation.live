import { NextRequest, NextResponse } from "next/server";
import { SURVEY_CODE_RE } from "@/lib/utils";

// Host routing.
//
//   ronation.live/…                     → the public site
//   portal.ronation.live/shasha         → the SHASHA staff portal
//   survey.ronation.live/ABCDE-FGHJKMN-PQR → a survey
//
// Everything is derived from the request host rather than an env var, because
// Next inlines env into the edge bundle at build time — and the Docker image is
// built without runtime config. Host-derived means it is simply always right.

/** Paths the portal host may serve. */
const PORTAL_PATHS = ["/shasha", "/legal", "/api/auth/discord", "/api/health"];

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

/**
 * Continue, tagging the request with the area it belongs to. The root layout
 * reads this to drop the marketing header/footer on portal and survey pages, so
 * those areas get their own chrome without a second root layout.
 */
function proceed(req: NextRequest, url?: URL) {
  const headers = new Headers(req.headers);
  const path = url?.pathname ?? req.nextUrl.pathname;
  headers.set(
    "x-ron-area",
    path.startsWith("/shasha")
      ? "portal"
      : path.startsWith("/survey")
        ? "survey"
        : "site",
  );

  return url
    ? NextResponse.rewrite(url, { request: { headers } })
    : NextResponse.next({ request: { headers } });
}

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") || "").split(":")[0].toLowerCase();
  const { pathname, search } = req.nextUrl;

  // ---- Local dev: one origin serves everything --------------------
  if (!host || isLocalHost(host)) {
    const code = surveyCodeFrom(pathname);
    if (code) {
      const url = req.nextUrl.clone();
      url.pathname = `/survey/${code}`;
      return proceed(req, url);
    }
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
  if (pathname === "/shasha" || pathname.startsWith("/shasha/")) {
    return NextResponse.redirect(
      new URL(`${pathname}${search}`, `https://${subdomainFor("portal", host)}`),
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
