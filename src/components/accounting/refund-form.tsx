"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { ConfirmButton } from "@/components/confirm-button";
import type { RefundFormState } from "@/app/actions/accounting";

// The refund form, shown once a ticket has been found.
//
// Everything it enforces, the server enforces again from the ledger (see
// checkRefundAmount) - this is the courtesy layer, not the guard. What it is genuinely
// FOR is making the exceptional nature of the act visible while somebody performs it:
// the ceiling in plain words, the reason mandatory, and a confirm that names the amount
// and the person out loud before anything is written.

const inputClass =
  "w-full rounded-brand border border-line bg-bg px-3 py-2 text-sm outline-none transition-colors focus:border-accent";
const labelClass =
  "mb-1 block text-[10px] font-semibold uppercase tracking-wide text-faint";

export function RefundForm({
  action,
  ticketId,
  code,
  holderName,
  refundable,
  canVoid,
  voidHint,
}: {
  action: (
    prev: RefundFormState,
    formData: FormData,
  ) => Promise<RefundFormState>;
  ticketId: string;
  code: string;
  holderName: string;
  /** The most that may be refunded - paid, less anything already refunded. */
  refundable: number;
  canVoid: boolean;
  /** Why the ticket can't be cancelled, when it can't. */
  voidHint: string;
}) {
  const [state, formAction] = useFormState<RefundFormState, FormData>(action, null);
  // Pre-filled to the full remaining amount: a full refund is the overwhelmingly common
  // case, and making somebody retype a figure the page already knows is how the wrong
  // figure gets typed.
  const [amount, setAmount] = useState(String(refundable));

  const parsed = Number(amount.replace(/,/g, ""));
  const valid = Number.isSafeInteger(parsed) && parsed > 0 && parsed <= refundable;

  return (
    <form action={formAction} className="card space-y-4 p-5">
      <input type="hidden" name="ticketId" value={ticketId} />
      <input type="hidden" name="code" value={code} />

      {state?.error ? (
        <p
          role="alert"
          className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          {state.error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="refund-amount">
            Refund amount
          </label>
          <input
            id="refund-amount"
            name="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="numeric"
            className={`${inputClass} text-right tabular-nums ${
              amount && !valid ? "border-red-500/50" : ""
            }`}
          />
          <p className="mt-1 text-xs text-muted">
            At most {refundable.toLocaleString("en-GB")} R$ — what they paid, less
            anything already refunded.
          </p>
          {amount && !valid ? (
            <p className="mt-1 text-xs text-red-400">
              {parsed > refundable
                ? "More than is left to refund on this ticket."
                : "Enter a whole number of Robux, at least 1."}
            </p>
          ) : null}
        </div>

        <div>
          <label className={labelClass} htmlFor="refund-reason">
            Reason
          </label>
          <textarea
            id="refund-reason"
            name="reason"
            required
            rows={3}
            maxLength={500}
            placeholder="Show cancelled, ticket unusable, etc."
            className={inputClass}
          />
          <p className="mt-1 text-xs text-muted">
            Goes on the document and the audit trail. Required.
          </p>
        </div>
      </div>

      <label
        className={`flex items-start gap-3 rounded-brand border border-line p-3 text-sm ${
          canVoid ? "" : "opacity-60"
        }`}
      >
        <input
          type="checkbox"
          name="voidsTicket"
          defaultChecked={canVoid}
          disabled={!canVoid}
          className="mt-0.5"
        />
        <span>
          <span className="font-medium text-fg">Cancel the ticket too</span>
          <span className="mt-0.5 block text-xs text-muted">
            {canVoid
              ? "Issuing the refund cancels the ticket and frees its seat. Untick for a partial or goodwill refund where they keep their place."
              : voidHint}
          </span>
        </span>
      </label>

      <div className="flex items-center gap-3 border-t border-line pt-4">
        <Submit
          amount={valid ? parsed : 0}
          holderName={holderName}
          disabled={!valid}
        />
        <a href="/" className="text-sm text-muted hover:text-fg">
          Cancel
        </a>
      </div>
    </form>
  );
}

function Submit({
  amount,
  holderName,
  disabled,
}: {
  amount: number;
  holderName: string;
  disabled: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <ConfirmButton
      // The amount and the person, said back before anything is written. A confirm
      // reading "are you sure?" is a confirm people click through.
      message={`Write a refund of ${amount.toLocaleString("en-GB")} R$ to ${holderName}? This creates a draft — it isn't issued until you issue it.`}
      disabled={disabled || pending}
      className="btn btn-accent disabled:opacity-50"
    >
      {pending ? "Writing…" : "Write refund draft"}
    </ConfirmButton>
  );
}
