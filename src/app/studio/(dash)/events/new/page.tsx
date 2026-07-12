import type { Metadata } from "next";
import { AdminHeader } from "@/components/admin-ui";
import { EventForm } from "@/components/event-form";
import { createEvent } from "@/app/actions/studio";
import { requireStudioUser } from "@/lib/studio";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New event" };

export default async function StudioNewEventPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  await requireStudioUser();
  return (
    <div>
      <AdminHeader
        title="New event"
        subtitle="Fill in the details, then publish when you're ready to open tickets."
      />
      <EventForm
        action={createEvent}
        error={searchParams.error}
        cancelHref="/studio/events"
      />
    </div>
  );
}
