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

/**
 * Validate an answer against its question and normalise it for storage.
 * Returns null when the question was left blank.
 */
function readAnswer(
  form: FormData,
  q: { id: string; type: QuestionType; options: string[] },
): { value: string; values: string[] } | null {
  const field = `q_${q.id}`;

  switch (q.type) {
    case QuestionType.CHECKBOXES: {
      // Only options the question actually offers — never trust the posted list.
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

  const answers: Prisma.SurveyAnswerCreateManyResponseInput[] = [];
  for (const q of survey.questions) {
    const answer = readAnswer(formData, q);
    if (!answer) {
      if (q.required) back(`error=required&q=${q.id}`);
      continue;
    }
    answers.push({
      questionId: q.id,
      value: answer.value,
      values: answer.values,
    });
  }

  try {
    await prisma.surveyResponse.create({
      data: {
        surveyId: survey.id,
        userId: session.uid,
        robloxUsername: session.username,
        answers: { createMany: { data: answers } },
      },
    });
  } catch (err) {
    // The @@unique([surveyId, userId]) is what actually enforces one response
    // per account — two tabs submitting at once both pass the earlier check.
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
