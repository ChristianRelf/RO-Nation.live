import "server-only";
import type { PartnerOnboarding } from "@prisma/client";
import { prisma } from "./db";

// The shape of partner.ronation.live/onboard: which steps exist, in which order, and
// what each one is for.
//
// The step list, the rules about which of them may be opened, and the one row that records
// how far somebody got. Server-only: the progress rail is a SERVER component (it already
// knows the current step from the route, so it needs no state), which is what lets the
// list and the row that indexes into it live in one module rather than two that drift.
//
// ---- Why the URL carries the step -----------------------------------------
//
// /onboard/details rather than /onboard with a piece of state. A partner doing this is
// being asked to go and find things - their group URL, whoever handles their money, the
// timezone their shows run in - so they WILL leave and come back, on another device, in
// another week. Every step is therefore a real address with a real Back button, and the
// row records the furthest one reached so /onboard itself can resume them.

export type OnboardingStep = {
  /** The URL segment: /onboard/<slug>. Stable - it is in people's history. */
  slug: string;
  /** The small caps line above the heading. */
  kicker: string;
  title: string;
  /** One sentence under the heading, and the same sentence in the progress rail. */
  blurb: string;
  /**
   * Does this step write to PartnerOnboarding?
   *
   * The explaining steps do not, and the difference is visible: a step that gathers
   * nothing gets "Next", a step that gathers something gets "Save and continue", and
   * nobody is asked to press Save on a page with no fields on it.
   */
  gathers: boolean;
};

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    slug: "welcome",
    kicker: "Step one",
    title: "You're in",
    blurb: "What just happened, and what the next few minutes are for.",
    gathers: false,
  },
  {
    slug: "programme",
    kicker: "Step two",
    title: "What you get",
    blurb: "Every part of the programme, and which of them you want switched on.",
    gathers: true,
  },
  {
    slug: "details",
    kicker: "Step three",
    title: "How we reach you",
    blurb: "The handful of things we would otherwise ask for in a Discord thread.",
    gathers: true,
  },
  {
    slug: "agreements",
    kicker: "Step four",
    title: "The agreements",
    blurb: "Three documents that set the split and what each side may do. Read them.",
    gathers: false,
  },
  {
    slug: "done",
    kicker: "Step five",
    title: "What happens next",
    blurb: "Where everything lives from here, and who does what.",
    gathers: false,
  },
];

/** The last index. Reaching it and pressing through is what sets completedAt. */
export const LAST_STEP = ONBOARDING_STEPS.length - 1;

export function stepIndex(slug: string): number {
  return ONBOARDING_STEPS.findIndex((s) => s.slug === slug);
}

export function stepBySlug(slug: string): OnboardingStep | null {
  return ONBOARDING_STEPS.find((s) => s.slug === slug) ?? null;
}

/**
 * A stored `step` value, forced back inside the array.
 *
 * The column is an integer and the array is a deploy artefact, so they can disagree the
 * moment a step is removed - and a partner whose row says 7 would otherwise land on
 * `undefined.title`. Clamping here means the worst case of shortening the flow is that
 * somebody is shown the new last step, which is the correct answer anyway.
 */
export function clampStep(step: number | null | undefined): number {
  if (typeof step !== "number" || !Number.isFinite(step)) return 0;
  return Math.min(Math.max(Math.trunc(step), 0), LAST_STEP);
}

/** Where /onboard should send somebody: the step they got to, or the end. */
export function resumeSlug(row: { step: number; completedAt: Date | null } | null): string {
  if (!row) return ONBOARDING_STEPS[0].slug;
  if (row.completedAt) return ONBOARDING_STEPS[LAST_STEP].slug;
  return ONBOARDING_STEPS[clampStep(row.step)].slug;
}

/**
 * May somebody open this step yet?
 *
 * They may open anything up to and including the furthest they have reached, and one
 * beyond it - the one they are about to do. Not "anything at all", because a flow whose
 * last step can be typed into the address bar is a flow whose last step gets typed into
 * the address bar, and the last step here is the one that says the setup is finished.
 *
 * A completed row opens everything: going back to re-read the agreements after finishing
 * is a reasonable thing to want.
 */
export function canOpenStep(
  row: { step: number; completedAt: Date | null } | null,
  index: number,
): boolean {
  if (index < 0 || index > LAST_STEP) return false;
  if (!row) return index === 0;
  if (row.completedAt) return true;
  return index <= clampStep(row.step) + 1;
}

// ---------------------------------------------------------------------------
// The row
// ---------------------------------------------------------------------------

/** This account's progress, or null if they have never opened the flow. */
export function getOnboarding(
  partnerAccountId: string,
): Promise<PartnerOnboarding | null> {
  return prisma.partnerOnboarding.findUnique({ where: { partnerAccountId } });
}

/**
 * Their progress, creating it on first sight.
 *
 * upsert with an empty update, rather than findUnique-then-create. Two tabs opening
 * /onboard at the same moment is not a hypothetical - it is what happens when somebody
 * clicks the link in an email twice - and the read-then-write version races into a unique
 * constraint violation on a page that has done nothing wrong.
 */
export function startOnboarding(
  partnerAccountId: string,
): Promise<PartnerOnboarding> {
  return prisma.partnerOnboarding.upsert({
    where: { partnerAccountId },
    create: { partnerAccountId },
    update: {},
  });
}

/**
 * Record that somebody reached `index`, without ever moving them backwards.
 *
 * The column is the FURTHEST step reached, so going back to re-read step two must not
 * reset a partner who had got to step four - they would be walked through the whole flow
 * again to reach a page they had already seen. Postgres decides it, in the statement:
 * the update only matches a row whose step is lower.
 *
 * Returns nothing, because there is nothing useful to say. "We already knew" and "noted"
 * are the same outcome from the caller's side.
 */
export async function reachStep(
  partnerAccountId: string,
  index: number,
): Promise<void> {
  const step = clampStep(index);
  await prisma.partnerOnboarding.updateMany({
    where: { partnerAccountId, step: { lt: step } },
    data: { step },
  });
}

/**
 * Mark the flow finished.
 *
 * Set once and never moved: a partner who comes back a year later to re-read the
 * agreements has not un-finished their setup, and "when did they onboard" is a fact about
 * the past. The where-clause is what enforces that, rather than an if-statement here.
 */
export async function completeOnboarding(partnerAccountId: string): Promise<void> {
  await prisma.partnerOnboarding.updateMany({
    where: { partnerAccountId, completedAt: null },
    data: { step: LAST_STEP, completedAt: new Date() },
  });
}
