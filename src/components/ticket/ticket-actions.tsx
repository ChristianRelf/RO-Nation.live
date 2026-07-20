"use client";

import { useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { activateTicket, cancelTicket } from "@/app/actions/tickets";
import { ConfirmButton } from "@/components/confirm-button";
import { fireConfetti } from "./celebrate";

// Activate and cancel.
//
// Neither navigates anywhere. They revalidate, and the ticket behind them
// re-renders in place - the stub unseals, or the ticket comes back stamped VOID.
// That is partly because a Server Action must not redirect on a partner host
// (see app/actions/tickets.ts), and partly because it is simply the better
// answer: the thing you just changed is the thing already on your screen.
//
// Activation is the moment worth celebrating, so this component owns the
// confetti. The action reports that it fired; the effect throws the burst.
//
// ---- Why the confirm lives HERE and not in the action ----------------------
//
// An action cannot ask a question. It runs, or it does not.
//
// So this is a WARNING, not a gate - the same distinction checkout-form.tsx draws
// about `required`. The real refusals are enforced server-side in cancelTicket(),
// which will not touch a ticket that has already been through the door. This just
// makes sure nobody spends their seat by brushing a button on a phone.

function Pending({
  children,
  busy,
  className,
  confirm,
}: {
  children: React.ReactNode;
  busy: string;
  className: string;
  /** Ask first. Omit for a button whose worst outcome is a wasted click. */
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  const label = pending ? busy : children;

  if (confirm) {
    return (
      <ConfirmButton className={className} message={confirm} disabled={pending}>
        {label}
      </ConfirmButton>
    );
  }

  return (
    <button className={className} disabled={pending}>
      {label}
    </button>
  );
}

export function ActivateButton({ ticketId }: { ticketId: string }) {
  const [state, submit] = useFormState(activateTicket, null);

  useEffect(() => {
    if (state?.activated) fireConfetti();
  }, [state]);

  return (
    <form action={submit} className="mt-5">
      <input type="hidden" name="ticketId" value={ticketId} />
      <Pending
        busy="Activating…"
        className="btn btn-accent w-full text-base disabled:opacity-60 sm:w-auto"
        // The card copy already says this is one-way. Saying it twice is the point:
        // there is no un-activate, and the second telling is the one that lands.
        confirm="Bring this ticket to life? There's no going back - but you don't need to do it to get in."
      >
        Activate ticket 🎉
      </Pending>
    </form>
  );
}

export function CancelButton({
  ticketId,
  seatLabel,
}: {
  ticketId: string;
  /**
   * Named in the confirm when there is one, because THIS is the irreversible half
   * and the old copy hid it: cancelling NULLs seatKey (app/actions/tickets.ts), the
   * chair goes straight back on sale, and "reserve again" will not get it back -
   * it gets whatever is left. See the long note on Ticket.seatKey in the schema.
   */
  seatLabel?: string | null;
}) {
  return (
    <form action={cancelTicket} className="mt-6 border-t border-line pt-5">
      <input type="hidden" name="ticketId" value={ticketId} />
      <Pending
        busy="Cancelling…"
        className="text-sm text-faint transition-colors hover:text-red-400 disabled:opacity-60"
        confirm={
          seatLabel
            ? `Cancel this ticket? Your seat (${seatLabel}) goes back on sale and you can't get it back.`
            : "Cancel this ticket? Your spot goes back to the pool - you can reserve again if there's still room."
        }
      >
        Cancel this ticket
      </Pending>
      <p className="mt-1.5 text-xs text-faint">
        {seatLabel
          ? "Frees your seat for someone else. You can reserve again if there's room, but not necessarily this seat."
          : "Frees your spot for someone else. You can reserve again if there's room."}
      </p>
    </form>
  );
}
