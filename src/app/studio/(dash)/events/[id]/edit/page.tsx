import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { AdminHeader } from "@/components/admin-ui";
import { EventForm } from "@/components/event-form";
import { updateEvent } from "@/app/actions/studio";
import { requireStudioUser } from "@/lib/studio";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit event" };

export default async function StudioEditEventPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  await requireStudioUser();
  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) notFound();

  return (
    <div>
      <AdminHeader title="Edit event" subtitle={event.title} />
      <EventForm
        action={updateEvent}
        event={event}
        error={searchParams.error}
        cancelHref="/studio/events"
      />
    </div>
  );
}
