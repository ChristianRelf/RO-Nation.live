import type { Metadata } from "next";
import Link from "next/link";
import { getUserSession } from "@/lib/session";
import { getPartnerAccountUser } from "@/lib/partner-account";
import { inviteByCode, inviteState, type InviteState } from "@/lib/partner-invites";
import { acceptPartnerInvite } from "@/app/actions/partnerships";
import { PROGRAMME_OFFERS } from "@/lib/partner-program";
import { PARTNER_AGREEMENTS } from "@/lib/legal";
import { ProgrammeShell } from "@/components/partner/programme-shell";
import { Kicker } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

// NEVER indexed, and this is the one page on this host where that is a security property
// rather than tidiness: the URL IS the authorisation. A crawler that reaches one of these
// and puts it in an index has published a link that mints a partner account.
//
// It is belt and braces - the middleware sends no-index headers for nothing, and robots.ts
// governs the main site - so the meta tag is what actually says it here.
export const metadata: Metadata = {
  title: "Your invitation",
  robots: { index: false, follow: false, nocache: true },
};

// partner.ronation.live/invite/<uuid> - an invitation RNL handed out.
//
// ---- Anonymous by design ---------------------------------------------------
//
// /invite is on PROGRAMME_PUBLIC_PATHS. The person holding this link has, by definition,
// no account here - gating it would bounce every invitee to a Roblox sign-in before they
// had been told what they were signing in to, which is exactly the wrong order for a page
// whose job is to explain an offer.
//
// So it reads for anybody, and the sign-in is asked for at the moment of ACCEPTING - which
// is the moment it is actually needed, because accepting attaches a Roblox login.
//
// ---- Every dead state gets its own words -----------------------------------
//
// A wrong code, a revoked one, an expired one and one somebody already used are four
// different situations, and three of them have a next step. Collapsing them into a 404
// would leave a real invitee - whose link expired while they were on holiday - with
// nothing to act on and no idea whether the problem was them.
//
// What they do NOT get is which one it was, when the answer would leak: `missing` and
// `revoked` deliberately read the same, so a probe cannot tell a code that never existed
// from one that was called back.
export default async function InvitePage({
  params,
  searchParams,
}: {
  params: { code: string };
  searchParams: { refused?: string };
}) {
  const [invite, session, partner] = await Promise.all([
    inviteByCode(params.code),
    getUserSession(),
    getPartnerAccountUser(),
  ]);

  const state = inviteState(invite);

  // Somebody who already holds a partner account. One Roblox login belongs to at most one
  // entity (see the schema), so this invitation is not claimable by them whatever it says -
  // and telling them the link is broken would be a lie about the link.
  if (partner && state === "pending") {
    return (
      <Frame>
        <Kicker>Invitation</Kicker>
        <h1 className="display mt-4 text-4xl leading-none sm:text-5xl">
          You already have an account
        </h1>
        <p className="mt-4 text-muted">
          This Roblox login signs in on behalf of{" "}
          <span className="text-fg">{partner.account.name}</span>, and an account can only
          belong to one partner. If this invitation was meant for somebody else on your
          team, forward it to them - they open it with their own Roblox account.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/hub" className="btn btn-accent">
            Your partner area
          </Link>
        </div>
      </Frame>
    );
  }

  if (state !== "pending") {
    return <DeadInvite state={state} />;
  }

  // Narrowing for TypeScript: inviteState() only returns "pending" for a real row.
  if (!invite) return <DeadInvite state="missing" />;

  return (
    <Frame>
      <Kicker>An invitation</Kicker>
      <h1 className="display mt-4 text-5xl leading-none sm:text-6xl">
        {invite.label}
      </h1>
      <p className="mt-5 text-lg text-muted">
        {invite.issuedByName} at RO. Nation LIVE would like you to partner with us. This
        link is yours - it opens an account in your name and nobody else&apos;s.
      </p>

      {searchParams.refused ? (
        <p
          role="alert"
          className="mt-6 rounded-brand border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          {searchParams.refused === "already"
            ? "That Roblox account already belongs to a partner, so it can't accept this."
            : "That didn't go through. The invitation may have just been used or called back."}
        </p>
      ) : null}

      {/* What they are being offered, from the one list the programme page also
          renders. Summaries rather than the full paragraphs: this page is a decision,
          not a pitch - the pitch is one link away and linked below. */}
      <section className="mt-10">
        <h2 className="text-[11px] font-bold uppercase tracking-kicker text-faint">
          What partnering gets you
        </h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {PROGRAMME_OFFERS.map((offer) => (
            <li key={offer.id} className="flex gap-3 text-sm">
              <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-accent" />
              <span>
                <span className="font-semibold">{offer.title}</span>
                <span className="block text-xs text-muted">{offer.summary}</span>
              </span>
            </li>
          ))}
        </ul>
        <Link
          href="/"
          className="link-underline mt-5 inline-block text-[11px] font-bold uppercase tracking-kicker text-faint transition-colors hover:text-accent"
        >
          The whole programme, in detail
        </Link>
      </section>

      {/* ---- Accepting ------------------------------------------------ */}
      <section className="card mt-10 p-6">
        <h2 className="font-display text-2xl">Accepting</h2>
        <p className="mt-2 text-sm text-muted">
          Accepting opens a partner account in the name above, with{" "}
          {session ? "this Roblox account" : "your Roblox account"} able to sign in on its
          behalf. It does <span className="text-fg">not</span> commit you to anything: the
          three agreements below are read, discussed and only then signed, and nothing is
          switched on until they are.
        </p>

        <ul className="mt-4 space-y-1">
          {PARTNER_AGREEMENTS.map((doc) => (
            <li key={doc.href}>
              <a
                href={doc.href}
                target="_blank"
                rel="noreferrer"
                className="link-underline text-xs font-semibold text-muted transition-colors hover:text-accent"
              >
                {doc.title} ↗
              </a>
            </li>
          ))}
        </ul>

        {session ? (
          <form action={acceptPartnerInvite} className="mt-6">
            <input type="hidden" name="code" value={invite.code} />
            <button type="submit" className="btn btn-accent w-full sm:w-auto">
              Accept as {session.displayName}
            </button>
            <p className="mt-3 text-xs text-faint">
              Not you?{" "}
              <a
                href={`/api/auth/logout?returnTo=/invite/${invite.code}`}
                className="link-underline font-semibold"
              >
                Sign out and use another account
              </a>
              .
            </p>
          </form>
        ) : (
          <div className="mt-6">
            <a
              href={`/api/auth/roblox/login?returnTo=/invite/${invite.code}`}
              className="btn btn-accent w-full sm:w-auto"
            >
              Sign in with Roblox to accept
            </a>
            <p className="mt-3 text-xs text-faint">
              Use the account you want to manage this partnership with - it is the one that
              will sign in from now on. You come straight back here.
            </p>
          </div>
        )}
      </section>

      <p className="mt-8 text-xs text-faint">
        This invitation expires on {formatDate(invite.expiresAt)}. If it lapses, ask{" "}
        {invite.issuedByName} for a fresh one - it is one click on our side.
      </p>
    </Frame>
  );
}

