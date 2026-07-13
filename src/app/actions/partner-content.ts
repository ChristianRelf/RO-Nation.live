"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApplicationStatus, JobStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { readPostForm, resolvePublishedAt, s, uniqueSlug } from "@/lib/content";
import { parseFaq } from "@/lib/partners/content";
import {
  assertPartnerFeature,
  requirePartnerManager,
} from "@/lib/partners/guard";
import {
  partnerPortalPath,
  partnerPortalRoute,
  partnerSiteRoute,
} from "@/lib/partners/urls";

// A partner's own blog, careers, applications and homepage copy.
//
// The sibling of partner-events.ts, and it follows exactly the same contract —
// which is worth stating once here rather than re-deriving at each function:
//
//   The scope arrives in the form body and authorizes NOTHING. It only selects
//   which guard runs. requirePartnerManager() re-reads the caller's grant on that
//   partner, so a forged scope fails a different org's guard rather than passing
//   this one.
//
//   Every write matches on { id, partnerId } TOGETHER, using the *Many form. A
//   manager of one partner who pastes another's post id matches zero rows — not
//   an error, not a silent edit of somebody else's content.
//
//   assertPartnerFeature() runs on the ACTION, not just the page. The page is
//   where a person is stopped; this is where a POST is.

function refreshBlog(slug: string) {
  revalidatePath(partnerPortalRoute(slug, "/studio/blog"));
  revalidatePath(partnerSiteRoute(slug, "/blog"));
}

function refreshCareers(slug: string) {
  revalidatePath(partnerPortalRoute(slug, "/studio/careers"));
  revalidatePath(partnerSiteRoute(slug, "/careers"));
}

// ---- blog ---------------------------------------------------------
export async function createPartnerPost(formData: FormData) {
  const scope = s(formData, "scope");
  const { partner, displayName, robloxId } = await requirePartnerManager(scope);
  assertPartnerFeature(partner, "blog");

  const data = readPostForm(formData);
  const base = partnerPortalPath(partner.slug, "/studio/blog");
  if (!data.title || !data.body) redirect(`${base}/new?error=required`);

  // Scoped: two partners may both publish /blog/opening-night, and neither
  // should push the other's slug to "-2" for a reason nobody can see.
  const slug = await uniqueSlug(data.title, "post", partner.slug);

  await prisma.post.create({
    data: {
      ...data,
      slug,
      partnerId: partner.slug,
      publishedAt: resolvePublishedAt(data.status),
      authorRobloxId: robloxId,
      authorName: displayName,
    },
  });

  refreshBlog(partner.slug);
  redirect(base);
}

export async function updatePartnerPost(formData: FormData) {
  const scope = s(formData, "scope");
  const { partner } = await requirePartnerManager(scope);
  assertPartnerFeature(partner, "blog");

  const id = s(formData, "id");
  const data = readPostForm(formData);
  const base = partnerPortalPath(partner.slug, "/studio/blog");
  if (!id || !data.title || !data.body) {
    redirect(`${base}/${id}/edit?error=required`);
  }

  const existing = await prisma.post.findFirst({
    where: { id, partnerId: partner.slug },
  });
  if (!existing) redirect(base);

  // The slug is left alone on edit, so a link already shared out doesn't rot.
  await prisma.post.update({
    where: { id },
    data: {
      ...data,
      publishedAt: resolvePublishedAt(data.status, existing.publishedAt),
    },
  });

  refreshBlog(partner.slug);
  revalidatePath(partnerSiteRoute(partner.slug, `/blog/${existing.slug}`));
  redirect(base);
}

export async function deletePartnerPost(formData: FormData) {
  const scope = s(formData, "scope");
  const { partner } = await requirePartnerManager(scope);
  assertPartnerFeature(partner, "blog");

  const id = s(formData, "id");
  if (id) {
    await prisma.post.deleteMany({ where: { id, partnerId: partner.slug } });
  }

  refreshBlog(partner.slug);
  redirect(partnerPortalPath(partner.slug, "/studio/blog"));
}

// ---- careers ------------------------------------------------------
function readCareer(form: FormData) {
  return {
    title: s(form, "title"),
    department: s(form, "department") || "Crew",
    commitment: s(form, "commitment") || "Volunteer",
    location: s(form, "location") || "Remote — Roblox",
    summary: s(form, "summary"),
    description: s(form, "description"),
    requirements: s(form, "requirements"),
    status: (s(form, "status") as JobStatus) || JobStatus.DRAFT,
  };
}

