import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { SurveyQuestion } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/session";
import { submitSurveyResponse } from "@/app/actions/survey";
import { SURVEY_CODE_RE } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { site } from "@/lib/site";
import { OfficialMark } from "@/components/official-mark";
import { SurveyFileField } from "@/components/survey-file-field";
import { DEFAULT_MAX_FILES, DEFAULT_MAX_FILE_MB } from "@/lib/survey-files";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { code: string };
}): Promise<Metadata> {
  const survey = await find(params.code);
  return {
    title: survey ? `${survey.title} - Survey` : "Survey",
    robots: { index: false, follow: false },
  };
}

async function find(code: string) {
  if (!SURVEY_CODE_RE.test(code)) return null;
  return prisma.survey.findUnique({
    where: { code: code.toUpperCase() },
    include: { questions: { orderBy: { order: "asc" } } },
  });
}

export default async function SurveyPage({
  params,
  searchParams,
}: {
  params: { code: string };
  searchParams: { ok?: string; error?: string; q?: string };
}) {
  const survey = await find(params.code);

  // A draft is indistinguishable from a bad code - no hints that it exists.
  if (!survey || survey.status === "DRAFT") notFound();

  const session = await getUserSession();
  const code = survey.code;

  const expired =
    survey.closesAt !== null && survey.closesAt.getTime() < Date.now();
  const closed = survey.status === "CLOSED" || expired;

  const existing = session
    ? await prisma.surveyResponse.findUnique({
        where: { surveyId_userId: { surveyId: survey.id, userId: session.uid } },
      })
    : null;

  const done = Boolean(existing) || searchParams.ok === "1";

  // Files this person has already uploaded and not yet submitted.
  //
  // Without this a reload is a trap. The upload door counts unclaimed rows to
  // enforce the author's file limit, and that count survives a refresh while the
  // field's own state does not - so a one-file question would come back empty,
  // refuse the next upload as "already at the limit", offer nothing to remove
  // (Remove only knows about files in local state) and then fail submit as
  // required. The respondent would be locked out until the cull ran, up to a day.
  //
  // Handing the rows back makes the form agree with the database again: the files
  // are listed, removable, and already attached.
  const pending =
    session && !done && !closed
      ? await prisma.surveyUpload.findMany({
          where: {
            question: { surveyId: survey.id },
            userId: session.uid,
            responseId: null,
          },
          select: { id: true, questionId: true, filename: true, size: true },
          orderBy: { createdAt: "asc" },
        })
      : [];

  return (
    <main className="relative min-h-dvh">
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-64" />

      <div className="shell relative max-w-2xl py-16">
        <p className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
          {site.name}
        </p>
        <h1 className="display mt-4 text-4xl sm:text-5xl">{survey.title}</h1>

        {survey.description ? (
          <p className="mt-5 whitespace-pre-line leading-relaxed text-muted">
            {survey.description}
          </p>
        ) : null}

        {/* Above the fold, and outside the panel switch below, so it is on the page
            in every state - including the sign-in one, which is the only state where
            somebody is about to hand Roblox a redirect on our say-so. This host is
            the whole reason the mark exists: a bare code on a subdomain, arriving by
            link, is otherwise unverifiable. */}
        <OfficialMark className="mt-8" />

        <div className="mt-10">
          {done ? (
            <Panel tone="ok" title="Thanks - that's in.">
              <p>
                Your answers have been recorded
                {existing ? ` on ${formatDateTime(existing.createdAt)}` : ""}.
                You can only answer once, so there&apos;s nothing more to do.
              </p>
            </Panel>
          ) : closed ? (
            <Panel tone="muted" title="This survey is closed.">
              <p>
                It&apos;s no longer accepting responses. Thanks for stopping by.
              </p>
            </Panel>
          ) : !session ? (
            <Panel tone="muted" title="Sign in to answer">
              <p className="mb-5">
                Answers are tied to your Roblox account so everyone gets one say.
                We only see your username - nothing else.
              </p>
              <a
                href={`/api/auth/roblox/login?returnTo=/${code}`}
                className="btn btn-accent w-full"
              >
                Sign in with Roblox
              </a>
            </Panel>
          ) : (
            <>
              {searchParams.error === "required" ? (
                <p className="mb-5 border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
                  One of the required questions was left blank. Have another look
                  below.
                </p>
              ) : searchParams.error === "already" ? (
                <p className="mb-5 border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-sm text-amber-200">
                  You&apos;ve already answered this one.
                </p>
              ) : searchParams.error === "closed" ? (
                <p className="mb-5 border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-sm text-amber-200">
                  This survey closed while you had it open.
                </p>
              ) : null}

              <p className="mb-6 text-sm text-faint">
                Answering as{" "}
                <span className="font-semibold text-fg">
                  {session.displayName}
                </span>
                . You can only submit once.
              </p>

              <form action={submitSurveyResponse} className="space-y-5">
                <input type="hidden" name="code" value={code} />

                {survey.questions.map((q, i) => (
                  <Question
                    key={q.id}
                    q={q}
                    index={i}
                    invalid={searchParams.q === q.id}
                    pending={pending.filter((u) => u.questionId === q.id)}
                  />
                ))}

                <button className="btn btn-accent w-full">Submit answers</button>
              </form>
            </>
          )}
        </div>

        <p className="mt-12 border-t border-line pt-6 text-center text-xs text-faint">
          Powered by{" "}
          <a href="https://ronation.live" className="text-muted hover:text-accent">
            {site.name}
          </a>
        </p>
      </div>
    </main>
  );
}

