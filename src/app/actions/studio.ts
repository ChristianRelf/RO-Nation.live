"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStudioUser } from "@/lib/studio";
import {
  readEventForm,
  readPostForm,
  resolvePublishedAt,
  s,
  uniqueSlug,
} from "@/lib/content";

// Event + blog CRUD for Roblox group members ranked 30+. Every action re-checks
// the rank server-side — the UI hiding a button is not a permission.

function refreshEvents() {
  revalidatePath("/studio/events");
  revalidatePath("/admin/events");
  revalidatePath("/events");
  revalidatePath("/");
}

function refreshBlog() {
  revalidatePath("/studio/blog");
  revalidatePath("/blog");
}

// ---- events ------------------------------------------------------
export async function createEvent(formData: FormData) {
  await requireStudioUser();

  const data = readEventForm(formData);
  if (!data.title || !data.startsAt || !data.description) {
    redirect("/studio/events/new?error=required");
  }

  const slug = await uniqueSlug(data.title, "event");
  await prisma.event.create({
    data: { ...data, startsAt: data.startsAt!, slug },
  });

  refreshEvents();
  redirect("/studio/events");
}

export async function updateEvent(formData: FormData) {
  await requireStudioUser();

  const id = s(formData, "id");
  const data = readEventForm(formData);
  if (!id || !data.title || !data.startsAt || !data.description) {
    redirect(`/studio/events/${id}/edit?error=required`);
  }

  await prisma.event.update({
    where: { id },
    data: { ...data, startsAt: data.startsAt! },
  });

  refreshEvents();
  redirect("/studio/events");
}

export async function deleteEvent(formData: FormData) {
  await requireStudioUser();

  const id = s(formData, "id");
  if (id) await prisma.event.delete({ where: { id } });

  refreshEvents();
  redirect("/studio/events");
}

// ---- blog posts --------------------------------------------------
export async function createPost(formData: FormData) {
  const user = await requireStudioUser();

  const data = readPostForm(formData);
  if (!data.title || !data.body) {
    redirect("/studio/blog/new?error=required");
  }

  const slug = await uniqueSlug(data.title, "post");
  await prisma.post.create({
    data: {
      ...data,
      slug,
      publishedAt: resolvePublishedAt(data.status),
      authorRobloxId: user.robloxId,
      authorName: user.displayName,
    },
  });

  refreshBlog();
  redirect("/studio/blog");
}

export async function updatePost(formData: FormData) {
  await requireStudioUser();

  const id = s(formData, "id");
  const data = readPostForm(formData);
  if (!id || !data.title || !data.body) {
    redirect(`/studio/blog/${id}/edit?error=required`);
  }

  const existing = await prisma.post.findUnique({ where: { id } });
  if (!existing) redirect("/studio/blog");

  // Retitling an existing post keeps its slug, so links already shared out in
  // the wild don't rot.
  await prisma.post.update({
    where: { id },
    data: {
      ...data,
      publishedAt: resolvePublishedAt(data.status, existing.publishedAt),
    },
  });

  refreshBlog();
  revalidatePath(`/blog/${existing.slug}`);
  redirect("/studio/blog");
}

export async function deletePost(formData: FormData) {
  await requireStudioUser();

  const id = s(formData, "id");
  if (id) await prisma.post.delete({ where: { id } });

  refreshBlog();
  redirect("/studio/blog");
}
