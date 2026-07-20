import "server-only";
import { cookies } from "next/headers";
import { TicketStatus } from "@prisma/client";
import { prisma } from "./db";
import { env } from "./env";
import { formatDateTime, relativeDays } from "./format";
import { getHubData, type HubArea, type HubData } from "./hub";
import { findAudit, COMPANY_SCOPE, type AuditEntry } from "./audit";
import { SHASHA_SCOPE } from "./shasha";
import { partnerBySlug } from "./partners/registry";
import { DANGEROUS_SCOPES } from "./apikey";
import { HUB_SEEN_COOKIE, parseHubSeen } from "./hub-seen";

// The hub's live state: what getHubData() says you can open, plus what is actually
// going on inside each of those areas.
//
// ---- Why this is a separate module from lib/hub.ts -------------------------
//
// getHubData() runs on EVERY portal page, not just this one - PortalNav renders
// getPortalSwitcher() in both portal layouts, and that calls it. So the eight
// aggregate queries below cannot live there: opening a blacklist at a door would
// pay for a capacity meter nobody is looking at.
//
// The split is DATA, never authorization. This module decorates the areas
// getHubData() returned and has no way to add one - there is no guard call in this
// file, and there must never be. If you find yourself wanting to ask "may they see
// X" here, the answer belongs in a guard, and the hub reads guards through
// getHubData() alone.
//
// ---- One query per QUESTION, not one per area ------------------------------
//
// A Promise.all(areas.map(loadOne)) would be areas × 8 queries, and it would look
// fine with the one partner that exists today. Everything below collects the ids
// first and issues one query for the lot, so the count is flat as partners are
// added and only the `in` lists get longer.

export type StatFigure = { label: string; value: number };

export type AttentionItem = {
  label: string;
  href: string;
  external?: boolean;
  /** warn: worth a look. danger: somebody could lose money or control. */
  tone: "warn" | "danger";
};

export type NextShow = {
  title: string;
  href: string;
  external?: boolean;
  when: string;
  relative: string;
  sold: number;
  /** 0 means unlimited - render the count, never a bar. See lib/tickets/crowd.ts. */
  capacity: number;
};

export type FeedEntry = {
  id: string;
  scopeId: string;
  /** "SHASHA", "Sleep Token" - the feed spans areas, so every line needs saying whose. */
  scopeName: string;
  summary: string;
  actorName: string;
  when: string;
  at: Date;
  /** Happened since this browser last opened the hub. See lib/hub-seen.ts. */
  isNew: boolean;
};

export type HubAreaLive = HubArea & {
  /**
   * false when this area has no shows to have - a partner without the events
   * feature. The block is then ABSENT rather than zeroed: statTiles() makes the
   * same call, and for the same reason. "0 tickets sold" on an org that does not
   * sell tickets is not a softer version of the truth, it is a different claim.
   */
  hasShows: boolean;
  /** null when there ARE shows but none upcoming. Distinct from hasShows: false. */
  nextShow: NextShow | null;
  stats: StatFigure[];
  attention: AttentionItem[];
};

export type HubDashboard = Omit<HubData, "areas"> & {
  areas: HubAreaLive[];
  feed: FeedEntry[];
};

type PartnerIdFilter = { partnerId: null } | { partnerId: { in: string[] } };

/**
 * Structurally compatible with Event, Application and ApiKey's WhereInput - all
 * three carry the same nullable `partnerId` column, so one helper serves them
 * without a cast per call site. (A cast would typecheck and then quietly stop
 * meaning anything the day one of those models changes shape.)
 */
type ScopedWhere = { OR: PartnerIdFilter[] };

/**
 * The `where` fragment for a set of areas, over a table with a `partnerId` column.
 *
 * THE trap this whole file is written around: `partnerId: { in: [...] }` does NOT
 * match NULL in Prisma, and RNL's own events, tickets and keys are all NULL. Write
 * the obvious thing and RNL's next show is simply missing from its card, with
 * nothing thrown, nothing logged, and the page looking perfectly healthy.
 *
 * So it is one helper, used by every batched query below, rather than a condition
 * spelled out five times - because it only has to be forgotten once.
 */
function scopedOr(slugs: string[], includeRnl: boolean): ScopedWhere {
  const or: PartnerIdFilter[] = [];
  if (includeRnl) or.push({ partnerId: null });
  if (slugs.length) or.push({ partnerId: { in: slugs } });

  // No areas at all → match nothing. An empty OR array matches EVERYTHING in
  // Prisma, so the empty case has to be spelled out as an impossible condition
  // rather than left to fall through as "no filter".
  return or.length ? { OR: or } : { OR: [{ partnerId: { in: [] } }] };
}

/** Which partnerId a given area reads its events/keys under. */
const eventScopeOf = (area: HubArea): string | null =>
  area.kind === "partner" ? area.id : null;

/** Does this area have shows at all? */
function areaHasShows(area: HubArea): boolean {
  if (area.kind === "partner") {
    return partnerBySlug(area.id)?.features.includes("events") ?? false;
  }
  // RNL always has shows - both the company dashboard and SHASHA look at the
  // same NULL-partnered line-up.
  return true;
}

