import type { InvoiceStatus } from "@prisma/client";

// One badge, two states. DRAFT is company-only and reads as unfinished (amber); SENT is
// live in the partner's portal and reads as done (emerald). Shared by the invoice tables
// and the document toolbar so the wording and colour can't drift between them.
//
// `tone` picks where it sits: "dark" for the dark company chrome, "light" for the white
// printable document (where the amber/emerald must carry on a white field). The badge is
// never printed - it lives in the document's no-print toolbar - so the light tone only has
// to survive a bright screen, not paper.
export function InvoiceStatusBadge({
  status,
  tone = "dark",
}: {
  status: InvoiceStatus;
  tone?: "dark" | "light";
}) {
  const sent = status === "SENT";
  const label = sent ? "Sent" : "Draft";

  const styles = sent
    ? tone === "light"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
      : "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30"
    : tone === "light"
      ? "bg-amber-50 text-amber-700 ring-amber-600/20"
      : "bg-amber-400/10 text-amber-300 ring-amber-400/30";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${styles}`}
    >
      {label}
    </span>
  );
}
