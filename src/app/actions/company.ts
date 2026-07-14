"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  ApplicationStatus,
  EnquiryStatus,
  JobStatus,
  SurveyStatus,
  TicketStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireCompanyUser } from "@/lib/company";
import { resolveRobloxUser, searchRobloxUsers } from "@/lib/roblox-users";
import { generateSurveyCode } from "@/lib/utils";
import {
  parseDate,
  readEventForm,
  readPostForm,
  resolvePublishedAt,
  s,
  uniqueSlug,
} from "@/lib/content";
import { readTiersForm, syncEventTiers } from "@/lib/tickets/tiers-form";
import { unrevokeTicket } from "@/lib/tickets/issue";

// Every write to ronation.live's own content: events, blog, surveys, careers,
// applications, attendees. One module, because there is now one door.
//
// There used to be two - /admin (a shared password) and /studio (a group rank) -
// with near-identical event CRUD in each, and a bug living in exactly the gap
// between them: the Studio's writes revalidated both dashboards, the admin's
// revalidated only its own, so an admin edit left the Studio's list stale.
// Merging them deletes that class of bug rather than fixing this instance of it.
//
// Every action re-checks the rank server-side. The UI hiding a button is not a
// permission, and neither is having loaded this page a minute ago - a demotion
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

function refreshTeam() {
  revalidatePath("/company/team");
  revalidatePath("/team");
}

