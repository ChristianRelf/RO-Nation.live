import type { PaymentRequestStatus } from "@prisma/client";
import {
  REQUEST_STATUS_META,
  type RequestStatusTone,
} from "@/lib/accounting/request-kinds";

// The sibling of DocumentStatusBadge, for the four states a payment request can be in.
//
// It borrows that badge's STYLES table by re-declaring it rather than importing it, and
// that is the one thing here worth a note: the tone names are shared (RequestStatusTone is
// an alias of the document badge's StatusTone) but a request has no printable form, so it
// has no "light" variant to keep in step. Exporting the styles from the document badge
// would tie a chip that only ever renders on a dark page to one that has to survive being
// printed on white.
//
// Wording and tone both come from REQUEST_STATUS_META, so this badge, the client's own
// list and the staff queue cannot come to describe the same row differently.

const STYLES: Record<RequestStatusTone, string> = {
  neutral: "bg-fg/5 text-muted ring-line",
  positive: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30",
  warning: "bg-amber-400/10 text-amber-300 ring-amber-400/30",
  danger: "bg-red-500/10 text-red-300 ring-red-500/30",
};

export function RequestStatusBadge({ status }: { status: PaymentRequestStatus }) {
  const meta = REQUEST_STATUS_META[status];
  return (
    <span
      title={meta.hint}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${STYLES[meta.tone]}`}
    >
      {meta.label}
    </span>
  );
}
