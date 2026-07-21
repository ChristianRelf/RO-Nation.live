import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DocumentStatus } from "@prisma/client";
import { requireCompanyUser } from "@/lib/company";
import { CompanyShell } from "@/components/company-shell";
import { AdminHeader } from "@/components/admin-ui";
import { DocumentBuilder } from "@/components/accounting/document-builder";
import { kindConfig } from "@/lib/accounting/kinds";
import { formatQty, readLineItems } from "@/lib/accounting/lines";
import { getDocument, listRelatable } from "@/lib/accounting/documents";
import { saveDocument } from "@/app/actions/accounting";
import { relatableOptions } from "../../relatable";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit document" };

/** A Date back to the yyyy-mm-dd an <input type="date"> wants. */
function dateValue(d: Date | null): string {
  if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

// Edit a draft - and only ever a draft. An issued document is frozen (see the model
// note), so this page REDIRECTS rather than rendering a disabled form: a form you can
// fill in but not save is a worse answer than not offering one.
export default async function EditDocumentPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireCompanyUser();

  const doc = await getDocument(params.id);
  if (!doc) notFound();
  if (doc.status !== DocumentStatus.DRAFT) {
    redirect(`/company/accounting/${doc.id}?error=frozen`);
  }

  const cfg = kindConfig(doc.kind);
  const relatable = cfg.relates
    ? relatableOptions(await listRelatable(doc.id))
    : [];

  return (
    <CompanyShell user={user}>
      <AdminHeader
        title={`Edit ${cfg.label.toLowerCase()}`}
        subtitle="Still a draft, so everything here is editable. Issuing it freezes every figure."
      />

      <p className="mb-6 text-sm">
        <Link
          href={`/company/accounting/${doc.id}`}
          className="text-muted hover:text-fg"
        >
          ← Back to the document
        </Link>
      </p>

      <DocumentBuilder
        kind={doc.kind}
        documentId={doc.id}
        action={saveDocument}
        relatable={relatable}
        submitLabel="Save changes"
        cancelHref={`/company/accounting/${doc.id}`}
        initial={{
          title: doc.title,
          counterpartyName: doc.counterpartyName,
          counterpartyRef: doc.counterpartyRef ?? "",
          counterpartyDetail: doc.counterpartyDetail ?? "",
          relatedId: doc.relatedId ?? "",
          // Back to the strings the builder edits - it works in what a person typed,
          // and lines.ts is what turns those into money.
          lines: readLineItems(doc.lineItems).map((l) => ({
            description: l.description,
            qty: formatQty(l.qtyCenti),
            unit: String(l.unitRobux),
          })),
          adjustmentLabel: doc.adjustmentLabel ?? "",
          adjustment: doc.adjustmentRobux ? String(doc.adjustmentRobux) : "",
          terms: doc.terms ?? "",
          notes: doc.notes ?? "",
          documentDate: dateValue(doc.documentDate),
          dueDate: dateValue(doc.dueDate),
        }}
      />
    </CompanyShell>
  );
}
