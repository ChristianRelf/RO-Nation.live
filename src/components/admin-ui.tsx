import Link from "next/link";

export function AdminHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl">{title}</h1>
        {subtitle ? <p className="mt-2 text-muted">{subtitle}</p> : null}
      </div>
      {action ? (
        <Link href={action.href} className="btn btn-accent shrink-0">
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="card p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-2 font-display text-4xl">{value}</p>
      {hint ? <p className="mt-1 text-xs text-faint">{hint}</p> : null}
    </div>
  );
}

const badgeStyles: Record<string, string> = {
  DRAFT: "bg-fg/5 text-faint border-line",
  PUBLISHED: "bg-emerald-400/10 text-emerald-300 border-emerald-400/30",
  ARCHIVED: "bg-fg/5 text-faint border-line",
  OPEN: "bg-emerald-400/10 text-emerald-300 border-emerald-400/30",
  CLOSED: "bg-fg/5 text-faint border-line",
  NEW: "bg-accent-soft text-accent border-accent/30",
  REVIEWING: "bg-amber-400/10 text-amber-300 border-amber-400/30",
  ACCEPTED: "bg-emerald-400/10 text-emerald-300 border-emerald-400/30",
  REJECTED: "bg-red-500/10 text-red-300 border-red-500/30",
  RESERVED: "bg-accent-soft text-accent border-accent/30",
  CHECKED_IN: "bg-emerald-400/10 text-emerald-300 border-emerald-400/30",
  CANCELLED: "bg-red-500/10 text-red-300 border-red-500/30",

  // A ban, not an undo. CANCELLED alone cannot say which of the two happened - and the
  // schema spends twenty lines on that distinction - so a revoked ticket carries this
  // one as well. Red and loud: it is a statement about a person.
  REVOKED: "bg-red-500/20 text-red-200 border-red-500/50",

  // Enquiries.
  READING: "bg-amber-400/10 text-amber-300 border-amber-400/30",
  REPLIED: "bg-emerald-400/10 text-emerald-300 border-emerald-400/30",
  BOOKING: "bg-accent-soft text-accent border-accent/30",
  PRESS: "bg-violet-400/10 text-violet-300 border-violet-400/30",
  PARTNERSHIP: "bg-sky-400/10 text-sky-300 border-sky-400/30",
  GENERAL: "bg-fg/5 text-muted border-line",

  // Partner roles.
  OWNER: "bg-accent-soft text-accent border-accent/30",
  MANAGER: "bg-sky-400/10 text-sky-300 border-sky-400/30",
  STAFF: "bg-fg/5 text-muted border-line",
};

export function Badge({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
        badgeStyles[value] ?? "border-line text-muted"
      }`}
    >
      {value.replace("_", " ")}
    </span>
  );
}
