"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  ApplicationStatus,
  JobStatus,
  SurveyStatus,
  TicketStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireCompanyUser } from "@/lib/company";
import { generateSurveyCode } from "@/lib/utils";
import {
  readEventForm,
  readPostForm,
  resolvePublishedAt,
  s,
  uniqueSlug,
} from "@/lib/content";
import { readTiersForm, syncEventTiers } from "@/lib/tickets/tiers-form";

// Every write to ronation.live's own content: events, blog, surveys, careers,
// applications, attendees. One module, because there is now one door.
//
// There used to be two — /admin (a shared password) and /studio (a group rank) —
// with near-identical event CRUD in each, and a bug living in exactly the gap
// between them: the Studio's writes revalidated both dashboards, the admin's
// revalidated only its own, so an admin edit left the Studio's list stale.
// Merging them deletes that class of bug rather than fixing this instance of it.
//
// Every action re-checks the rank server-side. The UI hiding a button is not a
// permission, and neither is having loaded this page a minute ago — a demotion
// lands within the group-membership cache TTL.

function refreshEvents() {
  revalidatePath("/company/events");
  revalidatePath("/events");
  revalidatePath("/");
}

function refreshBlog() {
  revalidatePath("/company/blog");
  revalidatePath("/blog");
}

function refreshCareers() {
  revalidatePath("/company/careers");
  revalidatePath("/careers");
}

// ---- events ------------------------------------------------------
export async function createEvent(formData: FormData) {
  await requireCompanyUser();

  const data = readEventForm(formData);
  const tiers = readTiersForm(formData);
  if (!data.title || !data.startsAt || !data.description) {
    redirect("/company/events/new?error=required");
  }
  if (tiers === null) redirect("/company/events/new?error=tiers");

  const slug = await uniqueSlug(data.title, "event");
  const event = await prisma.event.create({
    data: { ...data, startsAt: data.startsAt!, slug },
  });
  await syncEventTiers(event.id, tiers);

  refreshEvents();
  redirect("/company/events");
}

// The Company manages RNL's OWN events. Both writes below match on
// `partnerId: null` as well as the id, and use the *Many form so that a miss
// affects zero rows instead of throwing.
//
// Rank in RNL's group is what gets you in here, and by itself it says nothing
// about a partner's shows — without this, a company user could edit or delete a
// Sleep Token show by pasting its id into the URL. Staff ranked 250+ genuinely
// may touch a partner's shows, but they do it through that partner's own portal,
// where the guard has authorised them FOR that partner. Passing one guard is not
// the same as being allowed to touch the row.
export async function updateEvent(formData: FormData) {
  await requireCompanyUser();

  const id = s(formData, "id");
  const data = readEventForm(formData);
  const tiers = readTiersForm(formData);
  if (!id || !data.title || !data.startsAt || !data.description) {
    redirect(`/company/events/${id}/edit?error=required`);
  }
  if (tiers === null) redirect(`/company/events/${id}/edit?error=tiers`);

  const { count } = await prisma.event.updateMany({
    where: { id, partnerId: null },
    data: { ...data, startsAt: data.startsAt! },
  });
  // Gated on the same check the event write just made: the tier sync matches on
  // eventId alone, so without this a company user could rewrite a partner's tiers
  // by pasting their event id — the exact hole `partnerId: null` above closes.
  if (count > 0) await syncEventTiers(id, tiers);

  refreshEvents();
  redirect("/company/events");
}

export async function deleteEvent(formData: FormData) {
  await requireCompanyUser();

  const id = s(formData, "id");
  if (id) await prisma.event.deleteMany({ where: { id, partnerId: null } });

  refreshEvents();
  redirect("/company/events");
}

// ---- tickets (attendees) -----------------------------------------
export async function setTicketStatus(formData: FormData) {
  await requireCompanyUser();

  const id = s(formData, "ticketId");
  const status = s(formData, "status") as TicketStatus;
  const eventId = s(formData, "eventId");

  if (id && ["RESERVED", "CHECKED_IN", "CANCELLED"].includes(status)) {
    // Scoped to RNL's own events, like every other write here. The old admin
    // version matched on the ticket id alone, so a pasted id from a partner's
    // show would have been checked in from RNL's door.
    const { count } = await prisma.ticket.updateMany({
      where: { id, event: { partnerId: null } },
      data: {
        status,
        checkedInAt: status === "CHECKED_IN" ? new Date() : null,
      },
    });
    if (count > 0 && eventId) {
      revalidatePath(`/company/events/${eventId}/attendees`);
    }
  }
}

// ---- blog posts --------------------------------------------------
export async function createPost(formData: FormData) {
  const user = await requireCompanyUser();

  const data = readPostForm(formData);
  if (!data.title || !data.body) {
    redirect("/company/blog/new?error=required");
  }

  const slug = await uniqueSlug(data.title, "post", null);
  await prisma.post.create({
    data: {
      ...data,
      slug,
      // RNL's own. Everything this module writes is pinned to null, and every
      // list it reads filters on it — a partner's posts belong to their studio.
      partnerId: null,
      publishedAt: resolvePublishedAt(data.status),
      authorRobloxId: user.robloxId,
      authorName: user.displayName,
    },
  });

  refreshBlog();
  redirect("/company/blog");
}

