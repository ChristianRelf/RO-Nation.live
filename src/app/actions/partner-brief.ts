"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { PartnerSiteBriefStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { cleanFeatures, slugVerdict } from "@/lib/partners/registry";
import { cleanHex, FONT_DIRECTION_IDS } from "@/lib/partner-brief";
import { s } from "@/lib/content";

// Saving a partner's site brief, from partner.ronation.live/onboard/site/<uuid>.
//
// ---- Unguarded, and deliberately so ---------------------------------------
//
// Like actions/partner-applications.ts, this file holds a PUBLIC write and holds nothing
// else. There is no requireCompanyUser() and no requirePartnerAccount() at the top of
// these functions, because the person filling in a brief very often has neither: the link
// gets forwarded to whoever actually knows the brand.
//
// The authorisation is the TOKEN, and the rules that make that safe are the same three the
// upload route lists:
//
//   • The token names the brief. Never a briefId from the form - one valid token would
//     otherwise be a key to every brief in the table.
//   • A wrong token does nothing and says nothing. No "that brief is not yours".
//   • Nothing here can grant anything. A brief is a description; it creates no account,
//     opens no door and moves no money. That is what makes a bearer link the right shape
//     for it, and it is the property to check before adding a field.
//
// Staff-side writes about partnerships live in actions/partner-invites.ts, behind
// requireCompanyUser(), and the .zip comes off a route that checks company rank.

const schema = z.object({
  siteName: z.string().trim().max(120).optional().or(z.literal("")),
  shortName: z.string().trim().max(60).optional().or(z.literal("")),
  tagline: z.string().trim().max(200).optional().or(z.literal("")),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  disclaimer: z.string().trim().max(1000).optional().or(z.literal("")),
  robloxGroupUrl: z.string().trim().url().max(300).optional().or(z.literal("")),
  moodNotes: z.string().trim().max(4000).optional().or(z.literal("")),
  contactName: z.string().trim().max(120).optional().or(z.literal("")),
  contactEmail: z.string().trim().email().max(160).optional().or(z.literal("")),
  contactDiscord: z.string().trim().max(80).optional().or(z.literal("")),
});

/** How many reference links a brief may carry. Enough to be useful, finite to be safe. */
const MAX_REFERENCES = 8;

/**
 * Ticket codes read <PREFIX>-XXXXXX, so the prefix has to be short, loud and unambiguous.
 * Upper-cased rather than refused for being lowercase - a partner typing "st" means "ST".
 */
function cleanPrefix(input: string): string | null {
  const v = input.trim().toUpperCase();
  return /^[A-Z]{2,6}$/.test(v) ? v : null;
}

/**
 * The reference links, cleaned.
 *
 * Parsed from one textarea, one per line, because asking for eight URL fields is asking
 * for one URL. Anything that is not a URL is dropped silently rather than failing the
 * whole save: this is the field people paste half-remembered things into, and losing a
 * brief's worth of typing over a stray line would be a poor trade.
 */
function cleanReferences(input: string): string[] {
  const out: string[] = [];
  for (const line of input.split(/\r?\n/)) {
    const v = line.trim();
    if (!v || v.length > 300) continue;
    try {
      const url = new URL(v);
      // http(s) only. A javascript: or data: URL in a field that staff will click out of
      // the desk is the one thing here worth being strict about.
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      out.push(url.toString());
    } catch {
      continue;
    }
    if (out.length >= MAX_REFERENCES) break;
  }
  return out;
}

const back = (token: string, params: string) =>
  redirect(`/onboard/site/${token}${params}`);

/**
 * Save the brief, and optionally hand it in.
 *
 * ONE action for both, rather than a save and a separate submit, because they write the
 * same fields and a submit that did not save would hand in whatever was there last time.
 * The button pressed decides only whether `submittedAt` gets set.
 */
export async function savePartnerBrief(formData: FormData) {
  const token = s(formData, "token");
  if (!token) redirect("/");

  const brief = await prisma.partnerSiteBrief.findUnique({
    where: { token },
    select: { id: true, submittedAt: true },
  });
  // Silent. A bad token gets the same nothing a probe gets - and a real holder whose link
  // was revoked sees the page's own explanation, not a redirect loop.
  if (!brief) redirect("/");

  const parsed = schema.safeParse({
    siteName: formData.get("siteName"),
    shortName: formData.get("shortName"),
    tagline: formData.get("tagline"),
    description: formData.get("description"),
    disclaimer: formData.get("disclaimer"),
    robloxGroupUrl: formData.get("robloxGroupUrl"),
    moodNotes: formData.get("moodNotes"),
    contactName: formData.get("contactName"),
    contactEmail: formData.get("contactEmail"),
    contactDiscord: formData.get("contactDiscord"),
  });
  if (!parsed.success) back(token, "?error=invalid");

  const d = parsed.data!;

  // The subdomain gets the registry's own verdict, at the moment it is typed rather than
  // at deploy. Refusing here is the courtesy that matters most on this form: a name a
  // partner has been told they are getting, designed a logo around and announced is not
  // something to discover is taken three weeks later. See slugVerdict().
  const rawSlug = s(formData, "slug").toLowerCase();
  let slug: string | null = null;
  if (rawSlug) {
    const verdict = slugVerdict(rawSlug);
    if (verdict !== "ok") back(token, `?error=slug&verdict=${verdict}`);
    slug = rawSlug;
  }

  const fontRaw = s(formData, "fontChoice");
  const submit = s(formData, "intent") === "submit";

  await prisma.partnerSiteBrief.update({
    where: { id: brief.id },
    data: {
      slug,
      siteName: d.siteName || null,
      shortName: d.shortName || null,
      tagline: d.tagline || null,
      description: d.description || null,
      disclaimer: d.disclaimer || null,
      ticketPrefix: cleanPrefix(s(formData, "ticketPrefix")),
      robloxGroupUrl: d.robloxGroupUrl || null,
      features: cleanFeatures(formData.getAll("features")),
      accentColour: cleanHex(s(formData, "accentColour")),
      accentInkColour: cleanHex(s(formData, "accentInkColour")),
      fontChoice: FONT_DIRECTION_IDS.includes(fontRaw) ? fontRaw : null,
      moodNotes: d.moodNotes || null,
      referenceUrls: cleanReferences(s(formData, "referenceUrls")),
      contactName: d.contactName || null,
      contactEmail: d.contactEmail || null,
      contactDiscord: d.contactDiscord || null,
      ...(submit
        ? {
            status: PartnerSiteBriefStatus.SUBMITTED,
            // Set once. A later edit does not move it - "when did we get this" is a
            // different question from "when did they last touch it", and updatedAt
            // already answers the second.
            submittedAt: brief.submittedAt ?? new Date(),
          }
        : {}),
    },
  });

  back(token, submit ? "?ok=submitted" : "?ok=saved");
}