export async function getHubDashboard(): Promise<HubDashboard> {
  const data = await getHubData();

  if (!data.session || data.areas.length === 0) {
    return { ...data, areas: [], feed: [] };
  }

  // The ids, once. `areas` is already the authorized set - reusing it rather than
  // calling readableScopes() again is what guarantees the feed can never surface a
  // scope the cards did not.
  const areaIds = data.areas.map((a) => a.id);
  const partnerSlugs = data.areas
    .filter((a) => a.kind === "partner")
    .map((a) => a.id);
  // RNL's NULL-partnered rows are readable from either RNL area.
  const includeRnl = data.areas.some((a) => a.kind !== "partner");
  const showScope = scopedOr(partnerSlugs, includeRnl);

  // The feed's scopes, and COMPANY_SCOPE is conditional for a reason.
  //
  // Company-scoped rows are the things with no partnerId column at all - surveys,
  // enquiries, the team page, testimonials. They are RNL's internal business, and
  // adding COMPANY_SCOPE unconditionally would put them in the feed of every
  // partner's crew, who hold an area and therefore reach this function. Holding a
  // door is not the same as holding THAT door, which is the rule the whole portal
  // is built on; the feed does not get to be the exception.
  const feedScopes = data.areas.some((a) => a.kind === "company")
    ? [...areaIds, COMPANY_SCOPE]
    : areaIds;

  const now = new Date();

  const [
    upcoming,
    rosterCounts,
    draftCounts,
    applicationCounts,
    liveKeys,
    newEnquiries,
    feedRows,
  ] = await Promise.all([
    // Enough rows to be sure of finding the first for every area, without
    // fetching a whole line-up to throw most of it away.
    prisma.event.findMany({
      where: { ...showScope, status: "PUBLISHED", startsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      take: (partnerSlugs.length + 1) * 4,
    }),
    prisma.rosterEntry.groupBy({
      by: ["partnerId", "kind"],
      // The roster is the one table where SHASHA really is the STRING - its rows
      // carry partnerId "shasha" by default. No scopedOr() here, deliberately.
      where: { partnerId: { in: areaIds } },
      _count: { _all: true },
    }),
    prisma.event.groupBy({
      by: ["partnerId"],
      where: { ...showScope, status: "DRAFT" },
      _count: { _all: true },
    }),
    prisma.application.groupBy({
      by: ["partnerId"],
      where: { ...showScope, status: "NEW" },
      _count: { _all: true },
    }),
    prisma.apiKey.findMany({
      where: { ...showScope, revokedAt: null },
      select: { partnerId: true, scopes: true, lastUsedAt: true, createdAt: true },
    }),
    // Enquiries have no partnerId column at all - they are the company's, and only
    // a company holder sees the count.
    data.areas.some((a) => a.kind === "company")
      ? prisma.enquiry.count({ where: { status: "NEW" } })
      : Promise.resolve(0),
    findAudit(feedScopes, { take: 24 }),
  ]);

  const soldByEvent = await ticketCounts(upcoming.map((e) => e.id));

  // ---- fold the aggregates back onto the areas ----------------------------
  const firstShowFor = new Map<string | null, (typeof upcoming)[number]>();
  for (const event of upcoming) {
    if (!firstShowFor.has(event.partnerId)) firstShowFor.set(event.partnerId, event);
  }

  const roster = new Map<string, { vip: number; blacklist: number }>();
  for (const row of rosterCounts) {
    const entry = roster.get(row.partnerId) ?? { vip: 0, blacklist: 0 };
    if (row.kind === "VIP") entry.vip = row._count._all;
    else entry.blacklist = row._count._all;
    roster.set(row.partnerId, entry);
  }

  const drafts = countByPartner(draftCounts);
  const applications = countByPartner(applicationCounts);

  const areas: HubAreaLive[] = data.areas.map((area) => {
    const eventScope = eventScopeOf(area);
    const hasShows = areaHasShows(area);
    const event = hasShows ? firstShowFor.get(eventScope) : undefined;
    const isCompany = area.kind === "company";

    // Where this area's line-up lives, taken from the links getHubData() already
    // built rather than assembled here. The three areas spell it three different
    // ways - /company/events, /shasha/shows, /<slug>/studio/events - and a fourth
    // opinion about that in this file is a fourth thing to keep in step.
    const showHref =
      area.links.find((l) => l.label === "Events" || l.label === "Shows")?.href ??
      `${area.home.href}/studio/events`;

    const stats: StatFigure[] = [];
    const counts = roster.get(area.id);
    if (counts) {
      stats.push({ label: "VIP", value: counts.vip });
      stats.push({ label: "Blacklist", value: counts.blacklist });
    }
    if (hasShows) {
      const upcomingHere = upcoming.filter((e) => e.partnerId === eventScope).length;
      stats.push({ label: "Upcoming", value: upcomingHere });
    }

    return {
      ...area,
      hasShows,
      nextShow: event
        ? {
            title: event.title,
            href: showHref ?? area.home.href,
            external: isCompany,
            when: formatDateTime(event.startsAt),
            relative: relativeDays(event.startsAt),
            sold: soldByEvent.get(event.id) ?? 0,
            capacity: event.capacity,
          }
        : null,
      stats,
      attention: attentionFor({
        area,
        eventScope,
        drafts: drafts.get(eventScope) ?? 0,
        applications: applications.get(eventScope) ?? 0,
        enquiries: isCompany ? newEnquiries : 0,
        keys: liveKeys.filter((k) => k.partnerId === eventScope),
        showHref,
      }),
    };
  });

  const nameById = new Map(data.areas.map((a) => [a.id, a.name]));
  // Null on a first visit, which marks nothing rather than everything - a wall of
  // "new" on a page somebody has never seen says nothing at all.
  const lastSeen = parseHubSeen(cookies().get(HUB_SEEN_COOKIE)?.value);

  return {
    ...data,
    areas,
    feed: feedRows.map((row: AuditEntry) => ({
      id: row.id,
      scopeId: row.scope,
      scopeName:
        nameById.get(row.scope) ??
        (row.scope === COMPANY_SCOPE ? "RO. Nation LIVE" : row.scope),
      summary: row.summary,
      actorName: row.actorName,
      when: formatDateTime(row.createdAt),
      at: row.createdAt,
      isNew: lastSeen ? row.createdAt > lastSeen : false,
    })),
  };
}

/** Live (non-cancelled) tickets per event, in one groupBy. */
async function ticketCounts(ids: string[]) {
  if (!ids.length) return new Map<string, number>();
  const grouped = await prisma.ticket.groupBy({
    by: ["eventId"],
    where: { eventId: { in: ids }, status: { not: TicketStatus.CANCELLED } },
    _count: { _all: true },
  });
  return new Map(grouped.map((g) => [g.eventId, g._count._all]));
}

function countByPartner(rows: { partnerId: string | null; _count: { _all: number } }[]) {
  return new Map(rows.map((r) => [r.partnerId, r._count._all]));
}

const DAY = 24 * 60 * 60 * 1000;

function attentionFor(input: {
  area: HubArea;
  eventScope: string | null;
  drafts: number;
  applications: number;
  enquiries: number;
  keys: { scopes: string[]; lastUsedAt: Date | null; createdAt: Date }[];
  showHref?: string;
}): AttentionItem[] {
  const { area, drafts, applications, enquiries, keys } = input;
  const items: AttentionItem[] = [];
  const isCompany = area.kind === "company";
  const link = (label: string) => area.links.find((l) => l.label === label);

  if (drafts > 0 && input.showHref) {
    items.push({
      label: `${drafts} draft show${drafts === 1 ? "" : "s"}`,
      href: input.showHref,
      external: isCompany,
      tone: "warn",
    });
  }

  if (applications > 0) {
    const target = link("Applications") ?? { href: `${area.home.href}/studio/applications` };
    items.push({
      label: `${applications} new application${applications === 1 ? "" : "s"}`,
      href: target.href,
      external: isCompany,
      tone: "warn",
    });
  }

  if (enquiries > 0) {
    const target = link("Enquiries");
    if (target) {
      items.push({
        label: `${enquiries} new enquir${enquiries === 1 ? "y" : "ies"}`,
        href: target.href,
        external: true,
        tone: "warn",
      });
    }
  }

  // Key health, summarised. The detail lives on the keys page; this is the nudge
  // that gets somebody to open it. Only shown to those who can act on it - the
  // keys link is already filtered to managers by getHubData().
  const keysLink = link("API keys");
  if (keysLink) {
    // A key minted an hour ago and not yet deployed is not a finding. Seven days
    // of grace, so a health surface that cries wolf on day one is not ignored by
    // day three.
    const never = keys.filter(
      (k) => !k.lastUsedAt && Date.now() - k.createdAt.getTime() > 7 * DAY,
    ).length;
    if (never > 0) {
      items.push({
        label: `${never} key${never === 1 ? "" : "s"} never used`,
        href: keysLink.href,
        tone: "warn",
      });
    }

    const risky = keys.filter((k) =>
      k.scopes.some((s) => (DANGEROUS_SCOPES as readonly string[]).includes(s)),
    ).length;
    if (risky > 0) {
      items.push({
        label: `${risky} key${risky === 1 ? "" : "s"} can sell or void`,
        href: keysLink.href,
        tone: "danger",
      });
    }
  }

  // The unscoped env-var key. It can reach into EVERY org's shows, which is what
  // no key minted in the portal can do - so it is said where somebody can act on
  // it, not only in a source comment. SHASHA's card, because it is RNL's.
  if (env.gameApiKey && area.id === SHASHA_SCOPE) {
    items.push({
      label: "Root key still live",
      href: "/shasha/keys",
      tone: "danger",
    });
  }

  return items;
}
