import { dateBlock, formatDateTime } from "@/lib/format";
import { StatusBadge } from "./ui";
import { TicketQR } from "./ticket-qr";

const statusLabel: Record<string, { key: any; text: string }> = {
  RESERVED: { key: "upcoming", text: "Reserved" },
  CHECKED_IN: { key: "open", text: "Checked in" },
  CANCELLED: { key: "closed", text: "Cancelled" },
};

export function TicketStub({
  code,
  eventTitle,
  startsAt,
  venue,
  status,
  activated = false,
}: {
  code: string;
  eventTitle: string;
  startsAt: Date | string;
  venue?: string | null;
  status: "RESERVED" | "CHECKED_IN" | "CANCELLED";
  activated?: boolean;
}) {
  const { day, month } = dateBlock(startsAt);
  const s = statusLabel[status];
  const dimmed = status === "CANCELLED";

  return (
    <div
      className={`relative flex overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-accent/40 ${
        dimmed ? "opacity-55" : ""
      }`}
    >
      {/* Main body */}
      <div className="flex flex-1 flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-5">
        <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl border border-line bg-bg leading-none">
          <span className="font-display text-2xl">{day}</span>
          <span className="mt-1 text-[10px] font-bold tracking-widest text-accent">
            {month}
          </span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <StatusBadge status={s.key}>{s.text}</StatusBadge>
            {activated && status !== "CANCELLED" ? (
              <span className="rounded-[3px] border border-accent/30 bg-accent-soft px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-accent">
                Activated
              </span>
            ) : null}
          </div>
          <h3 className="mt-2 truncate font-display text-xl">{eventTitle}</h3>
          <p className="mt-1 text-sm text-muted">{formatDateTime(startsAt)}</p>
          {venue ? <p className="text-sm text-muted">{venue}</p> : null}
        </div>
      </div>

      {/* Perforation */}
      <div className="ticket-perf w-4 shrink-0" />

      {/* Stub */}
      <div className="flex w-32 shrink-0 flex-col items-center justify-center gap-2 bg-bg/40 p-4 sm:w-36">
        <TicketQR code={code} size={80} className="rounded-md" />
        <span className="font-mono text-xs font-semibold tracking-widest text-fg">
          {code}
        </span>
      </div>
    </div>
  );
}
