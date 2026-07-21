"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { DocumentKind, DocumentStatus } from "@prisma/client";
import { requireCompanyUser, type CompanyUser } from "@/lib/company";
import { AuditAction, AuditActorKind, AuditTarget, recordAudit, COMPANY_SCOPE } from "@/lib/audit";
import { s, parseDate } from "@/lib/content";
import { parseKind } from "@/lib/accounting/kinds";
import { buildTotals, readLineItems } from "@/lib/accounting/lines";
import {
  createDraft,
  deleteDraft,
  getDocument,
  issueDocument,
  markPaid,
  rotateShareToken,
  updateDraft,
  voidDocument,
  type DocumentFields,
} from "@/lib/accounting/documents";
import { formatRobux } from "@/lib/tickets/pricing";

// Every act on an accounting document, and all of them the COMPANY's - there is no
// counterparty-facing write here at all. The share link is read-only by construction:
// a recipient holding a token can open a document and nothing else.
//
// Two shapes of action live here, on purpose:
//
//   the BUILDER actions (create/save) take useFormState's (prevState, formData) and
//   RETURN an error rather than redirecting to one. A ten-line payment advice rejected
//   for "line 4 has no description" must not throw the other nine lines away, and a
//   redirect does exactly that.
//
//   the LIFECYCLE actions (issue/paid/void/…) are plain formData handlers that redirect,
//   like the rest of the app. They carry no typed input worth preserving.
//
// Every one of them re-checks company rank server-side. A page that hides a button is
// not a permission.

export type DocumentFormState = { error: string } | null;

function refresh(id?: string) {
  revalidatePath("/company/accounting");
  if (id) revalidatePath(`/company/accounting/${id}`);
}

/**
 * Read the builder's posted fields into the shape the lib layer writes.
 *
 * Returns a message instead of throwing, because every failure in here is something a
 * person typed and can fix. Note what is NOT read: any total. The form posts
 * descriptions, quantities and unit prices, and buildTotals derives the money from
 * those - a form that could post its own total could post any total.
 */
function readForm(
  formData: FormData,
): { ok: true; value: DocumentFields } | { ok: false; error: string } {
  const title = s(formData, "title");
  const counterpartyName = s(formData, "counterpartyName");
  if (!title) return { ok: false, error: "Say what the document is for." };
  if (!counterpartyName) return { ok: false, error: "Name the other party." };

  // The lines arrive as one JSON field - see the note in DocumentBuilder. Parsed
  // defensively: this is a hidden input, so it is whatever the client sent.
  let rawLines: { description: string; qty: string; unit: string }[];
  try {
    const parsed: unknown = JSON.parse(s(formData, "lines") || "[]");
    if (!Array.isArray(parsed)) throw new Error("not an array");
    rawLines = parsed.map((r) => {
      const row = (r ?? {}) as Record<string, unknown>;
      return {
        description: typeof row.description === "string" ? row.description : "",
        qty: typeof row.qty === "string" ? row.qty : "",
        unit: typeof row.unit === "string" ? row.unit : "",
      };
    });
  } catch {
    return { ok: false, error: "The lines couldn't be read. Reload and try again." };
  }

  const totals = buildTotals(rawLines, s(formData, "adjustment"));
  if (!totals.ok) return { ok: false, error: totals.error };

  const documentDate = parseDate(s(formData, "documentDate"));
  if (!documentDate) return { ok: false, error: "Give the document a valid date." };

  return {
    ok: true,
    value: {
      title,
      counterpartyName,
      counterpartyRef: s(formData, "counterpartyRef"),
      counterpartyDetail: s(formData, "counterpartyDetail"),
      relatedId: s(formData, "relatedId"),
      totals: totals.value,
      adjustmentLabel: s(formData, "adjustmentLabel"),
      terms: s(formData, "terms"),
      notes: s(formData, "notes"),
      documentDate,
      dueDate: parseDate(s(formData, "dueDate")),
    },
  };
}

/**
 * Validate that `relatedId`, if set, actually points at an issued document.
 *
 * The picker only offers issued ones, but the field is a posted string: without this a
 * crafted post could point a receipt at a draft and, on issue, silently flip that draft
 * to PAID - a document marked settled that was never even sent.
 */
