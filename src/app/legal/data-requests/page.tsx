import type { Metadata } from "next";
import { LegalDoc, type LegalSection } from "@/components/legal-doc";
import { site } from "@/lib/site";
import { legalUpdated } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Data & Privacy Requests",
  description:
    "How to ask RO. Nation LIVE for a copy of your data, correct it, or have it deleted - what to send us, what to expect, and the two honest limits on deletion.",
};

// The practical companion to the Privacy Policy. It does not restate what we hold - the
// Privacy Policy does that - it explains how to exercise a right over it. The request itself
// is made through the signed-in form at /legal/data-request/request (the sign-in is what
// proves the account is yours to ask about); the contact email is the documented fallback
// for anyone locked out of their account. Either way it lands with a human - a data request
// is answered by someone who can look at the actual records, not by an endpoint. The two
// "honest limits" mirror the Privacy Policy's "Your choices" section and must stay in step
// with it.

const sections: LegalSection[] = [
  {
    heading: "What you can ask for",
    body: [
      `You have rights over the data ${site.name} holds about you, and this page is how you use them. Our Privacy Policy explains what we hold and why; this one is about getting us to act on it.`,
      "You can ask us to:",
    ],
    list: [
      "Give you a copy of what we hold about you - a subject access request.",
      "Correct something that is wrong or out of date.",
      "Delete your account and the data attached to it.",
      "Restrict or object to a particular use of your data.",
      "Provide your data in a portable form, where that applies.",
    ],
  },
  {
    heading: "How to make a request",
    body: [
      "The quickest way is our [data request form](/legal/data-request/request). Sign in with Roblox, pick what you want, and leave us an email or Discord to reply to. Signing in is what proves the account is yours - which is exactly what stops someone else asking for your data.",
      `If you are locked out of your account and cannot sign in - which is common when the request is deletion or access - email [${site.contactEmail}](mailto:${site.contactEmail}) instead. Tell us your Roblox username, and we will verify it is you another way before acting.`,
      "Either way, one clear request is enough. You do not need to quote a law or use any special wording.",
    ],
  },
  {
    heading: "Proving it's you",
    body: [
      "We will not hand someone's data to whoever asks for it, so we need to be reasonably sure a request is really from the account it concerns.",
      "The simplest proof is to send the request while signed in, or from a channel already linked to your account. If we are not sure, we may ask you to confirm ownership - for example, by verifying through the Roblox account itself. This protects you as much as anyone.",
    ],
  },
  {
    heading: "What happens next",
    body: [
      "We aim to acknowledge a request quickly and to resolve it within a reasonable time - and if something will take longer, or we need more detail to act, we will tell you rather than go quiet.",
      "We do not charge for a reasonable request. If a request is repetitive or excessive we may say so and explain why, rather than simply ignoring it.",
    ],
  },
  {
    heading: "Deleting your account",
    body: [
      "Ask, and we delete your account and the data attached to it - including the tickets tied to it. You can also cancel any individual ticket yourself, at any time, from your tickets page.",
      "Deletion is deletion: once your account is gone, we cannot get it back, and any tickets it held are gone with it.",
    ],
  },
  {
    heading: "Two honest limits",
    body: [
      "There are exactly two things we may not simply erase on request, and we would rather say so here than surprise you later.",
    ],
    list: [
      "A blacklist entry, where removing it would put other people at risk. The blacklist exists to keep someone who has harmed others out of the next show; if you are on one, ask us to review it rather than to erase it - tell us your Roblox username, and we will look at the reason recorded and either remove it or explain it.",
      "An aggregate figure that no longer identifies you - such as the attendance count of a show that has already happened. Once a number is just a number, there is nothing personal left in it to remove.",
    ],
  },
  {
    heading: "If you're not satisfied",
    body: [
      "If you think we have handled your data or your request wrongly, tell us first - we would rather put it right. Depending on where you live, you may also have the right to complain to your local data protection authority.",
    ],
  },
  {
    heading: "Contact",
    body: [
      `To make a request, use the [data request form](/legal/data-request/request), or email [${site.contactEmail}](mailto:${site.contactEmail}) if you cannot sign in.`,
    ],
  },
];

export default function DataRequestsPage() {
  return (
    <LegalDoc
      title="Data & Privacy Requests"
      updated={legalUpdated("/legal/data-requests")}
      currentHref="/legal/data-requests"
      intro="How to get a copy of your data, correct it, or have it deleted - what to send, what to expect, and the two things we can't simply erase. The Privacy Policy says what we hold; this is how you act on it."
      sections={sections}
    />
  );
}
