"use client";

import { useFormStatus } from "react-dom";
import { joinWaitlist, leaveWaitlist } from "@/app/actions/waitlist";

// Join / leave the queue for a sold-out show. Built exactly like FollowButton: a
// client component only so the button can show a pending state, with the actual
// state (on the list or not) decided on the server and passed in, then re-rendered
// by the page's revalidatePath after the action. Signed out, it is a sign-in link
// rather than a dead button.

export function WaitlistButton({
  eventId,
  onWaitlist,
  signedIn,
  returnTo,
}: {
  eventId: string;
  onWaitlist: boolean;
  signedIn: boolean;
  returnTo?: string;
}) {
  if (!signedIn) {
    const href = returnTo
      ? `/account?returnTo=${encodeURIComponent(returnTo)}`
      : "/account";
    return (
      <a href={href} className="btn btn-accent w-full">
        Sign in to join the waitlist
      </a>
    );
  }

  return (
    <form action={onWaitlist ? leaveWaitlist : joinWaitlist}>
      <input type="hidden" name="eventId" value={eventId} />
      <Submit onWaitlist={onWaitlist} />
      {!onWaitlist ? (
        <p className="mt-2 text-center text-xs text-faint">
          We&apos;ll notify you the moment a spot opens.
        </p>
      ) : (
        <p className="mt-2 text-center text-xs text-faint">
          You&apos;re on the list - watch your account for a spot.
        </p>
      )}
    </form>
  );
}

function Submit({ onWaitlist }: { onWaitlist: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-pressed={onWaitlist}
      className={`btn w-full ${onWaitlist ? "btn-ghost" : "btn-accent"} ${
        pending ? "opacity-60" : ""
      }`}
    >
      {pending ? "…" : onWaitlist ? "On the waitlist ✓ · Leave" : "Join the waitlist"}
    </button>
  );
}
