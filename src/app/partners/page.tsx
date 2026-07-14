import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { Kicker, SectionHeading } from "@/components/ui";
import { site } from "@/lib/site";
import { activePartners } from "@/lib/partners/registry";
import { partnerOrigin } from "@/lib/partners/urls";

export const metadata: Metadata = {
  title: "Partners",
  description:
    "The groups, creators and sponsors who help RO. Nation LIVE put on bigger, better shows.",
};

// ---- The "Our partners" list that used to be here -------------------------
//
// A hardcoded array with one entry left in it - "SHA SHA Productions", described as "the
// production company that builds our stages" - and a dangling empty element where the
// others had already been deleted.
//
// Its "Visit" button linked to site.socials.roblox. That is RO. Nation LIVE's OWN Roblox
// group. The card was pointing RNL at itself and calling it a partner. (SHASHA is not a
// company at all - it is the name of RNL's internal staff portal scope, which is why it
// sits in the registry's RESERVED slug list.)
//
// It is gone, and nothing replaces it. The section below is derived from the partner
// registry - the same code the middleware routes on - so it cannot claim a partner who
// isn't live, and it cannot miss one who is. When a real production partner exists who
// is not a partner SITE, that is a schema decision, not an array to retype: a table for
// a list that is currently empty is exactly how this array happened in the first place.

export default function PartnersPage() {
  // Partner sites running on RNL infrastructure, read straight from the
  // registry that routes them - so this section cannot claim a site that isn't
  // live, or miss one that is.
  const sites = activePartners();

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

      {sites.length ? (
        <section className="shell py-14">
          <SectionHeading
            kicker="Live on our platform"
            title="Partner sites"
          />
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {sites.map((p, i) => (
              <Reveal key={p.slug} delay={i * 70}>
                <a
                  href={partnerOrigin(p.slug)}
                  className="card card-hover group flex h-full flex-col p-7"
                >
                  <div className="flex items-center gap-3">
                    <h2 className="font-display text-2xl">{p.name}</h2>
                    <span className="pill">Partner site</span>
                  </div>
                  <p className="mt-3 flex-1 text-muted">
                    Their shows, their brand - ticketed and run on RO. Nation
                    LIVE.
                  </p>
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
      ) : null}

      <section className="border-t border-line bg-elev">
        <div className="shell py-20">
          <div className="panel-paper p-10 text-center sm:p-16">
            <h2 className="display text-5xl text-black sm:text-6xl">
              Become a partner
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-black/70">
              Building, music, media, or sponsorship - if you want to reach a
              live Roblox crowd, let&apos;s talk. Tell us what you do and how
              you&apos;d like to get involved.
            </p>
            {/* Was a Discord link. It goes to the form now, pre-set to PARTNERSHIP, so an
                enquiry lands in an inbox somebody works through rather than in a channel it
                scrolls out of. The Discord is still right there underneath, because for a
                lot of people it genuinely is the better door. */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/contact?kind=partnership"
                className="inline-flex items-center gap-2 rounded-[3px] bg-black px-6 py-3 text-[12px] font-bold uppercase tracking-[0.09em] text-paper transition-colors hover:bg-accent hover:text-accent-ink"
              >
                Tell us what you do
              </Link>
              <a
                href={site.socials.discord}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-black/70 underline transition-colors hover:text-black"
              >
                or find us on Discord
              </a>
            </div>

            <p className="mt-6 text-sm text-black/60">
              Want a site and a box office of your own?{" "}
              <Link href="/services" className="underline">
                Here&apos;s what that involves
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
