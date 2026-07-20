"use server";

import { redirect } from "next/navigation";
import { MemberNotificationKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireScopeManager } from "@/lib/portal-scope";
import { notifyEventAudience } from "@/lib/member-notify";
import { recordAudit, AuditAction, AuditTarget } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";

// A partner (or RNL, via SHASHA) pushing a deliberate notice to a show's audience.
//
// The change-notices in member-notify.ts fire automatically off an edit - a
// reschedule, a cancellation. This is the OTHER thing an organiser needs: a chosen
// announcement ("line-up added", "doors info"), sent on purpose. It is a thin,
// guarded wrapper over notifyEventAudience - which already fans out to holders +
// followers and already gets the partner-vs-RNL link right - plus the three things
// a deliberate broadcast needs and an automatic notice does not: a WRITE guard, a
// RATE limit, and an AUDIT line.

/** A ceiling on broadcasts per org - generous for a real organiser, not a firehose. */
const BROADCAST_LIMIT = { limit: 6, windowSeconds: 60 * 60 };

export async function broadcastToShow(formData: FormData) {
  const scopeId = String(formData.get("scope") ?? "").trim();
  // Manager tier: a broadcast reaches every ticket-holder, so it is a write, not a
  // read. requireScopeManager 404s a stranger and bounces read-only staff.
  const { scope, actor } = await requireScopeManager(scopeId);

  const base = `${scope.basePath}/announce`;

  const eventId = String(formData.get("eventId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  const body = String(formData.get("body") ?? "").trim().slice(0, 1000);

  if (!eventId || !title || !body) redirect(`${base}?error=required`);

  const rl = await rateLimit(`broadcast:${scope.id}`, BROADCAST_LIMIT);
  if (!rl.ok) redirect(`${base}?error=slowdown`);

  // Scoped read: the show must be THIS org's. A published one - announcing to a
  // draft nobody can see, or an archived one, is not a thing to do.
  const event = await prisma.event.findFirst({
    where: { id: eventId, partnerId: scope.eventScope, status: "PUBLISHED" },
    select: { id: true, slug: true, partnerId: true, title: true },
  });
  if (!event) redirect(`${base}?error=badshow`);

  // EVENT_UPDATED, the ordinary notice (not the celebratory upgrade dialog). The
  // fan-out builds the link and creates one row per holder-or-follower, and hands
  // back how many it reached.
  const reached = await notifyEventAudience(event, {
    kind: MemberNotificationKind.EVENT_UPDATED,
    title,
    body,
  });

  await recordAudit({
    scope: scope.id,
    action: AuditAction.UPDATED,
    target: AuditTarget.EVENT,
    targetId: event.id,
    targetName: event.title,
    actor: { id: actor.robloxId, name: actor.displayName },
    summary: `Announced to ${reached} ${reached === 1 ? "person" : "people"} for "${event.title}": ${title}`,
  });

  redirect(`${base}?ok=1&n=${reached}`);
}
