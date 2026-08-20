"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  PartnerApplicationStatus,
  PartnerInviteStatus,
} from "@prisma/client";
import { unlink } from "fs/promises";
import { prisma } from "@/lib/db";
import { PRIVATE_UPLOAD_DIR, resolveInRoot } from "@/lib/uploads";
import { requireCompanyUser } from "@/lib/company";
import { getUserSession } from "@/lib/session";
import {
  claimInvite,
  inviteExpiry,
  inviteKind,
  newInviteCode,
  INVITE_DAYS,
} from "@/lib/partner-invites";
import { s } from "@/lib/content";

// The staff side of the partner funnel, all of it: triaging the applications that come in,
// cutting the invitations that answer them, and raising the site briefs RNL builds from.
// Plus the ONE thing here a member of the public does - claiming an invite - which is at
// the bottom of this file and clearly labelled.
//
// The two PUBLIC counterparts live apart from this on purpose, each alone in its own file:
// actions/partner-applications.ts (somebody asking) and actions/partner-brief.ts, singular
// (somebody filling one in). Nothing unguarded belongs in here.
//
// Every staff function opens with requireCompanyUser(). A page that hides a button is not
// a permission, and the buttons here mint accounts.
//
// The public write that is NOT here is the application form itself; it lives alone in
// actions/partner-applications.ts, for the reason set out at the top of that file.

const DESK = "/company/partnerships";
const one = (id: string, params = "") => `${DESK}/${id}${params}`;

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

export async function createPartnerInvite(formData: FormData) {
  const user = await requireCompanyUser();

  const label = s(formData, "label");
  const note = s(formData, "note");
  const days = Number(s(formData, "days")) || INVITE_DAYS;
  // The application this answers, when the invite is being cut FROM one. Optional - staff
  // also invite people who never applied, which is the whole point of having invites.
  const applicationId = s(formData, "applicationId");

  if (!label) redirect(`${DESK}?error=label`);

  const invite = await prisma.partnerInvite.create({
    data: {
      label,
      kind: inviteKind(s(formData, "kind")),
      note: note || null,
      expiresAt: inviteExpiry(days),
      issuedByRobloxId: user.robloxId,
      issuedByName: user.displayName,
    },
  });

  if (applicationId) {
    // updateMany rather than update: an application id that does not exist, or one that
    // somebody else has already answered, should not throw and lose the invite that was
    // just created. The invite is the valuable half; the link is bookkeeping.
    await prisma.partnerApplication.updateMany({
      where: { id: applicationId, inviteId: null },
      data: { status: PartnerApplicationStatus.ACCEPTED, inviteId: invite.id },
    });
  }

  revalidatePath(DESK);
  redirect(`${DESK}?ok=invited&invite=${invite.id}`);
}

export async function revokePartnerInvite(formData: FormData) {
  await requireCompanyUser();

  const id = s(formData, "id");
  if (!id) redirect(`${DESK}?error=missing`);

  // Only a PENDING invite can be revoked. Revoking a CLAIMED one would say nothing true -
  // the account it created still exists, and taking access away is a different act done
  // from /company/partner-accounts.
  await prisma.partnerInvite.updateMany({
    where: { id, status: PartnerInviteStatus.PENDING },
    data: { status: PartnerInviteStatus.REVOKED },
  });

  revalidatePath(DESK);
  redirect(`${DESK}?ok=revoked`);
}

/**
 * Re-roll the code on an unclaimed invite.
 *
 * For the case that actually happens: the link went to the wrong person, or into a channel
 * it should not have been in. Revoking and cutting a new one would work, but leaves the
 * desk holding two rows for one invitation and loses the note. This keeps the row and
 * makes the old URL dead in the same statement.
 */