function refreshTestimonials() {
  revalidatePath("/company/testimonials");
  // The homepage is where they surface. Miss this and publishing a quote appears to do
  // nothing at all, which reads as a broken button rather than a stale cache.
  revalidatePath("/");
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
// about a partner's shows - without this, a company user could edit or delete a
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
  // by pasting their event id - the exact hole `partnerId: null` above closes.
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

/**
 * Lift a show ban.
 *
 * api/v1/tickets/revoke has always told the world that "lifting it is a deliberate act in
 * the portal, not something the game can undo". The primitive was written
 * (unrevokeTicket), exported, and then called by NOTHING - so the deliberate act did not
 * exist anywhere, and a show-banned attendee could not be un-banned by any person through
 * any surface in this application.
 *
 * This is that act.
 *
 * It clears the ban and nothing else. The ticket stays CANCELLED - lifting a ban is not
 * the same as handing the ticket back, and conflating them would silently re-seat somebody
 * at a sold-out show. What it restores is their RIGHT to reserve one again, which is what
 * the ban took away.
 */
export async function liftTicketRevocation(formData: FormData) {
  await requireCompanyUser();

  const id = s(formData, "ticketId");
  const eventId = s(formData, "eventId");
  if (!id) return;

  // null = RNL's own shows. The primitive now takes the scope as a required argument, so
  // this cannot reach a partner's ticket even with a pasted id.
  await unrevokeTicket(id, null);

  if (eventId) revalidatePath(`/company/events/${eventId}/attendees`);
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
      // list it reads filters on it - a partner's posts belong to their studio.
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
    location: s(form, "location") || "Remote - Roblox",
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
    // Options are meaningless on the other types - drop them so they can't
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
    // A deadline the code has always ENFORCED and the form never let anybody SET. It is
    // read in two places - actions/survey.ts refuses a response past it, and
    // survey/[code] renders the page as closed - and the builder simply never posted it,
    // so the column could only ever be null.
    //
    // parseDate("") returns null, and that null is written rather than skipped: clearing
    // the field has to mean "no deadline", not "keep the old one". A spread that dropped
    // it would make the date un-clearable once set, which is the kind of thing nobody
    // notices until they need to reopen a survey.
    closesAt: parseDate(s(form, "closesAt")),
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

// ---- the Roblox picker, for /company -----------------------------
/**
 * Search Roblox from a /company page.
 *
 * There is already a searchRoblox() in actions/portal.ts, and it is NOT reused here on
 * purpose. That one guards with requireScopeUser(scope) - the SHASHA/partner door. A
 * /company user clears it today only because COMPANY_MIN_RANK (245) happens to be above
 * SHASHA_MIN_RANK (200), and those are two separate environment variables describing two
 * separate doors. Move them apart and the picker inside /company would start bouncing
 * staff to /shasha/login from a page they are perfectly entitled to be on.
 *
 * So: same lookup, its own guard. Three lines is a cheap price for not borrowing another
 * door's permission.
 *
 * Like the portal's, this is not an open Roblox proxy - you have to be staff to call it.
 */
export async function searchRobloxForCompany(query: string) {
  await requireCompanyUser();
  return searchRobloxUsers(query);
}

// ---- the crew ----------------------------------------------------
//
// /team was six invented people in a hardcoded array. The defence against that happening
// again is not discipline, it is the shape of the write: a crew member is identified by a
// ROBLOX ID that came back from Roblox's own API through the picker. You cannot type a
// person into this table - you can only find one.

function readTeamMember(form: FormData) {
  return {
    role: s(form, "role"),
    department: s(form, "department") || "Crew",
    bio: s(form, "bio") || null,
    order: parseInt(s(form, "order") || "0", 10) || 0,
    visible: form.get("visible") === "on",
  };
}

export async function createTeamMember(formData: FormData) {
  await requireCompanyUser();

  const robloxId = s(formData, "robloxId");
  const data = readTeamMember(formData);
  if (!robloxId || !data.role) redirect("/company/team/new?error=required");

  // Re-resolved server-side. The client sent an id, a username and an avatar; only the
  // id is used as a lookup key, and the other two are fetched again from Roblox - the
  // same rule addRosterEntry follows. Never trust the client's idea of who this is.
  const profile = await resolveRobloxUser(robloxId);
  if (!profile) redirect("/company/team/new?error=roblox");

  await prisma.teamMember.upsert({
    // Unique on robloxId, so adding somebody who is already on the crew updates them
    // rather than producing a second card nobody notices.
    where: { robloxId: profile.robloxId },
    update: {
      ...data,
      robloxUsername: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
    },
    create: {
      ...data,
      robloxId: profile.robloxId,
      robloxUsername: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
    },
  });

  refreshTeam();
  redirect("/company/team");
}

export async function updateTeamMember(formData: FormData) {
  await requireCompanyUser();

  const id = s(formData, "id");
  const data = readTeamMember(formData);
  if (!id || !data.role) redirect(`/company/team/${id}/edit?error=required`);

  await prisma.teamMember.update({ where: { id }, data });

  refreshTeam();
  redirect("/company/team");
}

/**
 * Re-read a crew member's name and face from Roblox.
 *
 * Usernames change and headshot URLs rotate. Without this, the only way to fix a stale
 * card is to delete the person and add them back - which loses their blurb and their
 * ordering, so nobody does it, so the page slowly fills with people under names they no
 * longer use.
 */
export async function refreshTeamMember(formData: FormData) {
  await requireCompanyUser();

  const id = s(formData, "id");
  if (!id) redirect("/company/team");

  const member = await prisma.teamMember.findUnique({ where: { id } });
  if (!member) redirect("/company/team");

  const profile = await resolveRobloxUser(member.robloxId);
  // Roblox did not answer, or the account is gone. Leaving the row exactly as it is
  // beats overwriting a real name with nothing.
  if (!profile) redirect("/company/team?error=roblox");

  await prisma.teamMember.update({
    where: { id },
    data: {
      robloxUsername: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
    },
  });

  refreshTeam();
  redirect("/company/team?ok=refreshed");
}

export async function deleteTeamMember(formData: FormData) {
  await requireCompanyUser();

  const id = s(formData, "id");
  if (id) await prisma.teamMember.delete({ where: { id } });

  refreshTeam();
  redirect("/company/team");
}

// ---- testimonials ------------------------------------------------

export async function createTestimonial(formData: FormData) {
  await requireCompanyUser();

  const body = s(formData, "body");
  const author = s(formData, "author");
  if (!body || !author) redirect("/company/testimonials?error=required");

  const eventId = s(formData, "eventId") || null;

  await prisma.testimonial.create({
    data: {
      body: body.slice(0, 600),
      author: author.slice(0, 60),
      meta: s(formData, "meta").slice(0, 60) || null,
      // Scoped to RNL's own shows. A pasted id for a partner's event would otherwise
      // attach an RNL homepage quote to somebody else's show.
      eventId: eventId
        ? ((await prisma.event.findFirst({
            where: { id: eventId, partnerId: null },
            select: { id: true },
          }))?.id ?? null)
        : null,
      // published is NOT read from the form, and that is the point of the whole table.
      // A quote is entered, then somebody READS it and publishes it. There is no path
      // that types a quote straight onto the homepage.
    },
  });

  refreshTestimonials();
  redirect("/company/testimonials?ok=added");
}

/**
 * Turn a survey answer into a quote.
 *
 * The single highest-integrity source of testimonials this codebase can have, and it was
 * already sitting in the database. A LONG_TEXT answer to "how was the show?" was typed by
 * a real, signed-in Roblox account - SurveyResponse.robloxUsername is denormalised so it
 * survives a rename - which makes it better attributed than anything anybody could paste
 * into a form.
 *
 * It still lands UNPUBLISHED. Somebody said it, but somebody at RNL still has to decide
 * it belongs on the homepage.
 */
export async function promoteSurveyAnswer(formData: FormData) {
  await requireCompanyUser();

  const answerId = s(formData, "answerId");
  if (!answerId) redirect("/company/testimonials");

  const answer = await prisma.surveyAnswer.findUnique({
    where: { id: answerId },
    include: {
      question: { select: { type: true } },
      response: { select: { robloxUsername: true, survey: { select: { title: true } } } },
    },
  });

  // Only free text. A "4" out of five, or a "YES", is data - it is not a quote, and
  // putting one in speech marks on the homepage would be a lie about what was said.
  if (!answer || answer.question.type !== "LONG_TEXT" || !answer.value.trim()) {
    redirect("/company/testimonials?error=notaquote");
  }

  await prisma.testimonial.upsert({
    // Unique, so a double-click or a second click from a stale page updates the row it
    // already made instead of putting the same words on the homepage twice.
    where: { sourceAnswerId: answerId },
    update: {},
    create: {
      sourceAnswerId: answerId,
      body: answer.value.trim().slice(0, 600),
      author: answer.response.robloxUsername,
      meta: answer.response.survey.title.slice(0, 60),
    },
  });

  refreshTestimonials();
  redirect("/company/testimonials?ok=promoted");
}

export async function setTestimonialPublished(formData: FormData) {
  await requireCompanyUser();

  const id = s(formData, "id");
  if (id) {
    await prisma.testimonial.update({
      where: { id },
      data: { published: s(formData, "published") === "true" },
    });
  }

  refreshTestimonials();
}

export async function deleteTestimonial(formData: FormData) {
  await requireCompanyUser();

  const id = s(formData, "id");
  if (id) await prisma.testimonial.delete({ where: { id } });

  refreshTestimonials();
}

// ---- enquiries ---------------------------------------------------
//
// The inbox side only. The public WRITE lives in actions/enquiries.ts, unguarded,
// because it has to be - and keeping the two in separate files is what stops somebody
// adding a public action to this module by muscle memory and quietly opening every
// /company write to the internet. Same reason actions/applications.ts is its own file.

export async function setEnquiryStatus(formData: FormData) {
  await requireCompanyUser();

  const id = s(formData, "id");
  const status = s(formData, "status") as EnquiryStatus;
  if (id && ["NEW", "READING", "REPLIED", "CLOSED"].includes(status)) {
    await prisma.enquiry.update({ where: { id }, data: { status } });
  }

  revalidatePath("/company/enquiries");
}

export async function setEnquiryNote(formData: FormData) {
  await requireCompanyUser();

  const id = s(formData, "id");
  if (id) {
    await prisma.enquiry.update({
      where: { id },
      data: { note: s(formData, "note").slice(0, 4000) || null },
    });
  }

  revalidatePath("/company/enquiries");
}

export async function deleteEnquiry(formData: FormData) {
  await requireCompanyUser();

  const id = s(formData, "id");
  if (id) await prisma.enquiry.delete({ where: { id } });

  revalidatePath("/company/enquiries");
}
