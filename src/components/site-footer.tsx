import Link from "next/link";
import { Logo } from "./logo";
import { SOCIAL_LABELS, site, type Social } from "@/lib/site";

/**
 * The socials RNL actually has, in the order SOCIAL_LABELS declares them.
 *
 * This list used to be four hardcoded <li>s, two of which pointed at
 * `x.com/your-handle` and `youtube.com/@your-channel` - placeholder strings, live and
 * clickable on every page of the site. Driving it off the record means an account that
 * does not exist cannot be linked to, because there is nothing to link.
 */
const socials = (Object.keys(SOCIAL_LABELS) as Social[])
  .map((key) => ({ key, href: site.socials[key] }))
  .filter((s): s is { key: Social; href: string } => Boolean(s.href));

// A glyph per social. Only discord and roblox are ever guaranteed (see lib/site.ts); the
// rest carry a plain fallback so adding one later is still one line in the record and needs
// no new artwork here.
function SocialIcon({ social }: { social: Social }) {
  const common = { viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true };
  if (social === "discord") {
    return (
      <svg {...common} className="h-4 w-4">
        <path d="M20.3 4.5A19 19 0 0 0 15.5 3l-.24.5a17.6 17.6 0 0 1 4 1.35 16.7 16.7 0 0 0-14.6 0 17.6 17.6 0 0 1 4-1.35L8.5 3A19 19 0 0 0 3.7 4.5C1 8.6.27 12.6.6 16.6A19.2 19.2 0 0 0 6.4 19.5l.7-1a12.4 12.4 0 0 1-2-.95l.5-.4a13.3 13.3 0 0 0 11.3 0l.5.4c-.63.37-1.3.68-2 .95l.7 1a19 19 0 0 0 5.8-2.9c.4-4.7-.68-8.66-3.6-12.6ZM8.9 14.4c-.95 0-1.73-.87-1.73-1.95S8.06 10.5 9 10.5s1.74.88 1.73 1.95c0 1.08-.78 1.95-1.73 1.95Zm6.3 0c-.95 0-1.73-.87-1.73-1.95s.78-1.95 1.73-1.95 1.74.88 1.73 1.95c0 1.08-.78 1.95-1.73 1.95Z" />
      </svg>
    );
  }
  if (social === "roblox") {
    return (
      <svg {...common} className="h-4 w-4">
        <path d="M4.9 2 2 15.1 19.1 22 22 8.9 4.9 2Zm7.75 12.2-3.85-1.55.9-3.85 3.85 1.55-.9 3.85Z" />
      </svg>
    );
  }
  // x / youtube / tiktok, if ever added: an outward arrow, honest about being a link out.
  return (
    <svg {...common} className="h-4 w-4">
      <path d="M7 17 17 7M8 7h9v9" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const columns = [
  {
    title: "Attend",
    links: [
      { label: "Upcoming events", href: "/events" },
      { label: "My tickets", href: "/tickets" },
      { label: "My account", href: "/account" },
      // Handed over to merch.ronation.live by the middleware - see the note on `nav`.
      { label: "Merch", href: "/merch" },
      { label: "Blog", href: "/blog" },
      { label: "How ticketing works", href: "/about#ticketing" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    // Renamed from "Join", because it is not just a careers column any more - /services
    // and /press are here, and they are for a different visitor entirely: somebody who
    // wants something FROM RNL rather than to come to a show.
    //
    // Services deliberately stays OUT of the header nav (lib/site.ts). RNL's primary
    // visitor is an attendee after a free ticket, not a client, and the top nav belongs to
    // them. The client finds this from four places instead - here, /about, /partners and
    // /contact - and if bookings ever become the priority, promoting it is one line.
    title: "Work with us",
    links: [
      { label: "What we do", href: "/services" },
      { label: "Open roles", href: "/careers" },
      { label: "About the group", href: "/about" },
      { label: "Meet the crew", href: "/team" },
      { label: "Partners", href: "/partners" },
      { label: "Press kit", href: "/press" },
      { label: "Contact us", href: "/contact" },
    ],
  },
];

const legalLinks = [
  { label: "Privacy", href: "/legal/privacy" },
  { label: "Terms", href: "/legal/terms" },
  { label: "Code of Conduct", href: "/legal/code-of-conduct" },
  // The other policies - the Roblox and Discord sign-in documents among them - were once
  // reachable only by cross-links from each other, so pages this site handed to two OAuth
  // providers at registration were effectively unlisted on it.
  { label: "All policies", href: "/legal" },
];

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-24 border-t border-line bg-elev">
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-40" />

      {/* Before you go: the footer earns its height with a real call to action, not just a
          sitemap. Both destinations are guaranteed to exist - /events always, and
          site.socials.discord is a required key (lib/site.ts) - so neither can go dead. */}
      <div className="shell relative">
        <div className="flex flex-col gap-6 border-b border-line py-12 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="kicker">Before you go</p>
            <h2 className="display mt-3 text-4xl sm:text-5xl md:text-6xl">
              Come to a show.
            </h2>
            <p className="mt-3 max-w-md text-muted">
              Tickets are free and tied to your Roblox account. Reserve one, or come
              hang out with the crew in the Discord.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/events" className="btn btn-accent">
              Reserve a free ticket
            </Link>
            <a href={site.socials.discord} className="btn btn-ghost">
              Join the Discord
            </a>
          </div>
        </div>
      </div>

      {/* Brand + navigation */}
      <div className="shell relative grid gap-12 py-14 md:grid-cols-[1.6fr_1fr_1fr]">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-5 text-sm leading-relaxed text-muted">
            {site.description}
          </p>

          {socials.length ? (
            <div className="mt-6">
              <p className="kicker">Follow</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {socials.map((s) => (
                  <a
                    key={s.key}
                    href={s.href}
                    aria-label={SOCIAL_LABELS[s.key]}
                    title={SOCIAL_LABELS[s.key]}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-brand border border-line text-muted transition-colors hover:border-accent hover:text-accent"
                  >
                    <SocialIcon social={s.key} />
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {columns.map((col) => (
          <div key={col.title}>
            <p className="kicker">{col.title}</p>
            <ul className="mt-4 space-y-3">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="link-underline text-sm text-muted transition-colors hover:text-fg"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* The wordmark as a signature. Decoration, and honestly so - aria-hidden, and it
          bleeds off the edge on purpose. It is the one place the brand gets to be big. */}
      <div
        aria-hidden
        className="shell relative select-none overflow-hidden pb-8"
      >
        <p className="display whitespace-nowrap text-[clamp(2.5rem,10vw,8rem)] leading-[0.78] tracking-tight text-fg/[0.06]">
          RO. NATION LIVE
        </p>
      </div>

      {/* Legal */}
      <div className="shell relative">
        <div className="flex flex-col gap-4 border-t border-line py-6 text-xs text-faint sm:flex-row sm:items-center sm:justify-between">
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {legalLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="link-underline transition-colors hover:text-fg"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          {/* "Built for the crew · v1.0" used to sit here. The version number tracked
              nothing - v1.0 on the first commit and v1.0 on the five hundredth. A number
              that never changes is not a version, it is decoration pretending to be
              information. The copyright year, by contrast, is computed and true. */}
          <p>
            © {year} {site.name}. Not affiliated with or endorsed by Roblox
            Corporation.
          </p>
        </div>
      </div>
    </footer>
  );
}
