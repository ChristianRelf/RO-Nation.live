// A calendar file for a ticket, as a data: URI.
//
// No route, no download endpoint: an <a download> pointing at a data: URI is a
// complete implementation of "add to calendar", and one that cannot 404, cannot
// leak a ticket code into a server log, and needs nothing deployed to work.

/** Escape the characters iCalendar gives meaning to. Order matters - backslash first. */
const esc = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");

/** iCalendar's UTC timestamp: 20260812T200000Z. */
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

export function ticketCalendarHref({
  code,
  id,
  title,
  startsAt,
  endsAt,
  doorsAt,
  venue,
  url,
  organiser,
}: {
  /**
   * The ticket code - or NULL while the ticket is still sealed.
   *
   * The .ics is a data: URI, which means it is TEXT SITTING IN THE PAGE'S HTML.
   * Putting the code in it before activation would hand it over to anybody who
   * opened view-source: the ticket would look sealed and not be. So a sealed
   * ticket gets a calendar entry that names the show and nothing else.
   */
  code: string | null;
  /** Stable UID for the calendar entry. Opaque, so it is safe before activation. */
  id: string;
  title: string;
  startsAt: Date;
  endsAt?: Date | null;
  doorsAt?: Date | null;
  venue?: string | null;
  url: string;
  organiser: string;
}) {
  const start = doorsAt ?? startsAt;
  // No end time given? Assume two hours, which is a better guess for a show than
  // an all-day block sprawled across the calendar.
  const end = endsAt ?? new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    `PRODID:-//${esc(organiser)}//Tickets//EN`,
    "BEGIN:VEVENT",
    `UID:${id}@ronation.live`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(title)}`,
    venue ? `LOCATION:${esc(venue)}` : null,
    `DESCRIPTION:${esc(`Ticket ${code} · ${organiser}\n${url}`)}`,
    `URL:${esc(url)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(`${title} - doors soon`)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean) as string[];

  // iCalendar is a CRLF format. Some parsers tolerate bare LF; enough of them
  // don't that it isn't worth finding out which.
  const body = lines.join("\r\n");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(body)}`;
}

// The EVENT calendar - a real file, served by a route handler, for anyone (not just a
// ticket-holder) who wants a show in their calendar. Same primitives as the ticket version
// above, minus the ticket code: there is nothing secret here, so it can be a plain download.
export function eventCalendarBody({
  id,
  title,
  startsAt,
  endsAt,
  doorsAt,
  venue,
  description,
  url,
  organiser,
}: {
  id: string;
  title: string;
  startsAt: Date;
  endsAt?: Date | null;
  doorsAt?: Date | null;
  venue?: string | null;
  description?: string | null;
  url: string;
  organiser: string;
}) {
  const start = doorsAt ?? startsAt;
  const end = endsAt ?? new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    `PRODID:-//${esc(organiser)}//Events//EN`,
    "BEGIN:VEVENT",
    `UID:${id}@ronation.live`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(title)}`,
    venue ? `LOCATION:${esc(venue)}` : null,
    `DESCRIPTION:${esc(`${description ? `${description}\n` : ""}${organiser}\n${url}`)}`,
    `URL:${esc(url)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(`${title} - doors soon`)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean) as string[];

  return lines.join("\r\n");
}
