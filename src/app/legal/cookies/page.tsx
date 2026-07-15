import type { Metadata } from "next";
import { LegalDoc, type LegalSection } from "@/components/legal-doc";
import { site } from "@/lib/site";
import { legalUpdated } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Cookie Notice",
  description:
    "Every cookie RO. Nation LIVE sets: one session cookie that keeps you signed in, and a handful of short-lived sign-in cookies. No analytics, no advertising, and no banner - because there is nothing here to consent to.",
};

// This notice describes the cookies the CODE actually sets. There are exactly two kinds,
// and both are named here as they are named in the source:
//
//   ron_session        - the persistent login cookie (src/lib/session.ts). httpOnly,
//                        SameSite=Lax, Secure in production, maxAge 30 days, hostname-scoped.
//   ron_oauth_state
//   ron_oauth_verifier - the transient sign-in cookies (api/auth/roblox/login + consent).
//   ron_oauth_return    All httpOnly, SameSite=Lax, Secure in production, maxAge 600s,
//   ron_oauth_grant     set only on authorise.ronation.live during the OAuth round trip.
//
// If a cookie is added, removed, or its lifetime changed, change this page in the same
// commit. A cookie notice that has drifted from the code is a promise quietly broken - the
// same rule the Privacy Policy follows against the schema.

const sections: LegalSection[] = [
  {
    heading: "The short version",
    body: [
      "We set one cookie that keeps you signed in, and a few short-lived ones that only exist for the ten minutes it takes to sign in with Roblox. That is the whole list.",
      "We use no analytics cookies, no advertising cookies, and no third-party trackers. That is why there is no cookie banner: there is nothing here to consent to that the site could work without.",
    ],
  },
  {
    heading: "What a cookie is here",
    body: [
      "A cookie is a small piece of text your browser stores for a site and sends back on each request. We use them for exactly one job - remembering that you are signed in - and for the handshake that signs you in. Nothing we set watches what you do or follows you anywhere else.",
    ],
  },
  {
    heading: "The session cookie",
    body: [
      "When you sign in with Roblox, we set a single cookie named ron_session. It holds a signed token identifying your account - your Roblox user ID, username, display name and avatar - and nothing more. It is what lets you move between pages without signing in again.",
    ],
    list: [
      "It is HTTP-only, so scripts running in your browser cannot read it.",
      "It is marked Secure in production, so it is only ever sent over HTTPS.",
      "It uses SameSite=Lax, which keeps it from being sent along with most cross-site requests.",
      "It lasts up to 30 days, or until you sign out - whichever comes first.",
      "It is strictly necessary: without it, there is no way to stay signed in.",
    ],
  },
  {
    heading: "It is scoped to one hostname",
    body: [
      "The session cookie is tied to the exact host that set it. Signing in on the portal is not signing in on the main site, and signing in on a partner's site is not signing in on ours. That separation is deliberate - each host carries its own login and can see only its own.",
    ],
  },
  {
    heading: "The sign-in cookies",
    body: [
      "Signing in with Roblox is a redirect out to Roblox and back. To do that safely we set a few short-lived cookies - ron_oauth_state, ron_oauth_verifier, ron_oauth_return and, for a paid checkout, ron_oauth_grant - on our sign-in host.",
      "They carry the security values for the round trip: a random state to prevent request forgery, a PKCE verifier, and where to send you afterwards. They are HTTP-only and Secure, they expire after ten minutes, and once you are back they have done their job. They hold nothing about who you are - they exist only for the handshake.",
    ],
  },
  {
    heading: "What we don't set",
    body: ["To be as specific about the absence as about the presence:"],
    list: [
      "No analytics cookies. We do not measure you across pages or visits.",
      "No advertising cookies, ad pixels, or retargeting tags.",
      "No third-party tracking cookies. Nothing we set is read by a company other than us.",
      "Nothing that is sold or handed to a data broker.",
    ],
  },
  {
    heading: "Cookies set by Roblox and Discord",
    body: [
      "When you sign in with Roblox, or when staff sign in with Discord, part of that happens on Roblox's and Discord's own websites, which may set their own cookies on their own domains. Those are theirs, not ours, and are governed by their cookie and privacy policies - not by this notice.",
    ],
  },
  {
    heading: "Managing cookies",
    body: [
      "You can delete cookies or block them in your browser's settings at any time. Because our session cookie is strictly necessary, blocking it means you will not be able to stay signed in - you can still browse the public site, but you will not be able to reach your tickets, the portal, or a survey.",
      "There is no preference to toggle here because there is no optional cookie to toggle. If we ever added one, we would ask first.",
    ],
  },
  {
    heading: "Changes to this notice",
    body: [
      "If we change the cookies we set, we update this page and the date at the top of it.",
    ],
  },
  {
    heading: "Contact",
    body: [
      `Questions about this notice? Use the contact page or email ${site.contactEmail}.`,
    ],
  },
];

export default function CookieNoticePage() {
  return (
    <LegalDoc
      title="Cookie Notice"
      updated={legalUpdated("/legal/cookies")}
      currentHref="/legal/cookies"
      intro="Every cookie this site sets, named and explained - and why there is no banner asking you to accept them. If a line here doesn't match what the site actually does, that's a bug. Tell us."
      sections={sections}
    />
  );
}
