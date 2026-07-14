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

const columns = [
  {
    title: "Attend",
    links: [
      { label: "Upcoming events", href: "/events" },
      { label: "My tickets", href: "/tickets" },
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
  // The other four - the Roblox and Discord sign-in documents - were reachable only by
  // cross-links from each other, so the pages this site handed to two OAuth providers at
  // registration were effectively unlisted on it.
  { label: "All policies", href: "/legal" },
];

export function SiteFooter() {
  return (
    <footer className="relative mt-24 border-t border-line bg-elev">
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-40" />
      <div className="shell relative py-16">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-5 text-sm leading-relaxed text-muted">
              {site.description}
            </p>
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

          <div>
            <p className="kicker">Follow</p>
            <ul className="mt-4 space-y-3">
              {socials.map((s) => (
                <li key={s.key}>
                  <a
                    href={s.href}
                    className="link-underline text-sm text-muted transition-colors hover:text-fg"
                  >
                    {SOCIAL_LABELS[s.key]}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-start gap-4 border-t border-line pt-6 text-xs text-faint">
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
          {/* "Built for the crew · v1.0" used to sit on the right here. The version
              number tracked nothing and meant nothing - it was v1.0 on the first commit
              and v1.0 on the five hundredth. A number that never changes is not a
              version, it is decoration pretending to be information. */}
          <p>
            © {new Date().getFullYear()} {site.name}. Not affiliated with or
            endorsed by Roblox Corporation.
          </p>
        </div>
      </div>
    </footer>
  );
}
