"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { JobStatus, ApplicationStatus, TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import {
  isAdmin,
  setAdminSession,
  clearAdminSession,
} from "@/lib/session";
import { readEventForm, s, uniqueSlug } from "@/lib/content";
import { readTiersForm, syncEventTiers } from "@/lib/tickets/tiers-form";

// ---- helpers -----------------------------------------------------
async function assertAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}

// ---- auth --------------------------------------------------------
export async function adminLogin(formData: FormData) {
  const username = s(formData, "username");
  const password = s(formData, "password");

  if (!env.admin.password) redirect("/admin/login?error=notset");
  if (username === env.admin.username && password === env.admin.password) {
    await setAdminSession();
    redirect("/admin");
  }
  redirect("/admin/login?error=invalid");
}

export async function adminLogout() {
  clearAdminSession();
  redirect("/admin/login");
}

// ---- events ------------------------------------------------------
export async function createEvent(formData: FormData) {
  await assertAdmin();
  const data = readEventForm(formData);
  const tiers = readTiersForm(formData);
  if (!data.title || !data.startsAt || !data.description) {
    redirect("/admin/events/new?error=required");
  }
  if (tiers === null) redirect("/admin/events/new?error=tiers");

  const slug = await uniqueSlug(data.title, "event");
  const event = await prisma.event.create({
    data: { ...data, startsAt: data.startsAt!, slug },
  });
  await syncEventTiers(event.id, tiers);

  revalidatePath("/admin/events");
  revalidatePath("/events");
  revalidatePath("/");
  redirect("/admin/events");
}

// Scoped to RNL's own events (partnerId: null), like the Studio's — see the note
// there. The *Many form means an id belonging to a partner matches zero rows
// rather than throwing.
export async function updateEvent(formData: FormData) {
  await assertAdmin();
  const id = s(formData, "id");
  const data = readEventForm(formData);
  const tiers = readTiersForm(formData);
  if (!id || !data.title || !data.startsAt || !data.description) {
    redirect(`/admin/events/${id}/edit?error=required`);
  }
  if (tiers === null) redirect(`/admin/events/${id}/edit?error=tiers`);

  const { count } = await prisma.event.updateMany({
    where: { id, partnerId: null },
    data: { ...data, startsAt: data.startsAt! },
  });
  // Zero rows means the id was not RNL's to edit. The tier sync is NOT scoped by
  // partner on its own — it matches on eventId — so it has to be gated on the
  // same check the event write just made, or a partner's tiers could be rewritten
  // through RNL's form by pasting their event id.
  if (count > 0) await syncEventTiers(id, tiers);

  revalidatePath("/admin/events");
  revalidatePath("/events");
  revalidatePath("/");
  redirect("/admin/events");
}

export async function deleteEvent(formData: FormData) {
  await assertAdmin();
  const id = s(formData, "id");
  if (id) await prisma.event.deleteMany({ where: { id, partnerId: null } });
  revalidatePath("/admin/events");
  revalidatePath("/events");
  redirect("/admin/events");
}

// ---- tickets (attendees) -----------------------------------------
export async function setTicketStatus(formData: FormData) {
  await assertAdmin();
  const id = s(formData, "ticketId");
  const status = s(formData, "status") as TicketStatus;
  const eventId = s(formData, "eventId");
  if (id && ["RESERVED", "CHECKED_IN", "CANCELLED"].includes(status)) {
    await prisma.ticket.update({
      where: { id },
      data: {
        status,
        checkedInAt: status === "CHECKED_IN" ? new Date() : null,
      },
    });
  }
  if (eventId) revalidatePath(`/admin/events/${eventId}/attendees`);
}

// ---- careers -----------------------------------------------------
function readCareer(form: FormData) {
  return {
    title: s(form, "title"),
    department: s(form, "department") || "Events",
    commitment: s(form, "commitment") || "Volunteer",
    location: s(form, "location") || "Remote — Roblox",
    summary: s(form, "summary"),
    description: s(form, "description"),
    requirements: s(form, "requirements"),
    status: (s(form, "status") as JobStatus) || JobStatus.DRAFT,
  };
}

export async function createCareer(formData: FormData) {
  await assertAdmin();
  const data = readCareer(formData);
  if (!data.title || !data.summary || !data.description) {
    redirect("/admin/careers/new?error=required");
  }
  const slug = await uniqueSlug(data.title, "career");
  await prisma.career.create({ data: { ...data, slug } });
  revalidatePath("/admin/careers");
  revalidatePath("/careers");
  redirect("/admin/careers");
}

export async function updateCareer(formData: FormData) {
  await assertAdmin();
  const id = s(formData, "id");
  const data = readCareer(formData);
  if (!id || !data.title || !data.summary || !data.description) {
    redirect(`/admin/careers/${id}/edit?error=required`);
  }
  await prisma.career.update({ where: { id }, data });
  revalidatePath("/admin/careers");
  revalidatePath("/careers");
  redirect("/admin/careers");
}

export async function deleteCareer(formData: FormData) {
  await assertAdmin();
  const id = s(formData, "id");
  if (id) await prisma.career.delete({ where: { id } });
  revalidatePath("/admin/careers");
  revalidatePath("/careers");
  redirect("/admin/careers");
}

// ---- applications ------------------------------------------------
export async function setApplicationStatus(formData: FormData) {
  await assertAdmin();
  const id = s(formData, "id");
  const status = s(formData, "status") as ApplicationStatus;
  if (id && ["NEW", "REVIEWING", "ACCEPTED", "REJECTED"].includes(status)) {
    await prisma.application.update({ where: { id }, data: { status } });
  }
  revalidatePath("/admin/applications");
}
