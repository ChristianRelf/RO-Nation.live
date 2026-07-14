import Link from "next/link";

export default function NotFound() {
  return (
    <div className="shell relative flex min-h-[70vh] flex-col items-center justify-center text-center">
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-72" />
      <p className="kicker">Error 404</p>
      <h1 className="display mt-4 text-7xl sm:text-9xl">Off the grid</h1>
      <p className="mt-5 max-w-md text-muted">
        This page doesn&apos;t exist - it may have wrapped, moved, or never made
        the line-up.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/" className="btn btn-accent">
          Back home
        </Link>
        <Link href="/events" className="btn btn-ghost">
          See events
        </Link>
      </div>
    </div>
  );
}
