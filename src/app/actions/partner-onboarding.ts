"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePartnerAccount } from "@/lib/partner-account";
import { cleanOfferIds } from "@/lib/partner-program";
import {
  ONBOARDING_STEPS,
  LAST_STEP,
  completeOnboarding,
  reachStep,
  startOnboarding,
  stepIndex,
} from "@/lib/partner-onboarding";
import { prisma } from "@/lib/db";
import { s } from "@/lib/content";

// The guided setup at partner.ronation.live/onboard.
//
// Every function here opens with requirePartnerAccount() - the same guard the hub uses -
// and writes ONLY to the row belonging to the account that guard returned. The
// partnerAccountId is never read from the form, which is the whole authorisation story:
// there is no id in the body to tamper with, so there is no way to write somebody else's
// onboarding row.
//
// ---- Advancing is a write, not a link -------------------------------------
//
// Even the steps that gather nothing post back here. It would be simpler to make "Next" an
// <a href>, and it would silently break resuming: the row would only ever record the steps
// that happened to have a form on them, so somebody who stopped after reading the
// agreements would come back to step two. The step counter has to advance on every step or
// it does not mean what it says.

const detailsSchema = z.object({
  contactName: z.string().trim().max(120).optional().or(z.literal("")),
  contactEmail: z.string().trim().email().max(160).optional().or(z.literal("")),
  contactDiscord: z.string().trim().max(80).optional().or(z.literal("")),
  robloxGroupUrl: z.string().trim().url().max(300).optional().or(z.literal("")),
  timezone: z.string().trim().max(60).optional().or(z.literal("")),
  about: z.string().trim().max(4000).optional().or(z.literal("")),
});

/** Where the flow goes after a step. `null` when there is no next one. */
function nextSlug(index: number): string | null {
  return index >= LAST_STEP ? null : ONBOARDING_STEPS[index + 1].slug;
}

/**
 * Move on from a step that gathers nothing - welcome, agreements, and the last one.
 *
 * `from` is the slug of the step being left, validated against the list rather than
 * trusted as a number. A form posting `step=99` is otherwise a partner marked as having
 * completed a flow they have not seen.
 */
export async function advanceOnboarding(formData: FormData) {
  const user = await requirePartnerAccount();
  await startOnboarding(user.account.id);

  const index = stepIndex(s(formData, "from"));
  if (index < 0) redirect("/onboard");

  const next = nextSlug(index);

  if (!next) {
    await completeOnboarding(user.account.id);
    // Out of the flow entirely. The last step's own page is reachable again afterwards
    // (canOpenStep opens everything once completedAt is set), but the thing somebody
    // wants after finishing setup is the area they just set up.
    redirect("/hub");
  }

  await reachStep(user.account.id, index + 1);
  redirect(`/onboard/${next}`);
}

/** Step two: which parts of the programme they want switched on. */
export async function saveOnboardingInterests(formData: FormData) {
  const user = await requirePartnerAccount();
  await startOnboarding(user.account.id);

  const index = stepIndex("programme");
  const interests = cleanOfferIds(formData.getAll("interests"));

  await prisma.partnerOnboarding.update({
    where: { partnerAccountId: user.account.id },
    data: { interests },
  });

  await reachStep(user.account.id, index + 1);
  redirect(`/onboard/${nextSlug(index)}`);
}

/** Step three: how to reach them, and what they run. */
export async function saveOnboardingDetails(formData: FormData) {
  const user = await requirePartnerAccount();
  await startOnboarding(user.account.id);

  const index = stepIndex("details");

  const parsed = detailsSchema.safeParse({
    contactName: formData.get("contactName"),
    contactEmail: formData.get("contactEmail"),
    contactDiscord: formData.get("contactDiscord"),
    robloxGroupUrl: formData.get("robloxGroupUrl"),
    timezone: formData.get("timezone"),
    about: formData.get("about"),
  });
  // Back to the step with a reason rather than onwards. Nothing here is required - a
  // partner may legitimately leave every box empty and move on - so the only way to fail
  // is a malformed email or group URL, and silently dropping either would be worse than
  // saying so.
  if (!parsed.success) redirect("/onboard/details?error=invalid");

  const d = parsed.data;

  await prisma.partnerOnboarding.update({
    where: { partnerAccountId: user.account.id },
    data: {
      contactName: d.contactName || null,
      contactEmail: d.contactEmail || null,
      contactDiscord: d.contactDiscord || null,
      robloxGroupUrl: d.robloxGroupUrl || null,
      timezone: d.timezone || null,
      about: d.about || null,
    },
  });

  await reachStep(user.account.id, index + 1);
  redirect(`/onboard/${nextSlug(index)}`);
}
