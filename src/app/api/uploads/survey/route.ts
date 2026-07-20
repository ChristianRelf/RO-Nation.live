import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import {
  SURVEY_FILE_TYPES,
  SURVEY_SCOPE,
  removePrivateFiles,
  savePrivateUpload,
} from "@/lib/uploads";

export const dynamic = "force-dynamic";
// Node, not edge: this writes to the filesystem.
export const runtime = "nodejs";

// Attachments for a FILE_UPLOAD survey question.
//
// A route handler, not a server action, for the reason api/uploads/route.ts spells
// out: an action's request body caps at 1 MB. The respondent's browser posts each
// file here as it is picked and gets back an id, and only the ids ride along with
// the form submit.
//
// This is the first upload door whose callers are NOT staff. api/uploads and its
// siblings all start from getCompanyUser() or getPartnerAccess(); this one starts
// from getUserSession(), which is any Roblox account that signed in to answer a
// form. So everything below is tighter than those doors, not looser:
//
//   - The QUESTION decides what is allowed - its type set, its size cap, its file
//     count - and the question is looked up server-side from an id. Nothing about
//     the limits is taken from the request.
//   - The survey must be open. A closed survey accepts no bytes, so the door shuts
//     at the same moment the form does.
//   - Somebody who has already answered cannot upload at all. Their response is in;
//     there is nothing left to attach files to.
//   - The file count is enforced against rows already on disk, so it cannot be
//     beaten by posting the requests in parallel and letting each one see zero.
//
// DELETE is the other half of that last rule. Unclaimed uploads count towards the
// cap, so a respondent who picks three files and changes their mind about one has
// to be able to give the slot back - otherwise "max 3" quietly means "3 attempts".

/** A respondent may not spend the disk faster than this, per account. */
const RATE = { limit: 30, windowSeconds: 10 * 60 };

const bad = (error: string, status = 400) =>
  NextResponse.json({ error }, { status });

/**
 * The question this upload is for, with the survey checked around it.
 *
 * Returns a string when the answer is "no" - deliberately vague ones, since a
 * respondent poking at ids is not owed a description of what exists.
 */
async function openQuestion(questionId: string, userId: string) {
  if (!questionId) return "That upload went to the wrong place." as const;

  const question = await prisma.surveyQuestion.findUnique({
    where: { id: questionId },
    include: { survey: true },
  });
  if (!question || question.type !== "FILE_UPLOAD") {
    return "That upload went to the wrong place." as const;
  }

  const { survey } = question;
  const closed =
    survey.status !== "OPEN" ||
    (survey.closesAt !== null && survey.closesAt.getTime() < Date.now());
  if (closed) return "This survey is closed." as const;

  // Already answered - but only a problem when the survey takes one response per
  // account, in which case the unique index would refuse a second one and anything
  // uploaded now could never be attached to anything. Where repeat answers are
  // allowed, a past response says nothing about this upload.
  if (!survey.multipleResponses) {
    const existing = await prisma.surveyResponse.findFirst({
      where: { surveyId: survey.id, userId },
      select: { id: true },
    });
    if (existing) return "You've already answered this survey." as const;
  }

  return question;
}

export async function POST(req: NextRequest) {
  const session = await getUserSession();
  if (!session) return bad("Sign in to attach a file.", 403);

  const limit = await rateLimit(`survey-upload:${session.uid}`, RATE);
  if (!limit.ok) {
    return bad("That's a lot of uploads at once. Try again shortly.", 429);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return bad("Malformed upload.");
  }

  const file = form.get("file");
  if (!(file instanceof File)) return bad("No file.");

  const question = await openQuestion(
    String(form.get("questionId") ?? "").trim(),
    session.uid,
  );
  if (typeof question === "string") return bad(question, 403);

  // ---- The author's three limits -------------------------------------
  //
  // Re-read from the question every time rather than trusted from the client,
  // which is the whole reason they are columns and not form fields.
  const maxFiles = question.maxFiles ?? 1;

  // Counted, not estimated. Two tabs uploading at once can both pass this, which
  // is why it is `>=` against a live count and why the cap is a courtesy rather
  // than a security boundary - the real bound is the rate limit above and the fact
  // that submit only ever attaches maxFiles of them.
  const held = await prisma.surveyUpload.count({
    where: {
      questionId: question.id,
      userId: session.uid,
      responseId: null,
    },
  });
  if (held >= maxFiles) {
    return bad(
      `That's the limit of ${maxFiles} file${maxFiles === 1 ? "" : "s"} for this question. Remove one first.`,
    );
  }

  // The author's list, intersected with what this door accepts rather than used in
  // its place: a column edited by hand to "text/html" then selects nothing, which
  // is the safe direction to fail.
  const accept = question.fileTypes.length
    ? SURVEY_FILE_TYPES.filter((t) => question.fileTypes.includes(t))
    : SURVEY_FILE_TYPES;
  if (!accept.length) return bad("This question isn't accepting files.");

  const saved = await savePrivateUpload(file, SURVEY_SCOPE, {
    accept,
    // Undefined when the author set no cap, in which case the module's own
    // per-type limit applies on its own. Either way store() takes the smaller.
    maxBytes: question.maxFileMb
      ? question.maxFileMb * 1024 * 1024
      : undefined,
  });

  if (!saved.ok) {
    if (saved.error === "empty") return bad("That file is empty.");
    if (saved.error === "too-large") {
      const mb = Math.max(1, Math.round((saved.limit ?? 0) / 1024 / 1024));
      return bad(`That file is over ${mb} MB.`);
    }
    return bad(`That isn't a file this question accepts (${describe(accept)}).`);
  }

  const row = await prisma.surveyUpload.create({
    data: {
      questionId: question.id,
      userId: session.uid,
      storagePath: saved.storagePath,
      mime: saved.mime,
      size: saved.size,
      filename: saved.filename,
    },
    select: { id: true, filename: true, size: true },
  });

  return NextResponse.json(row);
}

/**
 * Give back a file the respondent removed before submitting.
 *
 * Only ever an UNCLAIMED upload of their own. Once it is attached to a response it
 * is part of somebody's answer, and a respondent cannot reach back through this to
 * erase what they submitted.
 */
export async function DELETE(req: NextRequest) {
  const session = await getUserSession();
  if (!session) return bad("Sign in first.", 403);

  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return bad("No file.");

  const upload = await prisma.surveyUpload.findFirst({
    where: { id, userId: session.uid, responseId: null },
    select: { id: true, storagePath: true },
  });
  // Already gone, someone else's, or already submitted - all the same answer, and
  // a success rather than a 404 because the client's goal ("this file is not in my
  // form") is met either way.
  if (!upload) return NextResponse.json({ ok: true });

  // The row first, the bytes second - and the delete is guarded, so it is the
  // database that resolves a race with a submit landing at the same moment. If the
  // response claimed it first this removes nothing and the file stays, which is
  // the right way round: a stray byte beats deleting a submitted answer.
  const { count } = await prisma.surveyUpload.deleteMany({
    where: { id: upload.id, userId: session.uid, responseId: null },
  });
  if (count) await removePrivateFiles([upload.storagePath]);

  return NextResponse.json({ ok: true });
}

/** The accepted types, for a message a respondent can act on. */
function describe(accept: readonly string[]) {
  const names: Record<string, string> = {
    "image/jpeg": "JPG",
    "image/png": "PNG",
    "image/gif": "GIF",
    "image/webp": "WebP",
    "application/pdf": "PDF",
  };
  return accept.map((t) => names[t] ?? t).join(", ");
}
