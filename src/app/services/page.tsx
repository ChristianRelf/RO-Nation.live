import type { Metadata } from "next";
import Link from "next/link";
import { EnquiryForm } from "@/components/enquiry-form";
import { Reveal } from "@/components/reveal";
import { Kicker, SectionHeading } from "@/components/ui";
import { activePartners } from "@/lib/partners/registry";
import { OfficialMark } from "@/components/official-mark";
import { getUserSession } from "@/lib/session";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Services",
  description:
    "What RO. Nation LIVE does for other groups: production, custom venues, free account-tied ticketing with door verification, and a branded site of your own.",
  alternates: { canonical: "/services" },
};

// What you get if you hire us.
//
// ---- Why this is not /about -----------------------------------------------
//
// /about is who we ARE - the identity, the values, the ticketing explainer the footer
// links to. It is written for somebody deciding whether to come to a show. Nothing on it
// changes.
//
// This is written for the other visitor entirely: a group leader with a launch to run, a
// date in mind, and no idea whether RNL is a production company or four kids with a
// baseplate. It answers "what do I actually get", in the order they will ask it, and it
// ends in a form rather than a Discord link.
//
// ---- Every claim on this page is already shipped --------------------------
//
// Nothing here is aspirational, and that discipline matters more on this page than on any
// other, because this is the one where a promise turns into an obligation. Free
// account-tied tickets, capacity enforced at the door, in-experience verification over the
// API, a manual door tool, a VIP list and a blacklist, scoped API keys, a partner's own
// branded site - all of it exists, today, and Sleep Token is running on it.
//
// One thing it must NOT do: link the API reference. That lives at
// portal.ronation.live/docs/api behind requireDocsReader, so a link from a public sales
// page ships a prospect straight into a login wall. Describe it; hand it over with the key.

const process = [
  {
    step: "01",
    title: "Brief",
    body: "Tell us the date, the concept and roughly how many people you want in the room. We come back with what's possible, what it needs, and what we'd do differently.",
  },
  {
    step: "02",
    title: "Build",
    body: "The venue is built for the show, from the blockout up - stage, lighting, set pieces, the lot. Not a template with your logo dropped into it.",
  },
  {
    step: "03",
    title: "Ticket",
    body: "Your show gets a page, a capacity and free tickets tied to Roblox accounts. Reserve, cancel, sold-out states - all handled, none of it your problem.",
  },
  {
    step: "04",
    title: "Door",
    body: "On the night, tickets are verified inside the experience through our API. No screenshots, no queue-jumping, no arguing with a moderator about a DM.",
  },
  {
    step: "05",
    title: "Recap",
    body: "You get the numbers - who reserved, who actually turned up - and the room, if you want to keep it.",
  },
];

