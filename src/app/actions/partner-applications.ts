"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { PartnerAccountKind, PartnerApplicationStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/session";
import { cleanOfferIds } from "@/lib/partner-program";
import { notify } from "@/lib/notify";
import { rateLimit } from "@/lib/rate-limit";

// Somebody asking to become a partner, from partner.ronation.live/join/new.
//
// ---- Why this is its own file ---------------------------------------------
//
// It is a PUBLIC write. There is no requireCompanyUser() at the top of it and there must
// not be - the whole point is that a stranger can do it. Every staff-side write about
// partnerships lives in actions/partner-invites.ts, and every function in that file opens
// with a guard.
//
// Keeping the one unguarded action out of the guarded module is the safety property.
// Sitting side by side, the next person adding an action copies whichever one is nearest,
// and a fifty-fifty chance of copying the wrong one is not a security model. This is the
// same split, for the same reason, as actions/enquiries.ts and actions/applications.ts.
//
// ---- Two walls, because this one is worth spamming ------------------------
//
// A public form that writes to production is the most-attacked object on any site, and
// this one asks to be given a commercial relationship. It gets both walls the codebase
// already has, and no third-party captcha:
//
//   1. A SESSION. This is a Roblox site; everybody real here already has an account and
//      has already clicked through the sign-in once. It blocks essentially every bot,
//      because bots do not hold Roblox OAuth sessions, and it costs a genuine applicant
//      nothing. The long version of this argument is in actions/enquiries.ts.
//
//   2. A RATE LIMIT, keyed on the Roblox id. The session wall stops anonymous floods; it
//      does not stop one account submitting the same application forty times, which is
//      what actually happens when a form appears not to have worked.
//
// And one product rule that is not about abuse at all: ONE OPEN APPLICATION per account.
// Somebody who wrote in last week and is waiting should be told they are waiting, not
// allowed to file a second copy that lands under the first and makes RNL look like it
// ignored both.

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  kind: z.nativeEnum(PartnerAccountKind),
  email: z.string().trim().email().max(160).optional().or(z.literal("")),
  discord: z.string().trim().max(80).optional().or(z.literal("")),
  robloxGroupUrl: z.string().trim().url().max(300).optional().or(z.literal("")),
  audience: z.string().trim().max(120).optional().or(z.literal("")),
  about: z.string().trim().min(40).max(4000),
  want: z.string().trim().min(20).max(4000),
});

/** How many applications one Roblox account may file in a day, open or not. */
const RATE = { limit: 5, windowSeconds: 24 * 60 * 60 };

/**
 * The statuses that mean "we have not finished with this yet".
 *
 * ACCEPTED is on the list as well as NEW and REVIEWING, and that is deliberate: an
 * accepted application has an invite attached, and the answer to "can I apply again" for
 * somebody holding an unclaimed invitation is "you already have one - open it".
 */
const OPEN_STATUSES = [
  PartnerApplicationStatus.NEW,
  PartnerApplicationStatus.REVIEWING,
  PartnerApplicationStatus.ACCEPTED,
];

const back = (error: string) => redirect(`/join/new?error=${error}`);

export async function submitPartnerApplication(formData: FormData) {
  const session = await getUserSession();
  // Not a redirect to the sign-in: the page renders the form for anonymous visitors on
  // purpose (they need to read what they are signing in FOR), and the submit button is
  // already replaced by a sign-in link there. Reaching this line without a session means
  // a hand-posted form, and it gets the flat refusal rather than a guided tour.
  if (!session) return back("session");

  const limit = await rateLimit(`partner-application:${session.robloxId}`, RATE);
  if (!limit.ok) return back("rate");

  const parsed = schema.safeParse({
    name: formData.get("name"),
    kind: String(formData.get("kind") ?? "").toUpperCase(),
    email: formData.get("email"),
    discord: formData.get("discord"),
    robloxGroupUrl: formData.get("robloxGroupUrl"),
    audience: formData.get("audience"),
    about: formData.get("about"),
    want: formData.get("want"),
  });
  if (!parsed.success) return back("invalid");

  const data = parsed.data;

  // At least one way to reach them that is not Roblox. The schema cannot express this -
  // both fields are individually optional - and it matters: RNL's reply to this is a
  // conversation, and a Roblox id is not somewhere a conversation can happen.
  if (!data.email && !data.discord) return back("contact");

  const open = await prisma.partnerApplication.findFirst({
    where: { robloxId: session.robloxId, status: { in: OPEN_STATUSES } },
    select: { id: true },
  });
  if (open) return back("open");

  // Intersected against the programme's own list rather than trusted. The form renders
  // checkboxes from PROGRAMME_OFFERS, so a well-behaved browser can only send those ids -
  // and a hand-posted body can send anything at all, which is the case this is for.
  const interests = cleanOfferIds(formData.getAll("interests"));

  await prisma.partnerApplication.create({
    data: {
      robloxId: session.robloxId,
      username: session.username,
      displayName: session.displayName,
      name: data.name,
      kind: data.kind,
      email: data.email || null,
      discord: data.discord || null,
      robloxGroupUrl: data.robloxGroupUrl || null,
      audience: data.audience || null,
      about: data.about,
      want: data.want,
      interests,
    },
  });

  // Best-effort, exactly as the enquiry form's is. An application that was written to the
  // database but whose Discord ping failed is an application RNL still has; throwing here
  // would lose it AND tell the applicant it did not send.
  await notify({
    title: "New partnership request",
    description: data.want.slice(0, 400),
    fields: [
      { name: "Who", value: data.name, inline: true },
      {
        name: "Kind",
        value: data.kind === PartnerAccountKind.COMPANY ? "Company" : "Person",
        inline: true,
      },
      { name: "Submitted by", value: session.displayName, inline: true },
    ],
    url: "/company/partnerships",
  }).catch(() => {});

  redirect("/join/thanks");
}
