"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, RosterAction, RosterKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getPortalUser, type PortalUser } from "@/lib/shasha";
import {
  resolveRobloxUser,
  searchRobloxUsers,
  type RobloxProfile,
} from "@/lib/roblox-users";

// ---- helpers -----------------------------------------------------
function s(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

/** Anyone signed in to the portal (staff or manager). */
async function assertPortal(): Promise<PortalUser> {
  const user = await getPortalUser();
  if (!user) redirect("/shasha/login");
  return user;
}

/** Managers only — the write tier. */
async function assertManager(): Promise<PortalUser> {
  const user = await assertPortal();
  if (!user.canWrite) redirect("/shasha?error=readonly");
  return user;
}

const listPath = (kind: RosterKind) =>
  kind === "VIP" ? "/shasha/vip" : "/shasha/blacklist";

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

function refresh(kind: RosterKind) {
  revalidatePath(listPath(kind));
  revalidatePath("/shasha");
  revalidatePath("/shasha/audit");
}

async function audit(
  actor: PortalUser,
  action: RosterAction,
  entry: { kind: RosterKind; robloxId: string; robloxUsername: string },
  summary: string,
) {
  await prisma.rosterAudit.create({
    data: {
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
/** Typeahead used by the add form. Portal-gated so it isn't an open proxy. */
export async function searchRoblox(query: string): Promise<RobloxProfile[]> {
  await assertPortal();
  return searchRobloxUsers(query);
}

// ---- create ------------------------------------------------------
export async function addRosterEntry(formData: FormData) {
  const actor = await assertManager();

  const kind = parseKind(s(formData, "kind"));
  if (!kind) redirect("/shasha");

  const target = s(formData, "robloxId") || s(formData, "username");
  const reason = s(formData, "reason").slice(0, 2000);
  const tags = parseTags(s(formData, "tags"));

  if (!target) redirect(`${listPath(kind)}?error=nouser`);
  if (!reason) redirect(`${listPath(kind)}?error=noreason`);

  // Never trust the client's idea of who this is: re-resolve against Roblox so
  // the entry is pinned to a real, canonical user id.
  const profile = await resolveRobloxUser(target);
  if (!profile) redirect(`${listPath(kind)}?error=nouser`);

  try {
    await prisma.rosterEntry.create({
      data: {
        kind,
        robloxId: profile.robloxId,
        robloxUsername: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        tags,
        reason,
        addedById: actor.robloxId,
        addedByName: actor.displayName,
      },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      redirect(`${listPath(kind)}?error=exists&q=${profile.username}`);
    }
    throw err;
  }

  await audit(
    actor,
    RosterAction.ADDED,
    { kind, robloxId: profile.robloxId, robloxUsername: profile.username },
    tags.length ? `${reason} · roles: ${tags.join(", ")}` : reason,
  );

  refresh(kind);
  redirect(`${listPath(kind)}?ok=added&q=${profile.username}`);
}

// ---- update ------------------------------------------------------
export async function updateRosterEntry(formData: FormData) {
  const actor = await assertManager();

  const id = s(formData, "id");
  const reason = s(formData, "reason").slice(0, 2000);
  const tags = parseTags(s(formData, "tags"));

  const existing = await prisma.rosterEntry.findUnique({ where: { id } });
  if (!existing) redirect("/shasha");
  if (!reason) redirect(`${listPath(existing.kind)}?error=noreason`);

  await prisma.rosterEntry.update({
    where: { id },
    data: {
      reason,
      tags,
      updatedById: actor.robloxId,
      updatedByName: actor.displayName,
    },
  });

  await audit(
    actor,
    RosterAction.UPDATED,
    existing,
    tags.length ? `${reason} · roles: ${tags.join(", ")}` : reason,
  );

  refresh(existing.kind);
  redirect(`${listPath(existing.kind)}?ok=updated&q=${existing.robloxUsername}`);
}

// ---- delete ------------------------------------------------------
export async function removeRosterEntry(formData: FormData) {
  const actor = await assertManager();

  const id = s(formData, "id");
  const existing = await prisma.rosterEntry.findUnique({ where: { id } });
  if (!existing) redirect("/shasha");

  await prisma.rosterEntry.delete({ where: { id } });

  await audit(
    actor,
    RosterAction.REMOVED,
    existing,
    `Removed from ${existing.kind === "VIP" ? "the VIP list" : "the blacklist"}. Was: ${existing.reason}`,
  );

  refresh(existing.kind);
  redirect(`${listPath(existing.kind)}?ok=removed`);
}
