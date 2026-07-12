import { notFound } from "next/navigation";
import { partnerBySlug } from "@/lib/partners/registry";

// A placeholder home page, so a newly registered partner resolves to something
// in their own brand rather than a 404. The real bespoke site replaces this
// file — it is a landing pad, not a template.
export default function PartnerHome({ params }: { params: { slug: string } }) {
  const partner = partnerBySlug(params.slug);
  if (!partner) notFound();

  return (
    <div className="shell relative flex min-h-[80vh] flex-col items-center justify-center text-center">
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-72" />
      <p className="kicker">Coming soon</p>
      <h1 className="display mt-5 text-6xl sm:text-8xl">{partner.name}</h1>
      <p className="mt-5 max-w-md text-muted">
        The site is being built. Tickets, shows and everything else land here.
      </p>
    </div>
  );
}
