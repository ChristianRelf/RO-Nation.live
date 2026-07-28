import type { AccountingDocument } from "@prisma/client";
import { kindConfig } from "@/lib/accounting/kinds";
import type { RelatableDoc } from "@/components/accounting/document-builder";

/**
 * Turn issued documents into picker options for the "receipt for" / "credit against"
 * dropdown.
 *
 * Shared by the new and edit pages so the two labels are identical - a picker that reads
 * differently depending on which page you reached it from is a picker people distrust.
 *
 * Only the fields the option needs cross into the client component. The rows carry
 * counterparty details and internal notes, and a `<select>` has no business shipping
 * those to the browser.
 */
export function relatableOptions(rows: AccountingDocument[]): RelatableDoc[] {
  return rows.map((r) => ({
    id: r.id,
    number: r.number ?? "",
    label: `${r.number ?? "Draft"} — ${kindConfig(r.kind).label} — ${
      r.counterpartyName
    } — ${r.title}`,
  }));
}
