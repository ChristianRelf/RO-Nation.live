// Date/time formatting, en-GB style throughout.
//
// TWO families live here, and the difference is WHOSE clock:
//
//   formatDate / formatTime / formatDateTime / dateBlock
//       Format in the RUNTIME's timezone - the SERVER's clock for anything
//       server-rendered, which is one time for everyone. Kept for the places that must
//       be one canonical string: text frozen into a stored notification, a reminder or
//       an audit line (which cannot be re-localised per reader after the fact), and
//       machine/SEO strings. The clock variants (formatTime, formatDateTime) NAME the
//       zone - "16:30 GMT", never a bare "16:30" - so a frozen server-zone time cannot
//       be mistaken for a contradiction of a live page showing the reader's own zone.
//       The two are the same instant; the labels are what say so.
//
//   formatInstant / zoneLabel / dateParts  (below)
//       Format in a GIVEN timezone, defaulting to the runtime's. Passed `undefined` on
//       the client, that is the viewer's own browser zone - which is the whole point:
//       a London and a Paris reader each see their local time. These are the engine
//       behind <LocalTime> (components/local-time.tsx); a server render cannot know the
//       viewer's zone, so the component calls these on the client, after mount.
//
// Both stay en-GB so the format (weekday names, 24h clock, day/month order) is stable
// and identical between a server render and a client one - only the zone moves.

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

const monthDayFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
});

export function formatDate(d: Date | string) {
  return dateFmt.format(new Date(d));
}

/**
 * A file size a person can read. Deliberately not locale-formatted: the same
 * string has to come out of a server render and a client one, and a thousands
 * separator is exactly the sort of thing that differs between the two.
 */
/**
 * A Date, formatted for an `<input type="datetime-local">`.
 *
 * Lifted out of event-form.tsx, where it was a private helper, the moment a SECOND form
 * needed it (the survey builder's closing date). One function, so the two cannot disagree
 * about what a datetime-local value looks like - and the alternative was a copy that
 * would have.
 *
 * TIMEZONE: this is the SERVER's local time, and so is the parse on the way back in
 * (parseDate in lib/content.ts). datetime-local carries no zone, so the string a person
 * types is read in whatever TZ the container is set to - which is exactly how Event.startsAt
 * has always behaved, and is documented in the README. Consistent, and consistently the
 * server's clock.
 */
export function toDateTimeInput(d?: Date | null) {
  if (!d) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours(),
  )}:${p(d.getMinutes())}`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function formatTime(d: Date | string) {
  // Zone-labelled, in the runtime's timezone. See the header: a bare "16:30" frozen
  // into a reminder reads as a contradiction of a live page in another zone; "16:30 GMT"
  // does not.
  return formatInstant(d, "time", undefined, true);
}

export function formatDateTime(d: Date | string) {
  return formatInstant(d, "datetime", undefined, true);
}

/** { day: "12", month: "AUG" } for ticket-stub style date blocks. */
export function dateBlock(d: Date | string) {
  const date = new Date(d);
  const [day, month] = monthDayFmt.format(date).split(" ");
  return { day, month: month.toUpperCase() };
}

// ---- Viewer-local formatting -----------------------------------------------
//
// The engine behind <LocalTime>. Everything here takes an explicit `timeZone`;
// `undefined` means "the runtime's zone", which on the client is the browser's own -
// so the same call that shows a London reader 19:30 shows a Paris reader 20:30.

export type TimeMode = "date" | "time" | "datetime";

const DATE_OPTS: Intl.DateTimeFormatOptions = {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
};

const TIME_OPTS: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

/** The short zone name for an instant: "BST", "CEST", "GMT+2". Empty if unavailable. */
export function zoneLabel(d: Date | string, timeZone?: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).formatToParts(new Date(d));
  return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
}

/**
 * Format an instant in a timezone (default: the runtime's). `withZone` appends the
 * short zone name so a clock reading is never an unlabelled, ambiguous number -
 * "19:30 BST", not a bare "19:30" that could mean any of two dozen places.
 */
export function formatInstant(
  d: Date | string,
  mode: TimeMode,
  timeZone?: string,
  withZone = false,
) {
  const date = new Date(d);
  const datePart = new Intl.DateTimeFormat("en-GB", {
    ...DATE_OPTS,
    timeZone,
  }).format(date);
  const timePart = new Intl.DateTimeFormat("en-GB", {
    ...TIME_OPTS,
    timeZone,
  }).format(date);
  const zone = withZone ? ` ${zoneLabel(date, timeZone)}` : "";

  if (mode === "date") return datePart;
  if (mode === "time") return `${timePart}${zone}`;
  return `${datePart} · ${timePart}${zone}`;
}

/**
 * { day: "12", month: "AUG" } for a date block, in a given zone. The zone matters even
 * for a date with no clock: a show at 23:30 on the 12th in UTC is already the 13th in
 * Paris, so the block a Paris reader should see is a different day.
 */
export function dateParts(d: Date | string, timeZone?: string) {
  const [day, month] = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone,
  })
    .format(new Date(d))
    .split(" ");
  return { day, month: month.toUpperCase() };
}

export function isPast(d: Date | string) {
  return new Date(d).getTime() < Date.now();
}

/** "in 3 days", "today", "2 weeks ago" */
export function relativeDays(d: Date | string) {
  const diff = new Date(d).getTime() - Date.now();
  const days = Math.round(diff / (24 * 60 * 60 * 1000));
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 0 && days < 14) return `In ${days} days`;
  if (days < 0 && days > -14) return `${Math.abs(days)} days ago`;
  const weeks = Math.round(days / 7);
  if (weeks > 0) return `In ${weeks} weeks`;
  return `${Math.abs(weeks)} weeks ago`;
}