export async function createPartnerCareer(formData: FormData) {
  const scope = s(formData, "scope");
  const { partner } = await requirePartnerManager(scope);
  assertPartnerFeature(partner, "careers");

  const data = readCareer(formData);
  const base = partnerPortalPath(partner.slug, "/studio/careers");
  if (!data.title || !data.summary || !data.description) {
    redirect(`${base}/new?error=required`);
  }

  const slug = await uniqueSlug(data.title, "career", partner.slug);
  await prisma.career.create({
    data: { ...data, slug, partnerId: partner.slug },
  });

  refreshCareers(partner.slug);
  redirect(base);
}

export async function updatePartnerCareer(formData: FormData) {
  const scope = s(formData, "scope");
  const { partner } = await requirePartnerManager(scope);
  assertPartnerFeature(partner, "careers");

  const id = s(formData, "id");
  const data = readCareer(formData);
  const base = partnerPortalPath(partner.slug, "/studio/careers");
  if (!id || !data.title || !data.summary || !data.description) {
    redirect(`${base}/${id}/edit?error=required`);
  }

  await prisma.career.updateMany({
    where: { id, partnerId: partner.slug },
    data,
  });

  refreshCareers(partner.slug);
  redirect(base);
}

export async function deletePartnerCareer(formData: FormData) {
  const scope = s(formData, "scope");
  const { partner } = await requirePartnerManager(scope);
  assertPartnerFeature(partner, "careers");

  const id = s(formData, "id");
  if (id) {
    await prisma.career.deleteMany({ where: { id, partnerId: partner.slug } });
  }

  refreshCareers(partner.slug);
  redirect(partnerPortalPath(partner.slug, "/studio/careers"));
}

// ---- applications -------------------------------------------------
export async function setPartnerApplicationStatus(formData: FormData) {
  const scope = s(formData, "scope");
  const { partner } = await requirePartnerManager(scope);
  assertPartnerFeature(partner, "careers");

  const id = s(formData, "id");
  const status = s(formData, "status") as ApplicationStatus;
  if (id && ["NEW", "REVIEWING", "ACCEPTED", "REJECTED"].includes(status)) {
    // The application carries the partnerId of the role it was submitted
    // against, so this cannot reach into RNL's inbox or another partner's.
    await prisma.application.updateMany({
      where: { id, partnerId: partner.slug },
      data: { status },
    });
  }

  revalidatePath(partnerPortalRoute(partner.slug, "/studio/applications"));
}

// ---- homepage content ---------------------------------------------
export async function updatePartnerContent(formData: FormData) {
  const scope = s(formData, "scope");
  const { partner, displayName } = await requirePartnerManager(scope);

  const base = partnerPortalPath(partner.slug, "/studio/content");

  // The FAQ is posted as one hidden JSON field, like the survey builder's
  // questions — a list of pairs doesn't map onto flat form fields. null means it
  // failed to parse, which must NOT be saved as "no questions": that would wipe
  // a partner's accordion because of a bug in the editor.
  const faq = parseFaq(s(formData, "faq"));
  if (faq === null) redirect(`${base}?error=faq`);

  // Empty string means "leave this out", and has to survive the round trip — so
  // the columns are written as null rather than "" and the page's fallbacks
  // (lib/partners/content.ts) can tell the two apart.
  const orNull = (key: string) => s(formData, key) || null;

  const data = {
    heroKicker: orNull("heroKicker"),
    heroTitle: orNull("heroTitle"),
    heroSubtitle: orNull("heroSubtitle"),
    heroImageUrl: orNull("heroImageUrl"),
    aboutKicker: orNull("aboutKicker"),
    aboutTitle: orNull("aboutTitle"),
    aboutBody: orNull("aboutBody"),
    aboutNote: orNull("aboutNote"),
    faq,
    updatedByName: displayName,
  };

  await prisma.partnerContent.upsert({
    where: { partnerId: partner.slug },
    update: data,
    create: { partnerId: partner.slug, ...data },
  });

  revalidatePath(partnerPortalRoute(partner.slug, "/studio/content"));
  revalidatePath(partnerSiteRoute(partner.slug));
  redirect(`${base}?ok=1`);
}
