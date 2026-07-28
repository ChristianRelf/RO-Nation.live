import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentPaper } from "@/components/accounting/document-paper";
import {
  getDocument,
  getDocumentByToken,
  recordShareView,
} from "@/lib/accounting/documents";
import { documentKindBySlug } from "@/lib/accounting/kinds";

export const dynamic = "force-dynamic";

/**
 * NOINDEX, and it matters more here than almost anywhere else on the site.
 *
 * These pages are unauthenticated by design - a contractor has no account - so the only
 * thing standing between a document and the world is that nobody knows the URL. A
 * crawler that indexed one would turn "unguessable" into "searchable" in an afternoon.
 * The token never appears in a link on any public page for the same reason.
 */
export const metadata: Metadata = {
  title: "Document · RO. Nation LIVE",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * A document on its share link: accounts.ronation.live/document/<kind>/<token>.
 *
 * The whole authorisation story is the TOKEN. Hold it and you read this document, and only
 * this one. There is no session, no account, and NOTHING to act on - every write lives
 * behind the company gate, so a recipient can read and print and nothing else. The
 * middleware exempts this path from the accounts host's sign-in gate for exactly that
 * reason (ACCOUNTS_PUBLIC_PATHS), and the route sits outside app/accounts/ so the company
 * layout does not wrap it.
 *
 * ---- What the <kind> segment is, and what it is emphatically not ----------
 *
 * It is a LABEL, so a link says what it is before somebody clicks it. It is not a second
 * factor and it authorises nothing: the token already identifies exactly one document, and
 * a URL is not made safer by having more of it guessed correctly.
 *
 * But it is CHECKED, on every request, against the document's real kind - and the check is
 * the whole reason a mismatch 404s rather than redirecting. If /document/invoice/<token>
 * quietly served a payslip, the URL in somebody's inbox would be describing the wrong
 * document while displaying the right one, and the address of a financial record would
 * have stopped being a fact about it. A wrong slug means the link was mistyped or
 * hand-edited, and the honest answer to both is "no such document".
 *
 * ---- Deliberately the same page the company sees --------------------------
 *
 * The same DocumentPaper, minus the toolbar: what you checked before sending is exactly
 * what they receive. Drafts are excluded in the query (getDocumentByToken), so an unissued
 * document is a 404 here even if somebody were handed a token for one.
 */
export default async function SharedDocumentPage({
  params,
}: {
  params: { kind: string; token: string };
}) {
  const claimed = documentKindBySlug(params.kind);
  // An unrecognised slug cannot name a document, so there is nothing to look up. Answered
  // before touching the database, which also means this route cannot be used to time
  // whether a token exists by feeding it a junk kind.
  if (!claimed) notFound();

  const doc = await getDocumentByToken(params.token);
  // A wrong, rotated or draft token is a plain 404 - the same answer for all three, so the
  // page cannot be used to probe which documents exist.
  if (!doc) notFound();
  if (doc.kind !== claimed) notFound();

  // Fire-and-forget: counting a view must never be in the path of showing the document.
  // recordShareView swallows its own errors for the same reason.
  void recordShareView(doc.id);

  const related = doc.relatedId ? await getDocument(doc.relatedId) : null;

  return (
    <DocumentPaper document={doc} relatedNumber={related?.number ?? null} />
  );
}
