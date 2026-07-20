"use client";

import { useEffect } from "react";

/**
 * Move the hub's "last here" marker forward, once, after the page has rendered.
 *
 * A route handler rather than something the page does itself, because Next 14
 * forbids setting a cookie during a Server Component render. Firing it on mount
 * rather than on the server also gets the ordering right: the marker advances
 * after you have actually been shown the page, so a reload does not hide entries
 * you never saw.
 *
 * Renders nothing, and a failed POST is deliberately ignored - the consequence is
 * that a few entries stay marked "new" one visit longer, which is not worth an
 * error message about a cookie.
 */
export function MarkSeen() {
  useEffect(() => {
    // keepalive so navigating away immediately does not cancel it.
    void fetch("/api/portal/seen", { method: "POST", keepalive: true }).catch(
      () => {},
    );
  }, []);

  return null;
}
