import { describe, it, expect } from "vitest";
import { DocumentKind, PaymentRequestKind } from "@prisma/client";
import {
  EVERY_KIND_CONFIG,
  documentKindBySlug,
  kindConfig,
} from "@/lib/accounting/kinds";
import { documentPath, documentUrl } from "@/lib/accounting/urls";
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
    const print = kindConfig(DocumentKind.CONTRACTOR_PAYMENT).smallPrint.toLowerCase();
    expect(print).toContain("does not send the robux");
    expect(print).toContain("held until you request it");
  });

  it("do not leave the payslip's terms claiming it was paid on issue", () => {
    const terms = kindConfig(DocumentKind.CONTRACTOR_PAYMENT).defaultTerms.toLowerCase();
    expect(terms).not.toContain("paid on issue");
    expect(terms).toContain("held until requested");
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
