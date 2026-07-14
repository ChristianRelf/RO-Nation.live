import Link from "next/link";
import { prisma } from "@/lib/db";
import { AdminHeader, Badge } from "@/components/admin-ui";
import { ConfirmButton } from "@/components/confirm-button";
import { RobloxAvatar } from "@/components/roblox-picker";
import { deleteTeamMember, refreshTeamMember } from "@/app/actions/company";
import { requireCompanyUser } from "@/lib/company";
import { robloxProfileUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CompanyTeamPage({
  searchParams,
}: {
  searchParams: { ok?: string; error?: string };
}) {
  await requireCompanyUser();

  const crew = await prisma.teamMember.findMany({
    orderBy: [{ department: "asc" }, { order: "asc" }, { displayName: "asc" }],
  });

  const shown = crew.filter((m) => m.visible).length;

  return (
    <div>
      <AdminHeader
        title="Team"
        subtitle="Who appears on /team. Every card is a real Roblox account, picked from Roblox."
        action={{ label: "+ Add someone", href: "/company/team/new" }}
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

      {crew.length ? (
        <>
          <p className="mb-4 text-sm text-muted">
            <span className="font-semibold text-fg">{shown}</span> of {crew.length}{" "}
            {crew.length === 1 ? "person is" : "people are"} on the public page.
          </p>

          <div className="space-y-3">
            {crew.map((m) => (
              <div key={m.id} className="card flex flex-wrap items-center gap-4 p-4">
                <RobloxAvatar src={m.avatarUrl} size={48} />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-lg">{m.displayName}</h3>
                    <Badge value={m.department.toUpperCase()} />
                    {!m.visible ? <Badge value="HIDDEN" /> : null}
                  </div>
                  <p className="text-sm text-muted">{m.role}</p>
                  <a
                    href={robloxProfileUrl(m.robloxId)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs text-faint hover:text-accent"
                  >
                    @{m.robloxUsername} · {m.robloxId} ↗
                  </a>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  {/* Usernames change and Roblox rotates its headshot URLs. Without this
                      the only fix is delete-and-re-add, which loses the blurb and the
                      ordering - so nobody does it, so the page fills up with people under
                      names they no longer use. */}
                  <form action={refreshTeamMember}>
                    <input type="hidden" name="id" value={m.id} />
                    <button
                      className="text-muted hover:text-fg"
                      title="Re-read their name and picture from Roblox"
                    >
                      Re-sync
                    </button>
                  </form>
                  <Link
                    href={`/company/team/${m.id}/edit`}
                    className="text-muted hover:text-fg"
                  >
                    Edit
                  </Link>
                  <form action={deleteTeamMember}>
                    <input type="hidden" name="id" value={m.id} />
                    <ConfirmButton
                      className="text-faint hover:text-red-400"
                      message={`Remove ${m.displayName} from the crew? To take them off the site temporarily, edit them and untick "Show on /team" instead.`}
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
          <p className="font-display text-2xl">Nobody on the crew yet</p>
          <p className="mt-2 max-w-md text-muted">
            /team currently shows a heading and a hiring CTA, and nothing else -
            which is honest, and better than the six invented people it used to
            show. Add the real crew and the grid appears.
          </p>
          <Link href="/company/team/new" className="btn btn-accent mt-6">
            Add the first one
          </Link>
        </div>
      )}
    </div>
  );
}
