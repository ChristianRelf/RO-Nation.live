import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { Partner } from "./registry";

// A partner's editable homepage copy.
//
// Every field is optional and every read falls back to something sane - the
// registry's own tagline and description, or the wording the page shipped with.
// A partner who has never opened the content editor still gets the site they had
// before, which is what makes this additive rather than a migration.

/** One question and its answer, as stored in PartnerContent.faq. */
export const FaqItem = z.object({
  q: z.string().trim().min(1).max(200),
  a: z.string().trim().min(1).max(2000),
});
export type FaqItem = z.infer<typeof FaqItem>;

/**
 * The FAQ list, as it arrives from the editor (one hidden JSON field, the same
 * shape the survey builder uses for its questions).
 */
export const FaqList = z.array(FaqItem).max(20);

/**
 * Parse the FAQ out of a form. Returns null when the JSON is unusable, so the
 * caller can bounce the submit rather than silently saving an empty accordion -
 * "no questions" and "the questions failed to parse" must not look the same.
 */
export function parseFaq(raw: string): FaqItem[] | null {
  if (!raw.trim()) return [];
  try {
    const parsed = FaqList.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * The FAQ as stored - validated on the way OUT as well as in.
 *
 * The column is Json, so Prisma types it as JsonValue: it could be anything, and
 * a row written before this shape settled (or by hand, in psql) would otherwise
 * flow straight into the page as `any` and blow up at render. Anything that
 * doesn't parse is dropped rather than thrown - a malformed FAQ should cost the
 * partner their accordion, not their whole homepage.
 */
export function readFaq(value: unknown): FaqItem[] {
  const parsed = FaqList.safeParse(value);
  return parsed.success ? parsed.data : [];
}

export type PartnerHomeContent = {
  heroKicker: string;
  heroTitle: string | null;
  heroSubtitle: string;
  heroImageUrl: string | null;
  aboutKicker: string;
  aboutTitle: string | null;
  aboutBody: string | null;
  aboutNote: string | null;
  faq: FaqItem[];
};

/**
 * The partner's homepage copy, with the registry as the fallback for anything
 * they haven't written yet.
 *
 * `heroTitle` and the about fields stay nullable on purpose: the page renders a
 * hand-typeset wordmark when there is no custom title, and drops the about panel
 * entirely when there is no body. An empty string in the editor means "leave it
 * out", and that has to survive the round trip.
 */
export async function getPartnerContent(
  partner: Partner,
): Promise<PartnerHomeContent> {
  const row = await prisma.partnerContent.findUnique({
    where: { partnerId: partner.slug },
  });

  const text = (v: string | null | undefined) => {
    const s = (v ?? "").trim();
    return s.length ? s : null;
  };

  return {
    heroKicker: text(row?.heroKicker) ?? partner.tagline,
    heroTitle: text(row?.heroTitle),
    heroSubtitle: text(row?.heroSubtitle) ?? partner.description,
    heroImageUrl: text(row?.heroImageUrl),
    aboutKicker: text(row?.aboutKicker) ?? "About",
    aboutTitle: text(row?.aboutTitle),
    aboutBody: text(row?.aboutBody),
    aboutNote: text(row?.aboutNote),
    faq: readFaq(row?.faq),
  };
}
