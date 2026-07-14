"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// The Company sidebar. Everything on ronation.live is authored from behind these links -
// the /admin dashboard that used to hold some of them is gone.
//
// It is GROUPED, and that is not decoration. It was a flat list of nine, which is about
// where a flat list stops working; team, testimonials, enquiries and partners take it to
// thirteen, and thirteen undifferentiated links is a menu you scan rather than read.
//
// The groups answer the question you actually arrive with - "what am I here to do?" -
// rather than the one the database would answer:
//
//   The shows    the thing RNL does. Events, and the door you check people in at.
//   Content      things RNL publishes.
//   People       every human the org touches, from the crew to the inbox.
const groups: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "The shows",
    links: [
      { label: "Overview", href: "/company" },
      { label: "Events", href: "/company/events" },
      { label: "Door", href: "/company/door" },
    ],
  },
  {
    title: "Content",
    links: [
      { label: "Blog", href: "/company/blog" },
      { label: "Merch", href: "/company/merch" },
      { label: "Docs", href: "/company/docs" },
      { label: "Surveys", href: "/company/surveys" },
    ],
  },
  {
    title: "People",
    links: [
      { label: "Team", href: "/company/team" },
      { label: "Careers", href: "/company/careers" },
      { label: "Applications", href: "/company/applications" },
      { label: "Testimonials", href: "/company/testimonials" },
      { label: "Enquiries", href: "/company/enquiries" },
      { label: "Partners", href: "/company/partners" },
    ],
  },
];

export function CompanyNav({
  user,
}: {
  user: { displayName: string; roleName: string; rank: number };
}) {
  const pathname = usePathname();

  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <div className="mb-6">
        <p className="font-display text-2xl uppercase">Company</p>
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-kicker text-accent">
          {user.roleName} · rank {user.rank}
        </p>
      </div>

      {/* On a narrow screen the groups collapse back into one scrolling row - the
          headings are structure, and on a phone the structure is the scroll. */}
      <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-0">
        {groups.map((group) => (
          <div key={group.title} className="contents lg:block">
            <p className="hidden lg:mb-1.5 lg:mt-5 lg:block lg:px-3 lg:text-[10px] lg:font-bold lg:uppercase lg:tracking-kicker lg:text-faint lg:first:mt-0">
              {group.title}
            </p>

            {group.links.map((l) => {
              const active =
                l.href === "/company"
                  ? pathname === "/company"
                  : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors lg:block",
                    active
                      ? "bg-surface text-fg"
                      : "text-muted hover:bg-surface/60 hover:text-fg",
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="mt-6 flex flex-col gap-1 border-t border-line pt-4">
        <Link
          href="/company/settings"
          className="rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:text-fg"
        >
          Settings
        </Link>
        <Link
          href="/"
          className="rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:text-fg"
        >
          View site ↗
        </Link>
        <a
          href="/api/auth/logout"
          className="rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:text-red-400"
        >
          Sign out
        </a>
      </div>
    </aside>
  );
}
