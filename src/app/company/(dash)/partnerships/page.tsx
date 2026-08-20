import type { Metadata } from "next";
import Link from "next/link";
import {
  PartnerApplicationStatus,
  PartnerInviteStatus,
  PartnerSiteBriefStatus,
} from "@prisma/client";
import { requireCompanyUser } from "@/lib/company";
import { prisma } from "@/lib/db";
import { inviteState } from "@/lib/partner-invites";
import { INVITE_DAY_CHOICES, INVITE_DAYS } from "@/lib/partner-invites";
import { partnerUrls } from "@/lib/partner-urls";
import { describeOffers } from "@/lib/partner-program";
import { briefGaps } from "@/lib/partner-brief";
import {
  createPartnerInvite,
  createSiteBrief,
  revokePartnerInvite,
  rerollPartnerInvite,
  setApplicationStatus,
} from "@/app/actions/partnerships";
import { CopyField } from "@/components/copy-field";
import { formatDate } from "@/lib/format";
import { Kicker } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Partnerships" };

// /company/partnerships - the staff side of partner.ronation.live.
//
// Three lists on one page, and they are three because they are three stages of one funnel:
// somebody asks, RNL invites, RNL briefs the site. Splitting them across three sections of
// the company nav would hide the thing that matters most - that an application with no
// invite against it is somebody still waiting for an answer.
//
// This is NOT /company/partner-accounts. That page manages entities that already exist and
// the logins attached to them. This one is everything BEFORE that, plus the briefs after -
// and the join between the two is an invite's partnerAccountId, which is written when
// somebody claims it.
//
// ---- Every link on this page is a link somebody sends ----------------------
//
// Invite codes and brief tokens are bearer capabilities. They are rendered with CopyField
// rather than as anchors, deliberately: staff copy them into Discord or an email, and a
// clickable one on the desk is one click from a staff member accidentally claiming an
// invitation with their own Roblox account.

