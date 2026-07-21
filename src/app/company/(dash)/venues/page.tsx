import Link from "next/link";
import type { Metadata } from "next";
import { AdminHeader } from "@/components/admin-ui";
import { requireCompanyUser } from "@/lib/company";
import { LocalTime } from "@/components/local-time";
import { venueTemplates } from "@/lib/venue/form";
import { parseLayout } from "@/lib/venue/schema";
import { totalSeats } from "@/lib/venue/seats";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Venues" };

// The venue LIBRARY.
//
// Templates only. An event's own map is a CLONE of one of these and is edited from the
// event, not from here - see the note on Event.venueMapId. Listing event copies in the
// library would invite somebody to edit the wrong one, and "the wrong one" is a show that
// has already sold four hundred tickets.

export default async function CompanyVenuesPage() {
  await requireCompanyUser();

  const templates = await venueTemplates(null);

  // The seat count is the useful thing about a venue at a glance, and it lives inside the
  // Json - so it is derived here rather than denormalised onto a column that would go stale
  // the first time somebody edited a row spec.
  const rows = await Promise.all(
    templates.map(async (t) => {
      const map = await prisma.venueMap.findUnique({
        where: { id: t.id },
        select: { layout: true },
      });
      const layout = map ? parseLayout(map.layout) : null;
      return {
        ...t,
        seats: layout ? totalSeats(layout) : null,
        shapes: layout ? layout.shapes.length : null,
      };
    }),
  );

  return (
    <div>
      <AdminHeader
        title="Venues"
        subtitle="Draw a room once, then reuse it for every show that happens there. An event gets its own copy, so editing a venue never re-seats a show that has already sold."
        action={{ label: "+ New venue", href: "/company/venues/new" }}
      />

      {rows.length ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-5 py-3 font-semibold">Venue</th>
                  <th className="px-5 py-3 font-semibold">Seats</th>
                  <th className="px-5 py-3 font-semibold">Updated</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => (
                  <tr key={v.id} className="border-b border-line/60 last:border-0">
                    <td className="px-5 py-3">
                      <Link
                        href={`/company/venues/${v.id}/edit`}
                        className="font-medium transition-colors hover:text-accent"
                      >
                        {v.name}
                      </Link>
                      <p className="text-xs text-faint">
                        {v.shapes === null
                          ? "unreadable layout"
                          : `${v.shapes} shape${v.shapes === 1 ? "" : "s"}`}
                      </p>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-muted">
                      {v.seats === null ? "—" : v.seats || "standing"}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted">
                      <LocalTime value={v.updatedAt} mode="datetime" />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/company/venues/${v.id}/edit`}
                        className="text-xs text-faint transition-colors hover:text-fg"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="rounded-brand border border-dashed border-line px-4 py-10 text-center text-sm text-faint">
          No venues yet. Draw one, and every show in that room can reuse it.
        </p>
      )}
    </div>
  );
}
