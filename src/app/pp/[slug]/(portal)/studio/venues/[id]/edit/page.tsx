import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VenueDesigner } from "@/components/venue/venue-designer";
import {
  assertPartnerFeature,
  requirePartnerManager,
} from "@/lib/partners/guard";
import { savePartnerVenue } from "@/app/actions/venue";
import { venueMapFor } from "@/lib/venue/form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Draw venue" };

export default async function EditPartnerVenuePage({
  params,
  searchParams,
}: {
  params: { slug: string; id: string };
  searchParams: { error?: string; keys?: string };
}) {
  const { partner } = await requirePartnerManager(params.slug);
  assertPartnerFeature(partner, "events");

  // Scoped to THIS partner. RNL's own maps, and every other partner's, match nothing here
  // and 404 - which is the right answer, not a hidden Edit button over a form that would
  // have worked.
  const map = await venueMapFor(params.id, partner.slug);
  if (!map) notFound();

  return (
    <div>
      <div className="mb-8 border-b border-line pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
          Line-up
        </p>
        <h1 className="display mt-3 text-5xl">{map.name}</h1>
        <p className="mt-2 text-sm text-muted">
          Draw the room. A template has no tiers - you&apos;ll assign those on each
          event&apos;s own copy.
        </p>
      </div>

      <VenueDesigner
        initial={map.layout}
        tiers={[]}
        action={savePartnerVenue}
        mapId={map.id}
        scope={partner.slug}
        mapName={map.name}
        error={searchParams.error}
        strandedKeys={searchParams.keys?.split(",").filter(Boolean)}
      />
    </div>
  );
}
