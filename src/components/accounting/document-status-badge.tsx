import type { DocumentStatus } from "@prisma/client";
import { STATUS_META, type StatusTone } from "@/lib/accounting/kinds";

// The four-state sibling of InvoiceStatusBadge. Same shape, same two tones - "dark" for
// the company chrome, "light" for the white printable page - so a status chip reads the
// same wherever it appears. Wording and tone come from STATUS_META, so the badge, the
// filter tabs and the hint text can never disagree about what "issued" means.

const STYLES: Record<StatusTone, { dark: string; light: string }> = {
  neutral: {
    dark: "bg-fg/5 text-muted ring-line",
    light: "bg-neutral-100 text-neutral-600 ring-neutral-300",
  },
  positive: {
    dark: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30",
    light: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  },
  warning: {
    dark: "bg-amber-400/10 text-amber-300 ring-amber-400/30",
    light: "bg-amber-50 text-amber-700 ring-amber-600/20",
  },
  danger: {
    dark: "bg-red-500/10 text-red-300 ring-red-500/30",
    light: "bg-red-50 text-red-700 ring-red-600/20",
  },
};

export function DocumentStatusBadge({
  status,
  tone = "dark",
}: {
  status: DocumentStatus;
  tone?: "dark" | "light";
}) {
  const meta = STATUS_META[status];
  return (
    <span
      title={meta.hint}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${STYLES[meta.tone][tone]}`}
    >
      {meta.label}
    </span>
  );
}
