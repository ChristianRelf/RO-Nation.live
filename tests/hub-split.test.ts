import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

// The hub/switcher split, enforced rather than remembered.
//
// getHubData() runs on EVERY portal page - PortalNav renders getPortalSwitcher()
// in both portal layouts, and that calls it. getHubDashboard() is that function
// plus ~8 aggregate queries, and it exists for exactly one page.
//
// Nothing stops somebody importing the richer one somewhere shared, because it
// looks like a strictly better version of the same thing. Nothing would fail if
// they did, either: the page would render correctly and every portal page would
// quietly grow a capacity meter's groupBy in its critical path. A performance
// regression that produces correct output is one nobody finds by using the app,
// so it is asserted here instead.
//
// If this test fails, the fix is almost never to widen the allowlist. It is to
// take the data you need from getHubData(), or to load it in the page that wants
// it. See the note on getPortalSwitcher() in lib/hub.ts.

const SRC = path.resolve(__dirname, "../src");

/** Files allowed to reach for the dashboard AT RUNTIME. */
const ALLOWED = ["src/app/hub/page.tsx"];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

const files = walk(SRC).map((full) => ({
  rel: path.relative(path.resolve(__dirname, ".."), full).replace(/\\/g, "/"),
  body: readFileSync(full, "utf8"),
}));

/**
 * A VALUE import of the module - the kind that survives compilation and drags the
 * query code into the bundle.
 *
 * `import type { … }` is deliberately allowed anywhere: it is erased entirely, so
 * a component typing its own props against HubAreaLive costs nothing at runtime.
 * That is why this matches the statement form rather than the module name.
 */
const VALUE_IMPORT = /import\s+(?!type\s)[^;]*?from\s+["'][^"']*hub-dashboard["']/s;

describe("the hub/switcher split", () => {
  it("keeps getHubDashboard out of everything except the hub page", () => {
    const offenders = files
      .filter((f) => !ALLOWED.includes(f.rel))
      .filter((f) => VALUE_IMPORT.test(f.body))
      .map((f) => f.rel);

    expect(offenders).toEqual([]);
  });

  it("still lets the hub page import it, so the rule above can actually fail", () => {
    // Without this, deleting the import from the hub page would leave the test
    // above passing on an empty set and the invariant meaning nothing.
    const hub = files.find((f) => f.rel === "src/app/hub/page.tsx");
    expect(hub).toBeDefined();
    expect(VALUE_IMPORT.test(hub!.body)).toBe(true);
  });

  it("keeps the portal layouts on the cheap function", () => {
    const layouts = files.filter(
      (f) => /\(portal\)\/layout\.tsx$/.test(f.rel) && f.body.includes("PortalNav"),
    );
    // Both portal layouts, or this test is silently checking nothing.
    expect(layouts.length).toBeGreaterThanOrEqual(2);

    for (const layout of layouts) {
      expect(layout.body).toContain("getPortalSwitcher");
      expect(VALUE_IMPORT.test(layout.body)).toBe(false);
    }
  });
});
