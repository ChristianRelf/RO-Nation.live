import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentStatus, PartnerAccountKind, PartnerAccountStatus } from "@prisma/client";
import { requireCompanyUser } from "@/lib/company";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import {
  addPartnerAccountMember,
  deletePartnerAccount,
  removePartnerAccountMember,
  setPartnerAccountStatus,
} from "@/app/actions/partner-accounts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Partner" };

const NOTICE: Record<string, { tone: "ok" | "error"; text: string }> = {
  created: { tone: "ok", text: "Partner created. Add a login below so they can sign in." },
  status: { tone: "ok", text: "Status updated." },
  added: { tone: "ok", text: "Login added." },
  removed: { tone: "ok", text: "Login removed." },
  required: { tone: "error", text: "Enter a Roblox username or id." },
  roblox: { tone: "error", text: "Couldn't find that Roblox account. Check the username or id." },
  already: {
    tone: "error",
    text: "That Roblox account is already attached to a partner - to this one or another.",
  },
};

export default async function PartnerAccountDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { ok?: string; error?: string };
}) {
  await requireCompanyUser();

  const account = await prisma.partnerAccount.findUnique({
    where: { id: params.id },
    include: { members: { orderBy: { createdAt: "asc" } } },
  });
  if (!account) notFound();

  const docCount = await prisma.accountingDocument.count({
    where: { partnerAccountId: account.id, status: { not: DocumentStatus.DRAFT } },
  });

  const partner = account.status === PartnerAccountStatus.PARTNER;
  const notice = NOTICE[searchParams.ok ?? ""] ?? NOTICE[searchParams.error ?? ""];

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/company/partner-accounts"
        className="text-sm text-muted transition-colors hover:text-fg"
      >
        ← Partner accounts
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl uppercase">{account.name}</h1>
        <span className="text-xs text-faint">
          {account.kind === PartnerAccountKind.COMPANY ? "Company" : "Person"}
        </span>
      </div>
      <p className="mt-2 text-sm text-faint">
        {docCount} {docCount === 1 ? "document" : "documents"} raised · added{" "}
        {formatDate(account.createdAt)} by {account.createdByName}
      </p>

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

      {/* Status */}
      <section className="card mt-8 p-6">
        <h2 className="font-display text-xl uppercase">Status</h2>
        <p className="mt-1 text-sm text-muted">
          A <span className="font-semibold text-fg">Potential partner</span> reads the
          agreements only. A <span className="font-semibold text-fg">Partner</span> also sees
          their accounting.
        </p>
        <form
          action={setPartnerAccountStatus}
          className="mt-4 flex flex-wrap items-center gap-3"
        >
          <input type="hidden" name="id" value={account.id} />
          <select
            name="status"
            defaultValue={account.status}
            className="border border-line bg-bg px-4 py-2.5 text-sm outline-none transition-colors focus:border-accent"
          >
            <option value={PartnerAccountStatus.POTENTIAL}>Potential partner</option>
            <option value={PartnerAccountStatus.PARTNER}>Partner</option>
          </select>
          <button type="submit" className="btn btn-ghost">
            Update
          </button>
          <span className="text-xs text-faint">
            Currently {partner ? "Partner" : "Potential partner"}.
          </span>
        </form>
      </section>

      {/* Logins */}
      <section className="card mt-6 p-6">
        <h2 className="font-display text-xl uppercase">Logins</h2>
        <p className="mt-1 text-sm text-muted">
          The Roblox accounts that can sign in as {account.name}. A person usually needs one; a
          company can have several.
        </p>

        {account.members.length === 0 ? (
          <p className="mt-4 text-sm text-faint">
            No logins yet - nobody can sign in for this partner until you add one.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {account.members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-4 py-3">
                <span className="flex items-center gap-3">
                  {m.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.avatarUrl}
                      alt=""
                      width={32}
                      height={32}
                      className="h-8 w-8 rounded-brand"
                    />
                  ) : (
                    <span className="grid h-8 w-8 place-items-center rounded-brand bg-surface text-xs font-bold">
                      {m.displayName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span>
                    <span className="block text-sm font-medium">{m.displayName}</span>
                    <span className="block text-xs text-faint">@{m.username}</span>
                  </span>
                </span>
                <form action={removePartnerAccountMember}>
                  <input type="hidden" name="partnerAccountId" value={account.id} />
                  <input type="hidden" name="id" value={m.id} />
                  <button
                    type="submit"
                    className="text-xs font-semibold uppercase tracking-kicker text-faint transition-colors hover:text-red-400"
                  >
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form
          action={addPartnerAccountMember}
          className="mt-5 flex flex-wrap items-end gap-3"
        >
          <input type="hidden" name="partnerAccountId" value={account.id} />
          <label className="block flex-1">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-kicker text-faint">
              Add a login
            </span>
            <input
              name="robloxId"
              required
              placeholder="Roblox username or id"
              className="w-full border border-line bg-bg px-4 py-2.5 text-sm outline-none transition-colors focus:border-accent"
            />
          </label>
          <button type="submit" className="btn btn-accent">
            Add
          </button>
        </form>
      </section>

      {/* Danger */}
      <section className="mt-6 rounded-brand border border-red-500/20 p-6">
        <h2 className="font-display text-xl uppercase">Delete</h2>
        <p className="mt-1 text-sm text-muted">
          Removes this partner and every login. Documents already raised against them keep
          their own copy of the name and still print - only the sign-in is lost.
        </p>
        <form action={deletePartnerAccount} className="mt-4">
          <input type="hidden" name="id" value={account.id} />
          <button
            type="submit"
            className="text-xs font-semibold uppercase tracking-kicker text-red-400 transition-colors hover:text-red-300"
          >
            Delete this partner
          </button>
        </form>
      </section>
    </div>
  );
}
