import type { Metadata } from "next";
import Link from "next/link";
import { requirePartnerAccount, isFullPartner } from "@/lib/partner-account";
import { Kicker } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Overview" };

export default async function PartnerOverviewPage({
  searchParams,
}: {
  searchParams: { notice?: string };
}) {
  const user = await requirePartnerAccount();
  const partner = isFullPartner(user.account);
  const firstName = user.displayName.split(" ")[0];

  return (
    <div className="mx-auto max-w-3xl">
      <Kicker>Partners</Kicker>
      <h1 className="display mt-4 text-4xl leading-none sm:text-5xl">
        Welcome, {firstName}.
      </h1>

      <p className="mt-4 text-muted">
        You&apos;re signed in on behalf of{" "}
        <span className="font-semibold text-fg">{user.account.name}</span>.
      </p>

      <span
        className={
          partner
            ? "mt-4 inline-flex items-center rounded-brand border border-accent/40 bg-accent-soft px-3 py-1 text-[11px] font-bold uppercase tracking-kicker text-accent"
            : "mt-4 inline-flex items-center rounded-brand border border-line px-3 py-1 text-[11px] font-bold uppercase tracking-kicker text-muted"
        }
      >
        {partner ? "Partner" : "Potential partner"}
      </span>

      {searchParams.notice === "accounting" ? (
        <div className="card mt-8 border-amber-500/30 p-5">
          <p className="text-sm text-muted">
            Accounting opens once you&apos;re a full partner. While we&apos;re still in
            talks, you can read the agreements below.
          </p>
        </div>
      ) : null}

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <SectionCard
          href="/partner/documents"
          title="Documents"
          body="The agreements you accept as a partner - how we sell your merch and tickets, the split, and how we use your assets."
        />
        {partner ? (
          <SectionCard
            href="/partner/accounting"
            title="Accounting"
            body="Your payouts, billables, receipts and credit notes - every document we've raised with you."
          />
        ) : (
          <div className="card p-6 opacity-60">
            <h2 className="font-display text-2xl">Accounting</h2>
            <p className="mt-2 text-sm text-muted">
              Available once you&apos;re a full partner.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionCard({
  href,
  title,
  body,
}: {
  href: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="card group p-6 transition-colors hover:border-line-strong"
    >
      <h2 className="font-display text-2xl transition-colors group-hover:text-accent">
        {title}
      </h2>
      <p className="mt-2 text-sm text-muted">{body}</p>
    </Link>
  );
}
