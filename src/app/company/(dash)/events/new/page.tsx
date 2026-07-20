import type { Metadata } from "next";
import { AdminHeader } from "@/components/admin-ui";
import { EventForm } from "@/components/event-form";
import { createStudioEvent } from "@/app/actions/studio-events";
import { requireCompanyUser } from "@/lib/company";
import { env } from "@/lib/env";
import { robuxSalesAllowed } from "@/lib/tickets/pricing";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New event" };

export default async function CompanyNewEventPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  await requireCompanyUser();
  return (
    <div>
      <AdminHeader
        title="New event"
        subtitle="Fill in the details, then publish when you're ready to open tickets."
      />
      <EventForm
        action={createStudioEvent}
        error={searchParams.error}
        cancelHref="/company/events"
        robuxEnabled={robuxSalesAllowed(null, env.robuxTickets)}
      />
    </div>
  );
}
