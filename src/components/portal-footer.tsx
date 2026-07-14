import Link from "next/link";
import { site } from "@/lib/site";

// Slim footer for the SHASHA portal. The full marketing footer would be noise in
// a staff tool, but the OAuth policy links belong somewhere visible - Discord and
// Roblox both expect them to be reachable from the app they gate.
const links = [
  { label: "Discord policy", href: "/legal/discord/privacy" },
  { label: "Roblox policy", href: "/legal/roblox/privacy" },
  { label: "Terms", href: "/legal/discord/terms" },
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
