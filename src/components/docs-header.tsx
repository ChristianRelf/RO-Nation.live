import Link from "next/link";

/**
 * The docs header. A server component — unlike PortalNav it has no active-link
 * state to track, because the nav below it owns that.
 */
export function DocsHeader({
  user,
}: {
  user: { displayName: string; avatarUrl?: string };
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/85 backdrop-blur">
      <div className="shell flex h-16 items-center justify-between gap-6">
        <Link href="/docs" className="flex items-baseline gap-2">
          <span className="display text-2xl tracking-tight">RO. Nation</span>
          <span className="text-[10px] font-bold uppercase tracking-kicker text-accent">
            Docs
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <p className="hidden text-sm font-semibold sm:block">
            {user.displayName}
          </p>
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 rounded-full border border-line"
            />
          ) : (
            <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-xs font-bold text-accent-ink">
              {user.displayName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <a
            href="/api/auth/logout?returnTo=/docs/login"
            className="text-sm text-muted transition-colors hover:text-red-400"
          >
            Sign out
          </a>
        </div>
      </div>
    </header>
  );
}
