"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { SurveyStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireStudioUser } from "@/lib/studio";
import { generateSurveyCode } from "@/lib/utils";
import {
  readEventForm,
  readPostForm,
  resolvePublishedAt,
  s,
  uniqueSlug,
} from "@/lib/content";

// Event + blog CRUD for Roblox group members ranked 30+. Every action re-checks
// the rank server-side — the UI hiding a button is not a permission.

function refreshEvents() {
  revalidatePath("/studio/events");
  revalidatePath("/admin/events");
  revalidatePath("/events");
  revalidatePath("/");
}

function refreshBlog() {
  revalidatePath("/studio/blog");
  revalidatePath("/blog");
}

// ---- events ------------------------------------------------------
export async function createEvent(formData: FormData) {
  await requireStudioUser();

  const data = readEventForm(formData);
  if (!data.title || !data.startsAt || !data.description) {
    redirect("/studio/events/new?error=required");
  }

  const slug = await uniqueSlug(data.title, "event");
  await prisma.event.create({
    data: { ...data, startsAt: data.startsAt!, slug },
  });

  refreshEvents();
  redirect("/studio/events");
}

export async function updateEvent(formData: FormData) {
  await requireStudioUser();

  const id = s(formData, "id");
  const data = readEventForm(formData);
  if (!id || !data.title || !data.startsAt || !data.description) {
    redirect(`/studio/events/${id}/edit?error=required`);
  }

  await prisma.event.update({
    where: { id },
    data: { ...data, startsAt: data.startsAt! },
  });

  refreshEvents();
  redirect("/studio/events");
}

export async function deleteEvent(formData: FormData) {
  await requireStudioUser();

  const id = s(formData, "id");
  if (id) await prisma.event.delete({ where: { id } });

  refreshEvents();
  redirect("/studio/events");
}

// ---- blog posts --------------------------------------------------
export async function createPost(formData: FormData) {
  const user = await requireStudioUser();

  const data = readPostForm(formData);
  if (!data.title || !data.body) {
    redirect("/studio/blog/new?error=required");
  }

  const slug = await uniqueSlug(data.title, "post");
  await prisma.post.create({
    data: {
      ...data,
      slug,
      publishedAt: resolvePublishedAt(data.status),
      authorRobloxId: user.robloxId,
      authorName: user.displayName,
    },
  });

  refreshBlog();
  redirect("/studio/blog");
}

export async function updatePost(formData: FormData) {
  await requireStudioUser();

  const id = s(formData, "id");
  const data = readPostForm(formData);
  if (!id || !data.title || !data.body) {
    redirect(`/studio/blog/${id}/edit?error=required`);
  }

  const existing = await prisma.post.findUnique({ where: { id } });
  if (!existing) redirect("/studio/blog");

  // Retitling an existing post keeps its slug, so links already shared out in
  // the wild don't rot.
  await prisma.post.update({
    where: { id },
    data: {
      ...data,
      publishedAt: resolvePublishedAt(data.status, existing.publishedAt),
    },
  });

  refreshBlog();
  revalidatePath(`/blog/${existing.slug}`);
  redirect("/studio/blog");
}

export async function deletePost(formData: FormData) {
  await requireStudioUser();

  const id = s(formData, "id");
  if (id) await prisma.post.delete({ where: { id } });

  refreshBlog();
  redirect("/studio/blog");
}

// ---- surveys -----------------------------------------------------
// The builder is a client component; it posts the questions as JSON in one
// hidden field, since the shape (options per question, ordering) doesn't map
// cleanly onto flat form fields.
const QuestionSchema = z
  .object({
    type: z.enum([
      "SHORT_TEXT",
      "LONG_TEXT",
      "CHOICE",
      "CHECKBOXES",
      "RATING",
      "YES_NO",
    ]),
    prompt: z.string().trim().min(1).max(500),
    helpText: z.string().trim().max(300).optional().nullable(),
    required: z.boolean().default(false),
    options: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  })
  .transform((q) => ({
    ...q,
    // Options are meaningless on the other types — drop them so they can't
    // linger after someone switches a question's type in the builder.
    options: q.type === "CHOICE" || q.type === "CHECKBOXES" ? q.options : [],
  }))
  .refine(
    (q) =>
      (q.type !== "CHOICE" && q.type !== "CHECKBOXES") || q.options.length >= 2,
    { message: "Choice questions need at least two options." },
  );

