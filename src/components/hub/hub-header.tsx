import Link from "next/link";

// The hub's own top bar.
//
// Deliberately NOT PortalNav: every link that component renders is built from one
// `basePath`, and the hub sits above all of them - it is the page you reach when
// you do not yet know which area you want. PortalNav's switcher exists to solve
// the same problem from inside an area; this is the other end of it.
//
// Sticky, because the hub is now a long single column rather than a grid that fits
// a screen - losing the way back to your own identity halfway down a feed is how a
// staff tool starts feeling like a document.
//
// Extracted from the page so there is somewhere for a notification bell to hang
// later without touching the page's layout. (If one is added: it must be a client
// component that fetches on mount, not a server read - a server-rendered bell in a
// shared header is how the per-page query cost the hub split removed gets quietly
// added back. See lib/hub-dashboard.ts.)

export function HubHeader({
  session,
}: {
  session: { displayName: string; avatarUrl?: string } | null;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
      {/* A hairline of accent above everything. The old header opened with a plain
          rule; this says which surface you are on before anything is read. */}
      <div aria-hidden className="h-px w-full bg-accent/40" />

      <div className="shell flex h-14 items-center justify-between gap-6">
        <Link href="/hub" className="group flex items-center gap-3">
          <span className="display text-xl leading-none tracking-tight">
            RO. Nation LIVE
          </span>
          <span
            aria-hidden
            className="hidden h-3.5 w-px bg-line-strong sm:block"
          />
          <span className="hidden text-[10px] font-bold uppercase tracking-kicker text-accent transition-opacity group-hover:opacity-70 sm:inline">
            Backstage
          </span>
        </Link>

        {session ? (
          <div className="flex items-center gap-2">
            {/* Identity as one bordered block rather than three loose elements.
                The avatar was floating between a name and a link and belonged to
                neither. */}
            <div className="flex items-center gap-2.5 rounded-brand border border-line py-1 pl-1 pr-3">
              {session.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.avatarUrl}
                  alt=""
                  width={28}
                  height={28}
                  className="h-7 w-7 rounded-brand"
                />
              ) : (
                <span className="grid h-7 w-7 place-items-center rounded-brand bg-accent text-xs font-bold text-accent-ink">
                  {session.displayName.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="hidden text-xs font-semibold leading-none sm:block">
                {session.displayName}
              </span>
            </div>

            <a
              href="/api/auth/logout?returnTo=/hub"
              className="rounded-brand border border-transparent px-2.5 py-2 text-[10px] font-bold uppercase tracking-kicker text-faint transition-colors hover:border-red-500/30 hover:text-red-400"
            >
              Sign out
            </a>
          </div>
        ) : null}
      </div>
    </header>
  );
}
