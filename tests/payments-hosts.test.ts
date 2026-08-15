import { describe, it, expect } from "vitest";
import { DocumentKind, PaymentRequestKind } from "@prisma/client";
import {
  EVERY_KIND_CONFIG,
  documentKindBySlug,
  kindConfig,
} from "@/lib/accounting/kinds";
import { documentPath, documentUrl } from "@/lib/accounting/urls";
import {
  PAY_DOMAIN,
  documentTerms,
  payoutStatementTerms,
} from "@/lib/accounting/terms";
import { site } from "@/lib/site";
import { LEGAL_DOCS } from "@/lib/legal";
import {
  PAY_TERMS_CLAUSES,
  PAY_TERMS_CONFIRMATIONS,
  PAY_TERMS_DOCUMENTS,
  PAY_TERMS_VERSION,
  needsPayTermsAcceptance,
  payTermsSnapshot,
} from "@/lib/accounting/pay-terms";
import {
  ALL_REQUEST_KINDS,
  REQUEST_KINDS,
  isFreeFormRequest,
  parseRequestKind,
  requestKindConfig,
} from "@/lib/accounting/request-kinds";

// The payment system now answers on two hosts of its own, and a document's URL is the
// string RNL sends to a contractor. That URL then lives in somebody else's inbox for
// years, so the things it is built from are asserted here rather than trusted.
//
// Everything in this file is pure. None of it touches the database - which is the point:
// these are the invariants a refactor breaks silently, because nothing throws and every
// page still renders.

