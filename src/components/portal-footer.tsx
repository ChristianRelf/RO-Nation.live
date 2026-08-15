import Link from "next/link";
import { site } from "@/lib/site";

// Slim footer for the SHASHA portal. The full marketing footer would be noise in
// a staff tool, but the OAuth policy links belong somewhere visible - Discord and
// Roblox both expect them to be reachable from the app they gate.
//
// It is also the footer under pay.ronation.live and the partner area, which is why
// Payments is here: that host is entirely about money held and money requested, and the
// policy describing what those words mean was reachable from every page on the site
// EXCEPT the one where somebody is about to press "Request funds". "All policies" is the
// catch-all - /legal renders on every host (see the note on that page), so it resolves
// wherever this footer is standing.
const links = [
  { label: "Payments", href: "/legal/payments" },
  { label: "Discord policy", href: "/legal/discord/privacy" },
  { label: "Roblox policy", href: "/legal/roblox/privacy" },
  { label: "Terms", href: "/legal/discord/terms" },
  { label: "All policies", href: "/legal" },
];

export function PortalFooter() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="shell flex flex-col items-center justify-between gap-4 py-6 text-xs text-faint sm:flex-row">
        <p>
          Powered by{" "}
          <a
            href="https://ronation.live"
            className="font-semibold text-muted transition-colors hover:text-accent"
          >
            {site.name}
          </a>{" "}
          · © {new Date().getFullYear()}
        </p>

        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="transition-colors hover:text-fg"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
