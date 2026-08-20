import type { Metadata } from "next";
import Link from "next/link";
import { getUserSession } from "@/lib/session";
import { getPartnerAccountUser } from "@/lib/partner-account";
import { prisma } from "@/lib/db";
import { PartnerApplicationStatus } from "@prisma/client";
import { ProgrammeShell } from "@/components/partner/programme-shell";
import { JoinForm } from "@/components/partner/join-form";
import { Kicker } from "@/components/ui";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ask about partnering",
  description:
    "Tell RO. Nation LIVE what you run and what you want from a partnership. A person reads every one of these.",
  // Indexable, unlike the rest of this host. It is the other half of the programme page,
  // and a commercial offer whose application form cannot be found is half an offer.
  alternates: { canonical: "/join/new" },
};

// partner.ronation.live/join/new - the front door for somebody nobody invited.
//
// Public, by design. The gate in the middleware lets /join through unauthenticated (see
// PROGRAMME_PUBLIC_PATHS) so the questions can be read before the sign-in is asked for -
// the form itself explains why that ordering matters.
//
// ---- Three states, and only one of them is the form ------------------------
//
// A partner            → they are already in. Sent to their hub rather than shown a form
//                        asking them to introduce themselves.
// An open application  → told where it is up to. Filing a second copy under the first
//                        does not make it get read sooner, and makes RNL look like it
//                        ignored the first one.
// Everybody else       → the form.
//
// The middle case is the one worth having. The action refuses a duplicate anyway (that is
// the wall), but refusing after somebody has retyped four paragraphs is a bad way to
// deliver the news.
export default async function JoinPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const [session, partner] = await Promise.all([
    getUserSession(),
    getPartnerAccountUser(),
  ]);

  const open = session
    ? await prisma.partnerApplication.findFirst({
        where: {
          robloxId: session.robloxId,
          status: {
            in: [
              PartnerApplicationStatus.NEW,
              PartnerApplicationStatus.REVIEWING,
              PartnerApplicationStatus.ACCEPTED,
            ],
          },
        },
        orderBy: { createdAt: "desc" },
      })
    : null;

  return (
    <ProgrammeShell cta={null}>
      <div className="relative">
        <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-64" />
        <div className="shell relative max-w-3xl py-16">
          <Kicker>Partner programme</Kicker>

          {partner ? (
            <AlreadyPartner name={partner.account.name} />
          ) : open ? (
            <AlreadyAsked
              at={open.createdAt}
              accepted={open.status === PartnerApplicationStatus.ACCEPTED}
            />
          ) : (
            <>
              <h1 className="display mt-5 text-5xl leading-none sm:text-6xl">
                Tell us what you run
              </h1>
              <p className="mt-5 max-w-xl text-lg text-muted">
                There is no form scoring, no queue position and no automated reply. Somebody
                here reads this and writes back.
              </p>

              <JoinForm
                signedIn={Boolean(session)}
                // Built here, on the server, so it carries this host's origin rather than
                // whatever NEXT_PUBLIC_SITE_URL was baked into the client bundle.
                signInHref="/api/auth/roblox/login?returnTo=/join/new"
                error={searchParams.error}
              />
            </>
          )}
        </div>
      </div>
    </ProgrammeShell>
  );
}

function AlreadyPartner({ name }: { name: string }) {
  return (
    <>
      <h1 className="display mt-5 text-5xl leading-none sm:text-6xl">
        You&apos;re already in
      </h1>
      <p className="mt-5 max-w-xl text-lg text-muted">
        This account signs in on behalf of{" "}
        <span className="text-fg">{name}</span>, so there is nothing to ask for -
        everything is in your partner area.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/hub" className="btn btn-accent">
          Your partner area
        </Link>
        <Link href="/" className="btn btn-ghost">
          Read the programme
        </Link>
      </div>
    </>
  );
}

function AlreadyAsked({ at, accepted }: { at: Date; accepted: boolean }) {
  return (
    <>
      <h1 className="display mt-5 text-5xl leading-none sm:text-6xl">
        {accepted ? "We said yes" : "We have your request"}
      </h1>
      <p className="mt-5 max-w-xl text-lg text-muted">
        {accepted
          ? "Your request was accepted and an invitation went out. It is a link of its own - check wherever you asked us to reach you, and open that."
          : "You wrote to us on " +
            formatDate(at) +
            " and we haven't answered yet. Sending it again won't make it move faster, and it would land underneath the first one."}
      </p>
      <p className="mt-4 max-w-xl text-sm text-faint">
        If something has changed, or you think it got lost, reply to whatever thread we
        started - or write to us directly.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/" className="btn btn-ghost">
          Back to the programme
        </Link>
      </div>
    </>
  );
}
