import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { partnerBySlug } from "@/lib/partners/registry";
import { assertPartnerFeature } from "@/lib/partners/guard";
import { getOpenCareers } from "@/lib/queries";

export const dynamic = "force-dynamic";

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const partner = partnerBySlug(params.slug);
  return {
    title: "Crew",
    description: partner
      ? `Open roles with ${partner.name} - build and run the shows.`
      : undefined,
  };
}

export default async function PartnerCareersIndex({
  params,
}: {
  params: { slug: string };
}) {
  const partner = partnerBySlug(params.slug);
  if (!partner) notFound();
  assertPartnerFeature(partner, "careers");

  // This partner's openings. RNL's roles are advertised on RNL's site.
  const careers = await getOpenCareers(partner.slug);

  return (
    <div className="shell py-20">
      <div className="mb-12 border-b border-line pb-10">
        <p className="kicker text-accent">Join in</p>
        <h1 className="display mt-4 text-5xl sm:text-6xl">Crew</h1>
        <p className="mt-5 max-w-xl leading-relaxed text-muted">
          The shows are built by people who wanted them to exist. If that&apos;s
          you, there&apos;s a place here.
        </p>
      </div>

      {careers.length ? (
        <ul className="grid gap-px border border-line bg-line sm:grid-cols-2">
          {careers.map((career) => (
            <li key={career.id} className="bg-bg">
              <Link
                href={`/careers/${career.slug}`}
                className="group flex h-full flex-col p-8 transition-colors hover:bg-surface"
              >
                <p className="text-[11px] font-semibold uppercase tracking-kicker text-faint">
                  {career.department} · {career.commitment}
                </p>
                <h2 className="display mt-3 text-2xl transition-colors group-hover:text-accent">
                  {career.title}
                </h2>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">
                  {career.summary}
                </p>
                <p className="mt-6 text-sm text-accent">
                  Read the role{" "}
                  <span className="inline-block transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="card grid place-items-center px-6 py-20 text-center">
          <p className="display text-3xl">Nothing open right now</p>
          <p className="mt-3 max-w-sm text-muted">
            No roles are open at the moment. Keep an eye here - the crew grows
            with every show.
          </p>
        </div>
      )}
    </div>
  );
}
