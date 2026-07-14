import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminHeader } from "@/components/admin-ui";
import { VenueDesigner } from "@/components/venue/venue-designer";
import { requireCompanyUser } from "@/lib/company";
import { saveCompanyVenue } from "@/app/actions/venue";
import { venueMapFor } from "@/lib/venue/form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Draw venue" };

export default async function EditCompanyVenuePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string; keys?: string };
}) {
  await requireCompanyUser();

  // Scoped to RNL's own (partnerId: null). A partner's venue matches nothing here and 404s,
  // which is the right answer - it is managed from their portal, by their crew.
  const map = await venueMapFor(params.id, null);
  if (!map) notFound();

  return (
    <div>
      <AdminHeader
        title={map.name}
        subtitle="Draw the room. A template has no tiers - you'll assign those on each event's own copy."
      />

      <VenueDesigner
        initial={map.layout}
        tiers={[]}
        action={saveCompanyVenue}
        mapId={map.id}
        scope=""
        mapName={map.name}
        error={searchParams.error}
        strandedKeys={searchParams.keys?.split(",").filter(Boolean)}
      />
    </div>
  );
}
