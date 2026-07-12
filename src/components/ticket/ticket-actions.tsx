"use client";

import { useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { activateTicket, cancelTicket } from "@/app/actions/tickets";
import { fireConfetti } from "./celebrate";

// Activate and cancel.
//
// Neither navigates anywhere. They revalidate, and the ticket behind them
// re-renders in place — the stub unseals, or the ticket comes back stamped VOID.
// That is partly because a Server Action must not redirect on a partner host
// (see app/actions/tickets.ts), and partly because it is simply the better
// answer: the thing you just changed is the thing already on your screen.
//
// Activation is the moment worth celebrating, so this component owns the
// confetti. The action reports that it fired; the effect throws the burst.

function Pending({
  children,
  busy,
  className,
}: {
  children: React.ReactNode;
  busy: string;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending}>
      {pending ? busy : children}
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
      >
        Activate ticket 🎉
      </Pending>
    </form>
  );
}

export function CancelButton({ ticketId }: { ticketId: string }) {
  return (
    <form action={cancelTicket} className="mt-6 border-t border-line pt-5">
      <input type="hidden" name="ticketId" value={ticketId} />
      <Pending
        busy="Cancelling…"
        className="text-sm text-faint transition-colors hover:text-red-400 disabled:opacity-60"
      >
        Cancel this ticket
      </Pending>
      <p className="mt-1.5 text-xs text-faint">
        Frees your spot for someone else. You can reserve again if there&apos;s
        room.
      </p>
    </form>
  );
}
