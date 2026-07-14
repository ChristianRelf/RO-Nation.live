import Link from "next/link";
import { site } from "@/lib/site";
import { env } from "@/lib/env";

const legalLinks = [
  { label: "Privacy", href: "/legal/privacy" },
  { label: "Terms", href: "/legal/terms" },
  { label: "Code of Conduct", href: "/legal/code-of-conduct" },
];

/**
 * A collection's small print, rendered by the PAGES rather than by the footer.
 *
 * It has to be that way round: a tribute collection's disclaimer is about that
 * collection, and the shop layout sits above the [collection] segment and never sees
 * its params. A footer that tried to carry it would show the wrong band's disclaimer,
 * or none.
 *
 * ---- Why it is cream, and why it is bigger than it was ----------------------
 *
 * It used to be `text-xs text-faint` - the dimmest token on the site. That was wrong,
 * and not merely aesthetically: sleeptokenro.css says, in as many words, that nothing
 * may "hide it, dim it into the background or push it out of sight", and that "it
 * spoils the atmosphere" is precisely the instinct the rule exists to refuse. The
 * disclaimer is the only thing separating a page carrying a real band's marks from
 * the band's own page.
 *
 * So it is a slip of paper taped to the wall: cream, paper-grained, torn tape over one
 * corner - which makes it the HIGHEST-contrast object on a near-black page. Design and
 * compliance happen to point the same way here. Take the win.
 */
export function CollectionDisclaimer({ text }: { text: string }) {
  return (
    <aside className="mt-20">
      <div className="panel-paper relative max-w-2xl -rotate-[0.4deg] p-6 sm:p-7">
        <span
          aria-hidden
          className="tape-ink -left-4 -top-3"
          style={{ "--tape-rot": "-7deg" } as React.CSSProperties}
        />
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-paper-ink/60">
          &#9670; Notice
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-paper-ink">{text}</p>
      </div>
    </aside>
  );
}

export function ShopFooter() {
  return (
    <footer className="relative mt-24 bg-elev">
      <div className="shell">
        <div className="flex items-start">
          <span className="rail-bracket shrink-0" aria-hidden />
          <span className="rail-bar flex-1" aria-hidden />
          <span className="rail-bracket shrink-0 -scale-x-100" aria-hidden />
        </div>
      </div>

      <div className="shell py-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <p className="display text-2xl">Merch</p>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Roblox clothing from RO. Nation LIVE and the shows we produce. Bought
              and worn on Roblox - we just show it to you properly.
            </p>
          </div>

          <nav className="flex flex-col gap-3 text-sm">
            <a
              href={site.socials.roblox}
              className="link-underline text-muted transition-colors hover:text-fg"
            >
              Our Roblox group &#8599;
            </a>
            <a
              href={env.siteUrl}
              className="link-underline text-muted transition-colors hover:text-fg"
            >
              RO. Nation LIVE &#8599;
            </a>
          </nav>
        </div>

        <div className="mt-12 flex flex-col items-start gap-4 border-t border-line pt-6 text-xs text-faint">
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
          {/* RNL takes no payment for any of this: Roblox charges the Robux, on
              Roblox's own page. Saying so plainly is not hygiene - a shop that looks
              like it is taking money and then isn't is the kind of ambiguity people
              file complaints about. */}
          <p>
            Every item is sold on Roblox. Payment, ownership and refunds are handled
            by Roblox - RO. Nation LIVE never takes payment for merch.
          </p>
          <p>
            &copy; {new Date().getFullYear()} {site.name}. Not affiliated with or
            endorsed by Roblox Corporation.
          </p>
        </div>
      </div>
    </footer>
  );
}
