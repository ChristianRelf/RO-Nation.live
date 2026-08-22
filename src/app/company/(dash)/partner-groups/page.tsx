import Link from "next/link";
import { prisma } from "@/lib/db";
import { AdminHeader, Badge } from "@/components/admin-ui";
import { ConfirmButton } from "@/components/confirm-button";
import { RobloxAvatar } from "@/components/roblox-picker";
import { deletePartnerGroup, refreshPartnerGroup } from "@/app/actions/company";
import { requireCompanyUser } from "@/lib/company";
import { robloxGroupUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CompanyPartnerGroupsPage({
  searchParams,
}: {
  searchParams: { ok?: string; error?: string };
}) {
  await requireCompanyUser();

  const groups = await prisma.partnerGroup.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });

  const shown = groups.filter((g) => g.visible).length;

  return (
    <div>
      <AdminHeader
        title="Partner groups"
        subtitle='The Roblox groups shown under "Our Partners" on partner.ronation.live. Member counts are read live - nothing here is stored.'
        action={{ label: "+ Add a group", href: "/company/partner-groups/new" }}
      />

      {searchParams.error === "roblox" ? (
        <p className="mb-6 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Roblox didn&apos;t answer, so nothing was changed. That card is exactly
          as it was - try again in a minute.
        </p>
      ) : null}
      {searchParams.ok === "refreshed" ? (
        <p className="mb-6 border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
          Re-read from Roblox.
        </p>
      ) : null}

      {groups.length ? (
        <>
          <p className="mb-4 text-sm text-muted">
            <span className="font-semibold text-fg">{shown}</span> of {groups.length}{" "}
            {groups.length === 1 ? "group is" : "groups are"} on the public page.
          </p>

          <div className="space-y-3">
            {groups.map((g) => (
              <div key={g.id} className="card flex flex-wrap items-center gap-4 p-4">
                <RobloxAvatar src={g.iconUrl} size={48} />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-lg">{g.name}</h3>
                    {!g.visible ? <Badge value="HIDDEN" /> : null}
                  </div>
                  <p className="max-w-xl truncate text-sm text-muted">{g.description}</p>
                  <a
                    href={robloxGroupUrl(g.robloxGroupId)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs text-faint hover:text-accent"
                  >
                    {g.robloxGroupId} ↗
                  </a>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  {/* Names and icons rotate on Roblox's side; without this the only fix
                      is delete-and-re-add, which loses the description and ordering. */}
                  <form action={refreshPartnerGroup}>
                    <input type="hidden" name="id" value={g.id} />
                    <button
                      className="text-muted hover:text-fg"
                      title="Re-read the name and icon from Roblox"
                    >
                      Re-sync
                    </button>
                  </form>
                  <Link
                    href={`/company/partner-groups/${g.id}/edit`}
                    className="text-muted hover:text-fg"
                  >
                    Edit
                  </Link>
                  <form action={deletePartnerGroup}>
                    <input type="hidden" name="id" value={g.id} />
                    <ConfirmButton
                      className="text-faint hover:text-red-400"
                      message={`Remove ${g.name} from "Our Partners"? To take them off the site temporarily, edit them and untick "Show on Our Partners" instead.`}
                    >
                      Remove
                    </ConfirmButton>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="card grid place-items-center px-6 py-20 text-center">
          <p className="font-display text-2xl">No partner groups yet</p>
          <p className="mt-2 max-w-md text-muted">
            The &quot;Our Partners&quot; section on partner.ronation.live stays hidden
            until there&apos;s at least one group to show.
          </p>
          <Link href="/company/partner-groups/new" className="btn btn-accent mt-6">
            Add the first one
          </Link>
        </div>
      )}
    </div>
  );
}
