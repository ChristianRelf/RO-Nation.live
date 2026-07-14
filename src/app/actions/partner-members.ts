"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PartnerRole, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireCompanyUser } from "@/lib/company";
import { requirePartnerOwner } from "@/lib/partners/guard";
import { partnerBySlug } from "@/lib/partners/registry";
import { partnerPortalPath, partnerPortalRoute } from "@/lib/partners/urls";
import { resolveRobloxUser } from "@/lib/roblox-users";
import { s } from "@/lib/content";

// Who may open a partner's portal.
//
// ---- These are the most dangerous writes in the application ----------------
//
// A PartnerMember row is not a preference. It is the right to read a partner's blacklist,
// work their door, and mint API keys scoped to their live experience. Getting one of these
// functions wrong does not break a page - it hands somebody else's organisation to a
// stranger, silently, and nothing anywhere would show it had happened.
//
// So every rule below is written out, and none of them is clever.
//
// ---- Two doors, one set of functions ---------------------------------------
//
// RNL staff manage members from /company/partners. A partner's OWNER manages their own
// from /<slug>/members on the portal host. Same writes, different guards - so `slug`
// arrives on the FORM BODY and authorises NOTHING. It only selects which guard runs. That
// is the contract actions/portal.ts states and every scoped action in this codebase keeps:
// a pasted slug gets you the guard for that slug, and if you do not pass it, you get
// nothing.
//
// ---- The three traps -------------------------------------------------------
//
//   1. Match on { id, partnerId } TOGETHER, via *Many. An id on its own would let the
//      owner of one partner promote somebody on another's simply by pasting a row id.
//      Ids are opaque. Opaque is not secret.
//
//   2. The last-owner lock. Removing or demoting the only OWNER locks a partner out of
//      their own member admin permanently, with no way back that does not involve RNL and
//      a shell. Refused - but only when the caller came through the PARTNER's door. RNL
//      staff are allowed to do it, because for them it is offboarding.
//
//   3. revalidatePath takes the INTERNAL route (/pp/<slug>/members). redirect takes the
//      PUBLIC path (/<slug>/members). lib/partners/urls.ts names both after what you are
//      doing, and its header spells out the failure mode: "a revalidatePath() of the
//      public path matches no route, throws nothing, and the list simply keeps serving
//      stale after a write."

type Door = { slug: string; actor: { robloxId: string; displayName: string } };

/**
 * Run the guard that matches where this request came from, and return the partner slug
 * the guard approved - never the one the form claimed.
 *
 * `via` is not a permission either. It says which door to knock on; the door decides.
 */
async function open(formData: FormData): Promise<Door> {
  const claimed = s(formData, "slug");

  // Validated against the registry before it is ever used as a scope. An unregistered slug
  // is not a partner with no members - it is a typo or a probe, and it must not reach a
  // query as a partnerId.
  const partner = partnerBySlug(claimed);
  if (!partner) redirect("/company/partners?error=unknown");

  if (s(formData, "via") === "company") {
    const user = await requireCompanyUser();
    return {
      slug: partner.slug,
      actor: { robloxId: user.robloxId, displayName: user.displayName },
    };
  }

  const user = await requirePartnerOwner(partner.slug);
  return {
    slug: partner.slug,
    actor: { robloxId: user.robloxId, displayName: user.displayName },
  };
}

/** Where to send them back to, by the door they came in by. */
const home = (formData: FormData, slug: string, params = "") =>
  s(formData, "via") === "company"
    ? `/company/partners/${slug}${params}`
    : `${partnerPortalPath(slug, "/members")}${params}`;

function refresh(slug: string) {
  // INTERNAL route. The public path (/<slug>/members) matches no route in this app.
  revalidatePath(partnerPortalRoute(slug, "/members"));
  revalidatePath(`/company/partners/${slug}`);
  revalidatePath("/company/partners");
}

/** Is this the last person who can grant anybody anything? */
async function isLastOwner(slug: string, robloxId: string): Promise<boolean> {
  const owners = await prisma.partnerMember.findMany({
    where: { partnerId: slug, role: PartnerRole.OWNER },
    select: { robloxId: true },
  });
  return owners.length === 1 && owners[0].robloxId === robloxId;
}

export async function addPartnerMember(formData: FormData) {
  const { slug, actor } = await open(formData);

  const query = s(formData, "robloxId");
  const role = s(formData, "role").toUpperCase();
  if (!query) redirect(home(formData, slug, "?error=required"));
  if (!Object.values(PartnerRole).includes(role as PartnerRole)) {
    redirect(home(formData, slug, "?error=role"));
  }

  // Re-resolved against Roblox, server-side, before anything is written. The client sent an
  // id, a username and an avatar; only the id is used, and even that is looked up again.
  // addRosterEntry says it best: never trust the client's idea of who this is.
  const profile = await resolveRobloxUser(query);
  if (!profile) redirect(home(formData, slug, "?error=roblox"));

  try {
    await prisma.partnerMember.create({
      data: {
        partnerId: slug,
        robloxId: profile.robloxId,
        robloxUsername: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        role: role as PartnerRole,
        addedById: actor.robloxId,
        addedByName: actor.displayName,
      },
    });
  } catch (err) {
    // The (partnerId, robloxId) unique key. They are already on the list - which is a
    // thing to say, not a stack trace to print.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      redirect(home(formData, slug, "?error=already"));
    }
    throw err;
  }

  refresh(slug);
  redirect(home(formData, slug, "?ok=added"));
}

export async function setPartnerMemberRole(formData: FormData) {
  const { slug } = await open(formData);

  const id = s(formData, "id");
  const role = s(formData, "role").toUpperCase();
  if (!id || !Object.values(PartnerRole).includes(role as PartnerRole)) {
    redirect(home(formData, slug, "?error=role"));
  }

  const member = await prisma.partnerMember.findFirst({
    where: { id, partnerId: slug },
  });
  if (!member) redirect(home(formData, slug, "?error=missing"));

  // Demoting yourself out of OWNER when you are the only one is the same act as deleting
  // the last owner, and it locks the partner out just as permanently. RNL may do it; a
  // partner may not do it to themselves.
  if (
    member.role === PartnerRole.OWNER &&
    role !== PartnerRole.OWNER &&
    s(formData, "via") !== "company" &&
    (await isLastOwner(slug, member.robloxId))
  ) {
    redirect(home(formData, slug, "?error=lastowner"));
  }

  // { id, partnerId } together, via updateMany. A miss affects zero rows rather than
  // reaching into another partner's list.
  await prisma.partnerMember.updateMany({
    where: { id, partnerId: slug },
    data: { role: role as PartnerRole },
  });

  refresh(slug);
  redirect(home(formData, slug, "?ok=role"));
}

export async function removePartnerMember(formData: FormData) {
  const { slug } = await open(formData);

  const id = s(formData, "id");
  if (!id) redirect(home(formData, slug));

  const member = await prisma.partnerMember.findFirst({
    where: { id, partnerId: slug },
  });
  if (!member) redirect(home(formData, slug, "?error=missing"));

  if (
    member.role === PartnerRole.OWNER &&
    s(formData, "via") !== "company" &&
    (await isLastOwner(slug, member.robloxId))
  ) {
    redirect(home(formData, slug, "?error=lastowner"));
  }

  await prisma.partnerMember.deleteMany({ where: { id, partnerId: slug } });

  refresh(slug);
  redirect(home(formData, slug, "?ok=removed"));
}
