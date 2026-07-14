import { Logo } from "@/components/logo";
import { activeCollections } from "@/lib/merch/collections";
import { collectionPath } from "@/lib/merch/urls";
import { env } from "@/lib/env";
import { site } from "@/lib/site";
import { ShopNav } from "./shop-nav";

// The shop's own chrome.
//
// Not SiteHeader, and not a variant of it: that header's job is to move people toward a
// show, and every one of its links points at a route that does not exist on this host.
// Somebody arriving from a Roblox group post is not being sold a ticket.
//
// Three things it now does that the first version did not, and each of them was a real
// hole:
//
//   1. IT SAYS WHERE YOU ARE. The old one showed RNL's logo and nothing else, so the
//      shop was an unnamed page that happened to have shirts on it. Now the logo is
//      followed by MERCH, hung off the bar - you are at the merch table.
//   2. IT SAYS WHICH RAIL YOU ARE AT. The collection links had no active state at all,
//      so on /sleeptoken nothing in the nav told you so. See ShopNav.
//   3. IT SENDS YOU WHERE THE MONEY IS. The only right-hand link was back to the
//      marketing site. The one thing every visitor here eventually wants is the Roblox
//      group, and it was buried in the footer.
//
// `bg-bg`, not glass: a backdrop-blur is a material this brand does not use, and the film
// grain sits badly under one.

export function ShopHeader() {
  const collections = activeCollections();

  return (
    <header className="sticky top-0 z-40 bg-bg">
      <div className="shell flex h-[72px] items-center justify-between gap-4">
        <div className="flex shrink-0 items-center gap-3">
          {/* NOT wrapped in a <Link>: Logo already renders one, and an <a> inside an <a>
              is invalid HTML - the browser reparents it, the client tree stops matching
              the server tree, and React throws out the whole root and re-renders on the
              client. It surfaces as a hydration error whose stack points at Link rather
              than at the actual cause. */}
          <Logo />

          <span aria-hidden className="h-7 w-px bg-line-strong" />

          <span className="display text-xl leading-none text-fg">Merch</span>
        </div>

        <ShopNav
          items={collections.map((c) => ({
            slug: c.slug,
            name: c.name,
            href: collectionPath(c.slug),
          }))}
        />

        <div className="flex shrink-0 items-center gap-3">
          <a
            href={env.siteUrl}
            className="hidden text-[11px] font-bold uppercase tracking-[0.14em] text-muted transition-colors hover:text-fg lg:block"
          >
            RO. Nation LIVE &#8599;
          </a>
          <a
            href={site.socials.roblox}
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost !px-4 !py-2 !text-[10px]"
          >
            <span className="hidden sm:inline">Roblox group</span>
            <span className="sm:hidden">Roblox</span>
            &#8599;
          </a>
        </div>
      </div>

      {/* The bar everything in this shop hangs from - the header included. It is not a
          border-bottom somebody made too thick, and the brackets are what say so. */}
      <div className="shell">
        <div className="flex items-start">
          <span className="rail-bracket shrink-0" aria-hidden />
          <span className="rail-bar flex-1" aria-hidden />
          <span className="rail-bracket shrink-0 -scale-x-100" aria-hidden />
        </div>
      </div>
    </header>
  );
}
