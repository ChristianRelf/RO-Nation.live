import type { Metadata } from "next";
import Link from "next/link";
import { requirePartnerAccount } from "@/lib/partner-account";
import { PARTNER_AGREEMENTS } from "@/lib/legal";
import { Kicker } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Documents" };

// The three partner agreements come from the one legal registry that /legal itself renders
// from (lib/legal.ts) - so a change there shows up here for free. They open in a new tab: the
// canonical page lives under /legal, and we would rather keep the partner in their own area
// than hand them off to it.

export default async function PartnerDocumentsPage() {
  await requirePartnerAccount();

  return (
    <div className="mx-auto max-w-3xl">
      <Kicker>Documents</Kicker>
      <h1 className="display mt-4 text-4xl leading-none sm:text-5xl">Your agreements</h1>
      <p className="mt-4 max-w-xl text-muted">
        The terms you accept as a partner of RO. Nation LIVE - how we sell your merch and
        tickets, the split, and how we use your assets. Written to be read.
      </p>

      <div className="mt-8 divide-y divide-line border-y border-line">
        {PARTNER_AGREEMENTS.map((d) => (
          <a
            key={d.href}
            href={d.href}
            target="_blank"
            rel="noreferrer"
            className="group flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-5 transition-colors"
          >
            <span className="min-w-0">
              <span className="font-display text-2xl transition-colors group-hover:text-accent">
                {d.title}
              </span>
              <span className="mt-1 block max-w-xl text-muted">{d.blurb}</span>
            </span>
            <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] text-faint">
              Updated {d.updated}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
