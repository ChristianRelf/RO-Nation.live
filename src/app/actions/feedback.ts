"use server";

import { redirect } from "next/navigation";
import { MemberNotificationKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireScopeManager } from "@/lib/portal-scope";
import { recordAudit, AuditAction, AuditTarget } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";

// After a show, ask the people who came how it went.
//
// The invite goes to CHECKED-IN holders only - the ones the door actually admitted,
// not everyone who reserved - because "how was it" only means anything to somebody
// who was there. That is the same checkedInAt signal the loyalty and attendance
// features trust; a reservation is an intention, a check-in is attendance.
//
// It links the two things P1 made partner-scoped: a survey (theirs) and a show
// (theirs). The manager picks one of each; the link is realised at send time as the
// notice's URL, so there is no Event↔Survey column to keep in step. The best answers
// then feed testimonials through the existing promoteSurveyAnswer path.

const INVITE_LIMIT = { limit: 6, windowSeconds: 60 * 60 };

export async function inviteAttendees(formData: FormData) {
  const scopeId = String(formData.get("scope") ?? "").trim();
  const { scope, actor } = await requireScopeManager(scopeId);

  const base = `${scope.basePath}/feedback`;
  const eventId = String(formData.get("eventId") ?? "").trim();
  const surveyId = String(formData.get("surveyId") ?? "").trim();

  if (!eventId || !surveyId) redirect(`${base}?error=required`);

  const rl = await rateLimit(`feedback:${scope.id}`, INVITE_LIMIT);
  if (!rl.ok) redirect(`${base}?error=slowdown`);

  // Both must be this org's. The show by its partnerId, the survey by the same -
  // Survey.partnerId is null for RNL and the slug for a partner, exactly eventScope.
  const [event, survey] = await Promise.all([
    prisma.event.findFirst({
      where: { id: eventId, partnerId: scope.eventScope },
      select: { id: true, title: true },
    }),
    prisma.survey.findFirst({
      where: { id: surveyId, partnerId: scope.eventScope },
      select: { id: true, code: true, status: true, title: true },
    }),
  ]);
  if (!event) redirect(`${base}?error=badshow`);
  // Only an OPEN survey can take answers - inviting people to a closed one is a dead link.
  if (!survey || survey.status !== "OPEN") redirect(`${base}?error=badsurvey`);

  const attendees = await prisma.ticket.findMany({
    where: { eventId: event.id, status: "CHECKED_IN" },
    select: { userId: true },
  });
  const userIds = [...new Set(attendees.map((a) => a.userId))];

  if (userIds.length) {
    await prisma.memberNotification.createMany({
      data: userIds.map((userId) => ({
        userId,
        eventId: event.id,
        kind: MemberNotificationKind.SURVEY_INVITE,
        title: `How was ${event.title}?`,
        body: "You were there - tell us how we did. It only takes a minute.",
        // The public responder, by code. Relative is right: the account hub this lands
        // on is on ronation.live, where /survey/<code> resolves to the responder.
        url: `/survey/${survey.code}`,
      })),
    });
  }

  await recordAudit({
    scope: scope.id,
    action: AuditAction.UPDATED,
    target: AuditTarget.SURVEY,
    targetId: survey.id,
    targetName: survey.title,
    actor: { id: actor.robloxId, name: actor.displayName },
    summary: `Invited ${userIds.length} attendee${userIds.length === 1 ? "" : "s"} of "${event.title}" to the survey "${survey.title}"`,
  });

  redirect(`${base}?ok=1&n=${userIds.length}`);
}
