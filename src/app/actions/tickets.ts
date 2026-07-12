"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/session";
import { generateTicketCode } from "@/lib/utils";
import { isPast } from "@/lib/format";

export async function reserveTicket(formData: FormData) {
  const eventId = String(formData.get("eventId") || "");
  const slug = String(formData.get("slug") || "");
  const acceptedTerms = formData.get("terms") === "on";

  const session = await getUserSession();
  if (!session) {
    redirect(`/account?returnTo=${encodeURIComponent(`/events/${slug}/reserve`)}`);
  }

  // The "purchase" gate: you must accept the ticket terms & conditions.
  if (!acceptedTerms) {
    redirect(`/events/${slug}/reserve?error=terms`);
  }

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || event.status !== "PUBLISHED") {
    redirect(`/events/${slug}?error=unavailable`);
  }
  if (isPast(event.startsAt)) {
    redirect(`/events/${slug}?error=past`);
  }

  // Already holding an active ticket?
  const existing = await prisma.ticket.findUnique({
    where: { eventId_userId: { eventId, userId: session.uid } },
  });
  if (existing && existing.status !== "CANCELLED") {
    redirect(`/tickets?new=${existing.code}`);
  }

  // Capacity check (0 = unlimited).
  if (event.capacity > 0) {
    const taken = await prisma.ticket.count({
      where: { eventId, status: { not: "CANCELLED" } },
    });
    if (taken >= event.capacity) {
      redirect(`/events/${slug}?error=soldout`);
    }
  }

  // Re-activate a previously cancelled ticket, or create a fresh one.
  let code = existing?.code ?? "";
  if (existing) {
    await prisma.ticket.update({
      where: { id: existing.id },
      data: { status: "RESERVED", termsAcceptedAt: new Date() },
    });
  } else {
    for (let attempt = 0; attempt < 5; attempt++) {
      code = generateTicketCode();
      try {
        await prisma.ticket.create({
          data: {
            eventId,
            userId: session.uid,
            code,
            status: "RESERVED",
            termsAcceptedAt: new Date(),
          },
        });
        break;
      } catch (err: any) {
        // Unique collision on code -> retry; on (eventId,userId) -> already have one.
        if (err?.code === "P2002" && err?.meta?.target?.includes?.("code")) {
          continue;
        }
        redirect(`/tickets`);
      }
    }
  }

  revalidatePath(`/events/${slug}`);
  revalidatePath("/tickets");
  redirect(`/tickets?new=${code}`);
}

export async function cancelTicket(formData: FormData) {
  const ticketId = String(formData.get("ticketId") || "");
  const session = await getUserSession();
  if (!session) redirect("/account");

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (ticket && ticket.userId === session.uid) {
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: "CANCELLED" },
    });
  }
  revalidatePath("/tickets");
  redirect("/tickets");
}

// Flip a reserved ticket to "activated" — this reveals the decorative QR on the
// ticket detail page and drives the confetti moment on the client.
export async function activateTicket(formData: FormData) {
  const ticketId = String(formData.get("ticketId") || "");
  const session = await getUserSession();
  if (!session) redirect("/account?returnTo=/tickets");

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { event: true },
  });
  if (!ticket || ticket.userId !== session.uid) redirect("/tickets");
  if (ticket.status === "CANCELLED") redirect(`/tickets/${ticket.code}`);

  if (!ticket.activatedAt) {
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { activatedAt: new Date() },
    });
  }

  revalidatePath(`/tickets/${ticket.code}`);
  redirect(`/tickets/${ticket.code}?activated=1`);
}
