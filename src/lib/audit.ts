import "server-only";
import {
  AuditAction,
  AuditActorKind,
  AuditTarget,
  type Prisma,
} from "@prisma/client";
import { prisma } from "./db";
import { notify } from "./notify";
import { SHASHA_SCOPE } from "./shasha";

// The universal audit trail's write and read layer.
//
// One line per act, appended by the action that performed it, scoped exactly the
// way the portal is scoped - so the hub can ask "what has happened across every
// area this person holds" with one query and no special cases. See the AuditLog
// model in prisma/schema.prisma for why it exists and why RosterAudit is still
// written alongside it.
//
// ---- Two rules for anybody adding a call site -----------------------------
//
// SCOPE FOLLOWS THE DATA, NOT THE DOOR. A ticket checked in at /company/door and
// one checked in at /shasha/door are the same act on the same row, and both log
// scopeFromPartnerId(event.partnerId). If the scope depended on which URL somebody
// happened to use, the same action would land in two different feeds and the
// history of a show would be split across them for no reason a reader could see.
//
// LOG THE WRITE THAT HAPPENED, NOT THE ONE THAT WAS ASKED FOR. Every scoped write
// in this codebase is an updateMany/deleteMany matched on { id, partnerId }, which
// affects zero rows when the id belongs to somebody else. Call recordAudit AFTER
// that write, gated on count > 0. A row claiming somebody revoked a key they never
// touched is worse than no row at all - it is a false accusation with a timestamp.

/**
 * RNL's org-wide scope, for rows that have no `partnerId` column to live under -
 * a survey, an enquiry, a team member, a guide.
 *
 * NOT the same thing as `scopeFromPartnerId(null)`. An RNL *event* is scoped to
 * SHASHA, because on the portal RNL's own things sit with RNL's own roster; this
 * is for the things that belong to the company rather than to a line-up.
 */
export const COMPANY_SCOPE = "company";

/**
 * A `partnerId` column value → the audit scope it belongs to.
 *
 * NULL means RNL's own (see Event.partnerId), and on the portal RNL's own is
 * SHASHA - so an RNL show's history sits beside RNL's roster history rather than
 * in a third place nobody thinks to look. Anything with no partnerId column at all
 * uses COMPANY_SCOPE above.
 */
export const scopeFromPartnerId = (partnerId: string | null | undefined) =>
  partnerId ?? SHASHA_SCOPE;

export type AuditActor = {
  /** Roblox user id, or the ApiKey id when actorKind is API. */
  id: string;
  name: string;
  kind?: AuditActorKind;
};

export type AuditInput = {
  scope: string;
  action: AuditAction;
  target: AuditTarget;
  targetId?: string | null;
  targetName: string;
  actor: AuditActor;
  /** One human sentence. It has to stand alone - the feed renders only this. */
  summary: string;
  meta?: Prisma.InputJsonValue;
  /**
   * Also post a Discord notice, through the existing per-partner webhook routing.
   *
   * Opt-in per call site, and deliberately not the default: this is for the writes
   * with real blast radius - a member granted or removed, a key minted or revoked.
   * Every roster edit and every door scan pinging a channel is how a channel gets
   * muted, and a muted channel is worse than no channel, because everybody believes
   * they are still being told.
   */
  announce?: boolean;
};

/**
 * Append one line to the trail.
 *
 * AWAITED but never throws. The two halves of that both matter:
 *
 *   never throws  - an audit insert failing must not turn a saved roster entry or
 *                   a checked-in ticket into an error page. Same rule as notify(),
 *                   and for the same reason: the act already happened, and the
 *                   person in front of you cannot do anything about our database.
 *                   Failures are logged, and nothing authorises off this table, so
 *                   a missing line is a gap in history rather than a hole in a
 *                   guard.
 *
 *   awaited       - unlike notify(), which is fire-and-forget. Actions here end in
 *                   redirect(), and redirect() throws to unwind the request: an
 *                   un-awaited insert would be racing a teardown it cannot win.
 *                   The cost is one indexed insert.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        scope: input.scope,
        action: input.action,
        target: input.target,
        targetId: input.targetId ?? null,
        // Bounded here rather than trusted from the call site: these are built
        // from user-supplied names (a key's name, an event title) and a runaway
        // one should be a long line, not a failed write.
        targetName: input.targetName.slice(0, 200),
        actorId: input.actor.id,
        actorName: input.actor.name,
        actorKind: input.actor.kind ?? AuditActorKind.PORTAL,
        summary: input.summary.slice(0, 2000),
        meta: input.meta,
      },
    });
  } catch (err) {
    console.error("[audit] failed to record:", input.scope, input.action, err);
  }

  if (input.announce) {
    // Fire-and-forget, exactly as every other notify() call site does - the
    // Discord post is a courtesy and must not be in the path of the redirect.
    void notify({
      // COMPANY and SHASHA are both RNL, and RNL's channel is the null one.
      partnerId:
        input.scope === SHASHA_SCOPE || input.scope === COMPANY_SCOPE
          ? null
          : input.scope,
      title: input.summary,
      fields: [{ name: "By", value: input.actor.name, inline: true }],
    });
  }
}

export type AuditEntry = Awaited<ReturnType<typeof findAudit>>[number];

/**
 * Read the trail for one or more scopes.
 *
 * `scopes` is a REQUIRED first argument with no default, exactly as every function
 * in lib/queries.ts takes its scope - because the version of this with a default is
 * the version that one day returns every org's history to whoever forgot to pass
 * one. An empty array is a legitimate input (a person holding no doors) and returns
 * nothing, which is the correct answer rather than an error.
 *
 * Rides @@index([scope, createdAt]). The `in` list is short - a person holds a
 * handful of areas - so Postgres bitmap-ors a few index scans. If this table ever
 * grows enough for that to hurt, the honest fix is a per-scope take merged in JS,
 * not a wider index.
 */
export function findAudit(
  scopes: string[],
  opts: {
    take: number;
    skip?: number;
    /** Narrow to one kind of thing, or exclude one - see the /audit pages. */
    target?: AuditTarget | { not: AuditTarget };
    /** "what has this API key done" - rides @@index([actorId, createdAt]). */
    actorId?: string;
  },
) {
  return prisma.auditLog.findMany({
    where: {
      scope: { in: scopes },
      ...(opts.target ? { target: opts.target } : {}),
      ...(opts.actorId ? { actorId: opts.actorId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: opts.take,
    skip: opts.skip,
  });
}

// Re-exported so a call site imports the enums from the module it is already
// importing recordAudit from, rather than reaching into @prisma/client for them.
export { AuditAction, AuditActorKind, AuditTarget };
