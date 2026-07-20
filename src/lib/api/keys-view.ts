import "server-only";
import type { ApiKeyScope } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { rosterScope } from "@/lib/portal-scope";
import { ALL_SCOPES, DANGEROUS_SCOPES } from "@/lib/apikey";
import type { KeyHealth, KeyRow } from "@/components/portal/api-keys";

// Load an org's keys for the portal.
//
// Shared by /shasha/keys and /<slug>/keys, which are the same page pointed at a
// different org - exactly as the roster pages already are.
//
// It selects the fields the panel renders and, pointedly, NOT `hash`. There is
// nothing to be learned from a SHA-256 of a key and no reason for one to travel to
// a browser, and the surest way for a field never to leak is for it never to be
// read.

export async function loadApiKeys(scopeId: string): Promise<KeyRow[]> {
  // "shasha" → NULL, a partner slug → itself. Resolved through the scope rather
  // than re-derived here: this file used to spell that mapping out for itself,
  // and so did actions/api-keys.ts. See RosterScope.eventScope.
  const scope = rosterScope(scopeId);

  // An id naming no portal has no keys. Emphatically NOT a fall-through to
  // `partnerId: undefined`, which Prisma reads as "no filter at all" - that is
  // every org's keys, on a page whose entire job is to show one org's.
  if (!scope) return [];

  const keys = await prisma.apiKey.findMany({
    where: { partnerId: scope.eventScope },
    orderBy: [{ revokedAt: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      keyId: true,
      scopes: true,
      createdByName: true,
      createdAt: true,
      lastUsedAt: true,
      revokedAt: true,
      revokedByName: true,
    },
  });

  // Dates are formatted HERE, on the server, and cross the boundary as strings.
  // A Date sent to a client component is re-formatted in the visitor's own locale
  // and timezone, so two people looking at the same key would read two different
  // "last used" times - and the one who is wrong has no way to know it.
  //
  // Health is computed here for exactly the same reason: it is a judgement about
  // dates, and a judgement made in the browser is made in the browser's clock.
  return keys.map((k) => ({
    ...k,
    health: keyHealth(k),
    createdAt: formatDateTime(k.createdAt),
    lastUsedAt: k.lastUsedAt ? formatDateTime(k.lastUsedAt) : null,
    revokedAt: k.revokedAt ? formatDateTime(k.revokedAt) : null,
  }));
}

const DAY = 24 * 60 * 60 * 1000;
/** Long enough to be deployed. See the grace note below. */
const GRACE_DAYS = 7;
const QUIET_DAYS = 30;

/**
 * What is worth saying about a key that already exists.
 *
 * Not a warning at mint time - the form already explains every scope, and somebody
 * ticking one has decided. This is for the other moment: a list of keys minted
 * months ago by people who have since left, where the question is "which of these
 * should not still be alive".
 *
 * Every signal comes from columns we already store. Nothing new is tracked, and in
 * particular there is no per-call counter: touch() in lib/apikey.ts is throttled to
 * once a minute and deliberately not awaited because it sits on the hot path of
 * every door scan, and a counter cannot be throttled without being a lie. Once the
 * /api/v1 write routes record audit rows with actorKind API, "1,204 writes in 30
 * days" falls out of @@index([actorId, createdAt]) for nothing.
 */
export function keyHealth(key: {
  scopes: ApiKeyScope[];
  lastUsedAt: Date | null;
  createdAt: Date;
  revokedAt: Date | null;
}): KeyHealth[] {
  // A revoked key is history. It cannot be used, so nothing about it is a finding,
  // and flagging it would just add noise to the part of the list nobody can act on.
  if (key.revokedAt) return [];

  const out: KeyHealth[] = [];
  const age = Date.now() - key.createdAt.getTime();

  if (!key.lastUsedAt) {
    // The grace matters. A key minted an hour ago and not yet pasted into a game
    // server is not a finding - it is Tuesday. A health surface that cries wolf on
    // day one is one nobody reads by day three, which costs more than it saves.
    if (age > GRACE_DAYS * DAY) {
      out.push({ tone: "warn", label: "Never used" });
    }
  } else if (Date.now() - key.lastUsedAt.getTime() > QUIET_DAYS * DAY) {
    out.push({ tone: "warn", label: "Not used in a month" });
  }

  if (key.scopes.length === ALL_SCOPES.length) {
    // The exact thing the mint form argues against, found after the fact.
    out.push({ tone: "danger", label: "Holds every scope" });
  } else {
    if (key.scopes.includes("TICKETS_PURCHASE")) {
      out.push({ tone: "danger", label: "Can assert a payment" });
    }
    if (key.scopes.includes("TICKETS_VOID")) {
      out.push({ tone: "warn", label: "Can void and revoke" });
    }
  }

  return out;
}

/** One line for the whole list, so the state is legible before you scan it. */
export function keysSummary(keys: KeyRow[]) {
  const live = keys.filter((k) => !k.revokedAt);
  const parts = [`${live.length} live key${live.length === 1 ? "" : "s"}`];

  const unused = live.filter((k) =>
    k.health.some((h) => h.label === "Never used"),
  ).length;
  if (unused) parts.push(`${unused} never used`);

  const risky = live.filter((k) =>
    k.scopes.some((s) => (DANGEROUS_SCOPES as readonly string[]).includes(s)),
  ).length;
  if (risky) parts.push(`${risky} can sell or void`);

  return parts.join(" · ");
}
