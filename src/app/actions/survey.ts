"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, QuestionType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/session";

// Answering a survey. Respondents sign in with Roblox and get one response each.

function one(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

/** An upload this respondent has made and not yet attached to anything. */
type Unclaimed = { id: string; questionId: string; filename: string };

/**
 * Validate an answer against its question and normalise it for storage.
 * Returns null when the question was left blank.
 *
 * `unclaimed` is the respondent's own pending uploads, fetched once by the caller.
 * It is passed in rather than looked up here so this stays synchronous and so the
 * file questions cost one query between them instead of one each.
 */
function readAnswer(
  form: FormData,
  q: {
    id: string;
    type: QuestionType;
    options: string[];
    maxFiles: number | null;
  },
  unclaimed: Unclaimed[],
): { value: string; values: string[] } | null {
  const field = `q_${q.id}`;

  switch (q.type) {
    case QuestionType.FILE_UPLOAD: {
      // The posted ids are names, not evidence. Only ones that came back in
      // `unclaimed` survive - which means this respondent uploaded them, for THIS
      // question, and has not already spent them on another response. Posting
      // somebody else's id by hand matches nothing and drops out here.
      const byId = new Map(
        unclaimed.filter((u) => u.questionId === q.id).map((u) => [u.id, u]),
      );

      const picked = form
        .getAll(field)
        .map((v) => String(v))
        .filter((id, i, all) => byId.has(id) && all.indexOf(id) === i)
        // The author's count limit, applied on the way in. api/uploads/survey
        // already refuses the (n+1)th upload, but two tabs racing it can both
        // pass that check, and this is where the extra one stops being an answer.
        .slice(0, q.maxFiles ?? 1);

      if (!picked.length) return null;

      return {
        // The filenames, so anything that just wants to PRINT an answer - the CSV,
        // a summary line - reads `value` exactly as it does for every other type.
        value: picked.map((id) => byId.get(id)!.filename).join(", "),
        // The ids, which is what the results page resolves back into links.
        values: picked,
      };
    }

    case QuestionType.CHECKBOXES: {
      // Only options the question actually offers - never trust the posted list.
      const picked = form
        .getAll(field)
        .map((v) => String(v))
        .filter((v) => q.options.includes(v));
      return picked.length ? { value: picked.join(", "), values: picked } : null;
    }

    case QuestionType.CHOICE: {
      const v = one(form, field);
      return v && q.options.includes(v) ? { value: v, values: [] } : null;
    }

    case QuestionType.RATING: {
      const n = parseInt(one(form, field), 10);
      return n >= 1 && n <= 5 ? { value: String(n), values: [] } : null;
    }

    case QuestionType.YES_NO: {
      const v = one(form, field).toUpperCase();
      return v === "YES" || v === "NO" ? { value: v, values: [] } : null;
    }

    case QuestionType.SHORT_TEXT:
    case QuestionType.LONG_TEXT:
    default: {
      const v = one(form, field).slice(0, 5000);
      return v ? { value: v, values: [] } : null;
    }
  }
}

export async function submitSurveyResponse(formData: FormData) {
  const code = one(formData, "code").toUpperCase();
  if (!code) redirect("/");

  // Annotated `never` so TypeScript knows a call to this ends the function.
  const back: (q: string) => never = (q) => redirect(`/survey/${code}?${q}`);

  const session = await getUserSession();
  if (!session) back("error=signin");

  const survey = await prisma.survey.findUnique({
    where: { code },
    include: { questions: { orderBy: { order: "asc" } } },
  });

  if (!survey) redirect("/survey/not-found");

  // Re-check on submit, not just on render: a survey can close while the form
  // is open in someone's browser.
  const closed =
    survey.status !== "OPEN" ||
    (survey.closesAt !== null && survey.closesAt.getTime() < Date.now());
  if (closed) back("error=closed");

  // The respondent's pending uploads, in one query, scoped to this survey's file
  // questions and to them. Everything readAnswer is allowed to attach is in here.
  const fileQuestionIds = survey.questions
    .filter((q) => q.type === QuestionType.FILE_UPLOAD)
    .map((q) => q.id);

  const unclaimed = fileQuestionIds.length
    ? await prisma.surveyUpload.findMany({
        where: {
          questionId: { in: fileQuestionIds },
          userId: session.uid,
          responseId: null,
        },
        select: { id: true, questionId: true, filename: true },
      })
    : [];

  const answers: Prisma.SurveyAnswerCreateManyResponseInput[] = [];
  const attaching: string[] = [];
  for (const q of survey.questions) {
    const answer = readAnswer(formData, q, unclaimed);
    if (!answer) {
      if (q.required) back(`error=required&q=${q.id}`);
      continue;
    }
    if (q.type === QuestionType.FILE_UPLOAD) attaching.push(...answer.values);
    answers.push({
      questionId: q.id,
      value: answer.value,
      values: answer.values,
    });
  }

  try {
    // One transaction, because a response whose files are still marked unclaimed
    // is a results page full of dead links: /files/survey/[id] serves attached
    // uploads only, and the cull deletes unattached ones.
    await prisma.$transaction(async (tx) => {
      const response = await tx.surveyResponse.create({
        data: {
          surveyId: survey.id,
          userId: session.uid,
          robloxUsername: session.username,
          answers: { createMany: { data: answers } },
        },
      });

      if (attaching.length) {
        await tx.surveyUpload.updateMany({
          // The ownership conditions again, not just the ids. This runs after the
          // read that produced them, and `responseId: null` is what makes the
          // claim atomic - a second submit racing this one updates zero rows
          // rather than stealing files off the first.
          where: {
            id: { in: attaching },
            userId: session.uid,
            responseId: null,
          },
          data: { responseId: response.id },
        });
      }
    });
  } catch (err) {
    // The @@unique([surveyId, userId]) is what actually enforces one response
    // per account - two tabs submitting at once both pass the earlier check.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      back("error=already");
    }
    throw err;
  }

  revalidatePath(`/company/surveys/${survey.id}/responses`);
  redirect(`/survey/${code}?ok=1`);
}
