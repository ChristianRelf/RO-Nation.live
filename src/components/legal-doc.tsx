import Link from "next/link";
import { Kicker } from "@/components/ui";
import { cn } from "@/lib/utils";

// Shared layout for the legal documents so they stay visually consistent and
// DRY. Each legal page just supplies a `sections` array.
const legalNav = [
  { label: "Privacy Policy", href: "/legal/privacy" },
  { label: "Terms of Service", href: "/legal/terms" },
  { label: "Code of Conduct", href: "/legal/code-of-conduct" },
];

// The Roblox and Discord OAuth integrations have their own pair of documents —
// these are the URLs handed to Roblox and Discord when registering the apps, so
// they cross-link to each other rather than to the site-wide docs.
export const robloxNav = [
  { label: "Roblox — Privacy", href: "/legal/roblox/privacy" },
  { label: "Roblox — Terms", href: "/legal/roblox/terms" },
  { label: "Site policies", href: "/legal/privacy" },
];

export const discordNav = [
  { label: "Discord — Privacy", href: "/legal/discord/privacy" },
  { label: "Discord — Terms", href: "/legal/discord/terms" },
  { label: "Site policies", href: "/legal/privacy" },
];

export function LegalDoc({
  title,
  updated,
  intro,
  sections,
  currentHref,
  nav = legalNav,
}: {
  title: string;
  updated: string;
  intro?: string;
  sections: { heading: string; body: string[] }[];
  currentHref: string;
  nav?: { label: string; href: string }[];
}) {
  return (
    <div className="relative">
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-56" />
      <div className="shell relative pt-16 sm:pt-20">
        <Kicker>Legal</Kicker>
        <h1 className="display mt-5 text-4xl sm:text-5xl md:text-6xl">{title}</h1>
        <p className="mt-4 text-sm text-faint">Last updated {updated}</p>

        {/* Sub-nav between the related documents */}
        <nav className="mt-8 flex flex-wrap gap-2">
          {nav.map((l) => {
            const active = l.href === currentHref;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-[3px] border px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] transition-colors",
                  active
                    ? "border-accent/40 bg-accent-soft text-accent"
                    : "border-line text-muted hover:border-line-strong hover:text-fg",
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="shell max-w-3xl py-12">
        {intro ? (
          <p className="text-lg leading-relaxed text-muted">{intro}</p>
        ) : null}

        <div className="mt-10 space-y-10">
          {sections.map((s, i) => (
            <section key={s.heading}>
              <h2 className="flex items-baseline gap-3 font-display text-2xl">
                <span className="font-mono text-sm text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {s.heading}
              </h2>
              <div className="mt-3 space-y-3 leading-relaxed text-muted">
                {s.body.map((p, j) => (
                  <p key={j}>{p}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-14 border-t border-line pt-6 text-sm text-faint">
          Questions about this document? Reach us on{" "}
          <Link href="/contact" className="text-accent hover:text-fg">
            the contact page
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
