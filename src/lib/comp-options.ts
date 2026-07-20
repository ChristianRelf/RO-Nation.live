import { effectiveTiers, formatRobux } from "@/lib/tickets/pricing";

export type CompOption = { value: string; label: string };

// Flatten each published show into one comp option per tier - "Title · Tier (250 R$)".
// The value encodes both as "eventId::tierId" (tierId "" = the implicit free GA), so
// one <select> carries the whole choice with no client-side filtering. Shared by the
// partner and SHASHA comp pages.
export function compOptions(
  events: { id: string; title: string; tiers: Parameters<typeof effectiveTiers>[0] }[],
): CompOption[] {
  return events.flatMap((e) =>
    effectiveTiers(e.tiers).map((t) => ({
      value: `${e.id}::${t.id ?? ""}`,
      label: `${e.title} · ${t.name}${t.priceRobux > 0 ? ` (${formatRobux(t.priceRobux)})` : ""}`,
    })),
  );
}
