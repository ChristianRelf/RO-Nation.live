import Link from "next/link";
import { Logo } from "./logo";
import { site } from "@/lib/site";

const columns = [
  {
    title: "Attend",
    links: [
      { label: "Upcoming events", href: "/events" },
      { label: "My tickets", href: "/tickets" },
      { label: "How ticketing works", href: "/about#ticketing" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    title: "Join",
    links: [
      { label: "Open roles", href: "/careers" },
      { label: "About the group", href: "/about" },
      { label: "Meet the crew", href: "/team" },
      { label: "Partners", href: "/partners" },
      { label: "Contact us", href: "/contact" },
    ],
  },
];

const legalLinks = [
  { label: "Privacy", href: "/legal/privacy" },
  { label: "Terms", href: "/legal/terms" },
  { label: "Code of Conduct", href: "/legal/code-of-conduct" },
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
              <li>
                <a
                  href={site.socials.discord}
                  className="link-underline text-sm text-muted transition-colors hover:text-fg"
                >
                  Discord
                </a>
              </li>
              <li>
                <a
                  href={site.socials.roblox}
                  className="link-underline text-sm text-muted transition-colors hover:text-fg"
                >
                  Roblox group
                </a>
              </li>
              <li>
                <a
                  href={site.socials.x}
                  className="link-underline text-sm text-muted transition-colors hover:text-fg"
                >
                  X / Twitter
                </a>
              </li>
              <li>
                <a
                  href={site.socials.youtube}
                  className="link-underline text-sm text-muted transition-colors hover:text-fg"
                >
                  YouTube
                </a>
              </li>
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
          <div className="flex w-full flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <p>
              © {new Date().getFullYear()} {site.name}. Not affiliated with or
              endorsed by Roblox Corporation.
            </p>
            <p className="font-mono">Built for the crew · v1.0</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
