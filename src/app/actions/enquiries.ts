"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { EnquiryKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/session";

// Somebody filling in the contact form.
//
// ---- Why this is its own file ---------------------------------------------
//
// It is a PUBLIC write - there is no requireCompanyUser() at the top of it, and there
// must not be. Every other write to RNL's own data lives in actions/company.ts, and every
// function in that file opens with a guard.
//
// Keeping the one unguarded action out of that module is the whole safety property. If it
// sat in company.ts, the next person adding an action there would copy the function above
// theirs - and a fifty-fifty chance of copying the wrong one is not a security model.
// actions/applications.ts is separate for exactly the same reason.
//
// ---- The spam problem, and why the answer is a sign-in --------------------
//
// A public contact form is the most-spammed object on the web, and this one writes
// straight to the production database. The usual answers are a captcha (a third-party
// dependency, a cookie banner's worth of privacy policy, and a wall for anyone using a
// screen reader) or a rate limiter (state we do not have anywhere to keep).
//
// This site already has a better one. It is a Roblox site, everybody on it has a Roblox
// account, and signing in with it is one click they have already done to hold a ticket. So
// sending an enquiry requires a session:
//
//   • it blocks essentially every bot, because bots do not hold Roblox OAuth sessions
//   • it fills userId for free, so the inbox knows who wrote in and can look them up
//   • it costs a real visitor nothing
//
// The one person it turns away is a journalist with no Roblox account - and they are
// handed the better channel anyway: /press carries a plain email address, deliberately,
// precisely so the press does not depend on this form.

const schema = z.object({
  kind: z.nativeEnum(EnquiryKind),
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120).optional().or(z.literal("")),
  discord: z.string().trim().max(60).optional().or(z.literal("")),
  subject: z.string().trim().min(3).max(140),
  message: z.string().trim().min(20).max(4000),
  eventDate: z.string().trim().max(80).optional().or(z.literal("")),
  scale: z.string().trim().max(80).optional().or(z.literal("")),
});

/** How many open enquiries one account may have before it has to wait for a reply. */
const OPEN_LIMIT = 3;

/**
 * Where a form may send somebody back to, and the anchor to land them on.
 *
 * An ALLOWLIST, not a sanitised string. The form posts where it came from so that
 * submitting the booking form on /services does not dump you on /contact - but "a path
 * from the request body that we then redirect to" is the exact shape of an open redirect,
 * and the only version of that check which cannot be outsmarted is one that compares
 * against a fixed set of keys.
 *
 * Anything unrecognised falls back to /contact. There is no escape hatch and no
 * "startsWith('/')" cleverness.
 */
const RETURNS: Record<string, string> = {
  "/contact": "#form",
  "/services": "#book",
};

const returnTo = (form: FormData) => {
  const from = String(form.get("from") ?? "");
  return from in RETURNS ? from : "/contact";
};

/**
 * Bounce back to the form with a reason.
 *
 * A FUNCTION DECLARATION with an explicit `never`, and both halves of that are
 * load-bearing. redirect() throws, so nothing after a call to this ever runs - but
 * TypeScript only propagates that fact through control flow when the callee is a function
 * declaration (or a const with an explicit type annotation) that is *declared* to return
 * never. Write it as a plain `const back = (p) => redirect(...)` and the compiler keeps
 * insisting that `parsed.data` might be undefined below, and the tempting fix is a row of
 * `!` assertions papering over a fact it was simply never told.
 */
function back(path: string, params: string): never {
  redirect(`${path}?${params}${RETURNS[path]}`);
}

export async function submitEnquiry(formData: FormData) {
  const from = returnTo(formData);
  // The honeypot. A hidden field no human can see and therefore no human ever fills in;
  // a bot walks the DOM and fills everything.
  //
  // On a hit we redirect to the SUCCESS page and write nothing. Never tell a bot it
  // failed - an error is a signal it can tune against, and the operator gets to spend
  // their afternoon watching it try again with the field left blank. As far as this one
  // is concerned, it worked.
  if (String(formData.get("website") ?? "").trim() !== "") {
    back(from, "sent=1");
  }

  // The guard, such as it is. Not an authorisation check - anybody signed in may write to
  // us, which is the point of a contact form - but an identity one.
  const session = await getUserSession();
  if (!session) back(from, "error=signin");

  const parsed = schema.safeParse({
    kind: formData.get("kind"),
    name: formData.get("name"),
    email: formData.get("email") ?? "",
    discord: formData.get("discord") ?? "",
    subject: formData.get("subject"),
    message: formData.get("message"),
    eventDate: formData.get("eventDate") ?? "",
    scale: formData.get("scale") ?? "",
  });
  if (!parsed.success) back(from, "error=invalid");

  const data = parsed.data;

  // At least one way to reply. Enforced HERE rather than in the schema, because "one of
  // these two columns must be present" is a CHECK constraint, and `prisma db push` drops
  // hand-written constraints on every boot - see the note on Enquiry.email. A rule the
  // database forgets on Tuesday is worse than a rule the code enforces every time.
  const email = data.email || null;
  const discord = data.discord || null;
  if (!email && !discord) back(from, "error=contact");

  // A real person with three unanswered enquiries does not have a fourth thing to say -
  // they have an unanswered enquiry. This is the cheap backstop for the case the sign-in
  // does not cover: a genuine account being used to flood the inbox.
  const open = await prisma.enquiry.count({
    where: {
      userId: session.uid,
      status: { in: ["NEW", "READING"] },
    },
  });
  if (open >= OPEN_LIMIT) back(from, "error=toomany");

  await prisma.enquiry.create({
    data: {
      // Safe to take from the body: `kind` authorises nothing, it only decides which pile
      // the row lands in. Contrast a partner scope, which decides whose data you can
      // touch and is therefore never read from a form.
      kind: data.kind,
      name: data.name,
      email,
      discord,
      userId: session.uid,
      subject: data.subject,
      message: data.message,
      // Only meaningful on a booking, and the form only shows them there - but a stray
      // value on another kind is harmless, so there is no branch here to get wrong.
      eventDate: data.eventDate || null,
      scale: data.scale || null,
    },
  });

  back(from, "sent=1");
}
