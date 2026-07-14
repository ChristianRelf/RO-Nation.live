import Link from "next/link";
import { requireDocsReader } from "@/lib/docs-guard";

export const dynamic = "force-dynamic";

// The docs index. Guides and brand assets are for anybody with a door; the API
// reference is only shown to somebody who could hold a key - see lib/docs-guard.

export default async function DocsIndexPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const reader = await requireDocsReader();

  // requireDocsUser() bounces a reader who manages nothing back here rather than
  // out of the door. Without a word of explanation that just looks like a broken
  // link, so it sends one.
  const keysNotice = searchParams.error === "keys";

  const cards = [
    {
      href: "/docs/guides",
      title: "Guides",
      body: "Running an event, working the door, and how the systems fit together.",
    },
    {
      href: "/docs/brandassets",
      title: "Brand assets",
      body: "Logos, artwork and the brand guidelines. Some are shareable; some are not.",
    },
    ...(reader.canMintKeys
      ? [
          {
            href: "/docs/api",
            title: "Ticket API",
            body: "Verify, gift, redeem and revoke tickets from a Roblox game. The companion to a key.",
          },
        ]
      : []),
  ];

  return (
    <div>
      <header className="max-w-2xl">
        <p className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
          Backstage
        </p>
        <h1 className="display mt-3 text-4xl sm:text-5xl">Docs</h1>
        <p className="mt-4 text-sm text-muted">
          Everything RNL staff and partner crew need to run a show on this
          platform. Not public - don&apos;t forward these links.
        </p>
      </header>

      {keysNotice ? (
        <p className="mt-8 border border-line bg-surface px-4 py-3 text-sm text-muted">
          The Ticket API reference is for people who can mint an API key - a
          manager of an organisation on the platform. Everything else here is
          open to you.
        </p>
      ) : null}

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="card p-6 transition-colors hover:border-accent"
          >
            <h2 className="font-display text-xl uppercase">{c.title}</h2>
            <p className="mt-2 text-sm text-muted">{c.body}</p>
          </Link>
        ))}
      </div>

      <p className="mt-10 text-xs text-faint">
        You&apos;re here as{" "}
        <span className="font-semibold text-muted">{reader.displayName}</span>,
        with access to{" "}
        {reader.scopes.map((g) => g.scope.name).join(", ")}.
      </p>
    </div>
  );
}
