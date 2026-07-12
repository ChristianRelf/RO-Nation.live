import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { AdminHeader } from "@/components/admin-ui";
import { EventForm } from "@/components/event-form";
import { updateEvent } from "@/app/actions/admin";

export const dynamic = "force-dynamic";

export default async function EditEventPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) notFound();

  return (
    <div>
      <AdminHeader
        title="Edit event"
        subtitle={event.title}
        action={{ label: "View attendees", href: `/admin/events/${event.id}/attendees` }}
      />
      <EventForm action={updateEvent} event={event} error={searchParams.error} />
    </div>
  );
}