async function checkRelated(
  relatedId: string,
  self?: string,
): Promise<{ ok: true; value: string | null } | { ok: false }> {
  if (!relatedId) return { ok: true, value: null };
  const target = await getDocument(relatedId);
  if (!target || target.status !== DocumentStatus.ISSUED || target.id === self) {
    return { ok: false };
  }
  return { ok: true, value: relatedId };
}

const RELATED_GONE =
  "The document this points at is no longer open. Pick another.";

// ---- The builder ---------------------------------------------------------

/** Start a new document. Lands on its draft, which is the thing you then check and issue. */
export async function createDocument(
  _prev: DocumentFormState,
  formData: FormData,
): Promise<DocumentFormState> {
  const user = await requireCompanyUser();

  const kind = parseKind(s(formData, "kind"));
  if (!kind) return { error: "Unknown document type." };

  const parsed = readForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const related = await checkRelated(parsed.value.relatedId ?? "");
  if (!related.ok) return { error: RELATED_GONE };

  const doc = await createDraft(
    { ...parsed.value, relatedId: related.value, kind },
    user,
  );
  await audit(user, AuditAction.CREATED, doc.id, doc.title, {
    kind,
    total: doc.total,
  });

  refresh(doc.id);
  redirect(`/company/accounting/${doc.id}`);
}

/** Rewrite a draft. Refuses anything that has already been issued. */
export async function saveDocument(
  _prev: DocumentFormState,
  formData: FormData,
): Promise<DocumentFormState> {
  const user = await requireCompanyUser();

  const id = s(formData, "id");
  const existing = await getDocument(id);
  if (!existing) return { error: "That document no longer exists." };
  if (existing.status !== DocumentStatus.DRAFT) {
    return {
      error:
        "That document has been issued, so it can't be edited. Void it and write a new one, or raise a credit note.",
    };
  }

  const parsed = readForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const related = await checkRelated(parsed.value.relatedId ?? "", id);
  if (!related.ok) return { error: RELATED_GONE };

  // False means it stopped being a draft between the read above and this write - the
  // stale-tab case. The freeze held; say so rather than pretending it saved.
  const saved = await updateDraft(id, { ...parsed.value, relatedId: related.value });
  if (!saved) return { error: "That document was issued while you were editing it." };

  await audit(user, AuditAction.UPDATED, id, parsed.value.title, {
    total: parsed.value.totals.total,
  });

  refresh(id);
  redirect(`/company/accounting/${id}`);
}

// ---- Lifecycle -----------------------------------------------------------

/** Freeze a draft: number it, mint its share link, and close it to editing. */
export async function issueDocumentAction(formData: FormData) {
  const user = await requireCompanyUser();
  const id = s(formData, "id");

  const result = await issueDocument(id, user);
  if (!result.ok) {
    redirect(
      `/company/accounting/${id}?error=${result.reason === "missing" ? "missing" : "already"}`,
    );
  }

  const doc = result.document;
  await audit(user, AuditAction.ISSUED, id, doc.number ?? doc.title, {
    kind: doc.kind,
    number: doc.number,
    total: doc.total,
    counterparty: doc.counterpartyName,
  });

  refresh(id);
  redirect(`/company/accounting/${id}?ok=issued`);
}

/** Record that an issued document has been settled. */
export async function markPaidAction(formData: FormData) {
  const user = await requireCompanyUser();
  const id = s(formData, "id");

  const done = await markPaid(id);
  if (!done) redirect(`/company/accounting/${id}?error=notopen`);

  const doc = await getDocument(id);
  await audit(user, AuditAction.UPDATED, id, doc?.number ?? id, {
    marked: "paid",
    total: doc?.total,
  });

  refresh(id);
  redirect(`/company/accounting/${id}?ok=paid`);
}

/** Cancel an issued document. The row and its number stay - this is a correction, not a delete. */
export async function voidDocumentAction(formData: FormData) {
  const user = await requireCompanyUser();
  const id = s(formData, "id");
  const reason = s(formData, "reason");

  const done = await voidDocument(id, reason);
  if (!done) redirect(`/company/accounting/${id}?error=notopen`);

  const doc = await getDocument(id);
  await audit(
    user,
    AuditAction.VOIDED,
    id,
    doc?.number ?? id,
    { reason },
    // Announced: cancelling a document somebody has already been sent is exactly the
    // sort of write the Discord trail is for.
    true,
  );

  refresh(id);
  redirect(`/company/accounting/${id}?ok=voided`);
}

