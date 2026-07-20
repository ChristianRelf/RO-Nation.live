"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireScopeManager } from "@/lib/portal-scope";
import { issueTicket, type IssueReason } from "@/lib/tickets/issue";
import { recordAudit, AuditAction, AuditTarget } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";

// Turn the VIP list into tickets. A partner (or RNL via SHASHA) picks a show and a
// tier, and every VIP-listed player is comped a ticket to it in one click.
//
// It is a thin loop over issueTicket's `gift` mode - the same path a crew member's
// hand-comp takes - so every guard comes for free: a revoked player is refused, a
// blacklisted one never appears (they are a different roster kind), a priced tier
// respects the paid-ticket switch, and a player who already holds a ticket is handed
// the one they hold rather than a second. No money moves - a comp is a gift - and
// each ticket is stamped with who gave it (issuedBy…), so a room full of free VIPs is
// never a mystery in an audit.
//
// The two scopes in play are the trap RosterScope exists to close: the VIP list is
// read by scope.id (the STRING "shasha" or a slug), while the ticket is issued under
// scope.eventScope (NULL for RNL, the slug for a partner). One org, spelled two ways.

/** A ceiling on comp runs - this is a heavyweight action, not something to hammer. */
const COMP_LIMIT = { limit: 6, windowSeconds: 60 * 60 };

/** How many VIPs one run will comp. A guard rail, not a real limit for any org today. */
const COMP_CAP = 500;

export async function compVipsToShow(formData: FormData) {
  const scopeId = String(formData.get("scope") ?? "").trim();
  const { scope, actor } = await requireScopeManager(scopeId);

  const base = `${scope.basePath}/comp`;

  // One select carries both the show and the tier as "eventId::tierId" - a show and
  // its tiers are one choice ("Midnight Frequency · VIP"), and encoding them together
  // keeps the form static (no client filtering of tiers by show).
  const [eventId = "", tierRaw = ""] = String(formData.get("pick") ?? "").split("::");
  const tierId = tierRaw.trim() || null;

  if (!eventId) redirect(`${base}?error=required`);

  const rl = await rateLimit(`comp:${scope.id}`, COMP_LIMIT);
  if (!rl.ok) redirect(`${base}?error=slowdown`);

  // The show must be this org's and published.
  const event = await prisma.event.findFirst({
    where: { id: eventId, partnerId: scope.eventScope, status: "PUBLISHED" },
    select: { id: true, title: true },
  });
  if (!event) redirect(`${base}?error=badshow`);

  // The VIP list, by the ROSTER scope (scope.id), capped.
  const vips = await prisma.rosterEntry.findMany({
    where: { partnerId: scope.id, kind: "VIP" },
    orderBy: { createdAt: "asc" },
    take: COMP_CAP,
    select: { robloxId: true },
  });

  let issued = 0;
  let already = 0;
  const failed: Partial<Record<Exclude<IssueReason, "ok">, number>> = {};

  for (const vip of vips) {
    const outcome = await issueTicket({
      eventId: event.id,
      holder: { robloxId: vip.robloxId },
      tierId,
      // Issue under the EVENT scope (null for RNL, slug for a partner) - NOT scope.id.
      scope: scope.eventScope,
      mode: { kind: "gift", byRobloxId: actor.robloxId, byName: actor.displayName },
    });

    if (outcome.ok) {
      if (outcome.existing) already++;
      else issued++;
    } else {
      failed[outcome.reason] = (failed[outcome.reason] ?? 0) + 1;
    }
  }

  await recordAudit({
    scope: scope.id,
    action: AuditAction.ISSUED,
    target: AuditTarget.EVENT,
    targetId: event.id,
    targetName: event.title,
    actor: { id: actor.robloxId, name: actor.displayName },
    summary: `Comped ${issued} VIP${issued === 1 ? "" : "s"} into "${event.title}"${
      already ? ` (${already} already held one)` : ""
    }`,
    meta: { issued, already, failed },
  });

  const capped = vips.length === COMP_CAP ? "&capped=1" : "";
  redirect(`${base}?ok=1&issued=${issued}&already=${already}${capped}`);
}