const platform = [
  {
    title: "Tickets that are actually tickets",
    body: "Free, one per Roblox account, tied to that account. Nothing to screenshot, nothing to sell on, nothing to fake.",
  },
  {
    title: "A door that holds",
    body: "Capacity is enforced where it matters - at the door, inside the experience, over an HTTP call your game server makes as somebody walks in.",
  },
  {
    title: "A manual door too",
    body: "When the scanner breaks and there are two hundred people outside, somebody on the crew opens a page and checks people in by hand. It is not a nice-to-have.",
  },
  {
    title: "A VIP list and a blacklist",
    body: "Who gets in early and who does not get in at all - kept in one place, with an append-only history of who changed what.",
  },
  {
    title: "Keys, scoped to you",
    body: "Your experience gets its own API key, scoped to your org and to exactly the things it may do. It cannot read anybody else's shows, and you can revoke it yourself.",
  },
  {
    title: "Nobody pays us in Robux",
    body: "Every ticket on this platform is free today. There is no payment flow to trust us with, because there is no payment.",
  },
];

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: { sent?: string; error?: string };
}) {
  const session = await getUserSession();
  const partners = activePartners();

  return (
    <div className="relative">
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-64" />

      <div className="shell relative pt-16 sm:pt-20">
        <Kicker>Work with us</Kicker>
        <h1 className="display mt-5 text-5xl sm:text-6xl md:text-7xl">
          We&apos;ll run
          <br />
          your show.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          Production, a venue built for the night, and a ticketing system that
          actually holds the door. You bring the audience.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="#book" className="btn btn-accent">
            Start a booking
          </Link>
          <Link href="/events" className="btn btn-ghost">
            See what we&apos;ve run
          </Link>
        </div>
      </div>

      {/* ---- THE PROCESS ---- */}
      <section className="shell py-20">
        <SectionHeading
          kicker="How it goes"
          title={<>Brief to door, in five.</>}
        />
        <div className="mt-10 divide-y divide-line border-y border-line">
          {process.map((p, i) => (
            <Reveal key={p.step} delay={i * 55}>
              <div className="grid gap-4 py-7 md:grid-cols-[6rem_14rem_1fr] md:items-baseline">
                <span className="font-display text-4xl text-accent">{p.step}</span>
                <h3 className="font-display text-2xl">{p.title}</h3>
                <p className="text-muted">{p.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---- THE PLATFORM ---- */}
      <section className="border-y border-line bg-elev">
        <div className="shell py-20">
          <SectionHeading
            kicker="The part nobody else has"
            title={
              <>
                The ticketing
                <br className="hidden sm:block" /> is the product.
              </>
            }
          />
          <p className="mt-5 max-w-2xl text-muted">
            Anybody can build you a stage. The reason shows on this platform start
            on time is the box office behind them - and it is the same one RO. Nation
            LIVE runs its own shows on.
          </p>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {platform.map((f, i) => (
              <Reveal key={f.title} delay={i * 55}>
                <div className="card h-full p-7">
                  <h3 className="font-display text-xl">{f.title}</h3>
                  <p className="mt-3 text-muted">{f.body}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <p className="mt-8 max-w-2xl text-sm text-faint">
            The API reference, the key and the Luau you drop into your experience all
            come with the booking - the docs live behind the staff portal, so we hand
            them over rather than leaving you to find them.
          </p>
        </div>
      </section>

      {/* ---- A SITE OF YOUR OWN ---- */}
      {/* Only rendered when a partner site actually exists to point at. A sales page
          claiming a product with no live example is a page inviting somebody to ask for
          one - and the registry is the honest source, because it is the same data the
          middleware routes on. */}
      {partners.length ? (
        <section className="shell py-20">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <SectionHeading kicker="If you want one" title="A site of your own" />
              <p className="mt-6 text-muted">
                Your brand, your shows, your box office - on your own subdomain, with
                a portal your crew signs into and a studio where you write your own
                pages. You run it. We keep it standing.
              </p>
              <p className="mt-4 text-muted">
                It is not a mock-up. {partners.length === 1 ? "It is" : "They are"}{" "}
                live right now:
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                {partners.map((p) => (
                  <Link
                    key={p.slug}
                    href="/partners"
                    className="btn btn-ghost !py-2.5"
                  >
                    {p.name}
                  </Link>
                ))}
              </div>
            </div>

            <div className="card p-8">
              <h3 className="font-display text-2xl">What comes with it</h3>
              <ul className="mt-5 space-y-3 text-muted">
                {[
                  "Your own subdomain, in your own colours and typeface",
                  "Your shows, your line-up, your ticket pages",
                  "A portal for your crew - roster, door, VIP list, blacklist",
                  "A studio to write your homepage, blog and open roles",
                  "API keys scoped to your org, that you revoke yourself",
                ].map((l) => (
                  <li key={l} className="flex gap-3">
                    <span className="text-accent">✦</span>
                    {l}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      {/* ---- BOOK ---- */}
      <section id="book" className="border-t border-line bg-elev scroll-mt-24">
        <div className="shell py-20">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr]">
            <div>
              <Kicker>Start here</Kicker>
              <h2 className="display mt-4 text-4xl sm:text-5xl">
                Tell us what you&apos;re planning.
              </h2>
              <p className="mt-5 max-w-md text-muted">
                A rough date and a rough size is enough to start. You do not need a
                spec - the first reply is us telling you what one would look like.
              </p>
              <p className="mt-5 max-w-md text-muted">
                Would rather just talk? The{" "}
                <a
                  href={site.socials.discord}
                  target="_blank"
                  rel="noreferrer"
                  className="link-underline text-accent"
                >
                  Discord
                </a>{" "}
                is always open, and usually faster.
              </p>
            </div>

            {/* Pinned to BOOKING, so the two extra fields - roughly when, roughly how big
                - are showing before they start typing. returnTo brings them back HERE on
                submit rather than teleporting them to /contact mid-thought. */}
            <div>
              <OfficialMark className="mb-4" />
              <EnquiryForm
                session={session}
                defaultKind="BOOKING"
                returnTo="/services"
                sent={searchParams.sent === "1"}
                error={searchParams.error}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
