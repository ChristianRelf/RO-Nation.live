import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { Kicker, SectionHeading } from "@/components/ui";

export const metadata: Metadata = {
  title: "Meet the crew",
  description:
    "The builders, hosts, editors and moderators behind RO. Nation LIVE.",
};

// Static roster — swap names/roles/handles for the real crew.
const crew = [
  {
    name: "Ava Renn",
    role: "Founder & Executive Producer",
    department: "Leadership",
    robloxUsername: "avarenn",
    blurb: "Runs the show end to end — booking, run-of-show and live direction.",
  },
  {
    name: "Milo Kade",
    role: "Lead Stage Builder",
    department: "Build",
    robloxUsername: "milobuilds",
    blurb: "Designs and optimises the venues, stages and set pieces in Studio.",
  },
  {
    name: "Sena Okoye",
    role: "Head Host",
    department: "Talent",
    robloxUsername: "senalive",
    blurb: "The voice of the floor — hosting, hyping and keeping the energy up.",
  },
  {
    name: "Ray Vasquez",
    role: "Technical Director",
    department: "Tech",
    robloxUsername: "rayvfx",
    blurb: "Owns the ticketing API and in-experience door verification.",
  },
  {
    name: "Juno Park",
    role: "Social & Content Lead",
    department: "Media",
    robloxUsername: "junoedits",
    blurb: "Cuts the recap videos and runs the socials between shows.",
  },
  {
    name: "Cole Draper",
    role: "Moderation Lead",
    department: "Safety",
    robloxUsername: "coledraper",
    blurb: "Keeps events safe and welcoming — moderation is a feature here.",
  },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function TeamPage() {
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

      <section className="shell py-14">
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
          {crew.map((m, i) => (
            <Reveal key={m.name} delay={i * 70}>
              <div className="card h-full p-7">
                <div className="flex items-center gap-4">
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-accent/30 bg-accent-soft font-display text-lg text-accent">
                    {initials(m.name)}
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate font-display text-xl">{m.name}</h2>
                    <span className="pill mt-1 inline-block">
                      {m.department}
                    </span>
                  </div>
                </div>
                <p className="mt-4 text-sm font-semibold text-fg">{m.role}</p>
                <p className="mt-2 text-muted">{m.blurb}</p>
                <p className="mt-4 font-mono text-xs text-faint">
                  @{m.robloxUsername}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="border-t border-line bg-elev">
        <div className="shell py-20">
          <div className="panel-paper p-10 text-center sm:p-16">
            <h2 className="display text-5xl text-black sm:text-6xl">
              Want in?
            </h2>
            <p className="mx-auto mt-5 max-w-md text-black/70">
              We open new roles before every season — builders, hosts, editors
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
      </section>
    </div>
  );
}
