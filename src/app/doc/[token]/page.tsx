import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentPaper } from "@/components/accounting/document-paper";
import {
  getDocument,
  getDocumentByToken,
  recordShareView,
} from "@/lib/accounting/documents";

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
 * A document on its share link.
 *
 * The whole authorisation story is the token: hold it and you read this document, and
 * only this one. There is no session, no account, and NOTHING to act on - every write
 * lives behind the company gate, so a recipient can read and print and nothing else.
 *
 * Deliberately the same DocumentPaper the company sees, minus the toolbar: what you
 * checked before sending is exactly what they receive. Drafts are excluded in the
 * query (see getDocumentByToken), so an unissued document is a 404 here even if someone
 * were handed a token for one.
 */
export default async function SharedDocumentPage({
  params,
}: {
  params: { token: string };
}) {
  const doc = await getDocumentByToken(params.token);
  // A wrong, rotated or draft token is a plain 404 - the same answer for all three, so
  // the page cannot be used to probe which documents exist.
  if (!doc) notFound();

  // Fire-and-forget: counting a view must never be in the path of showing the document.
  // recordShareView swallows its own errors for the same reason.
  void recordShareView(doc.id);

  const related = doc.relatedId ? await getDocument(doc.relatedId) : null;

  return (
    <DocumentPaper document={doc} relatedNumber={related?.number ?? null} />
  );
}
