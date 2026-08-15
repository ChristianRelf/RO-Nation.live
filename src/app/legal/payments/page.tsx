import type { Metadata } from "next";
import { LegalDoc, type LegalSection } from "@/components/legal-doc";
import { site } from "@/lib/site";
import { legalUpdated } from "@/lib/legal";
import { CONTACT_PATH, PAY_DOMAIN } from "@/lib/accounting/terms";

export const metadata: Metadata = {
  title: "Payments & Payouts",
  description:
    "How RO. Nation LIVE's payment system works: documents are raised, amounts are held, and the recipient requests payment at pay.ronation.live. Everything is in Robux, and Roblox moves the money.",
};

// The policy behind the terms printed on every accounting sheet.
//
// ---- Why this document exists ---------------------------------------------
//
// The accounting system shipped on two hosts of its own, with five kinds of document, a
// held-funds model and two request forms - and nothing published anywhere said how any of
// it worked. The paper now carries a full terms block (lib/accounting/terms.ts), and that
// block refers to "the designated payment system" and sends people to pay.ronation.live.
// This is the page behind those words. A term printed on a document that cannot be read
// anywhere else is a term nobody agreed to.
//
// ---- The rule for editing it ----------------------------------------------
//
// The same rule the Privacy Policy follows against the schema: say what the code does.
// Every clause here maps to something real -
//
//   "issuing does not send the Robux"   `releasable` in lib/accounting/kinds.ts, and the
//                                       RELEASE request in lib/accounting/requests.ts.
//   "frozen at issue, never edited"     isEditable() - only DRAFT is editable.
//   "a void document keeps its number"  DocumentCounter never reissues.
//   "a credit note is the correction"   CREDIT_NOTE.relates, and the note on it.
//   "no form here moves any Robux"      both formBlurbs in request-kinds.ts.
//
// If one of those changes, change this page in the same commit. And keep it in step with
// lib/accounting/terms.ts, which is the short version of this document printed on paper -
// if the sheet and the policy ever disagree, the sheet is what somebody is holding.

