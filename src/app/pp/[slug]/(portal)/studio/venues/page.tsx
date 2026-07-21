import type { Metadata } from "next";
import Link from "next/link";
import {
  assertPartnerFeature,
  requirePartnerUser,
} from "@/lib/partners/guard";
import { partnerPortalPath } from "@/lib/partners/urls";
import { LocalTime } from "@/components/local-time";
import { venueTemplates } from "@/lib/venue/form";
import { parseLayout } from "@/lib/venue/schema";
import { totalSeats } from "@/lib/venue/seats";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Venues" };

// A partner's venue LIBRARY - the mirror of company/(dash)/venues.
//
// Templates only, for the reason the company page gives: an event's map is a CLONE and is
// edited from the event. Listing the copies here would invite somebody to edit the wrong
// one, and the wrong one is a show that has already sold.
//
// Gated on the `events` feature. A partner who cannot run shows has no use for a room to
// put one in, and the registry's rule is that a feature they don't have 404s rather than
// merely hiding its nav item.

export default async function PartnerVenuesPage({
  params,
}: {
  params: { slug: string };
}) {
  const user = await requirePartnerUser(params.slug);
  const { partner, canWrite } = user;
  assertPartnerFeature(partner, "events");

  // Scoped to THIS partner. RNL's own templates (partnerId: null) are not theirs to reuse.
  const templates = await venueTemplates(partner.slug);

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

  const base = partnerPortalPath(partner.slug, "/studio/venues");

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
            Line-up
          </p>
          <h1 className="display mt-3 text-5xl">Venues</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Draw a room once, then reuse it for every show that happens there. An event
            gets its own copy, so editing a venue never re-seats a show that has already
            sold.
          </p>
        </div>

        {canWrite ? (
          <Link href={`${base}/new`} className="btn btn-accent shrink-0">
            + New venue
          </Link>
        ) : null}
      </div>

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
                      {canWrite ? (
                        <Link
                          href={`${base}/${v.id}/edit`}
                          className="font-medium transition-colors hover:text-accent"
                        >
                          {v.name}
                        </Link>
                      ) : (
                        <span className="font-medium">{v.name}</span>
                      )}
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
                      {canWrite ? (
                        <Link
                          href={`${base}/${v.id}/edit`}
                          className="text-xs text-faint transition-colors hover:text-fg"
                        >
                          Edit
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card grid place-items-center px-6 py-16 text-center">
          <p className="font-display text-2xl uppercase">No venues yet</p>
          <p className="mt-2 max-w-sm text-sm text-muted">
            {canWrite
              ? "Draw one, and every show in that room can reuse it."
              : "Management hasn't drawn any rooms yet."}
          </p>
          {canWrite ? (
            <Link href={`${base}/new`} className="btn btn-accent mt-6">
              + New venue
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
