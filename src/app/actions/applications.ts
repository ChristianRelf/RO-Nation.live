"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/session";
import { notify } from "@/lib/notify";
import { partnerPortalUrl } from "@/lib/partners/urls";

const schema = z.object({
  careerId: z.string().min(1),
  slug: z.string().min(1),
  robloxUsername: z.string().trim().min(2).max(40),
  discord: z.string().trim().max(60).optional(),
  timezone: z.string().trim().max(40).optional(),
  portfolio: z.string().trim().max(200).optional(),
  message: z.string().trim().min(20).max(4000),
});

export async function submitApplication(formData: FormData) {
  const parsed = schema.safeParse({
    careerId: formData.get("careerId"),
    slug: formData.get("slug"),
    robloxUsername: formData.get("robloxUsername"),
    discord: formData.get("discord") || undefined,
    timezone: formData.get("timezone") || undefined,
    portfolio: formData.get("portfolio") || undefined,
    message: formData.get("message"),
  });

  if (!parsed.success) {
    redirect(`/careers/${formData.get("slug") ?? ""}?error=invalid#apply`);
  }
  const data = parsed.data;

  const career = await prisma.career.findUnique({
    where: { id: data.careerId },
  });
  if (!career || career.status !== "OPEN") {
    redirect(`/careers/${data.slug}?error=closed#apply`);
  }

  const session = await getUserSession();

  await prisma.application.create({
    data: {
      careerId: data.careerId,
      // Read from the career row, never from the form. It decides whose inbox
      // this lands in, so it is not something the applicant gets to choose.
      partnerId: career.partnerId,
      userId: session?.uid ?? null,
      robloxUsername: data.robloxUsername,
      discord: data.discord ?? null,
      timezone: data.timezone ?? null,
      portfolio: data.portfolio ?? null,
      message: data.message,
    },
  });

  // Route the ping to whoever owns the role: the partner's channel when the career
  // carries a partnerId (that same denormalised scope decides the inbox above), else
  // RNL's. The link goes to the matching applications dashboard - the partner's on
  // the portal host, RNL's on the main site. Fire-and-forget; the redirect below
  // throws, so this is started first and never awaited.
  void notify({
    partnerId: career.partnerId,
    title: `New application · ${career.title}`,
    description: data.message,
    url: career.partnerId
      ? partnerPortalUrl(career.partnerId, "/studio/applications")
      : "/company/applications",
    fields: [
      { name: "Roblox", value: data.robloxUsername, inline: true },
      ...(data.discord ? [{ name: "Discord", value: data.discord, inline: true }] : []),
      ...(data.timezone ? [{ name: "Timezone", value: data.timezone, inline: true }] : []),
      ...(data.portfolio ? [{ name: "Portfolio", value: data.portfolio }] : []),
    ],
  });

  redirect(`/careers/${data.slug}?applied=1#apply`);
}
