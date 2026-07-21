import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCompanyUser } from "@/lib/company";
import { CompanyShell } from "@/components/company-shell";
import { AdminHeader } from "@/components/admin-ui";
import { DocumentBuilder } from "@/components/accounting/document-builder";
import { kindConfig, parseKind } from "@/lib/accounting/kinds";
import { listRelatable } from "@/lib/accounting/documents";
import { createDocument } from "@/app/actions/accounting";
import { relatableOptions } from "../relatable";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: { kind?: string };
}): Promise<Metadata> {
  const kind = parseKind(searchParams.kind);
  return { title: kind ? `New ${kindConfig(kind).label.toLowerCase()}` : "New document" };
}

// Write a new document. The KIND is chosen on the hub and arrives in the query - it is
// not a field in the form, because what a document IS decides its number, its wording
// and half its fields, and changing it halfway through writing one is not an edit, it is
// a different document.
export default async function NewDocumentPage({
  searchParams,
}: {
  searchParams: { kind?: string };
}) {
  const user = await requireCompanyUser();

  // A missing or invented ?kind is a 404, never a silent default: defaulting would mint
  // an invoice for somebody who clicked "credit note".
  const kind = parseKind(searchParams.kind);
  if (!kind) notFound();

  const cfg = kindConfig(kind);
  // Only fetched for the kinds that can point at something - the picker isn't rendered
  // otherwise, and this is a query.
  const relatable = cfg.relates ? relatableOptions(await listRelatable()) : [];

  return (
    <CompanyShell user={user}>
      <AdminHeader title={`New ${cfg.label.toLowerCase()}`} subtitle={cfg.hint} />

      <p className="mb-6 text-sm">
        <Link href="/company/accounting" className="text-muted hover:text-fg">
          ← Accounting
        </Link>
      </p>

      <DocumentBuilder
        kind={kind}
        action={createDocument}
        relatable={relatable}
        submitLabel="Save draft"
        cancelHref="/company/accounting"
      />
    </CompanyShell>
  );
}
