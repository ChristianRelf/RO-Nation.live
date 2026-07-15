"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/session";
import { notify } from "@/lib/notify";
import { rateLimit } from "@/lib/rate-limit";
import { DATA_REQUEST_VALUES, dataRequestLabel } from "@/lib/data-request";

// Somebody submitting a privacy / data request from /legal/data-request/request/new.
//
// This is a deliberate near-copy of actions/enquiries.ts, and for the same reasons: it is a
// PUBLIC write with no requireCompanyUser() at the top, so it lives in its own file rather
// than in actions/company.ts where every other function opens with a guard - keeping the one
// unguarded write out of that module IS the safety property.
//
// It files into the SAME inbox as an enquiry (an Enquiry row, kind = DATA), because a data
// request is the same shape of thing from the inside: a message from outside that a human has
// to action. Tagging it DATA is what lets the /company/enquiries inbox filter the legal
// requests - which carry statutory deadlines - apart from a booking.
//
// ---- Why a sign-in is required, and what it buys here ---------------------
//
// A data request is a request to hand over, change, or delete personal data - so the ONE
// thing that must not happen is acting on it for the wrong person. Requiring the Roblox
// sign-in that every member already has does three jobs at once: it proves the request comes
// from the account it concerns (identity, which a bare form cannot give), it blocks the bots
// that flood any public write, and it binds userId so staff can find the exact account.
//
// Someone genuinely locked out of their account cannot use this form - and that case is
// handled off it: /legal/data-requests documents the contact email as the alternative, and
// staff verify ownership another way before acting. The form is the fast path, not the only
// one.

const schema = z.object({
  type: z.enum(DATA_REQUEST_VALUES),
  robloxUsername: z.string().trim().min(2).max(60),
  email: z.string().trim().email().max(120).optional().or(z.literal("")),
  discord: z.string().trim().max(60).optional().or(z.literal("")),
  details: z.string().trim().max(4000).optional().or(z.literal("")),
});

/** How many open data requests one account may have before it waits for a reply. */
const OPEN_LIMIT = 2;

// The one page this form posts from. An allowlist key, never a path taken from the body and
// redirected to - see the same guard in actions/enquiries.ts.
const FORM_PATH = "/legal/data-request/request/new";
const RETURNS: Record<string, string> = { [FORM_PATH]: "#form" };

/**
 * Bounce back to the form with a reason. A function declaration returning `never`, both
 * halves load-bearing - redirect() throws, and TypeScript only propagates that through
 * control flow for a declared-never callee. See the long note in actions/enquiries.ts.
 */
function back(params: string): never {
  redirect(`${FORM_PATH}?${params}${RETURNS[FORM_PATH]}`);
}

export async function submitDataRequest(formData: FormData) {
  // The honeypot. A hidden field no human sees; a bot fills every input it finds. On a hit
  // we redirect to success and write nothing - never tell a bot it failed.
  if (String(formData.get("website") ?? "").trim() !== "") back("sent=1");

  // Identity, not authorisation. Anybody signed in may ask about their own data - that is
  // the point - but it must be somebody, and a known somebody.
  const session = await getUserSession();
  if (!session) back("error=signin");

  // Burst guard on top of the sign-in and the open-request cap below. A real person does not
  // file five data requests in ten minutes; a script does.
  const rl = await rateLimit(`datareq:${session.uid}`, {
    limit: 5,
    windowSeconds: 600,
  });
  if (!rl.ok) back("error=toomany");

  const parsed = schema.safeParse({
    type: formData.get("type"),
    robloxUsername: formData.get("robloxUsername"),
    email: formData.get("email") ?? "",
    discord: formData.get("discord") ?? "",
    details: formData.get("details") ?? "",
  });
  if (!parsed.success) back("error=invalid");

  const data = parsed.data;

  // At least one way to reach them back. A data request we cannot answer is not a request we
  // can honour - we have to be able to tell them it is done, or ask them to verify ownership.
  const email = data.email || null;
  const discord = data.discord || null;
  if (!email && !discord) back("error=contact");

  // A real person with two open data requests does not have a third; they have two we have
  // not answered. Cheap backstop for a genuine account being used to flood the inbox.
  const open = await prisma.enquiry.count({
    where: { userId: session.uid, kind: "DATA", status: { in: ["NEW", "READING"] } },
  });
  if (open >= OPEN_LIMIT) back("error=toomany");

  const label = dataRequestLabel(data.type);

  // Compose the request into the enquiry's subject and message so no new columns are needed:
  // the inbox already renders subject + message, and this keeps the structured facts (which
  // right, which account) legible to whoever picks the request up.
  const message = [
    `Request type: ${label}`,
    `Roblox account named: ${data.robloxUsername}`,
    `Signed in as: ${session.username} (${session.robloxId})`,
    "",
    data.details ? data.details : "(no further detail given)",
  ].join("\n");

  await prisma.enquiry.create({
    data: {
      // Safe from the body: kind only files the row, it authorises nothing. `type` was
      // validated against a fixed enum above.
      kind: "DATA",
      name: session.username,
      email,
      discord,
      userId: session.uid,
      subject: `Data request · ${label}`,
      message,
    },
  });

  // Ping the inbox. Fire-and-forget: notify() never throws and is not awaited, so a down
  // webhook cannot turn a saved request into an error. Started before the redirect, which
  // throws.
  void notify({
    partnerId: null,
    title: `Data request · ${label}`,
    description: data.details || "(no further detail given)",
    url: "/company/enquiries?kind=DATA",
    fields: [
      { name: "Account", value: `${session.username} (${session.robloxId})`, inline: true },
      { name: "Type", value: label, inline: true },
      ...(email ? [{ name: "Email", value: email, inline: true }] : []),
      ...(discord ? [{ name: "Discord", value: discord, inline: true }] : []),
    ],
  });

  back("sent=1");
}
