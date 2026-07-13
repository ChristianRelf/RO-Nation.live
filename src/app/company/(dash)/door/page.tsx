import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireCompanyUser } from "@/lib/company";
import { DoorCheck } from "@/components/ticket/door-check";
import { AdminHeader } from "@/components/admin-ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Door" };

// The manual door for RNL's own shows.
//
// Guarded here AND in the action, because a page guard does not protect a POST —
// see the note on the page guards in lib/session.ts.

export default async function CompanyDoorPage() {
  await requireCompanyUser();

  // Shows worth having on a door tonight: RNL's own, published, and not long past.
  // Yesterday's is still listed, because a door is often worked the morning after
  // to reconcile who actually came.
  const events = await prisma.event.findMany({
    where: {
      partnerId: null,
      status: "PUBLISHED",
      startsAt: { gt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { startsAt: "asc" },
    select: { id: true, title: true },
    take: 20,
  });

  return (
    <div>
      <AdminHeader
        title="Door"
        subtitle="Check a ticket and check somebody in. Works with a USB barcode scanner."
      />
      <DoorCheck scope="" events={events} />
    </div>
  );
}
