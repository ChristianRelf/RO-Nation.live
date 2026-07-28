import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getDocumentByToken } from "@/lib/accounting/documents";
import { documentPath } from "@/lib/accounting/urls";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Document · RO. Nation LIVE",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * The share link's OLD address: /doc/<token>, with no kind in it.
 *
 * This page no longer renders anything. It looks the token up and forwards to the
 * document's canonical URL, /document/<kind>/<token> - and it EXISTS, rather than the
 * middleware doing the rewrite, because the middleware cannot: only the database knows
 * which kind a token points at, and the middleware runs on the edge with no database.
 *
 * ---- Why keep it at all ---------------------------------------------------
 *
 * Every document RNL has already issued carries one of these links, in somebody else's
 * inbox, and a financial record whose address stops resolving is worse than an
 * inconvenience - it is a contractor who cannot produce the payslip they were sent. The
 * tokens themselves did not change (they are matched exactly, and the old 24-character
 * ones still resolve - see the note on TOKEN_LENGTH), so this is purely a change of
 * shape, and a shape change is exactly what a redirect is for.
 *
 * ---- The 404 is the same 404 ---------------------------------------------
 *
 * A wrong, rotated or draft token gets notFound() here, the same answer the new route
 * gives, so this cannot be used as an oracle for which tokens exist while the new one
 * refuses to be.
 *
 * The redirect is RELATIVE. The middleware only serves this path on the accounts host
 * (it is in ACCOUNTS_PATHS) and forwards it there from everywhere else, so by the time
 * this renders, "here" is already the right host.
 */
export default async function LegacySharedDocumentPage({
  params,
}: {
  params: { token: string };
}) {
  const doc = await getDocumentByToken(params.token);
  if (!doc) notFound();

  const path = documentPath(doc);
  // Belt and braces: getDocumentByToken excludes drafts, and only a draft has no token,
  // so this cannot be null in practice. If it ever is, a 404 is the honest answer - there
  // is no URL to send them to.
  if (!path) notFound();

  redirect(path);
}
