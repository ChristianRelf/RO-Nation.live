"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCompanyUser } from "@/lib/company";
import { partnerBySlug, partnerHasFeature } from "@/lib/partners/registry";
import { partnerPortalRoute } from "@/lib/partners/urls";
import { parseInvoicePeriod } from "@/lib/invoice-period";
import {
  createInvoice,
  getInvoiceForCompany,
  sendInvoice,
} from "@/lib/invoices";
import { s } from "@/lib/content";

// The two acts on an invoice, and both are the COMPANY's: generating one from a
// partner's ledger, and sending it. Every write re-checks the company rank server-side -
// the page hiding a button is not a permission - and a partner has no action in here at
// all, which is the whole point of moving issuance behind this door.

function refresh(slug: string) {
  revalidatePath("/company/invoices");
  revalidatePath(`/company/invoices/${slug}`);
  // The partner's own payouts page carries the "new invoice" indicator; a send has to
  // freshen it, or the notice lags a deploy behind the thing it is announcing.
  revalidatePath(`${partnerPortalRoute(slug)}/payouts`);
}

/**
 * Generate a DRAFT invoice for a partner over a chosen period, then open it.
 *
 * Draft, not sent: generation is reversible right up until the deliberate second act of
 * sending. The partner is validated through the registry - an arbitrary slug from the
 * form must never become a partnerId in a query - and must actually run events, since an
 * invoice is a statement about ticket sales.
 */
export async function generateInvoice(formData: FormData) {
  const user = await requireCompanyUser();

  const slug = s(formData, "slug");
  const partner = partnerBySlug(slug);
  if (!partner) redirect("/company/invoices?error=partner");
  if (!partnerHasFeature(partner, "events")) {
    redirect(`/company/invoices/${slug}?error=noevents`);
  }

  const { range, label, tag } = parseInvoicePeriod(s(formData, "period"));

  const invoice = await createInvoice({
    partnerSlug: partner.slug,
    periodTag: tag,
    periodLabel: label,
    range,
    issuedBy: { robloxId: user.robloxId, displayName: user.displayName },
  });
  // Null only on a bad slug, which partnerBySlug already ruled out - but the type is
  // honest, so handle it rather than assert.
  if (!invoice) redirect(`/company/invoices/${slug}?error=partner`);

  refresh(partner.slug);
  redirect(`/company/invoices/${partner.slug}/${invoice.id}`);
}

/**
 * Send a draft to the partner.
 *
 * Resolved through getInvoiceForCompany first, scoped to the partner in the URL, so a
 * pasted id under the wrong partner sends nothing. Idempotent downstream: re-sending never
 * moves the issue date. After this the invoice is readable in the partner's portal.
 */
export async function issueInvoice(formData: FormData) {
  await requireCompanyUser();

  const slug = s(formData, "slug");
  const id = s(formData, "id");

  const invoice = await getInvoiceForCompany(slug, id);
  if (!invoice) redirect(`/company/invoices/${slug}?error=missing`);

  await sendInvoice(invoice.id);

  refresh(slug);
  redirect(`/company/invoices/${slug}/${invoice.id}?ok=sent`);
}