export async function rerollPartnerInvite(formData: FormData) {
  await requireCompanyUser();

  const id = s(formData, "id");
  if (!id) redirect(`${DESK}?error=missing`);

  await prisma.partnerInvite.updateMany({
    where: { id, status: PartnerInviteStatus.PENDING },
    data: { code: newInviteCode(), expiresAt: inviteExpiry(INVITE_DAYS) },
  });

  revalidatePath(DESK);
  redirect(`${DESK}?ok=rerolled`);
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

export async function setApplicationStatus(formData: FormData) {
  await requireCompanyUser();

  const id = s(formData, "id");
  const status = s(formData, "status").toUpperCase();
  if (!id) redirect(`${DESK}?error=missing`);
  if (!(status in PartnerApplicationStatus)) redirect(one(id, "?error=status"));

  await prisma.partnerApplication.update({
    where: { id },
    data: { status: status as PartnerApplicationStatus },
  });

  revalidatePath(DESK);
  revalidatePath(one(id));
  redirect(one(id, "?ok=status"));
}

export async function setApplicationNote(formData: FormData) {
  await requireCompanyUser();

  const id = s(formData, "id");
  const note = s(formData, "note");
  if (!id) redirect(`${DESK}?error=missing`);

  await prisma.partnerApplication.update({
    where: { id },
    data: { note: note || null },
  });

  revalidatePath(one(id));
  redirect(one(id, "?ok=note"));
}

// ---------------------------------------------------------------------------
// Site briefs
// ---------------------------------------------------------------------------

/**
 * Cut a new brief for somebody, and hand back its link.
 *
 * `label` is the only field staff fill in - everything else on a brief is the partner's to
 * answer, and pre-filling their tagline for them is how a brief comes back agreeing with
 * whatever RNL guessed.
 */
export async function createSiteBrief(formData: FormData) {
  const user = await requireCompanyUser();

  const label = s(formData, "label");
  if (!label) redirect(`${DESK}?error=label`);

  // Optional. A brief can exist before the account does - RNL raises them mid-conversation -
  // so this is a link when there is one to make, and null when there is not.
  const partnerAccountId = s(formData, "partnerAccountId") || null;

  const brief = await prisma.partnerSiteBrief.create({
    data: {
      label,
      partnerAccountId,
      issuedByRobloxId: user.robloxId,
      issuedByName: user.displayName,
    },
  });

  revalidatePath(DESK);
  redirect(`${DESK}?ok=brief&brief=${brief.id}`);
}

/**
 * Delete a brief and everything attached to it.
 *
 * The rows cascade (see the schema). The BYTES do not - they are on the private volume,
 * which nothing walks - so they are unlinked here, one by one, before the row that names
 * them goes. Deleting the brief first would leave files on disk that nothing in the
 * database points at, which is indistinguishable from files nobody knows about.
 *
 * Behind a typed confirmation rather than one click: this is the only destructive action
 * on the partnership desk, and what it destroys is somebody else's artwork.
 */
export async function deleteSiteBrief(formData: FormData) {
  await requireCompanyUser();

  const id = s(formData, "id");
  if (!id) redirect(`${DESK}?error=missing`);
  if (s(formData, "confirm") !== "delete") redirect(`${DESK}/brief/${id}?error=confirm`);

  const assets = await prisma.partnerSiteBriefAsset.findMany({
    where: { briefId: id },
    select: { storagePath: true },
  });

  for (const a of assets) {
    const target = resolveInRoot(PRIVATE_UPLOAD_DIR, a.storagePath);
    if (target) await unlink(target).catch(() => {});
  }

  await prisma.partnerSiteBrief.delete({ where: { id } });

  revalidatePath(DESK);
  redirect(`${DESK}?ok=deleted`);
}

// ---------------------------------------------------------------------------
// The public one
// ---------------------------------------------------------------------------

/**
 * Accept an invitation. THE ONE UNGUARDED FUNCTION IN THIS FILE.
 *
 * It needs a session - claiming attaches a Roblox login to a new partner entity, so there
 * has to be a login to attach - but it needs no rank and no existing grant, because the
 * person doing it is by definition not anybody here yet. That is the point of an invite.
 *
 * The authorisation is the CODE, and everything that makes that safe lives in
 * lib/partner-invites.ts: the expiry, the revocation, and the atomic spend. Read the note
 * on claimInvite() before changing any of this - in particular, do not be tempted to look
 * the invite up here and decide in JavaScript whether it is claimable.
 */
export async function acceptPartnerInvite(formData: FormData) {
  const code = s(formData, "code");
  if (!code) redirect("/");

  const session = await getUserSession();
  // The page renders a sign-in button for anonymous visitors, so this is a hand-posted
  // body. Send it back to the invite, which will render that button again.
  if (!session) redirect(`/invite/${code}`);

  const result = await claimInvite(code, session);

  if (!result.ok) {
    // Both refusals are shown by the invite page itself - it re-reads the state and
    // explains it. Sending them back there rather than inventing a second explanation
    // here means there is one place that describes a dead link.
    redirect(`/invite/${code}?refused=${result.reason}`);
  }

  // Straight into the guided setup rather than the hub. They have an account and nothing
  // in it: /onboard is the page that explains what they just got, and it is the only
  // moment anybody will read that explanation.
  redirect("/onboard");
}
