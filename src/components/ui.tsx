import Link from "next/link";
import { cn } from "@/lib/utils";

export function Kicker({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("kicker inline-flex items-center gap-2", className)}>
      <span className="h-px w-6 bg-accent" />
      {children}
    </span>
  );
}

export function SectionHeading({
  kicker,
  title,
  action,
  className,
}: {
  kicker?: string;
  title: React.ReactNode;
  action?: { label: string; href: string };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div>
        {kicker ? <Kicker>{kicker}</Kicker> : null}
        <h2 className="display mt-4 text-4xl text-fg sm:text-5xl md:text-6xl">
          {title}
        </h2>
      </div>
      {action ? (
        <Link
          href={action.href}
          className="group inline-flex items-center gap-2 self-start text-sm font-semibold text-fg sm:self-auto"
        >
          {action.label}
          <span className="transition-transform group-hover:translate-x-1">→</span>
        </Link>
      ) : null}
    </div>
  );
}

const statusStyles: Record<string, string> = {
  live: "border-red-500/30 bg-red-500/10 text-red-400",
  upcoming: "border-accent/30 bg-accent-soft text-accent",
  soon: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  past: "border-line bg-white/5 text-faint",
  open: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  closed: "border-line bg-white/5 text-faint",
  soldout: "border-red-500/30 bg-red-500/10 text-red-400",
};

export function StatusBadge({
  status,
  children,
}: {
  status: keyof typeof statusStyles;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[3px] border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]",
        statusStyles[status] ?? statusStyles.past,
      )}
    >
      {(status === "live" || status === "upcoming") && (
        <span className="relative flex h-1.5 w-1.5">
          {status === "live" && (
            <span className="absolute inline-flex h-full w-full animate-ping bg-current opacity-75" />
          )}
          <span className="relative inline-flex h-1.5 w-1.5 bg-current" />
        </span>
      )}
      {children}
    </span>
  );
}
