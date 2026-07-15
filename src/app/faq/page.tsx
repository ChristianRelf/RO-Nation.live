import type { Metadata } from "next";
import Link from "next/link";
import { Kicker, SectionHeading } from "@/components/ui";
import { JsonLd } from "@/components/json-ld";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers to common questions about RO. Nation LIVE tickets, entry, Roblox sign-in, events and joining the crew.",
  alternates: { canonical: "/faq" },
};

const groups = [
  {
    kicker: "Tickets & entry",
    title: "Getting in",
    faqs: [
      {
        q: "Are tickets really free?",
        a: "Yes. Every RO. Nation LIVE ticket is free - you just need a Roblox account to reserve one so we can verify you at the door.",
      },
      {
        q: "How do I get a ticket?",
        a: "Open an event, hit reserve, accept the ticket terms, and it's saved to your account. You'll find it on your tickets page.",
      },
      {
        q: "What does 'activate' do?",
        a: "Activating a ticket reveals your entry mark and prepares it for the door. Do it when you're heading in to the event.",
      },
      {
        q: "Can I give my ticket to a friend?",
        a: "No - tickets are tied to your Roblox account and can't be transferred or sold. Everyone needs to reserve their own free ticket.",
      },
      {
        q: "I reserved a ticket but can't get in - help?",
        a: "Make sure you're signed in with the same Roblox account you reserved with. Still stuck? Drop a message in the Discord support channel.",
      },
    ],
  },
  {
    kicker: "Accounts & sign-in",
    title: "Roblox sign-in",
    faqs: [
      {
        q: "Why do I need to sign in with Roblox?",
        a: "Tickets are verified inside our Roblox experiences at the door. Signing in with Roblox lets us tie your ticket to your account so entry is fast and fake-proof.",
      },
      {
        q: "What data do you get from Roblox?",
        a: "Just the basics: your user ID, username, display name and avatar. We never see your password. See our Privacy Policy for details.",
      },
      {
        q: "Can I delete my account?",
        a: `Yes. Contact us and we'll remove your account and associated tickets. You can reach us at ${site.contactEmail}.`,
      },
    ],
  },
  {
    kicker: "Events",
    title: "At the show",
    faqs: [
      {
        q: "Where do events take place?",
        a: "Inside Roblox experiences we build and run. Each event page links to the experience - join when doors open.",
      },
      {
        q: "What if an event is cancelled or rescheduled?",
        a: "We may change the date, venue or line-up of any event. We'll announce changes through our channels ahead of time where possible.",
      },
      {
        q: "Can you produce an event for my group?",
        a: "We do. Message us on Discord with your date, concept and rough scale and we'll put together a plan.",
      },
    ],
  },
  {
    kicker: "Crew & careers",
    title: "Joining the crew",
    faqs: [
      {
        q: "How do I join the crew?",
        a: "Check the Careers page for open roles and apply directly. We open new positions before every season.",
      },
      {
        q: "Do I need experience?",
        a: "Depends on the role. Some need building or hosting experience; others just need reliability and a good attitude. Each listing spells out what we're after.",
      },
    ],
  },
];

export default function FaqPage() {
  // The whole page's Q&A, flattened out of the same `groups` the page renders -
  // one source, so the structured data cannot drift from what a visitor reads.
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: groups.flatMap((g) =>
      g.faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    ),
  };

  return (
    <div className="relative">
      <JsonLd data={faqLd} />
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-64" />
      <div className="shell relative pt-16 sm:pt-20">
        <Kicker>Help centre</Kicker>
        <h1 className="display mt-5 text-5xl sm:text-6xl md:text-7xl">
          Questions
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          Everything you might need to know about tickets, entry and joining the
          crew. Can&apos;t find it here? The Discord is the fastest way to reach
          us.
        </p>
      </div>

      {groups.map((group, gi) => (
        <section
          key={group.title}
          className={
            gi % 2 === 1 ? "border-y border-line bg-elev" : ""
          }
        >
          <div className="shell py-16">
            <SectionHeading kicker={group.kicker} title={group.title} />
            <div className="mt-8 max-w-3xl space-y-3">
              {group.faqs.map((f) => (
                <details
                  key={f.q}
                  className="card group p-0 [&_summary::-webkit-details-marker]:hidden"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-semibold text-fg">
                    {f.q}
                    <span className="text-accent transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="px-5 pb-5 text-muted">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      ))}

      <section className="shell py-20">
        <div className="panel-paper p-10 text-center sm:p-16">
          <h2 className="display text-5xl text-black sm:text-6xl">
            Still stuck?
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-black/70">
            Our team is quickest to reach on Discord. For anything you&apos;d
            rather put in writing, drop us an email.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href={site.socials.discord}
              className="inline-flex items-center gap-2 rounded-[3px] bg-black px-6 py-3 text-[12px] font-bold uppercase tracking-[0.09em] text-paper transition-colors hover:bg-accent hover:text-accent-ink"
            >
              Ask on Discord
            </a>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-[3px] border border-black/25 px-6 py-3 text-[12px] font-bold uppercase tracking-[0.09em] text-black transition-colors hover:bg-black hover:text-paper"
            >
              Contact the team
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