function DeadInvite({ state }: { state: InviteState }) {
  // "missing" and "revoked" say the same thing on purpose - see the note at the top.
  const copy: Record<InviteState, { title: string; body: string }> = {
    pending: { title: "", body: "" },
    missing: {
      title: "This link doesn't work",
      body: "It may have been mistyped, cut short by a chat client, or called back. Ask whoever sent it for a fresh one - it takes them a moment.",
    },
    revoked: {
      title: "This link doesn't work",
      body: "It may have been mistyped, cut short by a chat client, or called back. Ask whoever sent it for a fresh one - it takes them a moment.",
    },
    expired: {
      title: "This invitation has expired",
      body: "Invitations only last a few weeks, so an unused one cannot sit in a chat history forever. Nothing is wrong at your end - ask whoever sent it to reissue it.",
    },
    claimed: {
      title: "This invitation has been used",
      body: "Somebody has already accepted it, and an invitation only works once. If that was you, sign in and your partner area is waiting.",
    },
  };

  const { title, body } = copy[state];

  return (
    <Frame>
      <Kicker>Invitation</Kicker>
      <h1 className="display mt-4 text-4xl leading-none sm:text-5xl">{title}</h1>
      <p className="mt-4 text-muted">{body}</p>

      <div className="mt-8 flex flex-wrap gap-3">
        {state === "claimed" ? (
          <Link href="/hub" className="btn btn-accent">
            Sign in to your partner area
          </Link>
        ) : (
          <Link href="/join/new" className="btn btn-accent">
            Ask about partnering
          </Link>
        )}
        <a href={`${env.siteUrl}/contact?kind=partnership`} className="btn btn-ghost">
          Write to us
        </a>
      </div>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <ProgrammeShell cta={null}>
      <div className="relative">
        <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-64" />
        <div className="shell relative max-w-2xl py-16 sm:py-20">{children}</div>
      </div>
    </ProgrammeShell>
  );
}
