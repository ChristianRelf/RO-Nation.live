"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * The section strip inside a partner's studio.
 *
 * Every link is built from `basePath` (the PUBLIC path on the portal host —
 * /sleeptokenro/studio, not the internal /pp/... route Next renders), and the
 * sections shown are the ones the registry actually gave this partner. A feature
 * they don't have has no route: the pages 404 rather than hiding a link, so this
 * is presentation that matches the guard rather than standing in for it.
 */
export function StudioNav({
  basePath,
  sections,
}: {
  basePath: string;
  sections: { label: string; href: string }[];
}) {
  const pathname = usePathname();

  return (
    <nav className="mb-8 flex gap-1 overflow-x-auto border-b border-line">
      {sections.map((s) => {
        const href = `${basePath}${s.href}`;
        const active =
          s.href === ""
            ? pathname === basePath
            : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              active
                ? "border-accent text-fg"
                : "border-transparent text-muted hover:text-fg",
            )}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
