import Link from "next/link";

// A partner's 404. Reached whenever the middleware rewrites an unknown path on
// <slug>.ronation.live to /p/<slug>/<junk> - so a visitor who mistypes a URL
// lands somewhere in the partner's own brand, rather than being bounced to RNL.
//
// It needs no slug of its own: the palette and fonts come from data-brand on
// <html>, which the root layout has already set from the request host. That is
// exactly why the brand stylesheets are imported up there and not in the partner
// layout - Next renders not-found OUTSIDE the nested layouts.

export default function PartnerNotFound() {
  return (
    <div className="shell relative flex min-h-[70vh] flex-col items-center justify-center py-24 text-center">
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-64" />

      <p className="kicker text-accent">404</p>
      <h1 className="display mt-6 text-6xl sm:text-7xl">Nothing here</h1>
      <p className="mt-5 max-w-sm text-muted">
        That page doesn&apos;t exist - or the show it pointed at has finished.
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Link href="/events" className="btn btn-accent">
          See the shows
        </Link>
        <Link href="/" className="btn btn-ghost">
          Home
        </Link>
      </div>
    </div>
  );
}
