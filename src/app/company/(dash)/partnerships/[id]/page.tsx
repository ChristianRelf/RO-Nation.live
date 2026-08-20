import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PartnerAccountKind, PartnerApplicationStatus } from "@prisma/client";
import { requireCompanyUser } from "@/lib/company";
import { prisma } from "@/lib/db";
import { describeOffers } from "@/lib/partner-program";
import { INVITE_DAY_CHOICES, INVITE_DAYS } from "@/lib/partner-invites";
import { partnerUrls } from "@/lib/partner-urls";
import {
  createPartnerInvite,
  setApplicationNote,
  setApplicationStatus,
} from "@/app/actions/partnerships";
import { CopyField } from "@/components/copy-field";
import { formatDate } from "@/lib/format";
import { Kicker } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Request" };

// One partnership request, in full, with the two things staff do about it: answer it, and
// write down what was decided.
//
// ---- Accepting IS cutting an invite ---------------------------------------
//
// There is no "Accept" button that only changes a status. Accepting an application means
// somebody gets a link, so the form that does it is the invite form, and it carries the
// application id - the action marks the row ACCEPTED and joins the two in one write. A
// separate accept step would create the state this desk most wants to avoid: an
// application marked accepted with nothing sent.

const INPUT =
  "w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm outline-none transition-colors focus:border-accent";

export default async function ApplicationPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { ok?: string; error?: string };
}) {
  await requireCompanyUser();

  const application = await prisma.partnerApplication.findUnique({
    where: { id: params.id },
    include: { invite: true },
  });
  if (!application) notFound();

  return (
    <div className="max-w-3xl">
      <Link
        href="/company/partnerships"
        className="text-[10px] font-bold uppercase tracking-kicker text-faint transition-colors hover:text-accent"
      >
        ← Partnerships
      </Link>

      <Kicker className="mt-6">Request</Kicker>
      <h1 className="display mt-4 text-4xl leading-none sm:text-5xl">
        {application.name}
      </h1>
      <p className="mt-3 text-sm text-muted">
        {application.kind === PartnerAccountKind.COMPANY ? "A group" : "An individual"} ·
        written in on {formatDate(application.createdAt)} by {application.displayName} (
        {application.username})
      </p>

      {searchParams.ok ? (
        <p className="mt-6 rounded-brand border border-line px-4 py-3 text-sm text-muted">
          Saved.
        </p>
      ) : null}

      {/* ---- Reaching them ------------------------------------------- */}
      <dl className="mt-10 grid gap-px overflow-hidden rounded-brand border border-line bg-line sm:grid-cols-2">
        <Cell label="Email" value={application.email} mono />
        <Cell label="Discord" value={application.discord} mono />
        <Cell label="Roblox group" value={application.robloxGroupUrl} mono />
        <Cell label="Roughly how big" value={application.audience} />
      </dl>

      {/* ---- Their words --------------------------------------------- */}
      <section className="mt-10">
        <h2 className="text-[11px] font-bold uppercase tracking-kicker text-faint">
          What they run
        </h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
          {application.about}
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-[11px] font-bold uppercase tracking-kicker text-faint">
          What they want
        </h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
          {application.want}
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-[11px] font-bold uppercase tracking-kicker text-faint">
          Interested in
        </h2>
        <p className="mt-3 text-sm text-muted">{describeOffers(application.interests)}</p>
      </section>

      {/* ---- Our notes ------------------------------------------------ */}
      <section className="mt-12">
        <h2 className="display text-2xl leading-none">Our notes</h2>
        <p className="mt-2 text-xs text-faint">
          Never shown to them. This is the only place on the desk that is.
        </p>
        <form action={setApplicationNote} className="mt-4 space-y-3">
          <input type="hidden" name="id" value={application.id} />
          <textarea
            name="note"
            rows={4}
            defaultValue={application.note ?? ""}
            maxLength={2000}
            className={`${INPUT} resize-y`}
            placeholder="Who spoke to them, what was agreed, why we said no."
          />
          <button className="btn btn-ghost">Save the note</button>
        </form>
      </section>

      {/* ---- The answer ----------------------------------------------- */}
      <section className="mt-12 border-t border-line pt-10">
        <h2 className="display text-2xl leading-none">The answer</h2>

        {application.invite ? (
          <div className="mt-4">
            <p className="text-sm text-muted">
              Accepted, and an invitation went out on{" "}
              {formatDate(application.invite.createdAt)}.
            </p>
            <div className="mt-3">
              <CopyField
                value={partnerUrls.invite(application.invite.code)}
                label="Invite link"
              />
            </div>
            <p className="mt-2 text-xs text-faint">
              Revoking or re-rolling it is on the{" "}
              <Link href="/company/partnerships" className="link-underline font-semibold">
                partnerships desk
              </Link>
              .
            </p>
          </div>
        ) : application.status === PartnerApplicationStatus.DECLINED ? (
          <div className="mt-4">
            <p className="text-sm text-muted">
              Declined. Nothing was sent from here - if they were told, somebody told them.
            </p>
            <form action={setApplicationStatus} className="mt-4">
              <input type="hidden" name="id" value={application.id} />
              <button
                name="status"
                value={PartnerApplicationStatus.REVIEWING}
                className="btn btn-ghost"
              >
                Reopen it
              </button>
            </form>
          </div>
        ) : (
          <>
            <p className="mt-2 max-w-xl text-sm text-muted">
              Accepting cuts an invitation and links it to this request. Whoever opens that
              link and signs in gets a partner account in the name below - so send it the
              way you would send a password.
            </p>

            <form action={createPartnerInvite} className="card mt-5 space-y-4 p-5">
              <input type="hidden" name="applicationId" value={application.id} />
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_7rem]">
                <input
                  name="label"
                  required
                  maxLength={120}
                  defaultValue={application.name}
                  className={INPUT}
                />
                <select name="kind" defaultValue={application.kind} className={INPUT}>
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
                placeholder="Note to ourselves"
                className={INPUT}
              />
              <button className="btn btn-accent">Accept and cut an invitation</button>
            </form>

            <form action={setApplicationStatus} className="mt-4 flex flex-wrap gap-2">
              <input type="hidden" name="id" value={application.id} />
              {application.status !== PartnerApplicationStatus.REVIEWING ? (
                <button
                  name="status"
                  value={PartnerApplicationStatus.REVIEWING}
                  className="btn btn-ghost"
                >
                  I&apos;m on it
                </button>
              ) : null}
              <button
                name="status"
                value={PartnerApplicationStatus.DECLINED}
                className="btn btn-ghost"
              >
                Decline
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

function Cell({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div className="bg-bg p-4">
      <dt className="text-[10px] font-bold uppercase tracking-kicker text-faint">
        {label}
      </dt>
      <dd
        className={`mt-1 break-words text-sm ${mono ? "font-mono text-xs" : ""} ${
          value ? "" : "text-faint"
        }`}
      >
        {value || "Not given"}
      </dd>
    </div>
  );
}