/** Bin a draft. Only ever a draft - deleteDraft scopes it, and this is why. */
export async function discardDraftAction(formData: FormData) {
  const user = await requireCompanyUser();
  const id = s(formData, "id");

  const doc = await getDocument(id);
  const done = await deleteDraft(id);
  if (!done) redirect(`/company/accounting/${id}?error=notdraft`);

  await audit(user, AuditAction.DELETED, id, doc?.title ?? id, { wasDraft: true });

  refresh();
  redirect("/company/accounting?ok=discarded");
}

/** Kill the old share link and mint a new one. The way to un-send a mis-sent document. */
export async function rotateShareLinkAction(formData: FormData) {
  const user = await requireCompanyUser();
  const id = s(formData, "id");

  const token = await rotateShareToken(id);
  if (!token) redirect(`/company/accounting/${id}?error=notissued`);

  await audit(user, AuditAction.REVOKED, id, "share link", { rotated: true });

  refresh(id);
  redirect(`/company/accounting/${id}?ok=rotated`);
}

/**
 * Start a credit note against an issued document, pre-filled from it.
 *
 * A convenience, not a separate concept: it creates an ordinary CREDIT_NOTE draft whose
 * lines mirror the original, which you then trim to whatever is actually being credited.
 * Pre-filling the whole thing is right - the common case is crediting all of it.
 */
export async function creditNoteFromAction(formData: FormData) {
  const user = await requireCompanyUser();
  const sourceId = s(formData, "id");

  const source = await getDocument(sourceId);
  if (!source || source.status !== DocumentStatus.ISSUED) {
    redirect(`/company/accounting/${sourceId}?error=notopen`);
  }

  // Through readLineItems, not a bare cast: lineItems is a Json column, so a document
  // written by an older shape of this code must still be creditable rather than
  // throwing halfway through building the note.
  const lines = readLineItems(source.lineItems);
  const draft = await createDraft(
    {
      kind: DocumentKind.CREDIT_NOTE,
      title: `Credit for ${source.number ?? source.title}`,
      counterpartyName: source.counterpartyName,
      counterpartyRef: source.counterpartyRef,
      counterpartyDetail: source.counterpartyDetail,
      relatedId: source.id,
      totals: {
        lines,
        subtotal: source.subtotal,
        // The original's adjustment is NOT carried across. It described that document's
        // arithmetic ("advance already paid"), and repeating it here would credit back
        // money that was never charged. Trim the lines instead.
        adjustmentRobux: 0,
        total: source.subtotal,
      },
      adjustmentLabel: null,
      terms: "",
      notes: `Credits ${source.number ?? "an earlier document"}.`,
      documentDate: new Date(),
      dueDate: null,
    },
    user,
  );

  await audit(user, AuditAction.CREATED, draft.id, draft.title, {
    kind: DocumentKind.CREDIT_NOTE,
    creditsId: source.id,
    creditsNumber: source.number,
  });

  refresh(draft.id);
  redirect(`/company/accounting/${draft.id}/edit`);
}

/** One audit line, in the company scope. Shape borrowed from the rest of the app. */
function audit(
  user: CompanyUser,
  action: AuditAction,
  id: string,
  name: string,
  meta: Record<string, unknown>,
  announce = false,
) {
  const verb: Partial<Record<AuditAction, string>> = {
    [AuditAction.CREATED]: "drafted",
    [AuditAction.UPDATED]: "updated",
    [AuditAction.ISSUED]: "issued",
    [AuditAction.VOIDED]: "voided",
    [AuditAction.DELETED]: "discarded draft",
    [AuditAction.REVOKED]: "rotated the share link on",
  };

  return recordAudit({
    scope: COMPANY_SCOPE,
    action,
    target: AuditTarget.ACCOUNTING_DOCUMENT,
    targetId: id,
    targetName: name,
    actor: { id: user.robloxId, name: user.displayName, kind: AuditActorKind.COMPANY },
    summary: `${user.displayName} ${verb[action] ?? "changed"} ${name}${
      typeof meta.total === "number" ? ` (${formatRobux(meta.total)})` : ""
    }`,
    meta: meta as Prisma.InputJsonValue,
    announce,
  });
}
