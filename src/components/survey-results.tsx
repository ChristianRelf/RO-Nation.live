import type { QuestionType } from "@prisma/client";
import { StatCard } from "@/components/admin-ui";
import { LocalTime } from "@/components/local-time";
import { formatBytes } from "@/lib/survey-files";

// The results of a survey, rendered. Shared by /company's responses page and a
// partner's studio one - the two differ only in HOW the survey is found and WHO may
// see it (the scoped query in each page), which is exactly the part that must not be
// shared. Everything below is pure display over rows already loaded and guarded.

type Answer = { id: string; value: string; values: string[] };
type Question = {
  id: string;
  prompt: string;
  type: QuestionType;
  required: boolean;
  options: string[];
  answers: Answer[];
};
type SurveyResultsData = {
  title: string;
  status: string;
  multipleResponses: boolean;
  questions: Question[];
  responses: { id: string; userId: string; robloxUsername: string; createdAt: Date }[];
};

export function SurveyResults({
  survey,
  attachments,
  exportHref,
}: {
  survey: SurveyResultsData;
  /** Submitted uploads by id, so a FILE_UPLOAD answer's ids become named links. */
  attachments: Map<string, { id: string; filename: string; size: number }>;
  /** The CSV route, when the caller has one. null omits the export tile entirely. */
  exportHref?: string | null;
}) {
  const total = survey.responses.length;
  const people = new Set(survey.responses.map((r) => r.userId)).size;

  return (
    <>
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Responses" value={total} />
        {/* Only worth the tile where the two numbers can differ. On a one-per-account
            survey "People" would always equal "Responses" and say nothing. */}
        {survey.multipleResponses ? (
          <StatCard label="People" value={people} />
        ) : (
          <StatCard label="Questions" value={survey.questions.length} />
        )}
        {exportHref ? (
          <div className="card flex flex-col justify-center p-5">
            <a href={exportHref} className="btn btn-ghost">
              Export CSV
            </a>
          </div>
        ) : null}
      </div>

      {total === 0 ? (
        <div className="card grid place-items-center px-6 py-16 text-center">
          <p className="font-display text-2xl uppercase">No responses yet</p>
          <p className="mt-2 max-w-sm text-sm text-muted">
            {survey.status === "OPEN"
              ? "The survey is open - share the link and answers will land here."
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
                    {q.required ? " · required" : ""} · {q.answers.length} of {total}{" "}
                    answered
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <QuestionSummary
                  type={q.type}
                  options={q.options}
                  answers={q.answers}
                  total={total}
                  attachments={attachments}
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
                    <LocalTime value={r.createdAt} mode="datetime" />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </>
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
    FILE_UPLOAD: "File upload",
  }[type];
}

function QuestionSummary({
  type,
  options,
  answers,
  total,
  attachments,
}: {
  type: QuestionType;
  options: string[];
  answers: { id: string; value: string; values: string[] }[];
  total: number;
  attachments: Map<string, { id: string; filename: string; size: number }>;
}) {
  if (type === "FILE_UPLOAD") {
    if (!answers.length) {
      return <p className="text-sm text-faint">Nobody answered this one.</p>;
    }
    return (
      <ul className="space-y-3">
        {answers.map((a) => (
          <li key={a.id} className="border-l-2 border-line pl-3">
            <ul className="space-y-1.5">
              {a.values.map((id) => {
                const file = attachments.get(id);
                if (!file) {
                  return (
                    <li key={id} className="text-sm text-faint">
                      File no longer available
                    </li>
                  );
                }
                return (
                  <li key={id} className="flex items-center gap-3 text-sm">
                    <a
                      href={`/files/survey/${file.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 flex-1 truncate text-accent hover:underline"
                    >
                      {file.filename}
                    </a>
                    <span className="tnum shrink-0 text-xs text-faint">
                      {formatBytes(file.size)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    );
  }

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

  // Everything else is countable - a bar per option.
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
          answers.reduce((sum, a) => sum + Number(a.value || 0), 0) / answers.length
        ).toFixed(1)
      : null;

  return (
    <div>
      {average ? (
        <p className="mb-4 text-sm text-muted">
          Average:{" "}
          <span className="tnum font-display text-2xl text-fg">{average}</span> / 5
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
              <div className="h-2 w-full bg-fg/[0.04]">
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
