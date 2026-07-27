import "server-only";
import { notify } from "@/lib/notify";
import { partnerOrigin } from "@/lib/partners/urls";

// "A show went live" → Discord.
//
// ---- What counts as posted -------------------------------------------------
//
// The TRANSITION into PUBLISHED, and nothing else. Not a save, not an edit, not
// a re-publish of something that was already published. actions/studio-events.ts
// owns that decision and calls this once, on the edge; this module only knows how
// to phrase it.
//
// The distinction matters because a show is edited a lot - a line-up firming up,
// a door time moving, a typo in the description - and a channel that announces
// every one of those is a channel people mute. The ticket-holders who DO want to
// know about an edit already get one, through notifyEventAudience() in
// member-notify.ts, in the notification bell where it belongs.
//
// ---- It is written for members, not for staff -----------------------------
//
// Which is why it goes to a different webhook than everything else in notify()
// (see the note on env.discordAnnounceWebhookUrl). The embed carries what
// somebody deciding whether to turn up needs - when, where, is it on sale - and
// deliberately nothing an organiser would want: no id, no draft status, no link
// into the studio.
//
// ---- Same three invariants as notify() ------------------------------------
//
// Fire-and-forget, never throws, no-ops without a webhook. Callers `void` it.
// A Discord outage must never turn "your show is live" into an error page for
// the person who just pressed publish - the row is written, the show IS live,
// and the announcement is the least important thing in that transaction.

/** Exactly what an announcement needs off the row. */
export type AnnounceableShow = {
  slug: string;
  title: string;
  tagline: string | null;
  description: string;
  category: string;
  venue: string | null;
  startsAt: Date;
  doorsAt: Date | null;
  capacity: number;
  thumbnailUrl: string | null;
  presale: boolean;
  partnerId: string | null;
};

/**
 * A Discord timestamp: `<t:1753574400:F>` renders as "Sunday, 27 July 2026 19:00"
 * in each READER's own timezone, and `:R` as "in 3 days".
 *
 * Chosen over lib/format.ts's server-zone strings on purpose, and it is the same
 * argument the note at the top of that file makes. A frozen "19:00 GMT" is right
 * for text stored in a row that can never be re-localised afterwards; a Discord
 * embed is not stored by us and Discord WILL re-localise it, so the reader in
 * another country gets their own clock instead of doing the arithmetic.
 */
const stamp = (d: Date, style: "F" | "R" | "t" = "F") =>
  `<t:${Math.floor(d.getTime() / 1000)}:${style}>`;

/** The public URL of the show - on the partner's own host when it is theirs. */
function showUrl(show: AnnounceableShow) {
  return show.partnerId
    ? `${partnerOrigin(show.partnerId)}/events/${show.slug}`
    : `/events/${show.slug}`;
}

/**
 * The blurb under the title. The tagline is what it is for; a description is the
 * fallback, cut at a sentence boundary rather than mid-word so a truncated
 * announcement still reads like a sentence somebody wrote.
 */
function blurb(show: AnnounceableShow) {
  if (show.tagline) return show.tagline;

  const text = show.description.trim();
  if (text.length <= 300) return text;

  const cut = text.slice(0, 300);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("\n"));
  return `${(stop > 140 ? cut.slice(0, stop + 1) : cut).trim()}…`;
}

export async function announceShow(show: AnnounceableShow): Promise<void> {
  const fields = [
    {
      name: "When",
      // Both, because they answer different questions: the absolute date is what
      // goes in a calendar, the relative one is what tells somebody scrolling
      // past whether this is tonight or in five weeks.
      value: `${stamp(show.startsAt)}\n${stamp(show.startsAt, "R")}`,
      inline: true,
    },
    // Only when it is actually earlier than the show. A doorsAt equal to (or,
    // through a mistyped form, after) startsAt tells the reader nothing and
    // invites them to arrive at the wrong time.
    ...(show.doorsAt && show.doorsAt < show.startsAt
      ? [{ name: "Doors", value: stamp(show.doorsAt, "t"), inline: true }]
      : []),
    ...(show.venue ? [{ name: "Where", value: show.venue, inline: true }] : []),
    {
      name: "Tickets",
      // presale is PUBLISHED-but-not-yet-buyable (see Event.presale). Announcing
      // "reserve now" for a show whose buy rails refuse every request is the one
      // way this embed could actively mislead somebody, so it is the first thing
      // checked.
      value: show.presale
        ? "Not on sale yet - watch this channel"
        : show.capacity > 0
          ? `Free · ${show.capacity} places`
          : "Free · no cap",
      inline: true,
    },
  ];

  await notify({
    channel: "announce",
    partnerId: show.partnerId,
    title: show.title,
    description: blurb(show),
    url: showUrl(show),
    image: show.thumbnailUrl ?? undefined,
    fields: [
      { name: "What", value: show.category, inline: true },
      ...fields,
    ],
  });
}
