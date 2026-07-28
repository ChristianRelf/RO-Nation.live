import type { Metadata } from "next";
import Link from "next/link";
import {
  DocumentStatus,
  PartnerAccountKind,
  type AccountingDocument,
  type PartnerAccountMember,
} from "@prisma/client";
import {
  requirePartnerAccount,
  isFullPartner,
  listPartnerAccountMembers,
} from "@/lib/partner-account";
import { listDocumentsForPartnerAccount, partnerLedger } from "@/lib/accounting/documents";
import { kindConfig } from "@/lib/accounting/kinds";
import { PARTNER_AGREEMENTS } from "@/lib/legal";
import { formatRobux } from "@/lib/tickets/pricing";
import { formatDate } from "@/lib/format";
import { env } from "@/lib/env";
import { Kicker } from "@/components/ui";
import { PartnerLedgerStrip } from "@/components/partner/ledger-strip";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Overview" };

// The partner area's front page.
//
// It began as a welcome line and two links to the other two tabs - which is a menu, not an
// overview. A partner opening this page has one of two questions, and neither was answered
// here: "where is my money" if they are a partner, and "what happens next" if they are still
// in talks. So the page now answers whichever one applies, and the tabs it used to consist
// of are the footer of it rather than the whole of it.
//
// The two states are genuinely different pages, not one page with a figure blanked out:
//
//   PARTNER    - the ledger, from their side. What they are owed, what they owe, what they
//                have been paid this year, and the last few documents.
//   POTENTIAL  - no ledger exists to show, so the space goes to what is actually true for
//                them: the agreements to read and what becoming a partner involves.
//
// The accounting read is skipped entirely for a potential partner rather than fetched and
// hidden - the accounting page refuses them (isFullPartner is the lock there), and a query
// whose result may not be rendered is a query that should not be run.

