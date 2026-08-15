import type { Metadata } from "next";
import { PaymentRequestKind } from "@prisma/client";
import { requirePayUser } from "@/lib/pay";
import { requestKindConfig } from "@/lib/accounting/request-kinds";
import { submitPaymentRequest } from "@/app/actions/payments";
import { PaymentRequestForm } from "@/components/pay/request-form";
import { Kicker } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tell us about a payment" };

/**
 * "I am paying you."
 *
 * The single most important thing on this page is the sentence saying it does NOT move
 * any Robux, and it is above the form rather than below it. Robux moves through Roblox -
 * a group payout or a direct transfer - and nothing on this site can do that. A form
 * headed "make a payment" that quietly does nothing is a form somebody submits and then
 * waits on, and the misunderstanding only surfaces a fortnight later when RNL is chasing
 * money the client believes they already sent.
 *
 * So the copy comes from requestKindConfig(), where it sits beside the other half's, and
 * the page is otherwise the same shape as /request-payment - one component, one action.
 */
export default async function MakePaymentPage() {
  await requirePayUser();
  const config = requestKindConfig(PaymentRequestKind.PAYMENT);

  return (
    <div className="mx-auto max-w-2xl">
      <Kicker>Payments</Kicker>
      <h1 className="display mt-4 text-4xl leading-none">{config.formTitle}</h1>
      <p className="mt-4 text-muted">{config.formBlurb}</p>

      {/* How the Robux actually gets there. Named explicitly, because "send it through
          Roblox" is not an instruction anybody can follow, and the alternative is a
          client guessing - which is how a payment ends up in the wrong group. */}
      <div className="card mt-8 border-accent/25 bg-accent-soft/40 p-5">
        <p className="text-sm font-semibold text-fg">How to actually send it</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Through Roblox, to the RO. Nation LIVE group - a group payout or a direct
          transfer, whichever you normally use. Quote the document number you are settling
          if there is one; it is the fastest way for us to match it. Then fill this in so
          we know to look for it.
        </p>
      </div>

      <div className="mt-8">
        <PaymentRequestForm
          kind={PaymentRequestKind.PAYMENT}
          config={config}
          action={submitPaymentRequest}
        />
      </div>
    </div>
  );
}
