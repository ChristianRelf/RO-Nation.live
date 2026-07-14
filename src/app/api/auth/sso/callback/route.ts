import { NextRequest, NextResponse } from "next/server";
import { requestOrigin } from "@/lib/origin";
import { USER_COOKIE, cookieOptions, createUserToken } from "@/lib/session";
import { redeemTicket } from "@/lib/sso";
import { failPath } from "@/lib/roblox";

export const dynamic = "force-dynamic";

// The other end of the handoff. Runs on EVERY host except the front door.
//
// A ticket arrives from authorise.ronation.live. If it verifies - right signature,
// not expired, minted for THIS origin and not somebody else's, and not already
// spent - this host sets its own host-only session cookie and gets on with it.
//
// Note what is NOT here: no Roblox call, no client secret, no PKCE. This host has
// never spoken to Roblox and does not need to. That is the entire point: adding a
// subdomain costs a DNS record and a line in the allowlist, and nothing at all in
// the Roblox OAuth app.

function sanitizeReturn(v: string | null) {
  if (v && v.startsWith("/") && !v.startsWith("//")) return v;
  return "/";
}

export async function GET(req: NextRequest) {
  const origin = requestOrigin(req);
  const returnTo = sanitizeReturn(req.nextUrl.searchParams.get("returnTo"));
  const ticket = req.nextUrl.searchParams.get("ticket") ?? "";

  // The audience is OUR origin, taken from the request we are answering - not from
  // anything in the ticket or the query. So a ticket minted for the portal cannot
  // be replayed on a partner host: the check is "is this for me", and only the host
  // itself can answer that.
  const session = ticket ? await redeemTicket(ticket, origin) : null;

  if (!session) {
    // Bad, expired, someone else's, or already spent - all the same from here. Back
    // to a sign-in page that exists on THIS host, with a message.
    const url = new URL(failPath(returnTo), origin);
    url.searchParams.set("error", "state");
    return NextResponse.redirect(url);
  }

  // The ordinary member session, set exactly as it always was. Everything
  // downstream - every guard, every rank lookup - is unchanged and cannot tell
  // that the cookie arrived this way.
  const token = await createUserToken(session);

  const res = NextResponse.redirect(new URL(returnTo, origin));
  res.cookies.set(USER_COOKIE, token, cookieOptions(60 * 60 * 24 * 30));
  return res;
}