export default async function PartnerOverviewPage({
  searchParams,
}: {
  searchParams: { notice?: string };
}) {
  const user = await requirePartnerAccount();
  const partner = isFullPartner(user.account);
  const firstName = user.displayName.split(" ")[0];

  const [docs, members] = await Promise.all([
    partner
      ? listDocumentsForPartnerAccount(user.account.id)
      : Promise.resolve<AccountingDocument[]>([]),
    listPartnerAccountMembers(user.account.id),
  ]);

  const ledger = partnerLedger(docs);
  // Void documents are on the record but they are not news. The accounting tab lists them,
  // with their status; a "latest" strip that led with a cancelled document would be leading
  // with the one thing that did not happen.
  const recent = docs.filter((d) => d.status !== DocumentStatus.VOID).slice(0, 4);

  // ---- No "new since your last visit" here any more, and that is deliberate ----
  //
  // The marker is a cookie, and a cookie is HOST-ONLY. The list it marks moved to
  // pay.ronation.live, so it is now set and read there (app/pay/(app)/statements) - a copy
  // of the count on this host would be reading a timestamp that never advances again, and
  // would therefore either say "nothing is new" forever or flag the same documents on
  // every single visit. Both are worse than not claiming to know. The count lives on the
  // pay overview, next to the list that consumes it. See lib/partner-seen.ts.

  return (
    <div className="mx-auto max-w-3xl">
      <Kicker>Partners</Kicker>
      <h1 className="display mt-4 text-4xl leading-none sm:text-5xl">
        Welcome, {firstName}.
      </h1>

      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="text-muted">
          Signed in on behalf of{" "}
          <span className="font-semibold text-fg">{user.account.name}</span>
        </p>
        <StatusPill partner={partner} />
      </div>

      <p className="mt-2 text-xs text-faint">
        {user.account.kind === PartnerAccountKind.COMPANY ? "Company" : "Individual"}{" "}
        account · on file since {formatDate(user.account.createdAt)}
      </p>

      {searchParams.notice === "accounting" ? (
        <div className="card mt-8 border-amber-500/30 p-5">
          <p className="text-sm text-muted">
            Accounting opens once you&apos;re a full partner. While we&apos;re still in
            talks, you can read the agreements below.
          </p>
        </div>
      ) : null}

      {partner ? (
        <>
          {docs.length ? (
            <>
              <PartnerLedgerStrip ledger={ledger} href="/partner/accounting" />
              <RecentDocuments docs={recent} total={docs.length} />
            </>
          ) : (
            <div className="card mt-10 p-6">
              <h2 className="font-display text-2xl">Nothing raised yet</h2>
              <p className="mt-2 text-sm text-muted">
                When we raise a payout, invoice, receipt or credit note with{" "}
                {user.account.name}, it lands here and in your accounting - and you can
                open, print or share any of them.
              </p>
            </div>
          )}
        </>
      ) : (
        <NextSteps />
      )}

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        <SectionCard
          href="/partner/documents"
          title="Documents"
          meta={`${PARTNER_AGREEMENTS.length} agreements`}
          body="How we sell your merch and tickets, the split, and how we use your assets."
        />
        {partner ? (
          <SectionCard
            href="/partner/accounting"
            title="Accounting"
            meta={
              docs.length
                ? `${docs.length} document${docs.length === 1 ? "" : "s"}`
                : "Nothing yet"
            }
            body="Your payouts, billables, receipts and credit notes - every document we've raised with you."
          />
        ) : (
          <div className="card p-6 opacity-60">
            <h2 className="font-display text-2xl">Accounting</h2>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-kicker text-faint">
              Locked
            </p>
            <p className="mt-2 text-sm text-muted">
              Opens once you&apos;re a full partner. There is nothing to see until there
              is money to account for.
            </p>
          </div>
        )}
      </div>

      <Access members={members} you={user.robloxId} />

      <p className="mt-10 border-t border-line pt-6 text-xs text-faint">
        Something here look wrong? Nothing on this page is editable from your side - the
        figures and the access list are ours to keep straight.{" "}
        <a
          href={`${env.siteUrl}/contact?kind=partnership&subject=${encodeURIComponent(
            `Partner account query (${user.account.name})`,
          )}`}
          className="link-underline font-semibold text-muted transition-colors hover:text-accent"
        >
          Tell us
        </a>{" "}
        and we&apos;ll put it right.
      </p>
    </div>
  );
}

function StatusPill({ partner }: { partner: boolean }) {
  return (
    <span
      className={
        partner
          ? "inline-flex items-center rounded-brand border border-accent/40 bg-accent-soft px-3 py-1 text-[11px] font-bold uppercase tracking-kicker text-accent"
          : "inline-flex items-center rounded-brand border border-line px-3 py-1 text-[11px] font-bold uppercase tracking-kicker text-muted"
      }
    >
      {partner ? "Partner" : "In talks"}
    </span>
  );
}

/**
 * The last few documents, as a strip.
 *
 * Deliberately not a second copy of the accounting table - no amount column, no status
 * column, no share link. This is "has anything happened", and the answer to "what exactly"
 * is one click away on a page that already renders it properly.
 */
