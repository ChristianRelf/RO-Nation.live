"use server";

import { revalidatePath } from "next/cache";
import type { ApiKeyScope } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ALL_SCOPES, mintApiKey } from "@/lib/apikey";
import { requireScopeManager, SHASHA_SCOPE } from "@/lib/portal-scope";

// Minting and revoking API keys, from the portal.
//
// Every action re-guards. A server action is a public HTTP endpoint wearing a
// function's clothes: the page that renders the form having checked who you are
// means nothing at all to a POST that never loaded the page. requireScopeManager()
// is what actually stops somebody minting a key for an org they do not run — and
// it is called first, before a single field of the form is read.
//
// The org is a ROUTE parameter, not a form field, and it is checked rather than
// trusted: `requireScopeManager(scopeId)` redirects unless the caller genuinely
// manages that org. Putting it in the body would let anybody who can reach their
// own portal mint a key for anybody else's, which is the whole game.

/**
 * A portal id ("shasha", "sleeptokenro") → the `partnerId` a key is stamped with.
 *
 * SHASHA is RNL, and RNL's own events carry `partnerId: null` — the same NULL that
 * Event.partnerId uses. That mapping is the reason a key's scope can be compared
 * to an event's partner with a single equality and no special cases.
 */
const keyPartnerId = (scopeId: string) =>
  scopeId === SHASHA_SCOPE ? null : scopeId;

export type MintState =
  | { ok: true; token: string; name: string }
  | { ok: false; error: string }
  | null;

/**
 * Mint a key, and hand back the token — ONCE.
 *
 * The token is returned in the action's result and never stored in a readable
 * form, so this is the only moment in its life it can be seen. The UI has to make
 * that unmissable, because "copy it now" is a sentence people skim.
 */
export async function createApiKey(
  scopeId: string,
  _prev: MintState,
  formData: FormData,
): Promise<MintState> {
  const { scope, actor } = await requireScopeManager(scopeId);

  const name = String(formData.get("name") || "").trim();
  if (!name) return { ok: false, error: "Give the key a name you'll recognise." };
  if (name.length > 80) return { ok: false, error: "That name is too long." };

  // Only real scopes, and only ones actually ticked. An invented value in the
  // form body resolves to nothing rather than to a scope nobody meant to grant.
  const requested = formData.getAll("scopes").map(String);
  const scopes = ALL_SCOPES.filter((s) => requested.includes(s)) as ApiKeyScope[];

  if (!scopes.length) {
    return {
      ok: false,
      error: "Tick at least one thing this key may do. A key with no scopes can do nothing.",
    };
  }

  const { token } = await mintApiKey({
    partnerId: keyPartnerId(scope.id),
    name,
    scopes,
    createdById: actor.robloxId,
    createdByName: actor.displayName,
  });

  revalidatePath(`${scope.routeBase}/keys`);
  return { ok: true, token, name };
}

/**
 * Revoke a key. It stops authenticating on the very next request.
 *
 * The row is KEPT, not deleted — a revoked key still has to resolve to a name in
 * an audit trail (TicketPurchase.apiKeyId points at it), and its keyId must stay
 * claimed so it can never be minted again.
 *
 * `id` is re-read and checked against the caller's own org before anything is
 * written: without that, a manager of one partner could revoke another's key by
 * posting its id, and taking down a rival's door is a one-line request.
 */
export async function revokeApiKey(scopeId: string, formData: FormData) {
  const { scope, actor } = await requireScopeManager(scopeId);

  const id = String(formData.get("id") || "");
  if (!id) return;

  const partnerId = keyPartnerId(scope.id);

  await prisma.apiKey.updateMany({
    // The partnerId in the WHERE is the guard, not decoration. An id belonging to
    // another org matches zero rows and writes nothing.
    where: { id, partnerId, revokedAt: null },
    data: { revokedAt: new Date(), revokedByName: actor.displayName },
  });

  revalidatePath(`${scope.routeBase}/keys`);
}
