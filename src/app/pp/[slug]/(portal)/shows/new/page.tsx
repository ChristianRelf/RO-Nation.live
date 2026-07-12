import type { Metadata } from "next";
import {
  assertPartnerFeature,
  requirePartnerManager,
} from "@/lib/partners/guard";
import { partnerPortalPath } from "@/lib/partners/urls";
import { createPartnerEvent } from "@/app/actions/partner-events";
import { EventForm } from "@/components/event-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New show" };

export default async function NewPartnerShowPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { error?: string };
}) {
  // Managers only. The page guards itself rather than leaning on the layout —
  // see the note on requirePartnerUser() in lib/partners/guard.ts.
  const { partner } = await requirePartnerManager(params.slug);
  assertPartnerFeature(partner, "events");
  const base = partnerPortalPath(partner.slug, "/shows");

  return (
    <div>
      <div className="mb-8 border-b border-line pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
          Line-up
        </p>
        <h1 className="display mt-3 text-5xl">New show</h1>
        <p className="mt-2 text-sm text-muted">
          Save it as a draft while you work on it. Publishing puts it on your
          site and opens tickets.
        </p>
      </div>

      <EventForm
        action={createPartnerEvent}
        error={searchParams.error}
        cancelHref={base}
        scope={partner.slug}
      />
    </div>
  );
}