function RecentDocuments({
  docs,
  total,
}: {
  docs: AccountingDocument[];
  total: number;
}) {
  if (!docs.length) return null;

  return (
    <section className="mt-10">
      <div className="flex items-baseline gap-3">
        <h2 className="display text-lg leading-none">Latest</h2>
        <span aria-hidden className="h-px flex-1 bg-line" />
        <Link
          href="/partner/accounting"
          className="shrink-0 text-[10px] font-bold uppercase tracking-kicker text-faint transition-colors hover:text-accent"
        >
          All {total}
        </Link>
      </div>

      <ul className="mt-1 divide-y divide-line/60 border-b border-line">
        {docs.map((d) => (
          <li
            key={d.id}
            className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3.5"
          >
            <span className="min-w-0">
              <span className="text-sm font-medium text-fg">
                {kindConfig(d.kind).heading}
              </span>
              <span className="ml-2 font-mono text-[11px] text-faint">
                {d.number ?? "—"}
              </span>
              <span className="mt-0.5 block truncate text-xs text-muted">{d.title}</span>
            </span>
            <span className="tnum shrink-0 text-right text-sm">
              <span className="block">{formatRobux(d.total)}</span>
              <span className="mt-0.5 block text-[11px] text-faint">
                {formatDate(d.documentDate)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * What a potential partner is actually looking at.
 *
 * The old page told them what they could NOT open ("Available once you're a full partner")
 * and stopped. That is the one thing they cannot act on. These are the three steps, and the
 * only one that is theirs to take is first.
 */
function NextSteps() {
  const steps = [
    {
      title: "Read the agreements",
      body: "Three documents - merchandise, tickets and assets. They set the split and what each side may do. Written to be read, not to be signed unread.",
    },
    {
      title: "We agree the terms",
      body: "Your RO. Nation LIVE contact works through anything you want changed before either side commits to it.",
    },
    {
      title: "You become a partner",
      body: "Accounting opens on this account, and every payout, invoice, receipt and credit note we raise with you appears in it.",
    },
  ];

  return (
    <section className="mt-10">
      <div className="flex items-baseline gap-3">
        <h2 className="display text-lg leading-none">What happens next</h2>
        <span aria-hidden className="h-px flex-1 bg-line" />
      </div>

      <ol className="mt-2 divide-y divide-line/60 border-b border-line">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-5 py-5">
            <span
              aria-hidden
              className="tnum display shrink-0 text-2xl leading-none text-faint"
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="min-w-0">
              <span className="block font-display text-lg leading-tight">{s.title}</span>
              <span className="mt-1 block text-sm text-muted">{s.body}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Who else can open this area on the account's behalf.
 *
 * A company partner's access is a list RNL writes and the partner cannot, so the least it
 * can do is show them the list. "You" is marked from the session's Roblox id rather than by
 * name - two people can share a display name, and nobody can share an id.
 */
function Access({ members, you }: { members: PartnerAccountMember[]; you: string }) {
  if (!members.length) return null;

  return (
    <section className="mt-12">
      <div className="flex items-baseline gap-3">
        <h2 className="display text-lg leading-none">Who can sign in</h2>
        <span aria-hidden className="h-px flex-1 bg-line" />
        <span className="tnum shrink-0 text-[10px] font-bold uppercase tracking-kicker text-faint">
          {members.length}
        </span>
      </div>

      <ul className="mt-3 flex flex-wrap gap-2">
        {members.map((m) => (
          <li
            key={m.id}
            className="inline-flex items-center gap-2.5 rounded-brand border border-line py-1 pl-1 pr-3"
          >
            {m.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={m.avatarUrl}
                alt=""
                width={24}
                height={24}
                className="h-6 w-6 rounded-brand"
              />
            ) : (
              <span className="grid h-6 w-6 place-items-center rounded-brand bg-fg/10 text-[10px] font-bold">
                {m.displayName.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="text-xs">
              <span className="font-semibold">{m.displayName}</span>
              {m.robloxId === you ? (
                <span className="ml-1.5 text-[10px] font-bold uppercase tracking-kicker text-accent">
                  You
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-faint">
        Access is granted per Roblox account by RO. Nation LIVE. Someone here who
        shouldn&apos;t be, or someone missing? Ask your contact.
      </p>
    </section>
  );
}

function SectionCard({
  href,
  title,
  meta,
  body,
}: {
  href: string;
  title: string;
  meta: string;
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
      <p className="mt-1 text-[10px] font-bold uppercase tracking-kicker text-faint">
        {meta}
      </p>
      <p className="mt-2 text-sm text-muted">{body}</p>
    </Link>
  );
}
