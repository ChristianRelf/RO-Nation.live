"use client";

import { useEffect, useState } from "react";
import { dateParts, formatInstant, type TimeMode } from "@/lib/format";

// Shows an instant in the VIEWER's timezone, so a London and a Paris reader each see
// their own local time - the thing a plain server render can never do, because the
// server has one clock and everyone shares it. See lib/format for the two families.
//
// ---- How it avoids a hydration mismatch -----------------------------------
//
// A server render (and the pre-JS / no-JS render) can't know the viewer's zone, so it
// shows the instant in a FIXED zone - UTC, labelled - and the client's FIRST render
// uses exactly the same fixed value, so React hydrates against matching text and never
// complains. Only in an effect, AFTER mount, does it swap to the browser's own zone.
// That "first render matches the server, then update" shape is the one safe way to
// render per-viewer time in a server-rendered app; suppressHydrationWarning is belt to
// that braces.
//
// The fixed fallback is UTC rather than the server's own zone on purpose: UTC is the
// one zone the client can reproduce without being told what the server's TZ is, so the
// two renders are guaranteed to agree.

const toIso = (v: Date | string) =>
  typeof v === "string" ? v : v.toISOString();

export function LocalTime({
  value,
  mode = "datetime",
  withZone,
  className,
}: {
  value: Date | string;
  mode?: TimeMode;
  /** Append the zone name. Defaults on for a clock (time/datetime), off for a date. */
  withZone?: boolean;
  className?: string;
}) {
  const at = toIso(value);
  const zoned = withZone ?? mode !== "date";

  const fixed = formatInstant(at, mode, "UTC", zoned);
  const [local, setLocal] = useState<string | null>(null);
  useEffect(() => {
    setLocal(formatInstant(at, mode, undefined, zoned));
  }, [at, mode, zoned]);

  return (
    <time dateTime={at} className={className} suppressHydrationWarning>
      {local ?? fixed}
    </time>
  );
}

// The day-of-month and short-month of a date block (event cards, ticket stubs),
// localised the same way. Two single-value components rather than one render-prop,
// because a server component cannot hand a function child across to a client one - so
// each renders just its own text, and the caller keeps its own markup around them.

export function LocalDay({ value }: { value: Date | string }) {
  const at = toIso(value);
  const [day, setDay] = useState<string | null>(null);
  useEffect(() => setDay(dateParts(at).day), [at]);
  return <span suppressHydrationWarning>{day ?? dateParts(at, "UTC").day}</span>;
}

export function LocalMonth({ value }: { value: Date | string }) {
  const at = toIso(value);
  const [month, setMonth] = useState<string | null>(null);
  useEffect(() => setMonth(dateParts(at).month), [at]);
  return (
    <span suppressHydrationWarning>{month ?? dateParts(at, "UTC").month}</span>
  );
}
