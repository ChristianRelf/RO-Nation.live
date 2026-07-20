import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { robloxConfigured } from "@/lib/env";
import { getUserSession } from "@/lib/session";
import { PortalFooter } from "@/components/portal-footer";

// portal.ronation.live/login - THE front door.
//
// Every anonymous request to this host arrives here, sent by the gate in
// src/middleware.ts, carrying where it was going.
//
// ---- What this page does, and the half it deliberately leaves alone -------
//
// There were four sign-in pages before this: /shasha/login, /<slug>/login,
// /docs/login (now deleted outright - see below), and the hub's own signed-out
// card. They were four pages because each was doing TWO jobs at once, and only
// one of those jobs is the same everywhere:
//
//   SIGNING IN      identical in every area. One Roblox account, one OAuth round
//                   trip - and since lib/sso.ts, literally one, on
//                   authorise.ronation.live, which every host borrows. There was
//                   never anything area-specific about this half. THIS PAGE.
//
//   BEING REFUSED   never identical. SHASHA turns you away on a rank number in
//                   RNL's Roblox group; a partner portal on whether that partner
//                   granted you access; the docs on whether you hold any door at
//                   all. NOT THIS PAGE - each area still answers for itself.
//
// That split is not a preference, it is the bug report. /docs/login only ever
// existed because the docs used to bounce people to /shasha/login, and its header
// comment said why that failed: "its denial copy talks about your rank in RNL's
// Roblox group - which is meaningless to a partner's manager, who has no rank in
// that group at all and is perfectly entitled to read the docs."
//
// So: one page for "who are you", and the area guards keep saying "you may not
// come in here, and here is the reason that applies to HERE". Merging the second
// half back in would rebuild exactly the page that had to be taken apart.
//
// ---- Except for the docs, where there was no second half ------------------
//
// /docs/login is now DELETED, not split, and the difference is worth knowing
// before anybody tries the same on the other two.
//
// SHASHA refuses you on a rank number; a partner refuses you on a per-account
// grant. Those sentences only make sense standing next to the thing refusing
// you. The docs refused you on "you hold no door ANYWHERE" - which is not a fact
// about the docs at all, it is a fact about the person, and /hub already states
// it ("your account doesn't hold access to any backstage area yet").
//
// So the docs guard now answers /login when there is no session and /hub when
// there is one holding nothing. Note it must NOT answer /login for that second
// case: this page sends anybody with a session straight on to `returnTo`, so
// that would be an unbreakable loop. See refuseDocs() in lib/docs-guard.ts.

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

/** Sign-in failures, bounced back here by failPath() - see lib/roblox.ts. */
const ERRORS: Record<string, string> = {
  denied: "Roblox sign-in was cancelled.",
  state: "That sign-in link expired. Give it another go.",
  exchange: "Roblox wouldn't complete the sign-in. Try again in a moment.",
  origin: "That sign-in link pointed somewhere we don't recognise.",
  ticket: "That sign-in link had already been used. Start again.",
  "not-configured":
    "Roblox sign-in isn't configured on this server yet (ROBLOX_CLIENT_ID / ROBLOX_CLIENT_SECRET).",
};

/**
 * Where to go after signing in.
 *
 * A RELATIVE path, or nothing. `?returnTo=https://evil.example` on the page that
 * every signed-out visitor to this host is force-fed would be an open redirect in
 * the worst possible place - the same check /<slug>/login already makes, for the
 * same reason.
 *
 * `//evil.example` is the one that catches people out: it starts with a slash and
 * is a protocol-relative URL, so it has to be refused explicitly.
 *
 * NOT sanitised against a list of known areas, unlike the page this replaces.
 * /shasha/login threw away any returnTo that did not start with "/shasha", which
 * is correct for a page that only serves SHASHA and useless for one that serves
 * every area. Any same-origin path is legitimate here; whether they may actually
 * open it is the guard's question, asked when they land.
 */
function safeReturn(v: string | undefined) {
  if (v && v.startsWith("/") && !v.startsWith("//") && v !== "/login") return v;
  return "/hub";
}

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: { error?: string; returnTo?: string };
}) {
  const returnTo = safeReturn(searchParams.returnTo);

  // Already signed in - a bookmarked login page must not dead-end, and the gate
  // never sends anybody here with a cookie. Straight through to where they were
  // going; if that turns out to be a door they do not hold, the guard there says
  // so in its own words.
  //
  // Deliberately just the cookie, not a rank check: this page's whole job is
  // identity, and asking "may you open something" here would mean guessing WHICH
  // something.
  const session = await getUserSession();
  if (session) redirect(returnTo);

  const message = searchParams.error ? ERRORS[searchParams.error] : null;
  const signInHref = `/api/auth/roblox/login?returnTo=${encodeURIComponent(returnTo)}`;

  // Something other than the hub is waiting - say so, so a signed-out click on a
  // deep link reads as "sign in and carry on" rather than "you have been moved".
  const resuming = returnTo !== "/hub";

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="relative flex-1">
        <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-72" />

        <div className="shell relative flex min-h-full items-center justify-center py-16">
          <div className="w-full max-w-sm">
            <div className="text-center">
              <p className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
                RO. Nation LIVE
              </p>
              <h1 className="display mt-4 text-5xl sm:text-6xl">Backstage</h1>
              <p className="mt-5 text-sm text-muted">
                One sign-in for everything behind the curtain - SHASHA, partner
                portals, the Company dashboard and the docs.
              </p>
            </div>

            <div className="card mt-8 p-6">
              {message ? (
                <p className="mb-4 rounded-brand border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {message}
                </p>
              ) : null}

              {resuming && !message ? (
                <p className="mb-4 rounded-brand border border-line bg-elev px-3 py-2 text-xs text-muted">
                  Sign in to continue to{" "}
                  <span className="font-mono font-semibold text-fg">
                    {returnTo}
                  </span>
                </p>
              ) : null}

              <a
                href={robloxConfigured ? signInHref : undefined}
                className={`btn w-full ${
                  robloxConfigured
                    ? "btn-accent"
                    : "btn-ghost pointer-events-none opacity-40"
                }`}
                aria-disabled={!robloxConfigured}
              >
                Sign in with Roblox
              </a>

              {/* Says the thing that makes the NEXT screen make sense. Signing in
                  always works - any Roblox account can complete the round trip -
                  and it is not the same as being let in. Somebody who reads this
                  first is not surprised by a "no access" card afterwards. */}
              <p className="mt-4 text-center text-xs text-faint">
                Use the Roblox account your access is on. Signing in identifies
                you; what you can open is decided by your rank in RNL&apos;s group
                or the access a partner granted you.
              </p>
            </div>

            <div className="mt-6 space-y-2 text-center">
              <p className="text-xs text-faint">
                Just been promoted or granted access? Ranks can take a few minutes
                to take effect here.
              </p>
              <p className="text-xs text-faint">
                Looking for shows and tickets?{" "}
                <a
                  href="https://ronation.live"
                  className="font-semibold text-muted transition-colors hover:text-accent"
                >
                  ronation.live
                </a>
              </p>
            </div>
          </div>
        </div>
      </main>

      <PortalFooter />
    </div>
  );
}
