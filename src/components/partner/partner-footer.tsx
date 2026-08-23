import Link from "next/link";
import type { Partner } from "@/lib/partners/registry";
import { site } from "@/lib/site";
import { env } from "@/lib/env";
import { PartnerDisclaimer, PartnerMark } from "./emblem";

const legalLinks = [
  { label: "Privacy", href: "/legal/privacy" },
  { label: "Terms", href: "/legal/terms" },
  { label: "Code of Conduct", href: "/legal/code-of-conduct" },
];

/**
 * A partner site's footer.
 *
 * Two things here are not decoration and should not be quietly dropped:
 *
 *   The RNL credit. These sites run on RNL's infrastructure, ticketing and
 *   domain. The credit is the deal.
 *
 *   The disclaimer. A partner whose name references a real-world act carries one
 *   (registry.disclaimer), and it is rendered plainly - normal body size, above
 *   the fold of the footer, not greyed out to nothing. A disclaimer nobody can
 *   read is not a disclaimer; and because this sits on an RNL subdomain with
 *   RNL's name beside it, an ambiguous page is RNL's problem too, not only the
 *   partner's.
 */
export function PartnerFooter({ partner }: { partner: Partner }) {
  return (
    <footer className="relative mt-24 border-t border-line bg-elev">
      <div className="shell relative py-14">
        <div className="grid gap-10 md:grid-cols-[1.6fr_1fr_1fr]">
          <div className="max-w-sm">
            {partner.wordmarkLogo ? (
              <PartnerMark
                partner={partner}
                size={220}
                alt={partner.name}
                className="max-h-9 opacity-80"
              />
            ) : (
              <div className="flex items-center gap-3">
                <PartnerMark partner={partner} size={30} className="max-h-7 opacity-70" />
                <p className="display text-2xl">{partner.name}</p>
              </div>
            )}
            <p className="mt-4 text-sm leading-relaxed text-muted">
              {partner.description}
            </p>
          </div>

          <div>
            <p className="kicker">Attend</p>
            <ul className="mt-4 space-y-3">
              <li>
                <Link
                  href="/events"
                  className="link-underline text-sm text-muted transition-colors hover:text-fg"
                >
                  Upcoming shows
                </Link>
              </li>
              <li>
                <Link
                  href="/tickets"
                  className="link-underline text-sm text-muted transition-colors hover:text-fg"
                >
                  My tickets
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="kicker">Legal</p>
            <ul className="mt-4 space-y-3">
              {legalLinks.map((l) => (
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
        </div>

        {/* Repeated here as well as under the hero, and both are wanted: the hero
            catches somebody who has just landed, this catches somebody who has
            read the whole page. Same component, so the two cannot drift apart. */}
        {partner.disclaimer ? (
          <div className="mt-12 border-t border-line pt-6">
            <PartnerDisclaimer partner={partner} />
          </div>
        ) : null}

        <div className="mt-8 flex flex-col items-start justify-between gap-4 border-t border-line pt-6 text-xs text-faint sm:flex-row sm:items-center">
          <p>
            © {new Date().getFullYear()} {partner.name}. Not affiliated with or
            endorsed by Roblox Corporation.
          </p>

          {/* The RNL credit - every partner site carries it. */}
          <p className="flex items-center gap-1.5">
            <span>Produced with</span>
            <a
              href={env.siteUrl}
              className="font-semibold text-muted transition-colors hover:text-accent"
            >
              {site.name}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