describe("document kind slugs", () => {
  it("are unique across every kind", () => {
    // documentKindBySlug() resolves by scanning for the first match, so a duplicate slug
    // would make one kind unreachable by URL - and, worse, would make the OTHER kind's
    // links resolve to it. Two kinds cannot share a word in the address bar.
    const slugs = EVERY_KIND_CONFIG.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("are lowercase, hyphenated, and free of anything a URL would escape", () => {
    for (const cfg of EVERY_KIND_CONFIG) {
      expect(cfg.slug, `${cfg.kind} slug`).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
    }
  });

  it("round-trip through documentKindBySlug", () => {
    for (const cfg of EVERY_KIND_CONFIG) {
      expect(documentKindBySlug(cfg.slug)).toBe(cfg.kind);
    }
  });

  it("resolve case-insensitively - a link typed by hand is still a link", () => {
    expect(documentKindBySlug("INVOICE")).toBe(DocumentKind.INVOICE);
    expect(documentKindBySlug("Payslip")).toBe(DocumentKind.CONTRACTOR_PAYMENT);
  });

  it("refuse anything that is not a kind, rather than defaulting", () => {
    // A default here would mean /document/<junk>/<token> served a real document under a
    // word that describes nothing. The route 404s on null; it must actually get null.
    for (const v of ["", "  ", "invoices", "pay-slip", "contractor_payment", "../"]) {
      expect(documentKindBySlug(v), v).toBeNull();
    }
    expect(documentKindBySlug(null)).toBeNull();
    expect(documentKindBySlug(undefined)).toBeNull();
  });

  it("name the payslip as a contractor would say it", () => {
    // Pinned deliberately. `heading` is prose and has already been reworded once
    // ("Payment advice" → "Payroll slip") without any link needing to change - which only
    // stayed true because the slug is its own field. If this assertion is ever edited,
    // every payslip link RNL has sent is being broken on purpose.
    expect(kindConfig(DocumentKind.CONTRACTOR_PAYMENT).slug).toBe("payslip");
    expect(kindConfig(DocumentKind.INVOICE).slug).toBe("invoice");
    expect(kindConfig(DocumentKind.RECEIPT).slug).toBe("receipt");
  });
});

describe("document URLs", () => {
  const issued = { kind: DocumentKind.INVOICE, shareToken: "a".repeat(40) };

  it("carry the kind and the token, in that order", () => {
    expect(documentPath(issued)).toBe(`/document/invoice/${"a".repeat(40)}`);
  });

  it("are absolute and always on the ACCOUNTS host", () => {
    // Whichever host generated it. The link a partner reads off their statement on
    // pay.ronation.live and the one staff copy off the desk have to be the same string,
    // or "which URL did I send them?" becomes a question somebody has to answer.
    const url = documentUrl(issued);
    expect(url).toBeTruthy();
    expect(new URL(url!).hostname.startsWith("accounts.")).toBe(true);
    expect(new URL(url!).pathname).toBe(documentPath(issued));
  });

  it("are null for a draft, so callers render nothing rather than a dead link", () => {
    const draft = { kind: DocumentKind.INVOICE, shareToken: null };
    expect(documentPath(draft)).toBeNull();
    expect(documentUrl(draft)).toBeNull();
  });

  it("still resolve the shape of the 24-character tokens minted before the move", () => {
    // Old links are matched exactly against the column and there is no length check
    // anywhere - see the note on TOKEN_LENGTH. This asserts nothing here has quietly
    // grown one.
    const old = { kind: DocumentKind.RECEIPT, shareToken: "b".repeat(24) };
    expect(documentPath(old)).toBe(`/document/receipt/${"b".repeat(24)}`);
  });
});

describe("held funds", () => {
  it("mark the two kinds that hold money as releasable, and only those", () => {
    // Issuing one of these does NOT send the Robux - it is held until the payee asks. The
    // flag is what puts a "Request funds" button on their statement, so getting the set
    // wrong either strands money (missing) or offers a self-service claim on a document
    // that owes nobody anything (extra).
    const releasable = EVERY_KIND_CONFIG.filter((c) => c.releasable).map((c) => c.kind);
    expect(new Set(releasable)).toEqual(
      new Set([DocumentKind.CONTRACTOR_PAYMENT, DocumentKind.CREDIT_NOTE]),
    );
  });

  it("do NOT make a ticket refund releasable, though it is outbound", () => {
    // The one case a `direction === "outbound"` shortcut would get wrong. A refund's payee
    // is a ticket holder: no partner account, no statement, nowhere to press a button - and
    // the refund desk is meant to stay a deliberate act by a person. See the note on the
    // field in kinds.ts.
    const refund = kindConfig(DocumentKind.TICKET_REFUND);
    expect(refund.direction).toBe("outbound");
    expect(refund.releasable).toBe(false);
  });

  it("say on the payslip itself that issuing does not send the Robux", () => {
    // The contractor reads this on paper, possibly weeks before anybody looks at a screen.
    // The old wording implied the payout was already on its way.
    const print = kindConfig(DocumentKind.CONTRACTOR_PAYMENT)
      .smallPrint.join(" ")
      .toLowerCase();
    expect(print).toContain("does not send the robux");
    expect(print).toContain("held until you request it");
  });

  it("do not leave the payslip's terms claiming it was paid on issue", () => {
    const terms = kindConfig(DocumentKind.CONTRACTOR_PAYMENT).defaultTerms.toLowerCase();
    expect(terms).not.toContain("paid on issue");
    expect(terms).toContain("held until requested");
  });
});

describe("printed terms", () => {
  const everyBlock = [
    ...EVERY_KIND_CONFIG.map((c) => ({
      what: `${c.kind} terms`,
      terms: documentTerms(c.kind),
    })),
    { what: "partner payout statement", terms: payoutStatementTerms("partner") },
    { what: "own revenue statement", terms: payoutStatementTerms("self") },
  ];

  it("exist, in full, on every sheet this system prints", () => {
    // Including TICKET_REFUND, which is not in DOCUMENT_KINDS, and both payout variants.
    // A sheet that prints without terms is the one somebody will be holding in the
    // argument these paragraphs exist to prevent.
    for (const { what, terms } of everyBlock) {
      expect(terms.heading.length, what).toBeGreaterThan(0);
      expect(terms.clauses.length, what).toBeGreaterThanOrEqual(4);
      expect(terms.facts.length, what).toBeGreaterThanOrEqual(2);
      for (const c of terms.clauses) expect(c.trim().length, what).toBeGreaterThan(40);
    }
  });

  it("close every bold marker they open", () => {
    // The renderer only substitutes a MATCHED **pair** and leaves anything else exactly as
    // written - which is the right failure mode on screen and an awful one on paper, where
    // a stray "**" prints as two asterisks in the middle of a legal clause.
    for (const { what, terms } of everyBlock) {
      for (const c of terms.clauses) {
        expect((c.match(/\*\*/g) ?? []).length % 2, `${what}: ${c.slice(0, 40)}`).toBe(0);
      }
    }
  });

  it("never claim RNL owes money on a sheet where the money runs the other way", () => {
    // The inversion that a single shared block of terms would have shipped: an invoice is
    // RNL asking to be paid, and "the amount payable by RO. Nation LIVE" on one is a
    // written admission of a debt that does not exist.
    // Read as the recipient reads it - emphasis stripped - because "payable **to RNL**"
    // and "payable to RNL" are the same sentence on paper and only one of them survives
    // a naive substring match.
    const asRead = (kind: DocumentKind) =>
      documentTerms(kind).clauses.join(" ").replace(/\*\*/g, "").toLowerCase();

    for (const kind of [DocumentKind.INVOICE, DocumentKind.RECEIPT]) {
      expect(asRead(kind), kind).not.toContain("payable by ro. nation live");
    }
    expect(asRead(DocumentKind.INVOICE)).toContain("payable to ro. nation live");
  });

  it("point at the payment portal on exactly the sheets that hold money", () => {
    // "Sign in at pay.ronation.live" is only true where there is something to claim and an
    // account to claim it with. On a TICKET_REFUND it is both - the payee is a member of
    // the public with no portal account, and sending them to a login screen they can never
    // pass is the one instruction on this paper that cannot be recovered from.
    for (const cfg of EVERY_KIND_CONFIG) {
      const text = documentTerms(cfg.kind).clauses.join(" ");
      const tellsThemToSignIn = text.includes(`sign in at **${PAY_DOMAIN}**`);
      expect(tellsThemToSignIn, cfg.kind).toBe(cfg.releasable);
    }

    const refund = documentTerms(DocumentKind.TICKET_REFUND).clauses.join(" ");
    expect(refund).not.toContain(PAY_DOMAIN);
    expect(refund.toLowerCase()).toContain("no account or sign-in is needed");
  });

  it("say on every held sheet that issuing it is not payment", () => {
    // The sentence the whole held-funds model rests on. See the note on `releasable`.
    const held = [
      ...EVERY_KIND_CONFIG.filter((c) => c.releasable).map((c) =>
        documentTerms(c.kind),
      ),
      payoutStatementTerms("partner"),
    ];
    for (const terms of held) {
      const text = terms.clauses.join(" ").toLowerCase();
      expect(text).toContain("does not constitute payment");
      expect(text).toContain("held pending a valid payment request");
    }
  });

  it("keep the claim wording off RNL's own revenue statement", () => {
    // There is no external payee on it, so a block telling "the recipient" how to request
    // payment would be RNL writing instructions to itself.
    const self = payoutStatementTerms("self").clauses.join(" ");
    expect(self).not.toContain(PAY_DOMAIN);
    expect(self.toLowerCase()).toContain("not a payment instruction");
  });

  it("name the portal as a subdomain of the site's own domain", () => {
    // PAY_DOMAIN is printed on paper that outlives any deploy, and it is derived rather
    // than typed so a move is one edit. This asserts the derivation still holds.
    expect(PAY_DOMAIN).toBe(`pay.${site.domain}`);
    expect(PAY_DOMAIN).not.toContain("localhost");
  });
});

describe("the payment terms gate", () => {
  const accepted = {
    payTermsAcceptedAt: new Date("2026-08-15T10:00:00Z"),
    payTermsVersion: PAY_TERMS_VERSION,
  };

  it("lets through only a login that accepted THIS version", () => {
    expect(needsPayTermsAcceptance(accepted)).toBe(false);
  });

  it("stops a login that has never accepted", () => {
    expect(
      needsPayTermsAcceptance({ payTermsAcceptedAt: null, payTermsVersion: null }),
    ).toBe(true);
    // Every membership row written before the columns existed looks like this. There is
    // deliberately no backfill - see the note on the column.
    expect(
      needsPayTermsAcceptance({
        payTermsAcceptedAt: null,
        payTermsVersion: PAY_TERMS_VERSION,
      }),
    ).toBe(true);
  });

  it("stops a login holding an older acceptance", () => {
    // The entire reason the version is stored beside the date. Without this check, a
    // partner who agreed to the first version of these terms would never be shown a
    // changed one, and the record would say they had accepted something they never read.
    expect(
      needsPayTermsAcceptance({ ...accepted, payTermsVersion: "2026-01-01" }),
    ).toBe(true);
    expect(needsPayTermsAcceptance({ ...accepted, payTermsVersion: null })).toBe(true);
  });

  it("has something to accept, and two distinct things to confirm", () => {
    expect(PAY_TERMS_DOCUMENTS.length).toBeGreaterThanOrEqual(2);
    expect(PAY_TERMS_CLAUSES.length).toBeGreaterThanOrEqual(3);
    // Two, and not one. The second is what makes the acceptance bind the ENTITY rather
    // than the individual signed in, and collapsing them loses exactly that.
    expect(PAY_TERMS_CONFIRMATIONS.length).toBeGreaterThanOrEqual(2);
    expect(new Set(PAY_TERMS_CONFIRMATIONS.map((c) => c.name)).size).toBe(
      PAY_TERMS_CONFIRMATIONS.length,
    );
  });

  it("points every document at a policy that exists", () => {
    // A gate whose "read this first" link 404s is a gate that asks somebody to accept a
    // document they were not shown. legalUpdated() throws at build time on an unregistered
    // href, so checking against the registry here is checking the same list the site does.
    for (const d of PAY_TERMS_DOCUMENTS) {
      expect(LEGAL_DOCS.map((l) => l.href), d.title).toContain(d.href);
    }
    expect(PAY_TERMS_DOCUMENTS.map((d) => d.href)).toContain("/legal/payments");
  });

  it("freezes what was shown, not what was posted", () => {
    // The half that matters when it is disputed. The snapshot has to contain the version,
    // every clause and every confirmation - if it only recorded the date, it would record
    // agreement to a text nobody can reconstruct. Same argument as Ticket.termsSnapshot.
    const snap = payTermsSnapshot();
    expect(snap.some((l) => l.includes(PAY_TERMS_VERSION))).toBe(true);
    for (const c of PAY_TERMS_CLAUSES) expect(snap).toContain(c);
    for (const c of PAY_TERMS_CONFIRMATIONS) {
      expect(snap.some((l) => l.includes(c.label)), c.name).toBe(true);
    }
    for (const d of PAY_TERMS_DOCUMENTS) {
      expect(snap.some((l) => l.includes(d.href)), d.title).toBe(true);
    }
  });

  it("closes every bold marker it opens", () => {
    // Same failure as the printed terms: an unmatched "**" renders as two asterisks in the
    // middle of the one sentence somebody is being asked to agree to.
    for (const c of PAY_TERMS_CLAUSES) {
      expect((c.match(/\*\*/g) ?? []).length % 2, c.slice(0, 40)).toBe(0);
    }
  });

  it("warns about the scam this system is shaped like", () => {
    // The single most valuable line on the card, and the reason a gate beats a policy
    // nobody opens: a partner who has read this once does not fall for it later.
    const text = PAY_TERMS_CLAUSES.join(" ").replace(/\*\*/g, "").toLowerCase();
    expect(text).toContain("never ask you to send robux to receive a payment");
    expect(text).toContain("issuing a document is not payment");
  });
});

describe("payment request kinds", () => {
  it("read differently from each side of the desk", () => {
    // The same row is "Payment to RO. Nation LIVE" to the client and "Incoming payment"
    // to staff. Both strings are real and both are used; if they ever collapse into one,
    // one of the two pages has started describing the transaction from the wrong side.
    for (const cfg of REQUEST_KINDS) {
      expect(cfg.label).not.toBe(cfg.staffLabel);
      expect(cfg.label.length).toBeGreaterThan(0);
      expect(cfg.staffLabel.length).toBeGreaterThan(0);
    }
  });

  it("point the two directions at opposite sides of the ledger", () => {
    expect(requestKindConfig(PaymentRequestKind.PAYMENT).direction).toBe("inbound");
    expect(requestKindConfig(PaymentRequestKind.REQUEST).direction).toBe("outbound");
  });

  it("say plainly, on the PAYMENT form, that no Robux moves", () => {
    // The single most consequential sentence on pay.ronation.live. A form headed "make a
    // payment" that quietly does nothing is one somebody submits and then waits on.
    const blurb = requestKindConfig(PaymentRequestKind.PAYMENT).formBlurb;
    expect(blurb.toLowerCase()).toContain("does not move any robux");
  });

  it("refuse an unknown kind rather than defaulting to one", () => {
    // Defaulting would let a tampered hidden field turn "please pay me" into "I paid you".
    for (const v of ["", "payments", "refund", "OUTBOUND"]) {
      expect(parseRequestKind(v), v).toBeNull();
    }
    expect(parseRequestKind("payment")).toBe(PaymentRequestKind.PAYMENT);
    expect(parseRequestKind("REQUEST")).toBe(PaymentRequestKind.REQUEST);
  });

  it("keep RELEASE out of the two free-form forms", () => {
    // A RELEASE's amount comes from the document it claims. Offering it in a form would
    // hand somebody a text box where the frozen figure used to be - the same trap
    // DOCUMENT_KINDS avoids by excluding TICKET_REFUND.
    expect(REQUEST_KINDS.map((c) => c.kind)).not.toContain(PaymentRequestKind.RELEASE);
    expect(ALL_REQUEST_KINDS.map((c) => c.kind)).toContain(PaymentRequestKind.RELEASE);
    expect(isFreeFormRequest(PaymentRequestKind.RELEASE)).toBe(false);
    expect(isFreeFormRequest(PaymentRequestKind.PAYMENT)).toBe(true);
    expect(isFreeFormRequest(PaymentRequestKind.REQUEST)).toBe(true);
  });

  it("still resolve RELEASE by name, so an existing row can be read back", () => {
    // parseRequestKind guards the FORM; it must not become the thing that decides a kind
    // exists at all, or a stored RELEASE row would stop rendering.
    expect(parseRequestKind("release")).toBe(PaymentRequestKind.RELEASE);
    expect(requestKindConfig(PaymentRequestKind.RELEASE).direction).toBe("outbound");
  });
});
