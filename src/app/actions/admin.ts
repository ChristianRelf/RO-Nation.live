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
  if (!data.title || !data.startsAt || !data.description) {
    redirect("/admin/events/new?error=required");
  }
  const slug = await uniqueSlug(data.title, "event");
  await prisma.event.create({
    data: { ...data, startsAt: data.startsAt!, slug },
  });
  revalidatePath("/admin/events");
  revalidatePath("/events");
  revalidatePath("/");
  redirect("/admin/events");
}

export async function updateEvent(formData: FormData) {
  await assertAdmin();
  const id = s(formData, "id");
  const data = readEventForm(formData);
  if (!id || !data.title || !data.startsAt || !data.description) {
    redirect(`/admin/events/${id}/edit?error=required`);
  }
  await prisma.event.update({
    where: { id },
    data: { ...data, startsAt: data.startsAt! },
  });
  revalidatePath("/admin/events");
  revalidatePath("/events");
  revalidatePath("/");
  redirect("/admin/events");
}

export async function deleteEvent(formData: FormData) {
  await assertAdmin();
  const id = s(formData, "id");
  if (id) await prisma.event.delete({ where: { id } });
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
