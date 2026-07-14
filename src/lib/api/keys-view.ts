import "server-only";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { SHASHA_SCOPE } from "@/lib/portal-scope";
import type { KeyRow } from "@/components/portal/api-keys";

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
  const partnerId = scopeId === SHASHA_SCOPE ? null : scopeId;

  const keys = await prisma.apiKey.findMany({
    where: { partnerId },
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
  return keys.map((k) => ({
    ...k,
    createdAt: formatDateTime(k.createdAt),
    lastUsedAt: k.lastUsedAt ? formatDateTime(k.lastUsedAt) : null,
    revokedAt: k.revokedAt ? formatDateTime(k.revokedAt) : null,
  }));
}
