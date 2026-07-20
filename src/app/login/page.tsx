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

// ---- Why this page looks the way it does ----------------------------------
//
// It used to be a centred card under a marketing-sized headline, which is the
// shape of a signup page for a product you are about to buy. This is neither: it
// is the front door of a staff system, and it should say so before anybody reads
// a word - a portal bar across the top, the doors this credential opens listed
// beside the panel, and the destination you were heading for quoted back at you.
//
// The list on the left is deliberately static copy, NOT resolved access. Nobody
// is signed in on this page, so there is nothing to resolve; /hub is the page
// that knows which of these you actually hold, and it says so per account. This
// is a description of the estate, which is the same for everyone.

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

/** The estate, for the panel beside the sign-in. Copy, not access - see above. */
const AREAS = [
  { name: "SHASHA", blurb: "The roster - VIP list, blacklist, artist admin." },
  { name: "Partner portals", blurb: "A partner's own shows, door and API keys." },
  { name: "Company", blurb: "Events, tickets, sales and the manual door." },
  { name: "Docs", blurb: "How the platform and the ticket API fit together." },
];

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
      {/* The portal bar. Same shape as the hub's header, minus the account block
          there is no account for yet - so arriving here and arriving at /hub read
          as two screens of one system rather than two different sites. */}
      <header className="border-b border-line">
        <div className="shell flex h-16 items-center justify-between gap-6">
          <span className="flex items-baseline gap-2">
            <span className="display text-2xl tracking-tight">
              RO. Nation LIVE
            </span>
            <span className="hidden text-[10px] font-bold uppercase tracking-kicker text-accent sm:inline">
              Backstage
            </span>
          </span>

          <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-kicker text-faint">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full bg-accent animate-glow"
            />
            Secure area
          </span>
        </div>
      </header>

      <main className="relative flex-1">
        <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-72" />
        <div className="hairline-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(120%_80%_at_50%_0%,#000,transparent_70%)]" />

        <div className="shell relative py-12 sm:py-20">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_minmax(0,26rem)] lg:gap-16">
            {/* ---- What is behind the door ---------------------------------- */}
            <div className="max-w-xl">
              <p className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
                Staff sign-in
              </p>
              <h1 className="display mt-4 text-5xl sm:text-6xl">
                Everything behind
                <br />
                the curtain.
              </h1>
              <p className="mt-5 text-sm text-muted">
                One Roblox account opens every backstage area you hold. Sign in
                once here and every portal on this host knows who you are.
              </p>

              <dl className="mt-8 border-t border-line">
                {AREAS.map((area) => (
                  <div
                    key={area.name}
                    className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-line py-3"
                  >
                    <dt className="w-40 shrink-0 text-[11px] font-bold uppercase tracking-kicker text-fg">
                      {area.name}
                    </dt>
                    <dd className="flex-1 text-sm text-muted">{area.blurb}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* ---- The panel ------------------------------------------------ */}
            <div className="w-full">
              <div className="card overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-line bg-elev px-6 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-kicker text-faint">
                    Access
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-wide text-faint">
                    Roblox OAuth
                  </p>
                </div>

                <div className="p-6">
                  {message ? (
                    <p
                      role="alert"
                      className="mb-4 rounded-brand border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
                    >
                      {message}
                    </p>
                  ) : null}

                  {/* Quote the destination back. A deep link that bounced here
                      reads as "sign in and carry on", not "you were moved". */}
                  <div className="mb-5 border-l-2 border-accent/60 pl-3">
                    <p className="text-[10px] font-bold uppercase tracking-kicker text-faint">
                      Continuing to
                    </p>
                    <p className="mt-1 break-all font-mono text-sm text-fg">
                      {returnTo}
                    </p>
                    {!resuming ? (
                      <p className="mt-1 text-xs text-faint">
                        Your hub - every door your account holds.
                      </p>
                    ) : null}
                  </div>

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

                  {/* Says the thing that makes the NEXT screen make sense. Signing
                      in always works - any Roblox account can complete the round
                      trip - and it is not the same as being let in. Somebody who
                      reads this first is not surprised by a "no access" card. */}
                  <p className="mt-4 text-xs text-faint">
                    {robloxConfigured ? (
                      <>
                        Use the Roblox account your access is on. Signing in
                        identifies you; what you can open is decided by your rank
                        in RNL&apos;s group or the access a partner granted you.
                      </>
                    ) : (
                      <>{ERRORS["not-configured"]}</>
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                <p className="text-xs text-faint">
                  Just been promoted or granted access? Ranks can take a few
                  minutes to take effect here.
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
        </div>
      </main>

      <PortalFooter />
    </div>
  );
}
