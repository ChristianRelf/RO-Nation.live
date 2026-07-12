"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  EventStatus,
  JobStatus,
  ApplicationStatus,
  TicketStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import {
  isAdmin,
  setAdminSession,
  clearAdminSession,
} from "@/lib/session";
import { slugify } from "@/lib/utils";

// ---- helpers -----------------------------------------------------
async function assertAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}

function s(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

function parseDate(v: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function uniqueSlug(
  base: string,
  model: "event" | "career",
  ignoreId?: string,
) {
  const root = slugify(base) || model;
  let slug = root;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const found =
      model === "event"
        ? await prisma.event.findUnique({ where: { slug } })
        : await prisma.career.findUnique({ where: { slug } });
    if (!found || found.id === ignoreId) return slug;
    slug = `${root}-${++n}`;
  }
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
function readEvent(form: FormData) {
  const startsAt = parseDate(s(form, "startsAt"));
  return {
    title: s(form, "title"),
    tagline: s(form, "tagline") || null,
    category: s(form, "category") || "Live Show",
    venue: s(form, "venue") || null,
    placeUrl: s(form, "placeUrl") || null,
    thumbnailUrl: s(form, "thumbnailUrl") || null,
    description: s(form, "description"),
    startsAt,
    doorsAt: parseDate(s(form, "doorsAt")),
    endsAt: parseDate(s(form, "endsAt")),
    capacity: Math.max(0, parseInt(s(form, "capacity") || "0", 10) || 0),
    status: (s(form, "status") as EventStatus) || EventStatus.DRAFT,
    featured: form.get("featured") === "on",
  };
}

export async function createEvent(formData: FormData) {
  await assertAdmin();
  const data = readEvent(formData);
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
  const data = readEvent(formData);
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
