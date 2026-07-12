import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  href = "/",
}: {
  className?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      aria-label="RO. Nation LIVE — home"
      className={cn("inline-flex items-center", className)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/RNL_standard_white_clear_logo.png"
        alt="RO. Nation LIVE"
        width={192}
        height={34}
        className="h-10 w-auto sm:h-12"
      />
    </Link>
  );
}
