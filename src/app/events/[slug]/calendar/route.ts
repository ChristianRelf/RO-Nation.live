import { NextRequest, NextResponse } from "next/server";
import { getEventBySlug } from "@/lib/queries";
import { eventCalendarBody } from "@/lib/tickets/ics";
import { ticketBrand } from "@/lib/tickets/brand";
import { requestOrigin } from "@/lib/origin";
import { slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

// The .ics for one of RNL's OWN shows. Scoped to `null`, exactly like the event page beside it,
// so a partner's slug pulled through this RNL route resolves to nothing rather than leaking.
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const event = await getEventBySlug(null, params.slug);
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
