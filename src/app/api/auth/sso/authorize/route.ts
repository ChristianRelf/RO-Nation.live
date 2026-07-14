import { NextRequest, NextResponse } from "next/server";
import { requestOrigin } from "@/lib/origin";
import { getUserSession } from "@/lib/session";
import { isAuthoriseOrigin, isKnownOrigin, mintTicket } from "@/lib/sso";

export const dynamic = "force-dynamic";

// The front door. Runs on authorise.ronation.live and nowhere else.
//
// Somebody arrives here because a host they were on needs to know who they are.
// Two cases, and only two:
//
//   already signed in here  → mint a ticket for that host and send them back.
//                             No Roblox round trip, no clicking. This is the bit
//                             that makes it single sign-on.
//
//   not signed in here      → run the ONE Roblox round trip in the system, and
//                             come straight back to this route, which then takes
//                             the case above.
//
// See lib/sso.ts for why a ticket rather than a domain-wide cookie.

function sanitizeReturn(v: string | null) {
  // A path on the target host - never an absolute URL. `//evil.com` is a
  // protocol-relative URL that most parsers treat as another origin, which is why
  // it is refused explicitly rather than left to `startsWith("/")`.
  if (v && v.startsWith("/") && !v.startsWith("//")) return v;
  return "/";
}

export async function GET(req: NextRequest) {
  const origin = requestOrigin(req);

  // This route mints credentials. It exists on one host and it answers on one
  // host - anywhere else it is simply not here.
  if (!isAuthoriseOrigin(origin)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const to = req.nextUrl.searchParams.get("to") ?? "";
  const returnTo = sanitizeReturn(req.nextUrl.searchParams.get("returnTo"));

  // THE check. `to` decides where a browser carrying a fresh RNL session is sent,
  // so it is matched against a list built from our own config (lib/sso.ts) and
  // never trusted as given. Without this, the route is an oracle that mints
  // sessions and posts them to whatever host somebody names in a link.
  if (!isKnownOrigin(to)) {
    return NextResponse.redirect(new URL("/?error=origin", origin));
  }

  const session = await getUserSession();

  if (!session) {
    // Sign in HERE, then come back to this exact URL and take the branch below.
    // Reusing the ordinary login route rather than duplicating the PKCE dance:
    // on this host it does the real Roblox flow (see its own comment).
    const self = new URL(req.nextUrl.pathname + req.nextUrl.search, origin);
    const login = new URL("/api/auth/roblox/login", origin);
    login.searchParams.set("returnTo", `${self.pathname}${self.search}`);
    return NextResponse.redirect(login);
  }

  const ticket = await mintTicket(session, to);

  const back = new URL("/api/auth/sso/callback", to);
  back.searchParams.set("ticket", ticket);
  back.searchParams.set("returnTo", returnTo);
  return NextResponse.redirect(back);
}
