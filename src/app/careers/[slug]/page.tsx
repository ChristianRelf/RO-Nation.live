import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCareerBySlug } from "@/lib/queries";
import { getUserSession } from "@/lib/session";
import { Kicker } from "@/components/ui";
import { toLines } from "@/lib/utils";
import { ApplyForm } from "@/components/apply-form";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const career = await getCareerBySlug(null, params.slug);
  if (!career) return { title: "Role not found" };
  return { title: career.title, description: career.summary };
}

export default async function CareerPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { applied?: string; error?: string };
}) {
  // null = RNL's own, so a partner's opening does not answer here.
  const career = await getCareerBySlug(null, params.slug);
  if (!career) notFound();

  const session = await getUserSession();
  const requirements = toLines(career.requirements);
  const closed = career.status === "CLOSED";

  return (
    <div className="relative">
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-56" />
      <div className="shell relative pt-14 sm:pt-16">
        <Link
          href="/careers"
          className="text-sm text-muted transition-colors hover:text-fg"
        >
          ← All roles
        </Link>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="pill">{career.department}</span>
          <span className="pill">{career.commitment}</span>
          <span className="pill">{career.location}</span>
        </div>
        <h1 className="display mt-4 max-w-3xl text-5xl sm:text-6xl">
          {career.title}
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted">{career.summary}</p>
      </div>

      <div className="shell grid gap-12 py-12 lg:grid-cols-[1.5fr_1fr] lg:gap-16">
        <div>
          <Kicker>The role</Kicker>
          <div className="mt-5 whitespace-pre-line text-[17px] leading-relaxed text-muted">
            {career.description}
          </div>

          {requirements.length ? (
            <>
              <h2 className="mt-10 font-display text-2xl">What we&apos;re after</h2>
              <ul className="mt-5 space-y-3">
                {requirements.map((r, i) => (
                  <li key={i} className="flex gap-3 text-muted">
                    <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] text-accent">
                      ✓
                    </span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>

        {/* Apply */}
        <aside id="apply" className="lg:sticky lg:top-24 lg:self-start">
          <ApplyForm
            career={career}
            session={session}
            applied={Boolean(searchParams.applied)}
            error={searchParams.error}
            closed={closed}
            note="Takes two minutes. We reply to everyone in the Discord."
          />
        </aside>
      </div>
    </div>
  );
}
