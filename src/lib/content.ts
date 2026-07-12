import "server-only";
import { EventStatus, PostStatus } from "@prisma/client";
import { prisma } from "./db";
import { slugify } from "./utils";

// Form parsing shared by the admin dashboard and the Studio, so the two can't
// drift apart on what a valid event or post looks like.

export function s(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

export function parseDate(v: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** A slug that doesn't collide with an existing row (ignoring `ignoreId`). */
export async function uniqueSlug(
  base: string,
  model: "event" | "career" | "post",
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
        : model === "career"
          ? await prisma.career.findUnique({ where: { slug } })
          : await prisma.post.findUnique({ where: { slug } });
    if (!found || found.id === ignoreId) return slug;
    slug = `${root}-${++n}`;
  }
}

export function readEventForm(form: FormData) {
  return {
    title: s(form, "title"),
    tagline: s(form, "tagline") || null,
    category: s(form, "category") || "Live Show",
    venue: s(form, "venue") || null,
    placeUrl: s(form, "placeUrl") || null,
    thumbnailUrl: s(form, "thumbnailUrl") || null,
    description: s(form, "description"),
    startsAt: parseDate(s(form, "startsAt")),
    doorsAt: parseDate(s(form, "doorsAt")),
    endsAt: parseDate(s(form, "endsAt")),
    capacity: Math.max(0, parseInt(s(form, "capacity") || "0", 10) || 0),
    status: (s(form, "status") as EventStatus) || EventStatus.DRAFT,
    featured: form.get("featured") === "on",
  };
}

export function readPostForm(form: FormData) {
  return {
    title: s(form, "title"),
    excerpt: s(form, "excerpt") || null,
    coverUrl: s(form, "coverUrl") || null,
    body: s(form, "body"),
    status: (s(form, "status") as PostStatus) || PostStatus.DRAFT,
  };
}

/**
 * `publishedAt` is stamped the first time a post goes live and then left alone,
 * so re-editing a published post doesn't shuffle it back to the top of the blog.
 */
export function resolvePublishedAt(
  status: PostStatus,
  existing?: Date | null,
): Date | null {
  if (status !== PostStatus.PUBLISHED) return existing ?? null;
  return existing ?? new Date();
}
