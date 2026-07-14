import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Reveal } from "@/components/reveal";
import { Kicker } from "@/components/ui";
import { robloxProfileUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Meet the crew",
  description:
    "The builders, hosts, editors and moderators behind RO. Nation LIVE.",
};

// ---- The roster that used to be here --------------------------------------
//
// Six people, hardcoded in this file, with names, roles, blurbs and Roblox handles. None
// of them existed. Ava Renn, Milo Kade, Sena Okoye, Ray Vasquez, Juno Park, Cole Draper -
// and @avarenn, @milobuilds, @senalive, @rayvfx, @junoedits, @coledraper, handles pointing
// at Roblox accounts that are either nobody or, worse, somebody else entirely.
//
// Inventing a statistic is bad. Inventing a PERSON - giving them a job title at a real
// company and a handle on a real platform - is a different category of thing, and it was
// the worst thing on this site.
//
// It is a table now, and the shape of the table is the defence: a crew member is
// IDENTIFIED BY A ROBLOX ID that came back from Roblox's own API through the picker in
// /company/team. You cannot type a person into this page any more. You can only find one.
//
// When there is nobody on the crew yet, the grid is simply absent - hero, then the hiring
// CTA. That reads as "we're hiring", which is true, rather than as broken.

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default async function TeamPage() {
  const crew = await prisma.teamMember.findMany({
    where: { visible: true },
    orderBy: [{ department: "asc" }, { order: "asc" }, { displayName: "asc" }],
  });

  // Grouped, in the order the departments first appear - so the ordering column controls
  // the sections as well as the cards inside them, and there is no second list of
  // department names anywhere to fall out of step with the data.
  const departments = crew.reduce<Record<string, typeof crew>>((acc, m) => {
    (acc[m.department] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div className="relative">
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-64" />
      <div className="shell relative pt-16 sm:pt-20">
        <Kicker>Who runs it</Kicker>
        <h1 className="display mt-5 text-5xl sm:text-6xl md:text-7xl">
          Meet the crew
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          A full crew of builders, hosts, editors and moderators. These are the
          people who turn an empty baseplate into a night people log in for.
        </p>
      </div>

      {Object.entries(departments).map(([department, members]) => (
        <section key={department} className="shell pt-14">
          <h2 className="kicker">{department}</h2>

          <div className="mt-6 grid gap-6 sm:grid-cols-2 md:grid-cols-3">
            {members.map((m, i) => (
              <Reveal key={m.id} delay={i * 70}>
                <div className="card h-full p-7">
                  <div className="flex items-center gap-4">
                    {m.avatarUrl ? (
                      // Not next/image: these are Roblox CDN URLs and they ROTATE, so a
                      // host that is not in next.config's remotePatterns throws rather than
                      // degrading. A crew card is not worth a crash - the same call
                      // product-card.tsx makes, for the same reason.
                      //
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.avatarUrl}
                        alt=""
                        loading="lazy"
                        className="h-14 w-14 shrink-0 rounded-full border border-accent/30 bg-accent-soft object-cover"
                      />
                    ) : (
                      // The headshot URL rotted, or Roblox had nothing. Initials, not a
                      // broken image icon.
                      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-accent/30 bg-accent-soft font-display text-lg text-accent">
                        {initials(m.displayName)}
                      </div>
                    )}

                    <div className="min-w-0">
                      <h3 className="truncate font-display text-xl">
                        {m.displayName}
                      </h3>
                      <p className="mt-0.5 truncate text-sm font-semibold text-fg">
                        {m.role}
                      </p>
                    </div>
                  </div>

                  {m.bio ? <p className="mt-4 text-muted">{m.bio}</p> : null}

                  {/* A real link to a real profile. The old page printed a handle you
                      could not click, because there was nothing at the other end of it. */}
                  <a
                    href={robloxProfileUrl(m.robloxId)}
                    target="_blank"
                    rel="noreferrer"
                    className="link-underline mt-4 inline-block font-mono text-xs text-faint transition-colors hover:text-accent"
                  >
                    @{m.robloxUsername}
                  </a>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      ))}

      <section className={crew.length ? "mt-20" : "pt-14"}>
        <div className="border-t border-line bg-elev">
          <div className="shell py-20">
            <div className="panel-paper p-10 text-center sm:p-16">
              <h2 className="display text-5xl text-black sm:text-6xl">Want in?</h2>
              <p className="mx-auto mt-5 max-w-md text-black/70">
                We open new roles before every season - builders, hosts, editors
                and moderators. If you take events seriously, we want to hear from
                you.
              </p>
              <Link
                href="/careers"
                className="mt-8 inline-flex items-center gap-2 rounded-[3px] bg-black px-6 py-3 text-[12px] font-bold uppercase tracking-[0.09em] text-paper transition-colors hover:bg-accent hover:text-accent-ink"
              >
                See open roles
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
