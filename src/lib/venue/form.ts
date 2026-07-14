import "server-only";
import { prisma } from "@/lib/db";
import {
  emptyLayout,
  parseLayout,
  venueLayoutSchema,
  type VenueLayout,
} from "./schema";
import { sectionSeats } from "./seats";

// Reading the venue designer's payload back, and persisting it.
//
// The designer posts ONE json field - the same shape as the tier editor and the survey
// builder, and for the same reason (see the header of components/tier-editor.tsx: indexed
// `shape[0][x]` names have to be re-assembled by hand, and a gap in the indices is exactly
// what re-assembly gets subtly wrong).
//
// Everything in that field is attacker-controlled. It goes through zod on the way in and
// is never used as given.

/**
 * Parse the designer's field.
 *
 * NULL means "I could not read this". It is NOT an empty venue, and the difference is the
 * whole safety property of this function.
 *
 * saveVenueLayout REPLACES the layout wholesale. So a parse failure collapsing into
 * `emptyLayout()` - which is the obvious, tidy-looking default - would take a sold-out
 * seated show and quietly delete every section in it. The map would render empty, the
 * allocator would see an unmapped tier and start selling the room a SECOND time, over the
 * top of four hundred people who already hold a seat, and the first anybody would know is
 * at the door.
 *
 * Exactly the lesson readTiersForm() has written on it, at higher stakes. The callers
 * refuse rather than default.
 */
