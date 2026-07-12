import { NextRequest, NextResponse } from "next/server";

// Host routing for the SHASHA staff portal.
//
//   portal.ronation.live/shasha   → the portal
//   portal.ronation.live/<other>  → bounced to the main site
//   ronation.live/shasha          → bounced to the portal
//
// Everything is derived from the request host rather than an env var, because
// Next inlines env into the edge bundle at build time — and the Docker image is
// built without runtime config. Host-derived means it is simply always right.

/** Paths the portal host is allowed to serve. */
const PORTAL_PATHS = ["/shasha", "/api/auth/discord", "/api/health"];

const isLocalHost = (host: string) =>
  host === "localhost" ||
  host === "127.0.0.1" ||
  host === "[::1]" ||
  host.endsWith(".localhost") ||
  !host.includes(".");

const isPortalHost = (host: string) => host.startsWith("portal.");

/** portal.ronation.live → ronation.live */
const mainSiteHost = (host: string) => host.replace(/^portal\./, "");

/** ronation.live / www.ronation.live → portal.ronation.live */
const portalHostFor = (host: string) => `portal.${host.replace(/^www\./, "")}`;

function matchesPortalPath(pathname: string) {
  return PORTAL_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Continue, tagging the request with the area it belongs to. The root layout
 * reads this to drop the marketing header/footer on portal pages, so the staff
 * area gets its own chrome without a second root layout.
 */
function proceed(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set(
    "x-ron-area",
    req.nextUrl.pathname.startsWith("/shasha") ? "portal" : "site",
  );
  return NextResponse.next({ request: { headers } });
}

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") || "").split(":")[0].toLowerCase();
  const { pathname, search } = req.nextUrl;

  // Local dev serves both the site and the portal off one origin.
  if (!host || isLocalHost(host)) return proceed(req);

  if (isPortalHost(host)) {
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/shasha", req.nextUrl.origin));
    }
    if (!matchesPortalPath(pathname)) {
      // Someone hit a main-site path on the portal subdomain — send them home.
      return NextResponse.redirect(
        new URL(`${pathname}${search}`, `https://${mainSiteHost(host)}`),
      );
    }
    return proceed(req);
  }

  // Main site: the portal lives on its own subdomain, so hand it over.
  if (pathname === "/shasha" || pathname.startsWith("/shasha/")) {
    return NextResponse.redirect(
      new URL(`${pathname}${search}`, `https://${portalHostFor(host)}`),
    );
  }

  return proceed(req);
}

export const config = {
  // Skip Next internals and anything that looks like a static file.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
};
