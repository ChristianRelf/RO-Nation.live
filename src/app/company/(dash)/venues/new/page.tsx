import type { Metadata } from "next";
import Link from "next/link";
import { AdminHeader } from "@/components/admin-ui";
import { VenuePresetPicker } from "@/components/venue/venue-preset-picker";
import { requireCompanyUser } from "@/lib/company";
import { createCompanyVenue } from "@/app/actions/venue";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New venue" };

export default async function NewCompanyVenuePage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  // Every guarded PAGE calls this itself. A layout-only guard still ships the page's RSC
  // payload - see the note in company/(dash)/layout.tsx.
  await requireCompanyUser();

  return (
    <div>
      <AdminHeader title="New venue" subtitle="Name it, then draw it." />

      <form action={createCompanyVenue} className="card max-w-3xl space-y-5 p-6">
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
            placeholder="The Vault - Main Stage"
            className="w-full rounded-brand border border-line bg-bg px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
          <p className="mt-1 text-xs text-faint">
            The room, not the show. You&apos;ll reuse this for every gig that happens here.
          </p>
        </div>

        <VenuePresetPicker />

        <div className="flex gap-3">
          <button type="submit" className="btn btn-accent">
            Create and draw
          </button>
          <Link href="/company/venues" className="btn btn-ghost">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