const QuestionsSchema = z.array(QuestionSchema).min(1).max(40);

function parseQuestions(raw: string) {
  try {
    return QuestionsSchema.safeParse(JSON.parse(raw));
  } catch {
    return { success: false } as const;
  }
}

function readSurveyForm(form: FormData) {
  const status = s(form, "status");
  return {
    title: s(form, "title").slice(0, 200),
    description: s(form, "description").slice(0, 2000) || null,
    status: (["DRAFT", "OPEN", "CLOSED"] as const).includes(status as never)
      ? (status as SurveyStatus)
      : SurveyStatus.DRAFT,
  };
}

/** A code that isn't already taken. Collisions are vanishingly unlikely. */
async function uniqueSurveyCode() {
  for (let i = 0; i < 5; i++) {
    const code = generateSurveyCode();
    const clash = await prisma.survey.findUnique({ where: { code } });
    if (!clash) return code;
  }
  throw new Error("Could not generate an unused survey code");
}

function refreshSurveys(id?: string) {
  revalidatePath("/studio/surveys");
  if (id) revalidatePath(`/studio/surveys/${id}/edit`);
}

export async function createSurvey(formData: FormData) {
  const user = await requireStudioUser();

  const data = readSurveyForm(formData);
  const questions = parseQuestions(s(formData, "questions"));

  if (!data.title) redirect("/studio/surveys/new?error=required");
  if (!questions.success) redirect("/studio/surveys/new?error=questions");

  const code = await uniqueSurveyCode();
  const survey = await prisma.survey.create({
    data: {
      ...data,
      code,
      authorRobloxId: user.robloxId,
      authorName: user.displayName,
      questions: {
        create: questions.data.map((q, order) => ({ ...q, order })),
      },
    },
  });

  refreshSurveys();
  redirect(`/studio/surveys?ok=created&code=${survey.code}`);
}

export async function updateSurvey(formData: FormData) {
  await requireStudioUser();

  const id = s(formData, "id");
  const data = readSurveyForm(formData);
  const questions = parseQuestions(s(formData, "questions"));

  if (!id) redirect("/studio/surveys");
  if (!data.title) redirect(`/studio/surveys/${id}/edit?error=required`);
  if (!questions.success) redirect(`/studio/surveys/${id}/edit?error=questions`);

  const existing = await prisma.survey.findUnique({
    where: { id },
    include: { _count: { select: { responses: true } } },
  });
  if (!existing) redirect("/studio/surveys");

  // Editing questions after people have answered would orphan their answers and
  // silently change what the results mean, so it's blocked. Title, description
  // and status stay editable.
  if (existing._count.responses > 0) {
    await prisma.survey.update({ where: { id }, data });
    refreshSurveys(id);
    redirect(`/studio/surveys?ok=updated&locked=1`);
  }

  await prisma.$transaction([
    prisma.surveyQuestion.deleteMany({ where: { surveyId: id } }),
    prisma.survey.update({
      where: { id },
      data: {
        ...data,
        questions: {
          create: questions.data.map((q, order) => ({ ...q, order })),
        },
      },
    }),
  ]);

  refreshSurveys(id);
  redirect("/studio/surveys?ok=updated");
}

export async function setSurveyStatus(formData: FormData) {
  await requireStudioUser();

  const id = s(formData, "id");
  const status = s(formData, "status");
  if (id && ["DRAFT", "OPEN", "CLOSED"].includes(status)) {
    await prisma.survey.update({
      where: { id },
      data: { status: status as SurveyStatus },
    });
  }

  refreshSurveys(id);
  redirect("/studio/surveys");
}

export async function deleteSurvey(formData: FormData) {
  await requireStudioUser();

  const id = s(formData, "id");
  if (id) await prisma.survey.delete({ where: { id } });

  refreshSurveys();
  redirect("/studio/surveys?ok=deleted");
}
