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

// The real, official marks (simple-icons) for the socials RNL actually has, so the footer
// shows Discord's and Roblox's own logos rather than a hand-drawn lookalike. Only discord and
// roblox are ever guaranteed (see lib/site.ts); the rest carry a plain outward-arrow fallback,
// so adding one later is still one line in the record and needs no new artwork here.
const SOCIAL_PATHS: Partial<Record<Social, string>> = {
  discord:
    "M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z",
  roblox:
    "M18.926 23.998 0 18.892 5.075.002 24 5.108ZM15.348 10.09l-5.282-1.453-1.414 5.273 5.282 1.453z",
};

function SocialIcon({ social }: { social: Social }) {
  const path = SOCIAL_PATHS[social];
  if (path) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-4 w-4">
        <path d={path} />
      </svg>
    );
  }
  // x / youtube / tiktok, if ever added without a mark here: an outward arrow, honest about
  // being a link out.
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-4 w-4">
      <path
        d="M7 17 17 7M8 7h9v9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
      // Handed over to merch.ronation.live by the middleware - hardNav so it does a full
      // browser navigation rather than a client RSC fetch that redirects off-origin.
      { label: "Merch", href: "/merch", hardNav: true },
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
      // ---- The backstage door -------------------------------------------
      //
      // The portal was, deliberately, linked from nowhere on this site: you
      // either knew the host or you had been sent a link. The reasoning was that
      // a visitor who does not belong there is better told "not for you" than
      // handed a map.
      //
      // What changed is that there is now one door to point at. Every anonymous
      // request to that host lands on /login, which explains what the place is
      // and hands out nothing - and a signed-in person goes to /hub, which shows
      // only the areas they actually hold. So the link cannot leak a map any
      // more: the map is built per-person, on the other side of a sign-in.
      //
      // In the FOOTER and not the header, for the same reason /services is - the
      // top nav belongs to somebody after a free ticket, and crew know to scroll.
      //
      // hardNav because the middleware 307s this to portal.ronation.live, and a
      // client-side <Link> would make an RSC fetch that the browser blocks when
      // it redirects off-origin. Same as /merch above.
      { label: "Staff & partner portal", href: "/login", hardNav: true },
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
              {col.links.map((l) => {
                const cls =
                  "link-underline text-sm text-muted transition-colors hover:text-fg";
                return (
                  <li key={l.href}>
                    {"hardNav" in l && l.hardNav ? (
                      // Cross-host (Merch, the portal) - full navigation, no
                      // client RSC fetch for the middleware to redirect
                      // off-origin and the browser to then block.
                      <a href={l.href} className={cls}>
                        {l.label}
                      </a>
                    ) : (
                      <Link href={l.href} className={cls}>
                        {l.label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* The wordmark as a signature. Decoration, and honestly so - aria-hidden, and it
          bleeds off the edge on purpose. It is the one place the brand gets to be big. */}
      <div
        aria-hidden
        className="shell relative select-none overflow-hidden pb-8 pt-3"
      >
        {/* leading-none, not tighter: Anton's caps are tall, and a sub-1 line-height under the
            overflow-hidden (which is there to clip the horizontal bleed) shaved the tops off.
            The small pt gives the ascenders their last pixel of room. */}
        <p className="display whitespace-nowrap text-[clamp(2.5rem,10vw,8rem)] leading-none tracking-tight text-fg/[0.06]">
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
