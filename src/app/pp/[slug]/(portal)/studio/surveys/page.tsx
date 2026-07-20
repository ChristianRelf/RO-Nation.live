import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { assertPartnerFeature, requirePartnerUser } from "@/lib/partners/guard";
import { partnerPortalPath } from "@/lib/partners/urls";
import { Badge } from "@/components/admin-ui";
import { ConfirmButton } from "@/components/confirm-button";
import { deleteSurvey, setSurveyStatus } from "@/app/actions/company";
import { formatDateTime } from "@/lib/format";
import { SurveyLink } from "@/components/survey-link";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Surveys" };

const STATUSES = ["DRAFT", "OPEN", "CLOSED"] as const;

// A partner's own surveys - the same builder and results RNL uses in /company,
// pointed at this partner's scope. Every write posts a hidden `scope` field so the
// shared survey actions guard and store against this org (see surveyScope in
// actions/company.ts). Note there is no CSV export here yet: the export route is
// /company's; the results page below shows everything in the meantime.
export default async function StudioSurveysPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { ok?: string; locked?: string };
}) {
  const { partner, canWrite } = await requirePartnerUser(params.slug);
  assertPartnerFeature(partner, "surveys");

  const surveys = await prisma.survey.findMany({
    where: { partnerId: partner.slug },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { responses: true, questions: true } } },
  });

  const base = partnerPortalPath(partner.slug, "/studio/surveys");

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="display text-4xl">Surveys</h1>
          <p className="mt-2 text-sm text-muted">
            Ask your crowd. Each survey gets its own link; people sign in with Roblox
            and answer once.
          </p>
        </div>
        {canWrite ? (
          <Link href={`${base}/new`} className="btn btn-accent shrink-0">
            + New survey
          </Link>
        ) : null}
      </div>

      {searchParams.ok ? (
        <p className="mb-6 border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-300">
          {searchParams.ok === "created"
            ? "Survey created - share the link below."
            : searchParams.ok === "deleted"
              ? "Survey deleted."
              : searchParams.locked
                ? "Saved. The questions were left untouched because people have already answered."
                : "Saved."}
        </p>
      ) : null}

      {surveys.length ? (
        <ul className="space-y-3">
          {surveys.map((s) => (
            <li key={s.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-xl uppercase">{s.title}</h3>
                    <Badge value={s.status} />
                  </div>

                  <p className="mt-1 text-xs text-faint">
                    {s._count.questions} question
                    {s._count.questions === 1 ? "" : "s"} ·{" "}
                    <Link
                      href={`${base}/${s.id}/responses`}
                      className="text-accent hover:underline"
                    >
                      {s._count.responses} response
                      {s._count.responses === 1 ? "" : "s"}
                    </Link>{" "}
                    · by {s.authorName} · {formatDateTime(s.createdAt)}
                  </p>

                  <div className="mt-3">
                    <SurveyLink code={s.code} />
                  </div>
                </div>

                {canWrite ? (
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    {STATUSES.map((st) => (
                      <form action={setSurveyStatus} key={st}>
                        <input type="hidden" name="scope" value={partner.slug} />
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="status" value={st} />
                        <button
                          className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                            s.status === st
                              ? "border-accent bg-accent-soft text-accent"
                              : "border-line text-muted hover:text-fg"
                          }`}
                        >
                          {st[0] + st.slice(1).toLowerCase()}
                        </button>
                      </form>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-line pt-3 text-sm">
                <Link href={`${base}/${s.id}/responses`} className="text-muted hover:text-fg">
                  Results
                </Link>
                {canWrite ? (
                  <>
                    <Link href={`${base}/${s.id}/edit`} className="text-muted hover:text-fg">
                      Edit
                    </Link>
                    <form action={deleteSurvey} className="ml-auto">
                      <input type="hidden" name="scope" value={partner.slug} />
                      <input type="hidden" name="id" value={s.id} />
                      <ConfirmButton
                        className="text-faint hover:text-red-400"
                        message={`Delete "${s.title}"? Its ${s._count.responses} response(s) go too. This can't be undone.`}
                      >
                        Delete
                      </ConfirmButton>
                    </form>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="card grid place-items-center px-6 py-20 text-center">
          <p className="font-display text-2xl">No surveys yet</p>
          <p className="mt-2 max-w-sm text-sm text-muted">
            {canWrite
              ? "Build one, set it to Open, and share the link after a show."
              : "Management hasn't created any surveys yet."}
          </p>
          {canWrite ? (
            <Link href={`${base}/new`} className="btn btn-accent mt-5">
              Create the first one
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