function Question({
  q,
  index,
  invalid,
  pending,
}: {
  q: SurveyQuestion;
  index: number;
  invalid: boolean;
  /** FILE_UPLOAD only: files already uploaded against this question. */
  pending: { id: string; filename: string; size: number }[];
}) {
  const name = `q_${q.id}`;
  const inputClass =
    "w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm outline-none transition-colors focus:border-accent";

  return (
    <fieldset
      className={`card p-6 ${invalid ? "border-red-500/50" : ""}`}
      aria-required={q.required}
    >
      <legend className="sr-only">{q.prompt}</legend>

      <div className="flex items-baseline gap-3">
        <span className="font-mono text-sm text-accent">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div>
          <p className="font-semibold">
            {q.prompt}
            {q.required ? <span className="ml-1 text-accent">*</span> : null}
          </p>
          {q.helpText ? (
            <p className="mt-1 text-xs text-faint">{q.helpText}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        {q.type === "SHORT_TEXT" ? (
          <input
            name={name}
            required={q.required}
            maxLength={500}
            className={inputClass}
          />
        ) : null}

        {q.type === "LONG_TEXT" ? (
          <textarea
            name={name}
            required={q.required}
            rows={5}
            maxLength={5000}
            className={`${inputClass} resize-y`}
          />
        ) : null}

        {q.type === "CHOICE" ? (
          <div className="space-y-2">
            {q.options.map((opt) => (
              <label
                key={opt}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-bg px-4 py-3 text-sm transition-colors hover:border-line-strong"
              >
                <input
                  type="radio"
                  name={name}
                  value={opt}
                  required={q.required}
                  className="h-4 w-4 accent-accent"
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        ) : null}

        {q.type === "CHECKBOXES" ? (
          <div className="space-y-2">
            {q.options.map((opt) => (
              <label
                key={opt}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-bg px-4 py-3 text-sm transition-colors hover:border-line-strong"
              >
                <input
                  type="checkbox"
                  name={name}
                  value={opt}
                  className="h-4 w-4 accent-accent"
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        ) : null}

        {q.type === "RATING" ? (
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <label
                key={n}
                className="flex flex-1 cursor-pointer items-center justify-center rounded-xl border border-line bg-bg px-4 py-3 text-sm transition-colors hover:border-line-strong has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent"
              >
                <input
                  type="radio"
                  name={name}
                  value={n}
                  required={q.required}
                  className="sr-only"
                />
                <span className="tnum font-display text-2xl">{n}</span>
              </label>
            ))}
          </div>
        ) : null}

        {q.type === "FILE_UPLOAD" ? (
          // No `required` on the picker: the value posted is a hidden input that
          // only exists once a file is up, and the browser cannot validate that.
          // submitSurveyResponse enforces it, the same way it does for every other
          // type it cannot trust the client about.
          <SurveyFileField
            name={name}
            questionId={q.id}
            maxFiles={q.maxFiles ?? DEFAULT_MAX_FILES}
            maxFileMb={q.maxFileMb ?? DEFAULT_MAX_FILE_MB}
            fileTypes={q.fileTypes}
            required={q.required}
            defaultFiles={pending}
          />
        ) : null}

        {q.type === "YES_NO" ? (
          <div className="flex gap-2">
            {["YES", "NO"].map((v) => (
              <label
                key={v}
                className="flex flex-1 cursor-pointer items-center justify-center rounded-xl border border-line bg-bg px-4 py-3 text-sm font-semibold transition-colors hover:border-line-strong has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent"
              >
                <input
                  type="radio"
                  name={name}
                  value={v}
                  required={q.required}
                  className="sr-only"
                />
                <span>{v === "YES" ? "Yes" : "No"}</span>
              </label>
            ))}
          </div>
        ) : null}
      </div>
    </fieldset>
  );
}

function Panel({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "ok" | "muted";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`card p-8 text-center ${
        tone === "ok" ? "border-emerald-400/30" : ""
      }`}
    >
      <h2 className="font-display text-2xl uppercase">{title}</h2>
      <div className="mt-3 text-sm leading-relaxed text-muted">{children}</div>
    </div>
  );
}
