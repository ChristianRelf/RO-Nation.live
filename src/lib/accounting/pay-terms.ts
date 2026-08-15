import { site } from "../site";
import { PAY_DOMAIN } from "./terms";

// What somebody agrees to before pay.ronation.live will open, and the record of them
// agreeing to it.
//
// ---- Why there is a gate at all --------------------------------------------
//
// This host is where a person asks to be paid, tells us money is coming, and reads
// documents that state what is owed. Every one of those acts assumes they know four things
// - that issuing a document is not payment, that everything here is Robux and not money,
// that a payout to a Roblox account they named cannot be recalled, and that we will never
// ask them to send Robux to receive some. Until now, all four were true and none of them
// had ever been put in front of the person they bind. They were on paper, on a document
// that arrives AFTER the fact, and in a policy nobody had been asked to read.
//
// ---- What makes the record worth having ------------------------------------
//
// The pattern is Ticket.termsAcceptedAt / Ticket.termsSnapshot, and the note on that column
// is the whole argument, so it is worth repeating here: a timestamp on its own records
// agreement to a text nobody can reconstruct afterwards, which is exactly the half that
// matters if it is ever disputed. So acceptance stores WHEN, WHICH VERSION, and A FROZEN
// COPY of the clauses as they read on the day - re-derived on the server at the moment of
// acceptance, never posted from the form.
//
// ---- PURE ------------------------------------------------------------------
//
// No prisma, no server-only, like terms.ts and kinds.ts beside it: the modal is a client
// component and renders these same strings, and two copies of a clause list is how the
// thing somebody ticked stops being the thing that was stored.

/**
 * Bumped BY HAND when the clauses below change in a way somebody should re-read.
 *
 * Deliberately not derived from the `updated` dates in lib/legal.ts. Those move whenever
 * any wording anywhere in a policy is tightened, and re-prompting every partner because a
 * sentence about cookies was rephrased trains people to click through the gate without
 * reading it - which costs exactly the thing the gate is for.
 *
 * A stored acceptance carrying an older version is treated as NOT accepted (see
 * needsPayTermsAcceptance), so bumping this re-prompts everybody. Do it when the deal
 * changes; do not do it for a typo.
 */
export const PAY_TERMS_VERSION = "2026-08-15";

/**
 * The documents the gate is an acceptance OF. Read before ticking, linked from the modal.
 *
 * `/legal` renders on every host - including this one - so these are relative and resolve
 * on pay.ronation.live without a cross-host hop. See the note at the top of
 * app/legal/page.tsx.
 */
export const PAY_TERMS_DOCUMENTS: { title: string; href: string; why: string }[] = [
  {
    title: "Payments & Payouts",
    href: "/legal/payments",
    why: "How documents are raised, how money actually moves, and what to do when something is wrong. The one that matters most here.",
  },
  {
    title: "Terms of Service",
    href: "/legal/terms",
    why: "The general terms for everything we run, including being paid by us.",
  },
  {
    title: "Privacy Policy",
    href: "/legal/privacy",
    why: "What we hold about you and this account, and how to act on it.",
  },
];

/**
 * The acknowledgements themselves - the four things that cause a problem when somebody did
 * not know them, in the order they bite.
 *
 * Short, and in the second person, on purpose. A gate whose text is a wall of clauses is a
 * gate people click past, and a clause somebody clicked past is worth very little more than
 * no clause at all. The full wording lives in /legal/payments, linked above; this is the
 * part they are asserting they understand.
 *
 * `**bold**` is honoured by the modal, and marks the phrase in each line that would be the
 * subject of the argument.
 */
export const PAY_TERMS_CLAUSES: string[] = [
  `**Issuing a document is not payment.** When ${site.name} raises a document that owes you money, no Robux is sent. The amount is held until you request it here, somebody reviews that request, and the payout is made.`,
  `**Everything here is Robux (R$).** It is not a cash value, not a balance you hold with us, and not convertible into real-world currency. We operate no wallet or account of that kind for you.`,
  `**A payout cannot be recalled.** You are responsible for the accuracy of what you submit, including the Roblox account a payout should reach. Robux sent to an account you named is gone, and Roblox transactions cannot be reversed by us.`,
  `**We will never ask you to send Robux to receive a payment**, and never ask for your Roblox password. Our payment pages only ever live on ${PAY_DOMAIN} and accounts.${site.domain}. Anything else claiming to be us is not.`,
  `**Submitting a request is not being paid.** Requests are reviewed, may be declined, and may be delayed where information is incomplete, inaccurate, disputed, or needs verification.`,
];

