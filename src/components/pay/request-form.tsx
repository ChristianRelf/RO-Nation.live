"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { PaymentRequestKind } from "@prisma/client";
import type { RequestFormState } from "@/app/actions/payments";
import type { RequestKindConfig } from "@/lib/accounting/request-kinds";

// The one form behind both /make-payment and /request-payment.
//
// ONE component, not two, because the two forms differ only in WORDING - and the wording
// is data (RequestKindConfig, in lib/accounting/request-kinds.ts), for exactly the reason
// kinds.ts gives for document kinds: two copies of a form is how the field labelled "when
// did you send it" ends up over a date the other side reads as "when do you need it by".
//
// That data lives in request-kinds.ts and NOT in requests.ts, which is `server-only` -
// importing the latter from this file would be a build error. See the note at the top of
// request-kinds.ts.
//
// What it enforces, the action enforces again (submitPaymentRequest). This is the
// courtesy layer: it stops somebody submitting an empty amount and waiting for a round
// trip to be told so. It is not the guard, and nothing here decides anything.

const inputClass =
  "w-full rounded-brand border border-line bg-bg px-3 py-2 text-sm outline-none transition-colors focus:border-accent";
const labelClass =
  "mb-1 block text-[10px] font-semibold uppercase tracking-wide text-faint";

export function PaymentRequestForm({
  kind,
  config,
  action,
}: {
  kind: PaymentRequestKind;
  config: RequestKindConfig;
  action: (
    prev: RequestFormState,
    formData: FormData,
  ) => Promise<RequestFormState>;
}) {
  const [state, formAction] = useFormState<RequestFormState, FormData>(action, null);
  const [amount, setAmount] = useState("");

  const parsed = Number(amount.replace(/,/g, ""));
  const amountValid = Number.isSafeInteger(parsed) && parsed > 0;

  return (
    <form action={formAction} className="card space-y-5 p-5">
      {/* The kind is a hidden field AND is re-parsed server-side against the enum. It
          decides only which wording and which document the request becomes - never who
          the requester is, which comes from the session. See the note at the top of
          app/actions/payments.ts. */}
      <input type="hidden" name="kind" value={kind} />

      {state?.error ? (
        <p
          role="alert"
          className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          {state.error}
        </p>
      ) : null}

      <label className="block">
        <span className={labelClass}>{config.amountLabel}</span>
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-sm font-semibold text-faint">
            R$
          </span>
          <input
            name="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            inputMode="numeric"
            placeholder="0"
            autoComplete="off"
            className={`${inputClass} tabular-nums`}
          />
        </div>
        <span className="mt-1 block text-xs text-faint">
          Whole Robux. No decimals - Robux does not have any.
        </span>
      </label>

      <label className="block">
        <span className={labelClass}>{config.referenceLabel}</span>
        <input
          name="reference"
          required
          maxLength={200}
          placeholder="Stage build, July shows"
          className={inputClass}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>{config.externalRefLabel}</span>
          <input
            name="externalRef"
            maxLength={200}
            placeholder="Optional"
            autoComplete="off"
            className={inputClass}
          />
          <span className="mt-1 block text-xs text-faint">
            A Roblox transaction id, a payout note, your own invoice number - whatever
            you would quote if we asked you to identify this.
          </span>
        </label>

        <label className="block">
          <span className={labelClass}>{config.dateLabel}</span>
          <input type="date" name="expectedAt" className={inputClass} />
          <span className="mt-1 block text-xs text-faint">Optional.</span>
        </label>
      </div>

      <label className="block">
        <span className={labelClass}>Anything else</span>
        <textarea
          name="detail"
          rows={4}
          maxLength={2000}
          placeholder="Optional. Context, a breakdown, what it relates to."
          className={inputClass}
        />
      </label>

      <div className="flex flex-wrap items-center gap-4 border-t border-line pt-4">
        <Submit label={config.submitLabel} disabled={!amountValid} />
        <p className="text-xs text-faint">
          This is submitted on behalf of your account, not your personal one.
        </p>
      </div>
    </form>
  );
}

/**
 * The submit button, disabled while the form is in flight.
 *
 * useFormStatus has to be read from a CHILD of the form - it reports on the nearest form
 * above it, and a hook called in the same component as <form> sees nothing. That is why
 * this is its own component rather than three lines inline, exactly as the refund form
 * has it.
 */
function Submit({ label, disabled }: { label: string; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="btn btn-accent disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Sending…" : label}
    </button>
  );
}
