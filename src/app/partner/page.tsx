import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getPartnerAccountUser } from "@/lib/partner-account";
import {
  PROGRAMME_OFFERS,
  PROGRAMME_JOURNEY,
  PROGRAMME_FIT,
} from "@/lib/partner-program";
import { PARTNER_AGREEMENTS } from "@/lib/legal";
import { activePartners } from "@/lib/partners/registry";
import { partnerOrigin } from "@/lib/partners/urls";
import { getLiveMemberCount } from "@/lib/partner-groups/roblox";
import { ProgrammeShell } from "@/components/partner/programme-shell";
import { RobloxAvatar } from "@/components/roblox-picker";
import { Kicker } from "@/components/ui";
import { site } from "@/lib/site";
import { robloxGroupUrl } from "@/lib/utils";
import { env } from "@/lib/env";

// partner.ronation.live - what the partner programme is.
//
// The public front door of the host, and the only page on it that wants to be indexed.
// Everything else here is either somebody's own area or a link that was handed to them.
//
// ---- What this page is for -------------------------------------------------
//
// One reader: somebody deciding whether to spend an hour talking to us. So it answers the
// three questions that decide it, in the order they get asked - what do we get, what does
// it cost, and is this for us - and then offers the form. It does not open with our
// history, and it does not have a "why choose us" section, because neither is a question
// anybody arrived with.
//
// The offer, the journey and the fit list all come from lib/partner-program.ts, which is
// also what the application form's checkboxes and the onboarding explainer read. That is
// the whole reason it is a module rather than JSX: a pitch that lives in three places
// disagrees with itself within a month, and the version a partner is held to is whichever
// one they happened to read.
//
// ---- The split is on the page, in numbers ----------------------------------
//
// Deliberately, and it is the one thing here that could reasonably have been left to the
// agreement. It is not left to the agreement, because the first question anybody asks is
// "what do you take", and a partner programme that will not answer it above the fold is
// one people assume the worst of.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Partner with RO. Nation LIVE",
  description:
    "Your own site, ticketing, a shelf in our shop and a crew who have run the night before. What the RO. Nation LIVE partner programme offers, what it costs, and how to join.",
  alternates: { canonical: "/" },
  // The full object, url and images included, and NOT because they differ from the
  // layout's - they are identical. `openGraph` is replaced wholesale by the deepest
  // segment that declares one rather than deep-merged, so declaring only a title here
  // silently drops the host's og:url, og:site_name and og:image. This is the one page on
  // the host that exists to be pasted into a Discord, which makes a blank preview card
  // the most expensive version of that bug. See the note in layout.tsx.
  openGraph: {
    title: "Partner with RO. Nation LIVE",
    description:
      "Your own site, ticketing, merchandise and production - for Roblox groups, creators and brands putting on live shows.",
    type: "website",
    siteName: "RO. Nation LIVE Partners",
    url: "/",
    images: ["/opengraph-image"],
  },
  // Same story: the root layout sets a `twitter` block, so without one here the card
  // would carry RNL's generic marketing copy directly under the og: tags above and
  // contradict them.
  twitter: {
    card: "summary_large_image",
    title: "Partner with RO. Nation LIVE",
    description:
      "Your own site, ticketing, merchandise and production - for Roblox groups, creators and brands putting on live shows.",
    images: ["/opengraph-image"],
  },
};

