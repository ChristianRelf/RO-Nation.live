import type { Metadata } from "next";
import { RosterPage, type RosterSearchParams } from "@/components/roster-page";
import { requirePortalUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "VIP list" };

export default async function VipPage({
  searchParams,
}: {
  searchParams: RosterSearchParams;
}) {
  await requirePortalUser();
  return <RosterPage kind="VIP" searchParams={searchParams} />;
}
