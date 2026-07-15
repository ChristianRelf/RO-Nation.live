import { NextRequest, NextResponse } from "next/server";
import { getEventBySlug } from "@/lib/queries";
import { partnerBySlug } from "@/lib/partners/registry";
import { assertPartnerFeature } from "@/lib/partners/guard";
import { eventCalendarBody } from "@/lib/tickets/ics";
import { ticketBrand } from "@/lib/tickets/brand";
import { requestOrigin } from "@/lib/origin";
import { slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

// The .ics for a PARTNER's show. Same builder as RNL's, but scoped to the partner - and gated
// on the partner actually having the events feature, so an RNL slug cannot be pulled through a
// partner host, and a partner without events answers 404 rather than serving an empty file.
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string; event: string } },
) {
  const partner = partnerBySlug(params.slug);
  if (!partner) return new NextResponse("Not found", { status: 404 });
  assertPartnerFeature(partner, "events"); // notFound() if this partner has no events

  const event = await getEventBySlug(partner.slug, params.event);
  if (!event) return new NextResponse("Not found", { status: 404 });

  const origin = requestOrigin(req);
  const body = eventCalendarBody({
    id: event.id,
    title: event.title,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    doorsAt: event.doorsAt,
    venue: event.venue,
    description: event.tagline ?? event.description,
    url: `${origin}/events/${event.slug}`,
    organiser: ticketBrand(event.partnerId).name,
  });

  return new NextResponse(body, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${slugify(event.title) || "event"}.ics"`,
      "cache-control": "no-store",
    },
  });
}