export default async function PartnerProgrammePage() {
  // Only to decide which button to show. A signed-in partner being invited to "ask about
  // partnering" is the sort of thing that makes a product feel like it does not know who
  // is holding it. The guard on /hub is what protects /hub.
  const partner = await getPartnerAccountUser();
  const sites = activePartners();

  // Roblox groups RNL credits with a card - see the note atop PartnerGroup in
  // schema.prisma for why this is a third thing, distinct from the registry's partner
  // SITES below. Member counts are read live, per group, and never stored: see
  // getLiveMemberCount in lib/partner-groups/roblox.ts for why a stale number is worse
  // than a missing one.
  const partnerGroups = await prisma.partnerGroup.findMany({
    where: { visible: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  const partnerGroupCounts = await Promise.all(
    partnerGroups.map((g) => getLiveMemberCount(g.robloxGroupId)),
  );

  return (
    <ProgrammeShell
      cta={
        partner
          ? { label: "Your partner area", href: "/hub" }
          : { label: "Ask about partnering", href: "/join/new" }
      }
    >
      {/* ---- Hero ---------------------------------------------------- */}
      <section className="relative">
        <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-80" />
        <div className="shell relative pb-16 pt-16 sm:pt-24">
          <Kicker>Partner programme</Kicker>
          <h1 className="display mt-5 max-w-4xl text-5xl leading-[0.95] sm:text-6xl md:text-7xl">
            We put on the show. You keep the audience.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted">
            {site.name} runs live events on Roblox - stages, lighting, ticketing, a door
            and a crew. The partner programme puts all of it behind{" "}
            <span className="text-fg">your</span> name: your own site, your own tickets,
            your merch in our shop, and your shows in front of our audience.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            {partner ? (
              <Link href="/hub" className="btn btn-accent">
                Your partner area
              </Link>
            ) : (
              <Link href="/join/new" className="btn btn-accent">
                Ask about partnering
              </Link>
            )}
            <a href="#offer" className="btn btn-ghost">
              What you get
            </a>
          </div>

          {/* The answer to the question everybody asks first, above the fold, in
              numbers. See the note at the top of this file. */}
          <dl className="mt-14 grid gap-px overflow-hidden rounded-brand border border-line bg-line sm:grid-cols-3">
            <Figure
              value="90%"
              label="of merch revenue"
              note="After Roblox's 30%. We keep 10% of what reaches us."
            />
            <Figure
              value="None"
              label="to join"
              note="No fee, no retainer, no minimum. We earn when you do."
            />
            <Figure
              value="Yours"
              label="to leave with"
              note="Your assets stay yours. You can withdraw any of them."
            />
          </dl>
        </div>
      </section>

      {/* ---- Our Partners ----------------------------------------------
          Roblox groups RNL credits here, each identified by nothing but its group id -
          see the note atop PartnerGroup in schema.prisma. Deliberately its own section,
          separate from "Partner sites" further down: that one is white-label sites
          running on RNL's infrastructure, read from the registry; this one is groups
          RNL wants to publicly thank, added and described from /company/partner-groups. */}
      {partnerGroups.length ? (
        <section className="shell border-t border-line py-16">
          <Kicker>Our partners</Kicker>
          <h2 className="display mt-4 text-4xl sm:text-5xl">Who we work with</h2>
          <p className="mt-4 max-w-2xl text-muted">
            The groups and communities who help us bring the show to their crowd.
          </p>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {partnerGroups.map((g, i) => (
              <a
                key={g.id}
                href={robloxGroupUrl(g.robloxGroupId)}
                target="_blank"
                rel="noreferrer"
                className="card card-hover flex flex-col gap-4 p-6"
              >
                <div className="flex items-center gap-3">
                  <RobloxAvatar src={g.iconUrl} size={44} />
                  <div className="min-w-0">
                    <h3 className="truncate font-display text-xl">{g.name}</h3>
                    {/* null means Roblox would not answer - printed as nothing rather
                        than a fabricated or stale count. See getLiveMemberCount. */}
                    {partnerGroupCounts[i] != null ? (
                      <p className="text-xs text-faint">
                        {partnerGroupCounts[i]!.toLocaleString("en-GB")} members
                      </p>
                    ) : null}
                  </div>
                </div>
                <p className="flex-1 text-sm text-muted">{g.description}</p>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {/* ---- The offer ------------------------------------------------ */}
      <section id="offer" className="shell scroll-mt-8 border-t border-line py-16">
        <Kicker>The offer</Kicker>
        <h2 className="display mt-4 text-4xl sm:text-5xl">Everything on the table</h2>
        <p className="mt-4 max-w-2xl text-muted">
          Not a bundle. Each of these is switched on per partner, and a partner who only
          wants two of them gets two of them.
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {PROGRAMME_OFFERS.map((offer) => (
            <article key={offer.id} className="card flex flex-col p-6">
              <h3 className="font-display text-2xl">{offer.title}</h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">
                {offer.body}
              </p>

              {offer.terms ? (
                <p className="mt-4 rounded-brand border border-accent/25 bg-accent-soft px-3 py-2 text-xs font-semibold text-accent">
                  {offer.terms}
                </p>
              ) : null}

              {offer.agreementHref ? (
                <a
                  href={offer.agreementHref}
                  className="link-underline mt-4 self-start text-[11px] font-bold uppercase tracking-kicker text-faint transition-colors hover:text-accent"
                >
                  Read the agreement
                </a>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      {/* ---- Who it is for -------------------------------------------- */}
      <section className="shell border-t border-line py-16">
        <Kicker>Fit</Kicker>
        <h2 className="display mt-4 text-4xl sm:text-5xl">Is this for you?</h2>
        <p className="mt-4 max-w-2xl text-muted">
          The most expensive thing either of us can do is spend three weeks finding out the
          answer was no. So here it is on the first page.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="card p-6">
            <h3 className="text-[11px] font-bold uppercase tracking-kicker text-accent">
              Yes, get in touch
            </h3>
            <ul className="mt-4 space-y-3">
              {PROGRAMME_FIT.yes.map((line) => (
                <li key={line} className="flex gap-3 text-sm text-muted">
                  <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-accent" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-6">
            <h3 className="text-[11px] font-bold uppercase tracking-kicker text-faint">
              Probably not
            </h3>
            <ul className="mt-4 space-y-3">
              {PROGRAMME_FIT.no.map((line) => (
                <li key={line} className="flex gap-3 text-sm text-muted">
                  <span
                    aria-hidden
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-line-strong"
                  />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ---- How it goes ---------------------------------------------- */}
      <section className="shell border-t border-line py-16">
        <Kicker>How it goes</Kicker>
        <h2 className="display mt-4 text-4xl sm:text-5xl">From asking to on air</h2>

        <ol className="mt-10 divide-y divide-line/60 border-y border-line">
          {PROGRAMME_JOURNEY.map((step, i) => (
            <li key={step.title} className="flex gap-6 py-6">
              <span
                aria-hidden
                className="tnum display shrink-0 text-3xl leading-none text-faint"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0">
                <span className="block font-display text-xl leading-tight">
                  {step.title}
                </span>
                <span className="mt-1.5 block max-w-2xl text-sm text-muted">
                  {step.body}
                </span>
              </span>
            </li>
          ))}
        </ol>

        <p className="mt-6 max-w-2xl text-xs text-faint">
          Been sent an invitation by someone here? It is a link of its own - open that
          instead, and it will pick up from step three.
        </p>
      </section>

      {/* ---- The paperwork -------------------------------------------- */}
      <section className="shell border-t border-line py-16">
        <Kicker>The paperwork</Kicker>
        <h2 className="display mt-4 text-4xl sm:text-5xl">
          Read it before you talk to us
        </h2>
        <p className="mt-4 max-w-2xl text-muted">
          All three are public. Nothing in them is negotiated in private and then sprung on
          you, and anything you want changed is changed before either side commits to it.
        </p>

        <div className="mt-8 divide-y divide-line border-y border-line">
          {PARTNER_AGREEMENTS.map((doc) => (
            <a
              key={doc.href}
              href={doc.href}
              className="group flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-5"
            >
              <span className="min-w-0">
                <span className="font-display text-xl transition-colors group-hover:text-accent">
                  {doc.title}
                </span>
                <span className="mt-1 block max-w-2xl text-sm text-muted">
                  {doc.blurb}
                </span>
              </span>
              <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] text-faint">
                Updated {doc.updated}
              </span>
            </a>
          ))}
        </div>
      </section>

      {/* ---- Who is already here --------------------------------------
          Derived from the registry that ROUTES these sites, so this cannot claim a
          partner who is not live or miss one who is. The main site's /partners page
          does exactly the same, for the same reason - see the long note there about
          the hardcoded array this replaced. */}
      {sites.length ? (
        <section className="shell border-t border-line py-16">
          <Kicker>Already here</Kicker>
          <h2 className="display mt-4 text-4xl sm:text-5xl">Partner sites</h2>
          <div className="mt-8 flex flex-wrap gap-3">
            {sites.map((p) => (
              <a
                key={p.slug}
                href={partnerOrigin(p.slug)}
                className="card px-5 py-4 transition-colors hover:border-line-strong"
              >
                <span className="block font-display text-lg">{p.name}</span>
                <span className="mt-0.5 block font-mono text-[11px] text-faint">
                  {p.slug}.{site.domain} ↗
                </span>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {/* ---- The ask --------------------------------------------------- */}
      <section className="border-t border-line">
        <div className="shell py-20 text-center">
          <h2 className="display text-4xl sm:text-5xl">
            {partner ? "You're already in." : "Tell us what you run."}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted">
            {partner
              ? "Everything above is yours to use. Your agreements, your account and your paperwork are in your partner area."
              : "A few boxes and two paragraphs. A person reads every one of these, and you will get a real answer rather than a queue position."}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {partner ? (
              <Link href="/hub" className="btn btn-accent">
                Your partner area
              </Link>
            ) : (
              <Link href="/join/new" className="btn btn-accent">
                Ask about partnering
              </Link>
            )}
            <a href={`${env.siteUrl}/contact?kind=partnership`} className="btn btn-ghost">
              Or just write to us
            </a>
          </div>
        </div>
      </section>
    </ProgrammeShell>
  );
}

function Figure({
  value,
  label,
  note,
}: {
  value: string;
  label: string;
  note: string;
}) {
  return (
    <div className="bg-bg p-6">
      <dt className="text-[11px] font-bold uppercase tracking-kicker text-faint">
        {label}
      </dt>
      <dd className="display mt-2 text-4xl leading-none text-accent">{value}</dd>
      <p className="mt-3 text-xs text-muted">{note}</p>
    </div>
  );
}
