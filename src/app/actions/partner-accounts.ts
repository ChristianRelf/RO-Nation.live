"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PartnerAccountKind, PartnerAccountStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireCompanyUser } from "@/lib/company";
import { resolveRobloxUser } from "@/lib/roblox-users";
import { s } from "@/lib/content";

// Managing the commercial-partner accounts - the entities that sign in at /partner, and the
// Roblox logins attached to each. RNL-staff-only: every function guards with requireCompanyUser()
// before it touches a row (a page that hides a button is not a permission).
//
// Simpler than a PartnerMember grant (actions/partner-members.ts): this hands over no blacklist
// and no API keys, only the partner's own agreements and their own accounting. But it is still a
// grant, so it is still all server-side, and a Roblox account is still re-resolved against Roblox
// before it becomes a login - the client's idea of who somebody is authorises nothing.

const LIST = "/company/partner-accounts";
const one = (id: string, params = "") => `${LIST}/${id}${params}`;

function isKind(v: string): v is PartnerAccountKind {
  return (Object.values(PartnerAccountKind) as string[]).includes(v);
}
function isStatus(v: string): v is PartnerAccountStatus {
  return (Object.values(PartnerAccountStatus) as string[]).includes(v);
}

export async function createPartnerAccount(formData: FormData) {
  const user = await requireCompanyUser();

  const name = s(formData, "name");
  const kind = s(formData, "kind").toUpperCase();
  const status = s(formData, "status").toUpperCase() || PartnerAccountStatus.POTENTIAL;

  if (!name) redirect(`${LIST}?error=name`);
  if (!isKind(kind)) redirect(`${LIST}?error=kind`);
  if (!isStatus(status)) redirect(`${LIST}?error=status`);

  const account = await prisma.partnerAccount.create({
    data: {
      kind,
      name,
      status,
      createdByRobloxId: user.robloxId,
      createdByName: user.displayName,
    },
  });

  revalidatePath(LIST);
  redirect(one(account.id, "?ok=created"));
}

export async function setPartnerAccountStatus(formData: FormData) {
  await requireCompanyUser();

  const id = s(formData, "id");
  const status = s(formData, "status").toUpperCase();
  if (!id) redirect(`${LIST}?error=missing`);
  if (!isStatus(status)) redirect(one(id, "?error=status"));

  await prisma.partnerAccount.update({ where: { id }, data: { status } });

  revalidatePath(one(id));
  revalidatePath(LIST);
  redirect(one(id, "?ok=status"));
}

export async function addPartnerAccountMember(formData: FormData) {
  const user = await requireCompanyUser();

  const partnerAccountId = s(formData, "partnerAccountId");
  const query = s(formData, "robloxId");
  if (!partnerAccountId) redirect(`${LIST}?error=missing`);
  if (!query) redirect(one(partnerAccountId, "?error=required"));

  // The entity has to exist before a login can hang off it.
  const account = await prisma.partnerAccount.findUnique({
    where: { id: partnerAccountId },
  });
  if (!account) redirect(`${LIST}?error=missing`);

  // Re-resolved against Roblox, server-side. Staff typed a username or an id; only the
  // canonical id, username and avatar Roblox returns are written.
  const profile = await resolveRobloxUser(query);
  if (!profile) redirect(one(partnerAccountId, "?error=roblox"));

  try {
    await prisma.partnerAccountMember.create({
      data: {
        partnerAccountId,
        robloxId: profile.robloxId,
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        addedByRobloxId: user.robloxId,
        addedByName: user.displayName,
      },
    });
  } catch (err) {
    // robloxId is globally unique in v1, so P2002 means one of two things: already a member
    // here, or already attached to ANOTHER partner entity. Both refuse the same way.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      redirect(one(partnerAccountId, "?error=already"));
    }
    throw err;
  }

  revalidatePath(one(partnerAccountId));
  redirect(one(partnerAccountId, "?ok=added"));
}

export async function removePartnerAccountMember(formData: FormData) {
  await requireCompanyUser();

  const partnerAccountId = s(formData, "partnerAccountId");
  const id = s(formData, "id");
  if (!partnerAccountId) redirect(LIST);
  if (!id) redirect(one(partnerAccountId));

  // { id, partnerAccountId } together, via deleteMany - an id on its own must not reach into
  // another entity's members. A miss deletes zero rows.
  await prisma.partnerAccountMember.deleteMany({
    where: { id, partnerAccountId },
  });

  revalidatePath(one(partnerAccountId));
  redirect(one(partnerAccountId, "?ok=removed"));
}

export async function deletePartnerAccount(formData: FormData) {
  await requireCompanyUser();

  const id = s(formData, "id");
  if (!id) redirect(LIST);

  // Members cascade (schema onDelete: Cascade). Any accounting document raised against this
  // entity keeps its partnerAccountId - a plain snapshot column, not an FK - and still prints
  // from its own counterpartyName, exactly as a free-text document does. What is lost is the
  // login, which is the point of deleting.
  await prisma.partnerAccount.delete({ where: { id } });

  revalidatePath(LIST);
  redirect(`${LIST}?ok=deleted`);
}