const sections: LegalSection[] = [
  {
    heading: "Who this covers",
    body: [
      `This page explains how ${site.name} raises payment documents, how money is paid out, and what the two payment hosts do. It applies if you are a partner, a contractor, a supplier, or anyone else we raise a document with - and it applies to the documents themselves, wherever you read one.`,
      "It sits alongside our [Terms of Service](/legal/terms) and [Privacy Policy](/legal/privacy). If you are a partner, your [partner agreements](/legal/partners/ticketing) set out what you are owed and how it is calculated; this page sets out the mechanics of getting it.",
      "It does not cover buying a ticket or an item of merchandise. Those happen on Roblox - see our [Ticket & Event Terms](/legal/tickets) and [Merch & Refunds](/legal/refunds) policy.",
    ],
  },
  {
    heading: "The two hosts",
    body: ["The payment system answers on two addresses, and they do different jobs."],
    list: [
      `accounts.${site.domain} - ours. Where our staff raise documents, and where a document you have been sent is read. You do not need an account there to open a document link somebody sent you.`,
      `${PAY_DOMAIN} - yours. Where you see every document we have raised with you, and where you ask to be paid. It needs a sign-in we have granted to your Roblox account.`,
    ],
  },
  {
    heading: "Everything is in Robux",
    body: [
      "Every figure in this system is stated in **Robux (R$)**, and Robux is the only thing we pay or receive here.",
      "A Robux amount is not a cash value, a monetary balance, or a promise of conversion into real-world currency. We do not hold funds on your behalf as money, we do not operate an account or a wallet for you, and we do not offer any conversion, withdrawal or exchange. An amount recorded as owed to you is a record of an obligation, not a balance you hold with us.",
      "Robux moves through Roblox - a group payout or a direct transfer - and nowhere else. No page on any of our sites can send or take Robux, whatever it says on it.",
    ],
  },
  {
    heading: "The documents we raise",
    body: [
      "There are five kinds, and each says at the top what it is. All of them are numbered from a single sequence, so a number identifies exactly one document, forever.",
    ],
    list: [
      "Invoice - we are asking to be paid for something.",
      "Payroll slip - we owe you for work, a fee, or a reimbursement.",
      "Receipt - we are recording that a payment reached us.",
      "Credit note - we are correcting or reversing a document we already issued.",
      "Refund - we are authorising money back to a ticket holder. Exceptional; see below.",
    ],
  },
  {
    heading: "Issuing a document is not paying it",
    body: [
      "This is the most important thing on this page, so it gets its own section.",
      "When we issue a document that owes you money, **no Robux is sent**. The amount is recorded and held. It stays held until you ask for it.",
      `To ask, sign in at ${PAY_DOMAIN}, find the document on your statement, and request the funds. The amount comes from the document itself and cannot be edited - that frozen figure is the ceiling, and it is there to protect both of us.`,
      "Somebody reads every request. If it is agreed, the Robux is sent by Roblox group payout and the document is marked paid at that point. Nothing is automatic, and submitting a request is not the same as being paid.",
    ],
  },
  {
    heading: "How long it takes",
    body: [
      "We aim to action a request promptly, and we would always rather tell you where it is than leave you guessing.",
      "Payment may be delayed where information is incomplete, inaccurate, disputed, or needs checking - and we may ask you for more detail or for verification before releasing funds. A request that has been submitted has not, by itself, been agreed.",
      "A payout also depends on the Robux being available to send. Roblox holds group funds for a period after a sale before they can be paid out, and that is Roblox's rule, not ours.",
    ],
  },
  {
    heading: "The two request forms",
    body: [
      `There are exactly two things you can send us from ${PAY_DOMAIN}, and **neither of them moves any Robux**.`,
    ],
    list: [
      "Tell us about a payment - you have sent, or are about to send, Robux to us. This records that it is coming so we can match it and receipt it back to you. You still have to actually send it, through Roblox.",
      "Request a payment - you are asking us for money: a payout you are expecting, work delivered, an expense. If it is agreed, we raise a numbered document for it and the Robux follows by group payout.",
    ],
  },
  {
    heading: "Getting the details right",
    body: [
      "You are responsible for making sure what you submit is accurate and matches the document it refers to - in particular, the Roblox account the payout should reach.",
      "**Robux sent to an account you named cannot be recalled.** Roblox transactions are final and we have no ability to reverse one. If you give us the wrong account, the money is gone, and the loss is yours.",
      "By requesting payment you confirm that you are the intended recipient of the amount, and that what you have told us is accurate and complete.",
    ],
  },
  {
    heading: "When something is wrong",
    body: [
      "If a document looks incorrect, duplicated, disputed, or issued in error, tell us **before** you request payment on it. That is much easier to put right than a payout that has already gone.",
      "An issued document is never edited. That is deliberate: a document whose figures could change after it was sent is not a record of anything. Instead, we raise a credit note against it, or void it. A voided document stays on the record and keeps its number - numbers are never reused, so a gap in a sequence is always a real gap.",
      `We may correct, cancel, amend or invalidate a document issued in error, or where the obligation behind it is no longer valid. Where we do, we will say so. If you disagree with a document or a decision on a request, raise it with us at ${CONTACT_PATH} - we will look at it properly.`,
    ],
  },
  {
    heading: "Set-off, and unpaid amounts",
    body: [
      "Where you owe us an amount and we owe you one, we may set the two off against each other rather than sending Robux in both directions. Where we do, the documents on both sides say so.",
      "Where an amount you owe us remains unpaid, we may suspend further supply or withhold services until it is settled.",
    ],
  },
  {
    heading: "Tax and your own obligations",
    body: [
      "We pay the amount stated, in Robux. We do not withhold, deduct or account for tax on it, and nothing we issue is a tax document.",
      "You are responsible for your own tax, reporting and any other legal obligations arising from what you receive, wherever you live. If you are unsure what those are, take your own advice - we cannot give it to you.",
      "You are also responsible for complying with Roblox's own terms in receiving a payout. We are not able to pay an account Roblox will not let us pay.",
    ],
  },
  {
    heading: "Ticket refunds are different",
    body: [
      "A refund to a ticket holder does not work like the rest of this page, and is deliberately exceptional. Tickets are ordinarily non-refundable - see our [Ticket & Event Terms](/legal/tickets).",
      "A ticket bought with Robux was bought **through Roblox**, and that transaction cannot be reversed by us. Where we authorise a refund anyway, it is paid separately, by group payout, to the Roblox account named on the refund document.",
      `There is nothing to sign in to and nothing to claim: a ticket holder has no account on ${PAY_DOMAIN}, and we arrange the payment directly. If you hold a refund document and have a question about it, contact us at ${CONTACT_PATH}.`,
    ],
  },
  {
    heading: "Watch out for this",
    body: [
      "The one scam this system is shaped like, said plainly so you can recognise it:",
    ],
    list: [
      `We will **never ask you to send Robux in order to receive a payment**. Not a fee, not a deposit, not a verification amount. Anybody who does is not us.`,
      `We will never ask for your Roblox password, and we never see it. Sign-in happens at Roblox.`,
      `Our payment pages only ever live on ${PAY_DOMAIN} and accounts.${site.domain}. Check the address before you sign in anywhere. A link that looks like ours on any other domain is not ours.`,
      `A document link we send you is on accounts.${site.domain}. Opening one never asks you to sign in, and never asks for anything.`,
      `If you are not sure whether something came from us, do not act on it - ask us at ${CONTACT_PATH}.`,
    ],
  },
  {
    heading: "Access to the payment portal",
    body: [
      `Access to ${PAY_DOMAIN} is granted by us to a specific Roblox account, and it shows that account everything we have raised with the entity it belongs to. Treat it as you would any other account: use your own, and do not let somebody else sign in as you.`,
      "We can withdraw access at any time - for instance when somebody leaves the organisation it was granted for. Withdrawing access does not cancel anything owed; the documents stay, and so does the obligation.",
      "Tell us promptly if somebody who had access should no longer have it. Until you do, we have no way of knowing.",
    ],
  },
  {
    heading: "Records, and your data",
    body: [
      "We keep the documents we raise, the requests you send, and the record of who did what to each - that is what makes an accounting system worth having, and we cannot delete a document that records a real transaction between us.",
      "What we hold about you in this system, and what you can ask us to do about it, is set out in our [Privacy Policy](/legal/privacy) and our [Data & Privacy Requests](/legal/data-requests) page.",
    ],
  },
  {
    heading: "Changes to this page",
    body: [
      "If how any of this works changes, we update this page and the date at the top of it. The terms printed on a document are the terms that applied when it was issued.",
    ],
  },
  {
    heading: "Contact",
    body: [
      `Questions about a document, a payout, or a request: use the [contact page](/contact), or email [${site.contactEmail}](mailto:${site.contactEmail}).`,
    ],
  },
];

export default function PaymentsPage() {
  return (
    <LegalDoc
      title="Payments & Payouts"
      updated={legalUpdated("/legal/payments")}
      currentHref="/legal/payments"
      intro={`How we raise documents, how money actually moves, and the one sentence that matters most: issuing a document does not send the Robux - the amount is held until you ask for it at ${PAY_DOMAIN}.`}
      sections={sections}
    />
  );
}
