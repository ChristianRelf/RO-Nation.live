// Locale-stable date/time formatting. We force en-GB + UTC-agnostic display so
// server and client renders match (avoids hydration mismatches).

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
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
export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function formatTime(d: Date | string) {
  return timeFmt.format(new Date(d));
}

export function formatDateTime(d: Date | string) {
  return `${dateFmt.format(new Date(d))} · ${timeFmt.format(new Date(d))}`;
}

/** { day: "12", month: "AUG" } for ticket-stub style date blocks. */
export function dateBlock(d: Date | string) {
  const date = new Date(d);
  const [day, month] = monthDayFmt.format(date).split(" ");
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
