import type { Metadata } from "next";
import { Reveal } from "@/components/reveal";
import { Kicker, SectionHeading } from "@/components/ui";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Partners",
  description:
    "The groups, creators and sponsors who help RO. Nation LIVE put on bigger, better shows.",
};

// Static list — swap names/blurbs/links for real partners.
const partners = [
  {
    name: "Neon District",
    tier: "Headline sponsor",
    blurb:
      "Roblox fashion group powering our stage looks and giving away in-experience merch at every show.",
    url: site.socials.roblox,
  },
  {
    name: "Studio Vantage",
    tier: "Build partner",
    blurb:
      "Environment artists who co-build our biggest festival maps and lighting rigs.",
    url: site.socials.roblox,
  },
  {
    name: "Pulse Audio",
    tier: "Audio partner",
    blurb:
      "Original music and live sets soundtracking our headline nights.",
    url: site.socials.youtube,
  },
  {
    name: "Frame Collective",
    tier: "Media partner",
    blurb:
      "Editors and streamers who capture and broadcast our events to a wider audience.",
    url: site.socials.x,
  },
];

export default function PartnersPage() {
  return (
    <div className="relative">
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-64" />
      <div className="shell relative pt-16 sm:pt-20">
        <Kicker>Better together</Kicker>
        <h1 className="display mt-5 text-5xl sm:text-6xl md:text-7xl">
          Partners
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          Great events aren&apos;t built alone. These groups, creators and
          sponsors help us build bigger stages, louder shows and a better night
          for the crowd.
        </p>
      </div>

      <section className="shell py-14">
        <SectionHeading kicker="Who we work with" title="Our partners" />
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {partners.map((p, i) => (
            <Reveal key={p.name} delay={i * 70}>
              <a
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="card card-hover group flex h-full flex-col p-7"
              >
                <div className="flex items-center gap-3">
                  <h2 className="font-display text-2xl">{p.name}</h2>
                  <span className="pill">{p.tier}</span>
                </div>
                <p className="mt-3 flex-1 text-muted">{p.blurb}</p>
                <span className="mt-6 inline-flex items-center gap-2 font-semibold text-accent">
                  Visit
                  <span className="transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </span>
              </a>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="border-t border-line bg-elev">
        <div className="shell py-20">
          <div className="panel-paper p-10 text-center sm:p-16">
            <h2 className="display text-5xl text-black sm:text-6xl">
              Become a partner
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-black/70">
              Building, music, media, or sponsorship — if you want to reach a
              live Roblox crowd, let&apos;s talk. Tell us what you do and how
              you&apos;d like to get involved.
            </p>
            <a
              href={site.socials.discord}
              className="mt-8 inline-flex items-center gap-2 rounded-[3px] bg-black px-6 py-3 text-[12px] font-bold uppercase tracking-[0.09em] text-paper transition-colors hover:bg-accent hover:text-white"
            >
              Partner with us on Discord
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
