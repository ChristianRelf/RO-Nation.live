import "server-only";
import {
  EventStatus,
  GuideKind,
  GuideStatus,
  PostStatus,
  SeatMode,
} from "@prisma/client";
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

/**
 * The seating mode, or NONE.
 *
 * Checked against the enum rather than cast to it. Both writers spread this straight into
 * Prisma, so a value that is not a member reaches the database as a bad enum and throws -
 * and the request that arrives with `seatMode=SEATT` is a forged one, which is not worth a
 * 500 for the sake of. NONE is the safe end of the range: a show that falls back to general
 * admission sells tickets, a show that throws sells none.
 */
function readSeatMode(form: FormData): SeatMode {
  const raw = s(form, "seatMode");
  return raw in SeatMode ? (raw as SeatMode) : SeatMode.NONE;
}

export function readEventForm(form: FormData) {
  return {
    title: s(form, "title"),
    tagline: s(form, "tagline") || null,
    category: s(form, "category") || "Live Show",
    venue: s(form, "venue") || null,
    placeUrl: s(form, "placeUrl") || null,
    // Digits or nothing. This is the id a deep link is BUILT from, and it is a separate
    // column from placeUrl on purpose - see the note on Event.placeId. A pasted URL is
    // therefore NOT quietly scraped for an id: an id we made up out of a tracking query
    // string builds a link that goes silently nowhere, which is worse than an empty field
    // the promoter can see is empty.
    placeId: /^\d+$/.test(s(form, "placeId")) ? s(form, "placeId") : null,
    thumbnailUrl: s(form, "thumbnailUrl") || null,
    description: s(form, "description"),
    startsAt: parseDate(s(form, "startsAt")),
    doorsAt: parseDate(s(form, "doorsAt")),
    endsAt: parseDate(s(form, "endsAt")),
    capacity: Math.max(0, parseInt(s(form, "capacity") || "0", 10) || 0),
    status: (s(form, "status") as EventStatus) || EventStatus.DRAFT,
    // Drawing a map does not put seats on sale. THIS does. See SeatMode in the schema.
    seatMode: readSeatMode(form),
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
    // Which docs area it files under. Validated against the enum rather than cast
    // blindly, so a hand-posted junk value lands as an ordinary GUIDE.
    kind: readGuideKind(s(form, "kind")),
    order: parseInt(s(form, "order") || "0", 10) || 0,
    status: (s(form, "status") as GuideStatus) || GuideStatus.DRAFT,
  };
}

function readGuideKind(value: string): GuideKind {
  return (Object.values(GuideKind) as string[]).includes(value)
    ? (value as GuideKind)
    : GuideKind.GUIDE;
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
