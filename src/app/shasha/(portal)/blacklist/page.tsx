import type { Metadata } from "next";
import { RosterPage, type RosterSearchParams } from "@/components/roster-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Blacklist" };

export default function BlacklistPage({
  searchParams,
}: {
  searchParams: RosterSearchParams;
}) {
  return <RosterPage kind="BLACKLIST" searchParams={searchParams} />;
}
