import { AdminHeader } from "@/components/admin-ui";
import { EventForm } from "@/components/event-form";
import { createEvent } from "@/app/actions/admin";

export const dynamic = "force-dynamic";

export default function NewEventPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <div>
      <AdminHeader
        title="New event"
        subtitle="Fill in the details, then publish when you're ready to sell tickets."
      />
      <EventForm action={createEvent} error={searchParams.error} />
    </div>
  );
}
