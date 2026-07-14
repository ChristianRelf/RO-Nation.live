import type { Metadata } from "next";
import Link from "next/link";
import {
  assertPartnerFeature,
  requirePartnerManager,
} from "@/lib/partners/guard";
import { partnerPortalPath } from "@/lib/partners/urls";
import { createPartnerVenue } from "@/app/actions/venue";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New venue" };

export default async function NewPartnerVenuePage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { error?: string };
}) {
  // Every guarded PAGE calls this itself. A layout-only guard still ships the page's RSC
  // payload in the body of the 307 it bounced you with - see lib/partners/guard.ts.
  const { partner } = await requirePartnerManager(params.slug);
  assertPartnerFeature(partner, "events");

  const base = partnerPortalPath(partner.slug, "/studio/venues");

  return (
    <div>
      <div className="mb-8 border-b border-line pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
          Line-up
        </p>
        <h1 className="display mt-3 text-5xl">New venue</h1>
        <p className="mt-2 text-sm text-muted">Name it, then draw it.</p>
      </div>

      <form action={createPartnerVenue} className="card max-w-lg space-y-4 p-6">
        {/* Carried in the body, and it authorises nothing - the action re-reads this
            caller's grant on this partner from the database before it writes a row. */}
        <input type="hidden" name="scope" value={partner.slug} />

        {searchParams.error === "required" ? (
          <p className="rounded-brand border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-xs text-red-200">
            A venue needs a name.
          </p>
        ) : null}

        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-faint">
            Name
          </label>
          <input
            name="name"
            placeholder="The Vault — Main Stage"
            className="w-full rounded-brand border border-line bg-bg px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
          <p className="mt-1 text-xs text-faint">
            The room, not the show. You&apos;ll reuse this for every gig that happens here.
          </p>
        </div>

        <div className="flex gap-3">
          <button type="submit" className="btn btn-accent">
            Create and draw
          </button>
          <Link href={base} className="btn btn-ghost">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
