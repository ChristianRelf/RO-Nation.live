import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { toLines } from "@/lib/utils";

// Reading the tier editor's payload back, and persisting it.
//
// The editor posts one JSON field. Everything in it is attacker-controlled — an
// id, a price, a capacity — so none of it is used as given: it goes through the
// schema below, and every write is matched on { id, eventId } TOGETHER, so a tier
// id belonging to another event matches zero rows instead of being quietly
// re-parented. Same rule the roster and partner-event actions follow.

const TierInput = z.object({
  // Present on a tier that already exists. Never trusted to be this event's —
  // see the updateMany below.
  id: z.string().optional(),
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(240),
  perks: z.string().max(600),
  priceRobux: z.number().int().min(0).max(1_000_000),
  capacity: z.number().int().min(0).max(1_000_000),
  active: z.boolean(),
});

const TiersInput = z.array(TierInput).max(8);

export type TierWrite = z.infer<typeof TierInput>;

/**
 * Parse the editor's field.
 *
 * `[]` is a legitimate answer — it means "no tiers", i.e. the implicit free
 * admission. NULL is a validation failure: missing field, bad JSON, or a row
 * that doesn't fit the schema.
 *
 * Those two must never be confused, and that is the whole reason this returns
 * null rather than falling back to []. syncEventTiers DELETES anything not in
 * the list it is handed, so "I couldn't read the form" collapsing into "the user
 * wants no tiers" would quietly wipe every tier on the event. The callers refuse
 * instead.
 */
export function readTiersForm(form: FormData): TierWrite[] | null {
  const raw = form.get("tiers");
  if (raw === null) return null;

  try {
    const parsed = TiersInput.safeParse(JSON.parse(String(raw)));
    if (!parsed.success) return null;
    // A row the user added and then left blank is a slip, not a tier.
    return parsed.data.filter((t) => t.name.length > 0);
  } catch {
    return null;
  }
}

/**
 * Make the event's tiers match `tiers`, exactly.
 *
 * A tier that has been removed from the form is DELETED, and that is safe by
 * design: Ticket.tierId is `onDelete: SetNull` and the ticket carries its own
 * frozen `tierName` and `priceRobux`. Somebody holding a VIP ticket to a show
 * that is still happening keeps their ticket, and it still says VIP on it. See
 * the note on Ticket.tierName in schema.prisma.
 */
export async function syncEventTiers(eventId: string, tiers: TierWrite[]) {
  const keep = tiers.map((t) => t.id).filter(Boolean) as string[];

  await prisma.$transaction(async (tx) => {
    await tx.ticketTier.deleteMany({
      where: { eventId, id: { notIn: keep.length ? keep : ["__none__"] } },
    });

    for (const [i, tier] of tiers.entries()) {
      const data = {
        name: tier.name,
        description: tier.description || null,
        perks: toLines(tier.perks),
        priceRobux: tier.priceRobux,
        capacity: tier.capacity,
        active: tier.active,
        sortOrder: i,
      };

      if (tier.id) {
        // Matched on the event too. An id from another event updates nothing.
        const { count } = await tx.ticketTier.updateMany({
          where: { id: tier.id, eventId },
          data,
        });
        if (count > 0) continue;
        // It didn't belong to this event (or no longer exists). Fall through and
        // create it here rather than silently dropping the row the user typed.
      }

      await tx.ticketTier.create({ data: { ...data, eventId } });
    }
  });
}

/** The editor's initial rows for an event that already has tiers. */
export async function tierDraftsFor(eventId: string) {
  const rows = await prisma.ticketTier.findMany({
    where: { eventId },
    orderBy: { sortOrder: "asc" },
  });
  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description ?? "",
    perks: t.perks.join("\n"),
    priceRobux: t.priceRobux,
    capacity: t.capacity,
    active: t.active,
  }));
}
