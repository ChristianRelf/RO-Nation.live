import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VenueDesigner } from "@/components/venue/venue-designer";
import {
  assertPartnerFeature,
  requirePartnerManager,
} from "@/lib/partners/guard";
import { partnerPortalPath } from "@/lib/partners/urls";
import { prisma } from "@/lib/db";
import { attachPartnerVenue, savePartnerVenue } from "@/app/actions/venue";
import { venueMapFor, venueTemplates } from "@/lib/venue/form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Event venue" };

// The event's OWN map, in a partner's studio.
//
// A clone of one of THEIR templates, with THIS show's tiers assigned to its sections.
// Editing here cannot touch the template it came from, and editing the template cannot
// touch this - see the note on Event.venueMapId. That separation is why the clone exists.

export default async function PartnerEventVenuePage({
  params,
  searchParams,
}: {
  params: { slug: string; id: string };
  searchParams: { error?: string; keys?: string };
}) {
  const { partner } = await requirePartnerManager(params.slug);
  assertPartnerFeature(partner, "events");

  // Matched on the partner as well as the id, so another org's event id in the URL is a
  // 404 here rather than an editable map of their room.
  const event = await prisma.event.findFirst({
    where: { id: params.id, partnerId: partner.slug },
    select: {
      id: true,
      title: true,
      seatMode: true,
      capacity: true,
      venueMapId: true,
      tiers: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, priceRobux: true },
      },
    },
  });
  if (!event) notFound();

  const base = partnerPortalPath(partner.slug, "/studio/events");
  const templates = await venueTemplates(partner.slug);
  const map = event.venueMapId
    ? await venueMapFor(event.venueMapId, partner.slug)
    : null;

  // No map yet: pick a template to clone. This is the ONLY way an event gets one - it
  // never points at a template directly.
  if (!map) {
    return (
      <div>
        <div className="mb-8 border-b border-line pb-6">
          <p className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
            Line-up
          </p>
          <h1 className="display mt-3 text-5xl">{event.title}</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Give this show a venue. It gets its own copy, so editing it never touches the
            template - or any other show.
          </p>
        </div>

        {templates.length === 0 ? (
          <p className="rounded-brand border border-dashed border-line px-4 py-10 text-center text-sm text-faint">
            No venues drawn yet.{" "}
            <Link
              href={partnerPortalPath(partner.slug, "/studio/venues/new")}
              className="text-accent underline"
            >
              Draw one first
            </Link>
            .
          </p>
        ) : (
          <form action={attachPartnerVenue} className="card max-w-lg space-y-4 p-6">
            <input type="hidden" name="scope" value={partner.slug} />
            <input type="hidden" name="eventId" value={event.id} />

            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-faint">
                Venue
              </label>
              <select
                name="templateId"
                className="w-full rounded-brand border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <p className="text-xs text-faint">
              Remember to set this show&apos;s seating mode on its{" "}
              <Link href={`${base}/${event.id}/edit`} className="text-accent underline">
                edit page
              </Link>
              , or the map is drawn and nobody is ever offered a seat off it.
            </p>

            <button type="submit" className="btn btn-accent">
              Use this venue
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 border-b border-line pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
          Line-up
        </p>
        <h1 className="display mt-3 text-5xl">{event.title}</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          This show&apos;s own copy of &ldquo;{map.name}&rdquo;. Assign each section to a
          tier - a section with no tier sells nothing.
        </p>
      </div>

      {event.seatMode === "NONE" ? (
        <p className="mb-4 rounded-brand border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-xs text-amber-200">
          <span className="font-semibold">Seating is switched off for this show.</span> You
          can draw the room, but nobody will be offered a seat until you set the seating
          mode to <strong>Section</strong> or <strong>Seat</strong> on the{" "}
          <Link href={`${base}/${event.id}/edit`} className="underline">
            edit page
          </Link>
          .
        </p>
      ) : null}

      <VenueDesigner
        initial={map.layout}
        tiers={event.tiers}
        action={savePartnerVenue}
        mapId={map.id}
        scope={partner.slug}
        mapName={map.name}
        error={searchParams.error}
        strandedKeys={searchParams.keys?.split(",").filter(Boolean)}
        eventCapacity={event.capacity}
      />
    </div>
  );
}
