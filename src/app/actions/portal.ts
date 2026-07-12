"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, RosterAction, RosterKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  requireScopeManager,
  requireScopeUser,
  type RosterScope,
  type ScopedActor,
} from "@/lib/portal-scope";
import {
  resolveRobloxUser,
  searchRobloxUsers,
  type RobloxProfile,
} from "@/lib/roblox-users";

// The roster actions, shared by SHASHA and every partner portal.
//
// SECURITY — the scope arrives on the form body, which is attacker-controlled.
// That is fine, and it is worth being precise about why: nothing is authorized
// FROM the scope. It only selects *which* org's guard to run, and that guard
// re-reads the caller's membership of that org from the database (see
// lib/portal-scope.ts). Posting `scope=sleeptokenro` from a SHASHA session
// grants nothing — it just fails Sleep Token RO's guard instead of SHASHA's.
//
// The scope must ALSO bound every row an action touches. Passing the guard is
// not sufficient on its own: ids are opaque, but they leak, and `update by id`
// alone would let a manager of one partner edit another partner's entry by
// pasting an id. So every read-then-write below matches on { id, partnerId }
// together and treats a miss as "no such entry".

// ---- helpers -----------------------------------------------------
function s(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

const listPath = (scope: RosterScope, kind: RosterKind) =>
  `${scope.basePath}${kind === "VIP" ? "/vip" : "/blacklist"}`;

function parseKind(value: string): RosterKind | null {
  return value === "VIP" || value === "BLACKLIST" ? value : null;
}

/**
 * Free-form tags from a comma-separated field: trimmed, de-duped
 * case-insensitively, and bounded so one entry can't carry unbounded data.
 */
function parseTags(raw: string) {
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const part of raw.split(",")) {
    const tag = part.trim().replace(/\s+/g, " ").slice(0, 24);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length === 8) break;
  }
  return tags;
}

/**
 * Revalidate the INTERNAL route, not the public path — a partner's pages render
 * at /pp/<slug>/…, so revalidatePath("/sleeptokenro/vip") would match no route
 * at all and quietly leave the list stale after a write. See partners/urls.ts.
 */
function refresh(scope: RosterScope, kind: RosterKind) {
  revalidatePath(`${scope.routeBase}${kind === "VIP" ? "/vip" : "/blacklist"}`);
  revalidatePath(scope.routeBase);
  revalidatePath(`${scope.routeBase}/audit`);
}

async function audit(
  { scope, actor }: ScopedActor,
  action: RosterAction,
  entry: { kind: RosterKind; robloxId: string; robloxUsername: string },
  summary: string,
) {
  await prisma.rosterAudit.create({
    data: {
      partnerId: scope.id,
      action,
      kind: entry.kind,
      robloxId: entry.robloxId,
      robloxUsername: entry.robloxUsername,
      actorId: actor.robloxId,
      actorName: actor.displayName,
      summary,
    },
  });
}

// ---- Roblox picker (read) ----------------------------------------
/**
 * Typeahead used by the add form. Gated on membership of the scope it claims,
 * so it isn't an open Roblox proxy for anyone who finds the endpoint.
 */
export async function searchRoblox(
  scopeId: string,
  query: string,
): Promise<RobloxProfile[]> {
  await requireScopeUser(scopeId);
  return searchRobloxUsers(query);
}

// ---- create ------------------------------------------------------
export async function addRosterEntry(formData: FormData) {
  const scoped = await requireScopeManager(s(formData, "scope"));
  const { scope } = scoped;

  const kind = parseKind(s(formData, "kind"));
  if (!kind) redirect(scope.basePath);

  const target = s(formData, "robloxId") || s(formData, "username");
  const reason = s(formData, "reason").slice(0, 2000);
  const tags = parseTags(s(formData, "tags"));

  if (!target) redirect(`${listPath(scope, kind)}?error=nouser`);
  if (!reason) redirect(`${listPath(scope, kind)}?error=noreason`);

  // Never trust the client's idea of who this is: re-resolve against Roblox so
  // the entry is pinned to a real, canonical user id.
  const profile = await resolveRobloxUser(target);
  if (!profile) redirect(`${listPath(scope, kind)}?error=nouser`);

  try {
    await prisma.rosterEntry.create({
      data: {
        partnerId: scope.id,
        kind,
        robloxId: profile.robloxId,
        robloxUsername: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        tags,
        reason,
        addedById: scoped.actor.robloxId,
        addedByName: scoped.actor.displayName,
      },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      // The unique key is (partnerId, kind, robloxId), so this fires only when
      // THIS org already holds them on THIS list. Another partner listing the
      // same player is not a conflict and no longer collides here.
      redirect(`${listPath(scope, kind)}?error=exists&q=${profile.username}`);
    }
    throw err;
  }

  await audit(
    scoped,
    RosterAction.ADDED,
    { kind, robloxId: profile.robloxId, robloxUsername: profile.username },
    tags.length ? `${reason} · roles: ${tags.join(", ")}` : reason,
  );

  refresh(scope, kind);
  redirect(`${listPath(scope, kind)}?ok=added&q=${profile.username}`);
}

// ---- update ------------------------------------------------------
export async function updateRosterEntry(formData: FormData) {
  const scoped = await requireScopeManager(s(formData, "scope"));
  const { scope } = scoped;

  const id = s(formData, "id");
  const reason = s(formData, "reason").slice(0, 2000);
  const tags = parseTags(s(formData, "tags"));

  const existing = await prisma.rosterEntry.findFirst({
    where: { id, partnerId: scope.id },
  });
  if (!existing) redirect(scope.basePath);
  if (!reason) redirect(`${listPath(scope, existing.kind)}?error=noreason`);

  await prisma.rosterEntry.update({
    where: { id: existing.id },
    data: {
      reason,
      tags,
      updatedById: scoped.actor.robloxId,
      updatedByName: scoped.actor.displayName,
    },
  });

  await audit(
    scoped,
    RosterAction.UPDATED,
    existing,
    tags.length ? `${reason} · roles: ${tags.join(", ")}` : reason,
  );

  refresh(scope, existing.kind);
  redirect(
    `${listPath(scope, existing.kind)}?ok=updated&q=${existing.robloxUsername}`,
  );
}

// ---- delete ------------------------------------------------------
export async function removeRosterEntry(formData: FormData) {
  const scoped = await requireScopeManager(s(formData, "scope"));
  const { scope } = scoped;

  const id = s(formData, "id");
  const existing = await prisma.rosterEntry.findFirst({
    where: { id, partnerId: scope.id },
  });
  if (!existing) redirect(scope.basePath);

  await prisma.rosterEntry.delete({ where: { id: existing.id } });

  await audit(
    scoped,
    RosterAction.REMOVED,
    existing,
    `Removed from ${existing.kind === "VIP" ? "the VIP list" : "the blacklist"}. Was: ${existing.reason}`,
  );

  refresh(scope, existing.kind);
  redirect(`${listPath(scope, existing.kind)}?ok=removed`);
}
