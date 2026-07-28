import type { Metadata } from "next";
import { PaymentRequestKind } from "@prisma/client";
import { requirePayUser } from "@/lib/pay";
import { requestKindConfig } from "@/lib/accounting/request-kinds";
import { submitPaymentRequest } from "@/app/actions/payments";
import { PaymentRequestForm } from "@/components/pay/request-form";
import { Kicker } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Request a payment" };

/**
 * "Please pay me."
 *
 * The mirror of /make-payment, and deliberately the same shape - same component, same
 * action, wording from the same table. What differs is what it becomes: a request accepted
 * here is raised as a PAYROLL SLIP draft rather than a receipt (see acceptPaymentRequest).
 *
 * The panel below says what happens after submitting, in order, because "I sent a request
 * and heard nothing" is the failure this page has to design against. It names the two
 * things that are NOT automatic: a person reads it, and a person pays it out.
 */
export default async function RequestPaymentPage() {
  await requirePayUser();
  const config = requestKindConfig(PaymentRequestKind.REQUEST);

  return (
    <div className="mx-auto max-w-2xl">
      <Kicker>Payments</Kicker>
      <h1 className="display mt-4 text-4xl leading-none">{config.formTitle}</h1>
      <p className="mt-4 text-muted">{config.formBlurb}</p>

      <div className="card mt-8 p-5">
        <p className="text-sm font-semibold text-fg">What happens next</p>
        <ol className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
          <li>
            <span className="font-semibold text-fg">1.</span> Somebody at RO. Nation LIVE
            reads it. It will sit as “open” on your requests until they do.
          </li>
          <li>
            <span className="font-semibold text-fg">2.</span> If it is agreed, a numbered
            payroll slip appears on your statement saying what is owed and what it covers.
          </li>
          <li>
            <span className="font-semibold text-fg">3.</span> The Robux is sent separately,
            by group payout. The slip is the record of it, not the payment itself.
          </li>
        </ol>
        <p className="mt-3 text-xs text-faint">
          If it is not agreed you will see it marked declined here, with the reason.
        </p>
      </div>

      <div className="mt-8">
        <PaymentRequestForm
          kind={PaymentRequestKind.REQUEST}
          config={config}
          action={submitPaymentRequest}
        />
      </div>
    </div>
  );
}
