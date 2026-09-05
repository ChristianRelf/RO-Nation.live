import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { partnerBySlug } from "@/lib/partners/registry";
import { assertPartnerFeature } from "@/lib/partners/guard";
import { getCareerBySlug } from "@/lib/queries";
import { getUserSession } from "@/lib/session";
import { getDiscordLinkByUser } from "@/lib/discord-link";
import { toLines } from "@/lib/utils";
import { ApplyForm } from "@/components/apply-form";

export const dynamic = "force-dynamic";

// [career], not [slug] - the partner already owns [slug] one level up, and Next
// forbids two names at the same position.

type Params = {
  params: { slug: string; career: string };
  searchParams: { applied?: string; error?: string };
};

export async function generateMetadata({
  params,
}: {
  params: { slug: string; career: string };
}): Promise<Metadata> {
  const partner = partnerBySlug(params.slug);
  if (!partner) return {};

  const career = await getCareerBySlug(partner.slug, params.career);
  return career
    ? { title: career.title, description: career.summary }
    : { title: "Role not found" };
}

export default async function PartnerCareerPage({
  params,
  searchParams,
}: Params) {
  const partner = partnerBySlug(params.slug);
  if (!partner) notFound();
  assertPartnerFeature(partner, "careers");

  // Scoped: RNL's roles, and other partners', do not answer on this host.
  const career = await getCareerBySlug(partner.slug, params.career);
  if (!career) notFound();

  const session = await getUserSession();
  const discordLink = session ? await getDiscordLinkByUser(session.uid) : null;
  const requirements = toLines(career.requirements);
  const closed = career.status === "CLOSED";

  return (
    <div className="shell py-20">
      <Link
        href="/careers"
        className="text-sm text-faint transition-colors hover:text-fg"
      >
        ← All roles
      </Link>

      <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_380px]">
        <div>
          <p className="kicker text-accent">
            {career.department} · {career.commitment}
          </p>
          <h1 className="display mt-4 text-4xl leading-tight sm:text-5xl">
            {career.title}
          </h1>
          <p className="mt-5 max-w-xl leading-relaxed text-muted">
            {career.summary}
          </p>

          <div className="mt-10 max-w-2xl space-y-5 border-t border-line pt-10 leading-relaxed text-muted">
            {toLines(career.description).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>

          {requirements.length ? (
            <div className="mt-10 border-t border-line pt-10">
              <h2 className="display text-2xl">What we&apos;re after</h2>
              <ul className="mt-5 space-y-3">
                {requirements.map((r, i) => (
                  <li key={i} className="flex gap-3 text-muted">
                    <span className="mt-1 shrink-0 text-accent">-</span>
                    <span className="leading-relaxed">{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <aside id="apply" className="lg:sticky lg:top-24 lg:self-start">
          <ApplyForm
            career={career}
            session={session}
            discordUsername={discordLink?.discordUsername ?? null}
            returnTo={`/careers/${career.slug}#apply`}
            applied={Boolean(searchParams.applied)}
            error={searchParams.error}
            closed={closed}
            note={`Applications go straight to the ${partner.shortName} crew.`}
          />
        </aside>
      </div>
    </div>
  );
}
