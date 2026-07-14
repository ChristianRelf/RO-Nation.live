import { prisma } from "@/lib/db";
import { AdminHeader, Badge } from "@/components/admin-ui";
import { ConfirmButton } from "@/components/confirm-button";
import {
  createTestimonial,
  deleteTestimonial,
  promoteSurveyAnswer,
  setTestimonialPublished,
} from "@/app/actions/company";
import { requireCompanyUser } from "@/lib/company";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

// What the crowd said - and the record of who actually said it.
//
// The homepage used to carry five of these as a hardcoded array, written by nobody. This
// is where the real ones live, and there are two ways in:
//
//   1. Type one in. Somebody said it on Discord, or on a stream, or to your face.
//   2. PROMOTE ONE FROM A SURVEY. This is the good one, and it is the reason the
//      section below exists: a LONG_TEXT survey answer was typed by a real, signed-in
//      Roblox account, so it arrives already attributed to a person who can be looked up.
//
// Either way it lands UNPUBLISHED. Nothing reaches the homepage because it was typed into
// a form; somebody reads it and decides. That is the entire point of the table.

export default async function CompanyTestimonialsPage({
  searchParams,
}: {
  searchParams: { ok?: string; error?: string };
}) {
  await requireCompanyUser();

  const [quotes, events, answers] = await Promise.all([
    prisma.testimonial.findMany({
      orderBy: [{ published: "desc" }, { order: "asc" }, { createdAt: "desc" }],
      include: { event: { select: { title: true } } },
    }),
    prisma.event.findMany({
      where: { partnerId: null },
      orderBy: { startsAt: "desc" },
      select: { id: true, title: true },
      take: 40,
    }),
    // The candidates. Free-text survey answers that have not already been lifted.
    //
    // `sourceAnswerId` is unique on Testimonial, so "already promoted" is answered by the
    // testimonial table rather than by a flag on the answer - which means a quote that was
    // promoted and then DELETED shows up here again, which is correct: deleting a quote is
    // a decision about the quote, not a promise never to see the answer again.
    prisma.surveyAnswer.findMany({
      where: { question: { type: "LONG_TEXT" }, NOT: { value: "" } },
      orderBy: { response: { createdAt: "desc" } },
      take: 60,
      include: {
        question: { select: { prompt: true } },
        response: {
          select: {
            robloxUsername: true,
            createdAt: true,
            survey: { select: { title: true } },
          },
        },
      },
    }),
  ]);

  const promoted = new Set(
    quotes.map((q) => q.sourceAnswerId).filter(Boolean) as string[],
  );
  const candidates = answers
    .filter((a) => !promoted.has(a.id))
    .filter((a) => a.value.trim().length >= 25);

  const live = quotes.filter((q) => q.published).length;

  return (
    <div>
      <AdminHeader
        title="Testimonials"
        subtitle="Quotes on the homepage. Nothing appears there until you publish it."
      />

      {searchParams.error === "required" ? (
        <p className="mb-6 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          A quote needs words and somebody who said them.
        </p>
      ) : null}
      {searchParams.ok === "promoted" ? (
        <p className="mb-6 border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
          Lifted from the survey. It is not on the site yet - publish it below.
        </p>
      ) : null}

      {/* ---- Add one by hand ---- */}
      <form action={createTestimonial} className="card mb-8 space-y-4 p-6">
        <h2 className="font-display text-xl">Add a quote</h2>

        <textarea
          name="body"
          required
          rows={3}
          maxLength={600}
          placeholder="What they said."
          className="w-full resize-y border border-line bg-bg px-4 py-3 text-sm outline-none transition-colors focus:border-accent"
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Who said it
            </label>
            <input
              name="author"
              required
              maxLength={60}
              placeholder="Their name or handle"
              className="w-full border border-line bg-bg px-4 py-2.5 text-sm outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Context
            </label>
            <input
              name="meta"
              maxLength={60}
              placeholder="Front row, ticket holder…"
              className="w-full border border-line bg-bg px-4 py-2.5 text-sm outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Which show
            </label>
            <select
              name="eventId"
              defaultValue=""
              className="w-full border border-line bg-bg px-4 py-2.5 text-sm outline-none focus:border-accent"
            >
              <option value="">Not about a specific one</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4 border-t border-line pt-4">
          <button className="btn btn-accent">Add it</button>
          <p className="text-xs text-faint">
            Added unpublished. It shows up on the homepage when you say so, and not
            before.
          </p>
        </div>
      </form>

      {/* ---- From the surveys ---- */}
      {candidates.length ? (
        <div className="mb-8">
          <h2 className="font-display text-xl">From your surveys</h2>
          <p className="mb-4 mt-1 text-sm text-muted">
            Free-text answers people gave while signed in with Roblox. These are the
            best quotes you have - somebody really typed them, under a name you can
            look up.
          </p>

          <div className="space-y-3">
            {candidates.map((a) => (
              <div key={a.id} className="card flex flex-wrap items-start gap-4 p-5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed text-fg">
                    &ldquo;{a.value.trim()}&rdquo;
                  </p>
                  <p className="mt-2 text-xs text-faint">
                    <span className="font-semibold text-muted">
                      {a.response.robloxUsername}
                    </span>{" "}
                    · {a.response.survey.title} · {a.question.prompt} ·{" "}
                    {formatDate(a.response.createdAt)}
                  </p>
                </div>
                <form action={promoteSurveyAnswer}>
                  <input type="hidden" name="answerId" value={a.id} />
                  <button className="btn btn-ghost !px-4 !py-2 text-xs">
                    Use as a quote
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* ---- The quotes ---- */}
      <h2 className="font-display text-xl">
        The quotes{" "}
        <span className="text-sm font-normal text-muted">
          ({live} live on the homepage)
        </span>
      </h2>

      {quotes.length ? (
        <div className="mt-4 space-y-3">
          {quotes.map((q) => (
            <div key={q.id} className="card flex flex-wrap items-start gap-4 p-5">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge value={q.published ? "PUBLISHED" : "DRAFT"} />
                  {q.sourceAnswerId ? <Badge value="FROM A SURVEY" /> : null}
                </div>
                <p className="text-sm leading-relaxed text-fg">
                  &ldquo;{q.body}&rdquo;
                </p>
                <p className="mt-2 text-xs text-faint">
                  <span className="font-semibold text-muted">{q.author}</span>
                  {q.meta ? ` · ${q.meta}` : ""}
                  {q.event ? ` · ${q.event.title}` : ""}
                </p>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <form action={setTestimonialPublished}>
                  <input type="hidden" name="id" value={q.id} />
                  <input
                    type="hidden"
                    name="published"
                    value={q.published ? "false" : "true"}
                  />
                  <button
                    className={
                      q.published
                        ? "text-muted hover:text-fg"
                        : "font-semibold text-accent hover:underline"
                    }
                  >
                    {q.published ? "Unpublish" : "Publish"}
                  </button>
                </form>

                <form action={deleteTestimonial}>
                  <input type="hidden" name="id" value={q.id} />
                  <ConfirmButton
                    className="text-faint hover:text-red-400"
                    message="Delete this quote?"
                  >
                    Delete
                  </ConfirmButton>
                </form>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card mt-4 grid place-items-center px-6 py-16 text-center">
          <p className="font-display text-2xl">No quotes yet</p>
          <p className="mt-2 max-w-md text-muted">
            The homepage simply leaves the section out until there is one - it does
            not print a heading over empty space, and it certainly does not make five
            of them up, which is what it used to do.
          </p>
        </div>
      )}
    </div>
  );
}
