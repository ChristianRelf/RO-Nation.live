import type { ReactNode } from "react";
import Link from "next/link";
import { Kicker } from "@/components/ui";
import { cn, slugify } from "@/lib/utils";

// Inline markup inside otherwise-plain policy text.
//
// The sections are authored as plain strings - deliberately, because a policy is prose and
// prose is easier to read and diff as prose than as a tree of elements. Two affordances are
// allowed on top of that, and only two:
//
//   [label](href)   A request the reader is meant to ACT on ("make a request here") is
//                   worse as an un-clickable URL. Internal hrefs (starting "/") route
//                   through next/link; anything else (mailto:, https:) is a plain anchor,
//                   and an external http(s) link opens in a new tab.
//
//   **emphasis**    A policy is skimmed before it is read, and some of these documents turn
//                   on a single clause - "issuing a document does not send the Robux",
//                   "we will never ask you to send Robux to receive a payment". Those have
//                   to survive the skim. It is the same token, and the same restraint, as
//                   the terms printed on an accounting sheet (components/accounting/
//                   terms-block.tsx) - so a clause reads the same way on paper and here.
//
// Both tokens are specific enough that ordinary copy does not trip them: a link needs a
// []-bracketed label immediately followed by a ()-wrapped href, and emphasis needs a
// DOUBLED asterisk on both sides. Prose that merely uses brackets, parentheses or a lone
// asterisk never produces either. Anything unmatched is left exactly as written.
const INLINE = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g;

function renderInline(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let last = 0;
  let key = 0;

  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) parts.push(text.slice(last, at));

    // Group 3 is the emphasis alternative; groups 1 and 2 are the link's label and href.
    // Exactly one branch matched, so which groups are defined is what tells them apart.
    if (m[3] !== undefined) {
      parts.push(
        <strong key={key} className="font-semibold text-fg">
          {m[3]}
        </strong>,
      );
    } else {
      const label = m[1];
      const href = m[2];
      const style = "link-underline text-accent transition-colors hover:text-fg";

      if (href.startsWith("/")) {
        parts.push(
          <Link key={key} href={href} className={style}>
            {label}
          </Link>,
        );
      } else {
        const external = href.startsWith("http");
        parts.push(
          <a
            key={key}
            href={href}
            className={style}
            {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
          >
            {label}
          </a>,
        );
      }
    }

    last = at + m[0].length;
    key++;
  }

  // Nothing to substitute: hand back the original string, so the overwhelmingly common
  // case allocates nothing and renders identically to before.
  if (key === 0) return text;
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// Shared layout for the legal documents so they stay visually consistent and
// DRY. Each legal page just supplies a `sections` array.
//
// A section is paragraphs, optionally followed by a bulleted list - because the
// honest answer to "what data do you hold?" is a list, and a list crammed into a
// paragraph is how a policy stops being read.
//
// Every heading gets a stable anchor (slugified), so a specific clause can be
// linked to: /legal/privacy#what-we-collect. Once a document is long enough that
// you'd scroll to find anything, a contents index is rendered above it.

export type LegalSection = {
  heading: string;
  body: string[];
  list?: string[];
};

/** The point at which a wall of sections needs an index in front of it. */
const CONTENTS_THRESHOLD = 8;
const legalNav = [
  { label: "Privacy Policy", href: "/legal/privacy" },
  { label: "Terms of Service", href: "/legal/terms" },
  { label: "Code of Conduct", href: "/legal/code-of-conduct" },
];

// The Roblox and Discord OAuth integrations have their own pair of documents -
// these are the URLs handed to Roblox and Discord when registering the apps, so
// they cross-link to each other rather than to the site-wide docs.
export const robloxNav = [
  { label: "Roblox - Privacy", href: "/legal/roblox/privacy" },
  { label: "Roblox - Terms", href: "/legal/roblox/terms" },
  { label: "Site policies", href: "/legal/privacy" },
];

export const discordNav = [
  { label: "Discord - Privacy", href: "/legal/discord/privacy" },
  { label: "Discord - Terms", href: "/legal/discord/terms" },
  { label: "Site policies", href: "/legal/privacy" },
];

// The Discord bot is a separate integration from the sign-in above - it links a
// member's Roblox account to their Discord one - so its two documents cross-link
// to each other, not to the sign-in pair.
export const discordBotNav = [
  { label: "Bot - Privacy", href: "/legal/discord/bot/privacy" },
  { label: "Bot - Terms", href: "/legal/discord/bot/terms" },
  { label: "Site policies", href: "/legal/privacy" },
];

// The three partner agreements are one set - the deal a partner signs on to - so they
// cross-link to each other, not to the site-wide policies. A partner reading one of them
// almost always wants the next.
export const partnerNav = [
  { label: "Merchandise", href: "/legal/partners/merchandise" },
  { label: "Asset use", href: "/legal/partners/assets" },
  { label: "Ticketing", href: "/legal/partners/ticketing" },
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
  sections: LegalSection[];
  currentHref: string;
  nav?: { label: string; href: string }[];
}) {
  const showContents = sections.length >= CONTENTS_THRESHOLD;
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
          <p className="text-lg leading-relaxed text-muted">{renderInline(intro)}</p>
        ) : null}

        {showContents ? (
          <nav aria-label="Contents" className="card mt-10 p-6">
            <p className="text-[11px] font-semibold uppercase tracking-kicker text-faint">
              Contents
            </p>
            <ol className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
              {sections.map((s, i) => (
                <li key={s.heading} className="flex gap-3 text-sm">
                  <span className="tnum font-mono text-xs text-faint">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <a
                    href={`#${slugify(s.heading)}`}
                    className="text-muted transition-colors hover:text-accent"
                  >
                    {s.heading}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        <div className="mt-10 space-y-10">
          {sections.map((s, i) => (
            <section
              key={s.heading}
              id={slugify(s.heading)}
              // Anchored headings land under the sticky header without it.
              className="scroll-mt-24"
            >
              <h2 className="flex items-baseline gap-3 font-display text-2xl">
                <span className="font-mono text-sm text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {s.heading}
              </h2>
              <div className="mt-3 space-y-3 leading-relaxed text-muted">
                {s.body.map((p, j) => (
                  <p key={j}>{renderInline(p)}</p>
                ))}
              </div>

              {s.list?.length ? (
                <ul className="mt-4 space-y-2.5">
                  {s.list.map((item, j) => (
                    <li key={j} className="flex gap-3 leading-relaxed text-muted">
                      <span className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-accent" />
                      <span>{renderInline(item)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
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
