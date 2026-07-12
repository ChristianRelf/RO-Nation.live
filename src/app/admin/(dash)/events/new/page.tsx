import { AdminHeader } from "@/components/admin-ui";
import { EventForm } from "@/components/event-form";
import { createEvent } from "@/app/actions/admin";
import { requireAdmin } from "@/lib/session";
import { env } from "@/lib/env";
import { robuxSalesAllowed } from "@/lib/tickets/pricing";

export const dynamic = "force-dynamic";

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  await requireAdmin();
  return (
    <div>
      <AdminHeader
        title="New event"
        subtitle="Fill in the details, then publish when you're ready to sell tickets."
      />
      <EventForm
        action={createEvent}
        error={searchParams.error}
        robuxEnabled={robuxSalesAllowed(null, env.robuxTickets)}
      />
    </div>
  );
}