/**
 * The two things the person is asserting, as distinct affirmative acts.
 *
 * Two boxes rather than one, because they are two different assertions and only one of them
 * is about the documents: the second is the one that makes the acceptance BIND THE ENTITY
 * rather than the individual who happened to be signed in. A single "I agree" collapses
 * them, and it is the second that would be argued about.
 */
export const PAY_TERMS_CONFIRMATIONS: { name: string; label: string }[] = [
  {
    name: "read",
    label:
      "I have read and accept the documents above, and I understand the points listed.",
  },
  {
    name: "authorised",
    label:
      "I am authorised to accept these on behalf of this account, and to request payments for it.",
  },
];

/**
 * What gets frozen onto the membership row at the moment of acceptance.
 *
 * Everything the person was shown, flattened to one array of strings - the clauses, the
 * confirmations they ticked, and the documents as they were named and linked. Rebuilt on
 * the server from these constants, so the stored record is what this module said on the day
 * and not what a form posted.
 */
export function payTermsSnapshot(): string[] {
  return [
    `Version ${PAY_TERMS_VERSION}`,
    ...PAY_TERMS_DOCUMENTS.map((d) => `Accepted: ${d.title} (${d.href})`),
    ...PAY_TERMS_CLAUSES,
    ...PAY_TERMS_CONFIRMATIONS.map((c) => `Confirmed: ${c.label}`),
  ];
}

/** Where somebody lands when there is nothing worth resuming. The client's overview. */
export const PAY_HOME = "/";

/**
 * Reduce a proposed returnTo to something safe to hand `redirect()`, or PAY_HOME.
 *
 * ---- Why this is not just a null check -------------------------------------
 *
 * The value travels from a request header, through a URL, through a hidden form field, and
 * back to the server - which is to say a person can put anything in it. A redirect target
 * taken at face value is an OPEN REDIRECT: `pay.ronation.live/terms?returnTo=https://…`
 * would send somebody who followed a link from us, signed in, and accepted our terms
 * straight to somebody else's page - carrying every bit of trust the journey just built.
 * On the one host in this system whose whole subject is money, that is the exact shape of
 * the scam the terms themselves warn about.
 *
 * So: a single leading slash, and nothing else gets through.
 *
 *   "//evil.test"     PROTOCOL-RELATIVE. Starts with "/" and is a different ORIGIN - the
 *                     case a naive `startsWith("/")` check waves past, and the reason this
 *                     function exists rather than that one line.
 *   "/\\evil.test"    the same trick with a backslash, which some parsers fold to "/".
 *   "https://…"       absolute, and obvious.
 *   "/terms"          refused as a matter of sense rather than safety: resuming the gate
 *                     after passing it is a loop back to a page that redirects out again.
 */
export function safeReturnTo(raw: string | null | undefined): string {
  if (!raw) return PAY_HOME;

  const value = raw.trim();
  if (!value.startsWith("/")) return PAY_HOME;
  // Protocol-relative in both spellings. "/" + ("/" | "\") is a host, not a path.
  if (value.startsWith("//") || value.startsWith("/\\")) return PAY_HOME;
  // A control character in a Location header is a header-splitting attempt, and there is
  // no legitimate path that contains one.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return PAY_HOME;
  // The gate itself, and the refusal page. Neither is a destination.
  if (value === "/terms" || value.startsWith("/terms?")) return PAY_HOME;
  if (value === "/access" || value.startsWith("/access?")) return PAY_HOME;

  return value;
}

/**
 * Does this login still have to pass the gate?
 *
 * Takes the shape it needs rather than the Prisma type, so the check is callable from a
 * test without a database and from anywhere holding a membership row.
 *
 * A NULL timestamp is somebody who has never accepted. A STALE version is somebody who
 * accepted an older deal - and they are treated identically, because the alternative is
 * letting an old acceptance stand in for a new one, which is the whole reason the version
 * is stored rather than just the date.
 */
export function needsPayTermsAcceptance(membership: {
  payTermsAcceptedAt: Date | null;
  payTermsVersion: string | null;
}): boolean {
  if (!membership.payTermsAcceptedAt) return true;
  return membership.payTermsVersion !== PAY_TERMS_VERSION;
}
