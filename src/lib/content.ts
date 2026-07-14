import "server-only";
import { EventStatus, GuideStatus, PostStatus } from "@prisma/client";
import { prisma } from "./db";
import { slugify } from "./utils";

// Form parsing shared by /company and every partner's studio, so they can't
// drift apart on what a valid event or post looks like.

export function s(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

/**
 * The most a post body may be, in characters.
 *
 * There was no cap at all: `body` is `@db.Text`, and the action checked only that
 * it was non-empty, so a single request could put an arbitrary number of megabytes
 * into a row that is then read on every render of the page. Generous enough that no
 * real post will ever meet it - this is about eight times the longest thing anybody
 * has written here - and finite, which is the point.
 *
 * The editor shows a counter and sets `maxLength` on the textarea, but that is
 * courtesy: it stops a person, not a forged POST. The truncation below is the wall.
 */
export const BODY_MAX = 80_000;

export function parseDate(v: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * A slug that doesn't collide with an existing row in the SAME scope.
 *
 * Scope matters here, and getting it wrong is quiet rather than loud. Posts and
 * careers are unique per `[partnerId, slug]`, so RNL and a partner may both have
 * a "the-first-rite" - but if this checked globally, the partner's would silently
 * come out as "the-first-rite-2" on their own site, for no reason a reader could
 * see. Events are the exception: their slug is still globally unique, because a
 * ticket code and the /events/<slug> route are shared across every org.
 *
 * `scope` is a partner slug, or null for RNL's own. Events, guides and merch ignore
 * it: all three are globally unique - an event because a ticket code and the
 * /events/<slug> route are shared across every org, a guide because there is only
 * one library, and a merch product because a product belongs to a collection but its
 * slug is unique across the whole shop (moving a shirt between shelves must not
 * change its URL).
 */
export async function uniqueSlug(
  base: string,
  model: "event" | "career" | "post" | "guide" | "merch",
  scope: string | null = null,
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
        : model === "guide"
          ? await prisma.guide.findUnique({ where: { slug } })
          : model === "merch"
            ? await prisma.merchProduct.findUnique({ where: { slug } })
            : model === "career"
              ? await prisma.career.findFirst({
                  where: { slug, partnerId: scope },
                })
              : await prisma.post.findFirst({
                  where: { slug, partnerId: scope },
                });
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
    // Truncated, not rejected. A body at the cap is somebody pasting a novel or
    // forging a request, and neither is worth an error page for the other's sake -
    // but an unbounded string reaching @db.Text and then being parsed as Markdown
    // on every render of the page is worth stopping.
    body: s(form, "body").slice(0, BODY_MAX),
    status: (s(form, "status") as PostStatus) || PostStatus.DRAFT,
  };
}

export function readGuideForm(form: FormData) {
  return {
    title: s(form, "title"),
    excerpt: s(form, "excerpt") || null,
    section: s(form, "section") || "General",
    // Truncated, not rejected - same wall, same reasoning as a post body above.
    body: s(form, "body").slice(0, BODY_MAX),
    order: parseInt(s(form, "order") || "0", 10) || 0,
    status: (s(form, "status") as GuideStatus) || GuideStatus.DRAFT,
  };
}

/**
 * `publishedAt` is stamped the first time something goes live and then left
 * alone, so re-editing a published post doesn't shuffle it back to the top of the
 * blog.
 *
 * Takes either status enum: they are distinct Prisma types but the same three
 * strings, and the rule is the same for both.
 */
export function resolvePublishedAt(
  status: PostStatus | GuideStatus,
  existing?: Date | null,
): Date | null {
  if (status !== "PUBLISHED") return existing ?? null;
  return existing ?? new Date();
}
