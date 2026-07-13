import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import {
  assertPartnerFeature,
  requirePartnerUser,
} from "@/lib/partners/guard";
import { DoorCheck } from "@/components/ticket/door-check";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Door" };

// A partner's door. Every member of their crew can work it — including read-only
// STAFF, deliberately: working the door IS that role's job, and admitting somebody
// is not editing the line-up. See the note in app/actions/door.ts.

export default async function PartnerDoorPage({
  params,
}: {
  params: { slug: string };
}) {
  const { partner } = await requirePartnerUser(params.slug);
  assertPartnerFeature(partner, "events");

  // Theirs only. The action re-scopes from the guard, so this list is a
  // convenience, not the boundary.
  const events = await prisma.event.findMany({
    where: {
      partnerId: partner.slug,
      status: "PUBLISHED",
      startsAt: { gt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { startsAt: "asc" },
    select: { id: true, title: true },
    take: 20,
  });

  return (
    <div>
      <div className="mb-8 border-b border-line pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
          Front of house
        </p>
        <h1 className="display mt-3 text-5xl">Door</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Check a ticket and check somebody in. Scan the barcode or the QR with a
          USB scanner, or type the code — it&apos;s the same check the game makes
          at the door.
        </p>
      </div>

      <DoorCheck scope={partner.slug} events={events} />
    </div>
  );
}
