import type { SettlementRange } from "@/lib/settlement";

// Turn an optional `?period=YYYY-MM` into a settlement window, a human label and a
// tag for the invoice number. Shared by the partner and SHASHA invoice pages so the
// two cannot drift on what a period means. Anything unparseable is all-time, which is
// the safe default (it shows everything rather than silently narrowing).

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function parseInvoicePeriod(raw?: string): {
  range?: SettlementRange;
  label: string;
  tag: string;
} {
  const m = /^(\d{4})-(\d{2})$/.exec(raw ?? "");
  if (!m) return { label: "All time", tag: "ALL" };

  const year = Number(m[1]);
  const month = Number(m[2]); // 1-12
  if (month < 1 || month > 12) return { label: "All time", tag: "ALL" };

  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 1); // exclusive: first of the next month
  return {
    range: { from, to },
    label: `${MONTHS[month - 1]} ${year}`,
    tag: `${m[1]}-${m[2]}`,
  };
}
