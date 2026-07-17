import type { Metadata } from "next";
import Link from "next/link";
import type { EnquiryKind } from "@prisma/client";
import { EnquiryForm } from "@/components/enquiry-form";
import { Kicker, SectionHeading } from "@/components/ui";
import { OfficialMark } from "@/components/official-mark";
import { getUserSession } from "@/lib/session";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with RO. Nation LIVE - bookings, partnerships, press and support.",
};

// Getting hold of us.
//
// This page used to be three links and nothing else. There was no form anywhere on the
// site: every "book us" and "work with us" call to action - here, on /about, on /partners -
// pointed at Discord, which is a fine channel for a fan and a strange one for a group
// leader with a launch to run and a budget to spend.
//
// The three channels stay, because they are all real and Discord genuinely is the fastest.
// The form is what was missing, and what it feeds - the /company/enquiries inbox - is what
// makes it more than decoration.

const KINDS = ["BOOKING", "PRESS", "PARTNERSHIP", "GENERAL"] as const;

const channels = [
  {
    title: "Discord",
    detail: "The fastest way to reach us. Support, bookings and general chat.",
    action: "Open Discord",
    href: site.socials.discord,
    primary: true,
  },
  {
    title: "Email",
    detail: "Press, partnerships and anything you'd rather put in writing.",
    action: site.contactEmail,
    href: `mailto:${site.contactEmail}`,
  },
  {
    title: "Roblox group",
    detail: "Follow the group to catch every announcement the moment it drops.",
    action: "View group",
    href: site.socials.roblox,
  },
];

const faqs = [
  {
    q: "Are tickets really free?",
    a: "Yes. Every RO. Nation LIVE ticket is free - you just need a Roblox account to reserve one so we can verify you at the door.",
  },
  {
    q: "Can you produce an event for my group?",
    a: "We do. Use the form on this page - or read what's actually involved on the Services page first.",
  },
  {
    q: "How do I join the crew?",
    a: "Check the Careers page for open roles and apply directly. We open new positions before every season.",
  },
  {
    q: "I reserved a ticket but can't get in - help?",
    a: "Make sure you're signed in with the same Roblox account you reserved with. Still stuck? Drop a message in the Discord support channel.",
  },
];

export default async function ContactPage({
  searchParams,
}: {
  searchParams: { kind?: string; sent?: string; error?: string };
}) {
  const session = await getUserSession();

  // ?kind=press / ?kind=booking presets the selector - which is what lets /press,
  // /partners and /services deep-link straight into the right conversation instead of
  // dropping somebody on a blank form and hoping.
  const requested = (searchParams.kind ?? "").toUpperCase();
  const defaultKind = (
    KINDS.includes(requested as (typeof KINDS)[number]) ? requested : "GENERAL"
  ) as EnquiryKind;

  return (
    <div className="relative">
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-64" />
      <div className="shell relative pt-16 sm:pt-20">
        <Kicker>Get in touch</Kicker>
        <h1 className="display mt-5 text-5xl sm:text-6xl md:text-7xl">Contact</h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          Booking an event, chasing a partnership, or need a hand with a ticket?
          Here&apos;s how to reach the team.
        </p>
      </div>

      <section id="form" className="shell scroll-mt-24 py-14">
        <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr]">
          {/* The channels. All three are real - which was not true of this site's
              social links until recently. */}
          <div>
            <SectionHeading kicker="Straight to us" title="The quick ways" />
            <div className="mt-8 space-y-4">
              {channels.map((c) => (
                <a
                  key={c.title}
                  href={c.href}
                  className={`card card-hover group flex flex-col p-6 ${
                    c.primary ? "ring-1 ring-accent/40" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-2xl">{c.title}</h2>
                    {c.primary ? <span className="pill">Fastest</span> : null}
                  </div>
                  <p className="mt-2 text-muted">{c.detail}</p>
                  <span className="mt-4 inline-flex items-center gap-2 font-semibold text-accent">
                    {c.action}
                    <span className="transition-transform group-hover:translate-x-1">
                      →
                    </span>
                  </span>
                </a>
              ))}
            </div>
          </div>

          <div className="lg:pt-[4.5rem]">
            <OfficialMark className="mb-4" />
            <EnquiryForm
              session={session}
              defaultKind={defaultKind}
              sent={searchParams.sent === "1"}
              error={searchParams.error}
            />
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-elev">
        <div className="shell py-20">
          <SectionHeading kicker="Good to know" title="Common questions" />
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {faqs.map((f) => (
              <div key={f.q} className="card p-6">
                <h3 className="font-semibold text-fg">{f.q}</h3>
                <p className="mt-2 text-muted">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="shell py-20">
        <div className="panel-paper p-10 text-center sm:p-16">
          <h2 className="display text-5xl text-black sm:text-6xl">
            Book RO. Nation LIVE
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-black/70">
            Tell us what you&apos;re planning - a launch party, a tournament, a full
            festival. Here&apos;s what we actually do, and what it costs you to find
            out.
          </p>
          <Link
            href="/services"
            className="mt-8 inline-flex items-center gap-2 rounded-[3px] bg-black px-6 py-3 text-[12px] font-bold uppercase tracking-[0.09em] text-paper transition-colors hover:bg-accent hover:text-accent-ink"
          >
            What we do
          </Link>
        </div>
      </section>
    </div>
  );
}