export function readVenueForm(form: FormData): VenueLayout | null {
  const raw = form.get("layout");
  if (raw === null) return null;

  try {
    const parsed = venueLayoutSchema.safeParse(JSON.parse(String(raw)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// ---- The guard ------------------------------------------------------------

export type SaveVenueResult =
  | { ok: true }
  | { ok: false; reason: "not_found" }
  /**
   * The edit would delete a chair somebody is sitting in.
   *
   * The keys come back so the editor can NAME them - "you have removed A1-K12, and
   * somebody is holding a ticket for it" is a fixable problem; "cannot save" is a
   * mystery. A promoter who genuinely means it must move or refund those holders first,
   * which is a decision only they can make.
   */
  | { ok: false; reason: "sold_seats"; keys: string[] };

/**
 * Which live tickets would this layout strand?
 *
 * A ticket holds a seat by its KEY. Redraw the map so that key no longer exists - delete
 * the section, rename it, shrink the block from 12 rows to 10 - and the holder is left
 * with a ticket for a chair that is not in the building. The door would find no seat, the
 * stub would name a section nobody can point at, and the allocator would never sell that
 * key again because a live ticket still holds it.
 *
 * So the save is REFUSED, and the promoter is told exactly which seats they just deleted.
 *
 * `seatKey IS NOT NULL` is the whole test - a cancelled ticket has already had its seat
 * nulled (see the note on Ticket.seatKey) and is therefore, correctly, not stranded by
 * anything.
 */
async function strandedSeats(
  eventId: string,
  next: VenueLayout,
): Promise<string[]> {
  const live = await prisma.ticket.findMany({
    where: {
      eventId,
      OR: [{ seatKey: { not: null } }, { sectionKey: { not: null } }],
    },
    select: { seatKey: true, sectionKey: true },
  });
  if (live.length === 0) return [];

  const seats = new Set<string>();
  const sections = new Set<string>();

  for (const shape of next.shapes) {
    if (shape.kind === "SEATED_SECTION") {
      sections.add(shape.key);
      for (const s of sectionSeats(shape)) seats.add(s.key);
    } else if (shape.kind === "STANDING_AREA") {
      sections.add(shape.key);
    }
  }

  const stranded = new Set<string>();
  for (const t of live) {
    if (t.seatKey) {
      if (!seats.has(t.seatKey)) stranded.add(t.seatKey);
    } else if (t.sectionKey && !sections.has(t.sectionKey)) {
      stranded.add(t.sectionKey);
    }
  }

  return [...stranded].sort();
}

// ---- Writing --------------------------------------------------------------

/**
 * Save a map.
 *
 * Scoped, always. `partnerId` is matched as well as the id, so a map belonging to another
 * org matches zero rows and is not quietly overwritten - the same rule every other write
 * in this codebase follows, and the reason lib/queries.ts takes scope as a required
 * argument.
 *
 * The sold-seat guard runs against every event using this map, not just one: an EVENT map
 * has exactly one event, but a TEMPLATE may be attached to several, and editing a template
 * that a live show is (unusually) still pointing at must not strand that show either.
 */
export async function saveVenueLayout(input: {
  id: string;
  scope: string | null;
  layout: VenueLayout;
  actorName: string;
}): Promise<SaveVenueResult> {
  const map = await prisma.venueMap.findFirst({
    where: { id: input.id, partnerId: input.scope },
    select: { id: true, events: { select: { id: true } } },
  });
  if (!map) return { ok: false, reason: "not_found" };

  const stranded = new Set<string>();
  for (const event of map.events) {
    for (const key of await strandedSeats(event.id, input.layout)) {
      stranded.add(key);
    }
  }
  if (stranded.size > 0) {
    return { ok: false, reason: "sold_seats", keys: [...stranded].sort() };
  }

  await prisma.venueMap.update({
    where: { id: map.id },
    data: { layout: input.layout as any, updatedByName: input.actorName },
  });

  return { ok: true };
}

export async function createVenueMap(input: {
  scope: string | null;
  name: string;
  layout?: VenueLayout;
  actorId: string;
  actorName: string;
}) {
  return prisma.venueMap.create({
    data: {
      partnerId: input.scope,
      name: input.name,
      kind: "TEMPLATE",
      layout: (input.layout ?? emptyLayout()) as any,
      createdById: input.actorId,
      createdByName: input.actorName,
    },
    select: { id: true },
  });
}

/**
 * Give an event its own copy of a template.
 *
 * A CLONE, and that is the whole design - see the note on Event.venueMapId. A template is
 * a library item drawn once and reused; an event's map is a snapshot of one. Pointing two
 * live shows at the same row would mean tidying up a template on a Tuesday silently
 * re-seats a show that has already sold four hundred tickets.
 *
 * `tierId` on every section is deliberately CLEARED. A template belongs to no event, so
 * whatever tier ids it happens to be carrying are another show's - and leaving them in
 * would map this event's sections onto tiers that do not exist here, which reads as "no
 * section for this tier" and quietly sells the whole show as unseated general admission.
 * The promoter assigns tiers on the copy, which is the one place the question makes sense.
 */
export async function cloneTemplateOnto(input: {
  eventId: string;
  templateId: string;
  scope: string | null;
  actorId: string;
  actorName: string;
}): Promise<{ ok: boolean }> {
  const template = await prisma.venueMap.findFirst({
    where: { id: input.templateId, partnerId: input.scope },
  });
  if (!template) return { ok: false };

  const layout = parseLayout(template.layout);
  if (!layout) return { ok: false };

  const cleared: VenueLayout = {
    ...layout,
    shapes: layout.shapes.map((s) =>
      s.kind === "SEATED_SECTION" || s.kind === "STANDING_AREA"
        ? { ...s, tierId: null }
        : s,
    ),
  };

  const copy = await prisma.venueMap.create({
    data: {
      partnerId: input.scope,
      name: template.name,
      kind: "EVENT",
      templateId: template.id,
      layout: cleared as any,
      createdById: input.actorId,
      createdByName: input.actorName,
    },
    select: { id: true },
  });

  // Scoped on partnerId as well as the id: an event belonging to another org matches zero
  // rows rather than being handed a map it did not ask for.
  const { count } = await prisma.event.updateMany({
    where: { id: input.eventId, partnerId: input.scope },
    data: { venueMapId: copy.id },
  });

  if (count === 0) {
    // The event was not ours. Do not leave the orphan copy lying around in the library.
    await prisma.venueMap.delete({ where: { id: copy.id } });
    return { ok: false };
  }

  return { ok: true };
}

/** The library, for a picker. Scoped, like everything else. */
export async function venueTemplates(scope: string | null) {
  return prisma.venueMap.findMany({
    where: { partnerId: scope, kind: "TEMPLATE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, updatedAt: true },
  });
}

/** One map, for the designer. Returns the parsed layout, or null if it is unreadable. */
export async function venueMapFor(id: string, scope: string | null) {
  const map = await prisma.venueMap.findFirst({
    where: { id, partnerId: scope },
  });
  if (!map) return null;

  return {
    id: map.id,
    name: map.name,
    kind: map.kind,
    // Null on an unreadable layout, and the designer must SAY so rather than opening an
    // empty canvas over the top of it - see readVenueForm(). Opening empty and letting
    // them hit Save is how a corrupted map becomes a deleted one.
    layout: parseLayout(map.layout),
  };
}
