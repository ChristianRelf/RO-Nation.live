import type { Metadata } from "next";
import { RosterPage, type RosterSearchParams } from "@/components/roster-page";
import { requirePortalUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Blacklist" };

export default async function BlacklistPage({
  searchParams,
}: {
  searchParams: RosterSearchParams;
}) {
  await requirePortalUser();
  return <RosterPage kind="BLACKLIST" searchParams={searchParams} />;
}
