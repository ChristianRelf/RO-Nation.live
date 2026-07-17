import type { Metadata } from "next";
import Link from "next/link";
import { Kicker } from "@/components/ui";
import { DataRequestForm } from "@/components/data-request-form";
import { OfficialMark } from "@/components/official-mark";
import {
  DATA_REQUEST_VALUES,
  type DataRequestType,
} from "@/lib/data-request";
import { getUserSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New data request",
  description:
    "Tell RO. Nation LIVE what you need - a copy of your data, a correction, or deletion. Signed-in, so we know it's really your account.",
};

// The form itself. force-dynamic because it reads the session on every request - the whole
// page is different for a signed-in member (the form) and a signed-out visitor (the wall),
// and neither may ever be cached and served to the other.
//
// ?type=DELETE etc. presets the selector, which is what lets the landing page's cards deep
// link straight into the right request instead of dropping somebody on a blank form.

export default async function NewDataRequestPage({
  searchParams,
}: {
  searchParams: { type?: string; sent?: string; error?: string };
}) {
  const session = await getUserSession();

  const requested = (searchParams.type ?? "").toUpperCase();
  const defaultType = (
    DATA_REQUEST_VALUES.includes(requested as DataRequestType["value"])
      ? requested
      : "ACCESS"
  ) as DataRequestType["value"];

  return (
    <div className="relative">
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-56" />

      <div className="shell relative pt-16 sm:pt-20">
        <Kicker>Your data</Kicker>
        <h1 className="display mt-5 text-4xl sm:text-5xl md:text-6xl">
          New data request
        </h1>
        <p className="mt-4 max-w-xl text-muted">
          Pick what you&apos;re asking for and tell us where to reply.{" "}
          <Link
            href="/legal/data-requests"
            className="link-underline text-accent"
          >
            How we handle requests
          </Link>{" "}
          explains what happens next, and the two things we can&apos;t simply erase.
        </p>
      </div>

      <div className="shell max-w-xl py-12">
        <OfficialMark className="mb-4" />
        <DataRequestForm
          session={session}
          defaultType={defaultType}
          sent={searchParams.sent === "1"}
          error={searchParams.error}
        />
      </div>
    </div>
  );
}
