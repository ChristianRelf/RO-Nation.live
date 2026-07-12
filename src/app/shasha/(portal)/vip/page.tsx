import type { Metadata } from "next";
import { RosterPage, type RosterSearchParams } from "@/components/roster-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "VIP list" };

export default function VipPage({
  searchParams,
}: {
  searchParams: RosterSearchParams;
}) {
  return <RosterPage kind="VIP" searchParams={searchParams} />;
}