export default async function PartnershipsPage({
  searchParams,
}: {
  searchParams: { ok?: string; error?: string; invite?: string; brief?: string };
}) {
  await requireCompanyUser();

  const [applications, invites, briefs, accounts] = await Promise.all([
    prisma.partnerApplication.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 60,
      include: { invite: { select: { id: true, code: true } } },
    }),
    prisma.partnerInvite.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { partnerAccount: { select: { id: true, name: true } } },
    }),
    prisma.partnerSiteBrief.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        partnerAccount: { select: { name: true } },
        _count: { select: { assets: true } },
      },
    }),
    // For the "raise a brief against" picker. Small list by design - if RNL ever has
    // hundreds of partner accounts this becomes a search, but a select is right for a
    // list you can read.
    prisma.partnerAccount.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
      take: 200,
    }),
  ]);

  const waiting = applications.filter(
    (a) => a.status === PartnerApplicationStatus.NEW,
  ).length;

  return (
    <div className="max-w-4xl">
      <Kicker>Company</Kicker>
      <h1 className="display mt-4 text-4xl leading-none sm:text-5xl">Partnerships</h1>
      <p className="mt-4 max-w-2xl text-muted">
        Everything on partner.ronation.live before somebody becomes an account: who has
        asked, who has been invited, and the briefs we build their sites from.
      </p>

      <Notice ok={searchParams.ok} error={searchParams.error} />

      {/* The freshly-cut link, right where the person who cut it is looking. Without
          this they would have to find the row again to copy the thing they just made. */}
      {searchParams.invite ? (
        <FreshInvite id={searchParams.invite} invites={invites} />
      ) : null}
      {searchParams.brief ? (
        <FreshBrief id={searchParams.brief} briefs={briefs} />
      ) : null}

      {/* ---- Applications ------------------------------------------- */}
      <Section title="Requests" count={waiting ? `${waiting} unanswered` : "All answered"}>
        {applications.length ? (
          <ul className="divide-y divide-line/60 border-y border-line">
            {applications.map((a) => (
              <li key={a.id} className="py-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <Link
                    href={`/company/partnerships/${a.id}`}
                    className="min-w-0 font-display text-xl transition-colors hover:text-accent"
                  >
                    {a.name}
                  </Link>
                  <span className="shrink-0 text-[11px] font-bold uppercase tracking-kicker text-faint">
                    {a.status} · {formatDate(a.createdAt)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {a.displayName} · {describeOffers(a.interests)}
                </p>
                {a.invite ? (
                  <p className="mt-1 text-xs text-accent">Invited</p>
                ) : (
                  <form
                    action={setApplicationStatus}
                    className="mt-2 flex flex-wrap gap-2"
                  >
                    <input type="hidden" name="id" value={a.id} />
                    {a.status !== PartnerApplicationStatus.REVIEWING ? (
                      <button
                        name="status"
                        value={PartnerApplicationStatus.REVIEWING}
                        className="btn btn-ghost px-3 py-1.5 text-[10px]"
                      >
                        I&apos;m on it
                      </button>
                    ) : null}
                    <button
                      name="status"
                      value={PartnerApplicationStatus.DECLINED}
                      className="btn btn-ghost px-3 py-1.5 text-[10px]"
                    >
                      Decline
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Nobody has written in yet.</Empty>
        )}
      </Section>

      {/* ---- Invites -------------------------------------------------- */}
      <Section title="Invitations" count={`${invites.length}`}>
        <form
          action={createPartnerInvite}
          className="card mb-6 space-y-4 p-5"
        >
          <p className="text-sm text-muted">
            Cut a link and send it to somebody. Whoever opens it and signs in gets a
            partner account in this name - so send it the way you would send a password.
          </p>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_7rem]">
            <input
              name="label"
              required
              maxLength={120}
              placeholder="Who it is for - it is printed on the page"
              className={INPUT}
            />
            <select name="kind" defaultValue="COMPANY" className={INPUT}>
              <option value="COMPANY">A group</option>
              <option value="PERSON">A person</option>
            </select>
            <select name="days" defaultValue={String(INVITE_DAYS)} className={INPUT}>
              {INVITE_DAY_CHOICES.map((d) => (
                <option key={d} value={d}>
                  {d} days
                </option>
              ))}
            </select>
          </div>
          <input
            name="note"
            maxLength={500}
            placeholder="Note to ourselves - where they came from, what was agreed"
            className={INPUT}
          />
          <button className="btn btn-accent">Cut an invitation</button>
        </form>

        {invites.length ? (
          <ul className="divide-y divide-line/60 border-y border-line">
            {invites.map((i) => {
              const state = inviteState(i);
              return (
                <li key={i.id} className="py-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                    <span className="font-display text-xl">{i.label}</span>
                    <span className="shrink-0 text-[11px] font-bold uppercase tracking-kicker text-faint">
                      {state} · cut {formatDate(i.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    By {i.issuedByName}
                    {state === "pending"
                      ? ` · expires ${formatDate(i.expiresAt)}`
                      : i.claimedByName
                        ? ` · claimed by ${i.claimedByName}`
                        : ""}
                    {i.partnerAccount ? ` · ${i.partnerAccount.name}` : ""}
                  </p>
                  {i.note ? (
                    <p className="mt-1 text-xs text-faint">{i.note}</p>
                  ) : null}

                  {state === "pending" ? (
                    <div className="mt-3 space-y-2">
                      <CopyField value={partnerUrls.invite(i.code)} label="Invite link" />
                      <div className="flex flex-wrap gap-2">
                        <form action={rerollPartnerInvite}>
                          <input type="hidden" name="id" value={i.id} />
                          <button className="btn btn-ghost px-3 py-1.5 text-[10px]">
                            New code
                          </button>
                        </form>
                        <form action={revokePartnerInvite}>
                          <input type="hidden" name="id" value={i.id} />
                          <button className="btn btn-ghost px-3 py-1.5 text-[10px]">
                            Revoke
                          </button>
                        </form>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>No invitations cut yet.</Empty>
        )}
      </Section>

      {/* ---- Briefs --------------------------------------------------- */}
      <Section title="Site briefs" count={`${briefs.length}`}>
        <form action={createSiteBrief} className="card mb-6 space-y-4 p-5">
          <p className="text-sm text-muted">
            Raise a brief and send the link to whoever knows their brand. It does not need
            to be one of their Roblox logins - that is the point of it.
          </p>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
            <input
              name="label"
              required
              maxLength={120}
              placeholder="What to call it - their name, usually"
              className={INPUT}
            />
            <select name="partnerAccountId" defaultValue="" className={INPUT}>
              <option value="">Not linked to an account yet</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-accent">Raise a brief</button>
        </form>

        {briefs.length ? (
          <ul className="divide-y divide-line/60 border-y border-line">
            {briefs.map((b) => {
              const gaps = briefGaps(b, b._count.assets);
              return (
                <li key={b.id} className="py-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                    <Link
                      href={`/company/partnerships/brief/${b.id}`}
                      className="min-w-0 font-display text-xl transition-colors hover:text-accent"
                    >
                      {b.siteName || b.label}
                    </Link>
                    <span className="shrink-0 text-[11px] font-bold uppercase tracking-kicker text-faint">
                      {b.status === PartnerSiteBriefStatus.SUBMITTED
                        ? `handed in ${b.submittedAt ? formatDate(b.submittedAt) : ""}`
                        : "draft"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {b.partnerAccount ? `${b.partnerAccount.name} · ` : ""}
                    {b._count.assets} file{b._count.assets === 1 ? "" : "s"}
                    {gaps.length ? ` · ${gaps.length} thing${gaps.length === 1 ? "" : "s"} missing` : " · complete"}
                  </p>
                  <div className="mt-3">
                    <CopyField value={partnerUrls.brief(b.token)} label="Brief link" />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>No briefs raised yet.</Empty>
        )}
      </Section>
    </div>
  );
}

const INPUT =
  "w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm outline-none transition-colors focus:border-accent";

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-14">
      <div className="mb-5 flex items-baseline gap-3">
        <h2 className="display text-2xl leading-none">{title}</h2>
        <span aria-hidden className="h-px flex-1 bg-line" />
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-kicker text-faint">
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-y border-line py-6 text-sm text-faint">{children}</p>
  );
}

function FreshInvite({
  id,
  invites,
}: {
  id: string;
  invites: { id: string; code: string; label: string }[];
}) {
  const invite = invites.find((i) => i.id === id);
  if (!invite) return null;
  return (
    <div className="card mt-8 border-accent/30 p-5">
      <p className="text-sm text-muted">
        Invitation for <span className="text-fg">{invite.label}</span>. Send this to them -
        it is the only copy, and anybody holding it can use it.
      </p>
      <div className="mt-3">
        <CopyField value={partnerUrls.invite(invite.code)} label="Invite link" />
      </div>
    </div>
  );
}

function FreshBrief({
  id,
  briefs,
}: {
  id: string;
  briefs: { id: string; token: string; label: string }[];
}) {
  const brief = briefs.find((b) => b.id === id);
  if (!brief) return null;
  return (
    <div className="card mt-8 border-accent/30 p-5">
      <p className="text-sm text-muted">
        Brief for <span className="text-fg">{brief.label}</span>. Send this to whoever
        knows their brand.
      </p>
      <div className="mt-3">
        <CopyField value={partnerUrls.brief(brief.token)} label="Brief link" />
      </div>
    </div>
  );
}

function Notice({ ok, error }: { ok?: string; error?: string }) {
  const messages: Record<string, string> = {
    invited: "Invitation cut.",
    revoked: "Invitation revoked. The old link is dead.",
    rerolled: "New code issued. The old link is dead.",
    brief: "Brief raised.",
    deleted: "Brief and its files deleted.",
    status: "Updated.",
    note: "Note saved.",
  };
  const errors: Record<string, string> = {
    label: "It needs a name - it is printed on the page the recipient sees.",
    missing: "That row has gone.",
    status: "That isn't a status.",
  };

  if (error) {
    return (
      <p
        role="alert"
        className="mt-8 rounded-brand border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
      >
        {errors[error] ?? "That didn't work."}
      </p>
    );
  }
  if (ok && messages[ok]) {
    return (
      <p className="mt-8 rounded-brand border border-line px-4 py-3 text-sm text-muted">
        {messages[ok]}
      </p>
    );
  }
  return null;
}