export async function updatePost(formData: FormData) {
  await requireCompanyUser();

  const id = s(formData, "id");
  const data = readPostForm(formData);
  if (!id || !data.title || !data.body) {
    redirect(`/company/blog/${id}/edit?error=required`);
  }

  // Scoped, like the event writes: an id belonging to a partner must match
  // nothing here, rather than being edited from RNL's door.
  const existing = await prisma.post.findFirst({
    where: { id, partnerId: null },
  });
  if (!existing) redirect("/company/blog");

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
  redirect("/company/blog");
}

export async function deletePost(formData: FormData) {
  await requireCompanyUser();

  const id = s(formData, "id");
  if (id) await prisma.post.deleteMany({ where: { id, partnerId: null } });

  refreshBlog();
  redirect("/company/blog");
}

// ---- careers -----------------------------------------------------
function readCareer(form: FormData) {
  return {
    title: s(form, "title"),
    department: s(form, "department") || "Events",
    commitment: s(form, "commitment") || "Volunteer",
    location: s(form, "location") || "Remote — Roblox",
    summary: s(form, "summary"),
    description: s(form, "description"),
    requirements: s(form, "requirements"),
    status: (s(form, "status") as JobStatus) || JobStatus.DRAFT,
  };
}

export async function createCareer(formData: FormData) {
  await requireCompanyUser();

  const data = readCareer(formData);
  if (!data.title || !data.summary || !data.description) {
    redirect("/company/careers/new?error=required");
  }

  const slug = await uniqueSlug(data.title, "career", null);
  await prisma.career.create({ data: { ...data, slug, partnerId: null } });

  refreshCareers();
  redirect("/company/careers");
}

export async function updateCareer(formData: FormData) {
  await requireCompanyUser();

  const id = s(formData, "id");
  const data = readCareer(formData);
  if (!id || !data.title || !data.summary || !data.description) {
    redirect(`/company/careers/${id}/edit?error=required`);
  }

  await prisma.career.updateMany({ where: { id, partnerId: null }, data });

  refreshCareers();
  redirect("/company/careers");
}

export async function deleteCareer(formData: FormData) {
  await requireCompanyUser();

  const id = s(formData, "id");
  if (id) await prisma.career.deleteMany({ where: { id, partnerId: null } });

  refreshCareers();
  redirect("/company/careers");
}

// ---- applications ------------------------------------------------
export async function setApplicationStatus(formData: FormData) {
  await requireCompanyUser();

  const id = s(formData, "id");
  const status = s(formData, "status") as ApplicationStatus;
  if (id && ["NEW", "REVIEWING", "ACCEPTED", "REJECTED"].includes(status)) {
    // An application carries the partnerId of the role it was submitted against,
    // so this cannot reach into a partner's inbox with a pasted id.
    await prisma.application.updateMany({
      where: { id, partnerId: null },
      data: { status },
    });
  }

  revalidatePath("/company/applications");
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
  revalidatePath("/company/surveys");
  if (id) revalidatePath(`/company/surveys/${id}/edit`);
}

export async function createSurvey(formData: FormData) {
  const user = await requireCompanyUser();

  const data = readSurveyForm(formData);
  const questions = parseQuestions(s(formData, "questions"));

  if (!data.title) redirect("/company/surveys/new?error=required");
  if (!questions.success) redirect("/company/surveys/new?error=questions");

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
  redirect(`/company/surveys?ok=created&code=${survey.code}`);
}

export async function updateSurvey(formData: FormData) {
  await requireCompanyUser();

  const id = s(formData, "id");
  const data = readSurveyForm(formData);
  const questions = parseQuestions(s(formData, "questions"));

  if (!id) redirect("/company/surveys");
  if (!data.title) redirect(`/company/surveys/${id}/edit?error=required`);
  if (!questions.success) {
    redirect(`/company/surveys/${id}/edit?error=questions`);
  }

  const existing = await prisma.survey.findUnique({
    where: { id },
    include: { _count: { select: { responses: true } } },
  });
  if (!existing) redirect("/company/surveys");

  // Editing questions after people have answered would orphan their answers and
  // silently change what the results mean, so it's blocked. Title, description
  // and status stay editable.
  if (existing._count.responses > 0) {
    await prisma.survey.update({ where: { id }, data });
    refreshSurveys(id);
    redirect(`/company/surveys?ok=updated&locked=1`);
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
  redirect("/company/surveys?ok=updated");
}

export async function setSurveyStatus(formData: FormData) {
  await requireCompanyUser();

  const id = s(formData, "id");
  const status = s(formData, "status");
  if (id && ["DRAFT", "OPEN", "CLOSED"].includes(status)) {
    await prisma.survey.update({
      where: { id },
      data: { status: status as SurveyStatus },
    });
  }

  refreshSurveys(id);
  redirect("/company/surveys");
}

export async function deleteSurvey(formData: FormData) {
  await requireCompanyUser();

  const id = s(formData, "id");
  if (id) await prisma.survey.delete({ where: { id } });

  refreshSurveys();
  redirect("/company/surveys?ok=deleted");
}
