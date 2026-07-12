import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { QuestionType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireStudioUser } from "@/lib/studio";
import { AdminHeader, StatCard } from "@/components/admin-ui";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Survey results" };

export default async function SurveyResponsesPage({
  params,
}: {
  params: { id: string };
}) {
  await requireStudioUser();

  const survey = await prisma.survey.findUnique({
    where: { id: params.id },
    include: {
      questions: {
        orderBy: { order: "asc" },
        include: { answers: true },
      },
      responses: {
        orderBy: { createdAt: "desc" },
        include: { answers: true },
      },
    },
  });
  if (!survey) notFound();

  const total = survey.responses.length;

  return (
    <div>
      <AdminHeader
        title="Results"
        subtitle={survey.title}
        action={{ label: "Edit survey", href: `/studio/surveys/${survey.id}/edit` }}
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Responses" value={total} />
        <StatCard label="Questions" value={survey.questions.length} />
        <div className="card flex flex-col justify-center p-5">
          <a
            href={`/api/studio/surveys/${survey.id}/export`}
            className="btn btn-ghost"
          >
            Export CSV
          </a>
        </div>
      </div>

      {total === 0 ? (
        <div className="card grid place-items-center px-6 py-16 text-center">
          <p className="font-display text-2xl uppercase">No responses yet</p>
          <p className="mt-2 max-w-sm text-sm text-muted">
            {survey.status === "OPEN"
              ? "The survey is open — share the link and answers will land here."
              : "The survey isn't open yet, so nobody can answer it."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {survey.questions.map((q, i) => (
            <section key={q.id} className="card p-6">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-sm text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h2 className="font-display text-xl">{q.prompt}</h2>
                  <p className="mt-1 text-xs text-faint">
                    {label(q.type)}
                    {q.required ? " · required" : ""} · {q.answers.length} of{" "}
                    {total} answered
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <QuestionSummary
                  type={q.type}
                  options={q.options}
                  answers={q.answers}
                  total={total}
                />
              </div>
            </section>
          ))}

          <section className="card p-6">
            <h2 className="font-display text-xl uppercase">Who answered</h2>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {survey.responses.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between border border-line px-3 py-2 text-sm"
                >
                  <span className="font-medium">{r.robloxUsername}</span>
                  <span className="text-xs text-faint">
                    {formatDateTime(r.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

function label(type: QuestionType) {
  return {
    SHORT_TEXT: "Short text",
    LONG_TEXT: "Long text",
    CHOICE: "Multiple choice",
    CHECKBOXES: "Checkboxes",
    RATING: "Rating 1–5",
    YES_NO: "Yes / No",
  }[type];
}

function QuestionSummary({
  type,
  options,
  answers,
  total,
}: {
  type: QuestionType;
  options: string[];
  answers: { id: string; value: string; values: string[] }[];
  total: number;
}) {
  // Free text: just list what people wrote.
  if (type === "SHORT_TEXT" || type === "LONG_TEXT") {
    if (!answers.length) {
      return <p className="text-sm text-faint">Nobody answered this one.</p>;
    }
    return (
      <ul className="space-y-2">
        {answers.map((a) => (
          <li
            key={a.id}
            className="whitespace-pre-line border-l-2 border-line pl-3 text-sm text-muted"
          >
            {a.value}
          </li>
        ))}
      </ul>
    );
  }

  // Everything else is countable — show a bar per option.
  const buckets: { key: string; count: number }[] =
    type === "CHECKBOXES"
      ? options.map((o) => ({
          key: o,
          count: answers.filter((a) => a.values.includes(o)).length,
        }))
      : type === "CHOICE"
        ? options.map((o) => ({
            key: o,
            count: answers.filter((a) => a.value === o).length,
          }))
        : type === "RATING"
          ? ["1", "2", "3", "4", "5"].map((n) => ({
              key: n,
              count: answers.filter((a) => a.value === n).length,
            }))
          : ["YES", "NO"].map((v) => ({
              key: v === "YES" ? "Yes" : "No",
              count: answers.filter((a) => a.value === v).length,
            }));

  const max = Math.max(1, ...buckets.map((b) => b.count));

  const average =
    type === "RATING" && answers.length
      ? (
          answers.reduce((sum, a) => sum + Number(a.value || 0), 0) /
          answers.length
        ).toFixed(1)
      : null;

  return (
    <div>
      {average ? (
        <p className="mb-4 text-sm text-muted">
          Average:{" "}
          <span className="tnum font-display text-2xl text-fg">{average}</span>{" "}
          / 5
        </p>
      ) : null}

      <ul className="space-y-2.5">
        {buckets.map((b) => {
          const pct = total ? Math.round((b.count / total) * 100) : 0;
          return (
            <li key={b.key}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{b.key}</span>
                <span className="tnum shrink-0 text-xs text-faint">
                  {b.count} · {pct}%
                </span>
              </div>
              <div className="h-2 w-full bg-white/[0.04]">
                <div
                  className="h-2 bg-accent"
                  style={{ width: `${(b.count / max) * 100}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
