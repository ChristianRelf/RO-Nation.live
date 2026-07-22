import type { Metadata } from "next";
import Link from "next/link";
import { PartnerAccountKind, PartnerAccountStatus } from "@prisma/client";
import { requireCompanyUser } from "@/lib/company";
import { prisma } from "@/lib/db";
import { createPartnerAccount } from "@/app/actions/partner-accounts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Partner accounts" };

const NOTICE: Record<string, { tone: "ok" | "error"; text: string }> = {
  created: { tone: "ok", text: "Partner created. Add a login below so they can sign in." },
  deleted: { tone: "ok", text: "Partner deleted." },
  name: { tone: "error", text: "A name is required." },
  kind: { tone: "error", text: "Pick whether this is a person or a company." },
  status: { tone: "error", text: "Invalid status." },
  missing: { tone: "error", text: "That partner no longer exists." },
};

export default async function PartnerAccountsPage({
  searchParams,
}: {
  searchParams: { ok?: string; error?: string };
}) {
  await requireCompanyUser();

  const accounts = await prisma.partnerAccount.findMany({
    include: { _count: { select: { members: true } } },
    orderBy: { createdAt: "desc" },
  });

  const notice = NOTICE[searchParams.ok ?? ""] ?? NOTICE[searchParams.error ?? ""];

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl uppercase">Partner accounts</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Commercial partners and prospects who sign in at{" "}
            <span className="font-mono text-xs">portal.ronation.live/partner</span> to read
            their agreements and, once a full partner, their accounting. Not the tenant
            partner sites - those live under Partners.
          </p>
        </div>
      </div>

      {notice ? (
        <p
          className={
            notice.tone === "ok"
              ? "mt-6 rounded-brand border border-accent/40 bg-accent-soft px-4 py-3 text-sm text-accent"
              : "mt-6 rounded-brand border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300"
          }
        >
          {notice.text}
        </p>
      ) : null}

      {/* New partner */}
      <form
        action={createPartnerAccount}
        className="card mt-8 grid gap-4 p-6 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end"
      >
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-kicker text-faint">
            Name
          </span>
          <input
            name="name"
            required
            maxLength={120}
            placeholder="A person's name or a company name"
            className="w-full border border-line bg-bg px-4 py-2.5 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-kicker text-faint">
            Kind
          </span>
          <select
            name="kind"
            defaultValue={PartnerAccountKind.PERSON}
            className="border border-line bg-bg px-4 py-2.5 text-sm outline-none transition-colors focus:border-accent"
          >
            <option value={PartnerAccountKind.PERSON}>Person</option>
            <option value={PartnerAccountKind.COMPANY}>Company</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-kicker text-faint">
            Status
          </span>
          <select
            name="status"
            defaultValue={PartnerAccountStatus.POTENTIAL}
            className="border border-line bg-bg px-4 py-2.5 text-sm outline-none transition-colors focus:border-accent"
          >
            <option value={PartnerAccountStatus.POTENTIAL}>Potential partner</option>
            <option value={PartnerAccountStatus.PARTNER}>Partner</option>
          </select>
        </label>

        <button type="submit" className="btn btn-accent">
          Create
        </button>
      </form>

      {/* The list */}
      <div className="mt-10">
        {accounts.length === 0 ? (
          <p className="text-sm text-faint">No partner accounts yet.</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {accounts.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/company/partner-accounts/${a.id}`}
                  className="group flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-4"
                >
                  <span className="min-w-0">
                    <span className="font-display text-xl transition-colors group-hover:text-accent">
                      {a.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-faint">
                      {a.kind === PartnerAccountKind.COMPANY ? "Company" : "Person"} ·{" "}
                      {a._count.members} {a._count.members === 1 ? "login" : "logins"}
                    </span>
                  </span>
                  <StatusBadge status={a.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: PartnerAccountStatus }) {
  const partner = status === PartnerAccountStatus.PARTNER;
  return (
    <span
      className={
        partner
          ? "shrink-0 rounded-brand border border-accent/40 bg-accent-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-kicker text-accent"
          : "shrink-0 rounded-brand border border-line px-2.5 py-1 text-[10px] font-bold uppercase tracking-kicker text-muted"
      }
    >
      {partner ? "Partner" : "Potential"}
    </span>
  );
}
