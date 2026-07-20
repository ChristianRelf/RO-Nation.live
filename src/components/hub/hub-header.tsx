import Link from "next/link";

// The hub's own top bar.
//
// Deliberately NOT PortalNav: every link that component renders is built from one
// `basePath`, and the hub sits above all of them - it is the page you reach when
// you do not yet know which area you want. PortalNav's switcher exists to solve
// the same problem from inside an area; this is the other end of it.
//
// Extracted from the page so there is somewhere for a notification bell to hang
// later without touching the page's layout. (If one is added: it must be a client
// component that fetches on mount, not a server read - see the note on the feed in
// the plan. A server-rendered bell in a shared header is how the per-page query
// cost the hub split just removed gets quietly added back.)

export function HubHeader({
  session,
}: {
  session: { displayName: string; avatarUrl?: string } | null;
}) {
  return (
    <header className="border-b border-line">
      <div className="shell flex h-16 items-center justify-between gap-6">
        <Link href="/hub" className="flex items-baseline gap-2">
          <span className="display text-2xl tracking-tight">RO. Nation LIVE</span>
          <span className="hidden text-[10px] font-bold uppercase tracking-kicker text-accent sm:inline">
            Backstage
          </span>
        </Link>

        {session ? (
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-tight">
                {session.displayName}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-kicker text-faint">
                Signed in
              </p>
            </div>
            {session.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.avatarUrl}
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 rounded-full border border-line"
              />
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-xs font-bold text-accent-ink">
                {session.displayName.slice(0, 1).toUpperCase()}
              </span>
            )}
            <a
              href="/api/auth/logout?returnTo=/hub"
              className="text-sm text-muted transition-colors hover:text-red-400"
            >
              Sign out
            </a>
          </div>
        ) : null}
      </div>
    </header>
  );
}
