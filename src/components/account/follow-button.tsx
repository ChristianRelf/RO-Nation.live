"use client";

import { useFormStatus } from "react-dom";
import { followEvent, unfollowEvent } from "@/app/actions/follows";

// The Follow / Following toggle on an event page.
//
// A client component only so the button can show a pending state while the action runs; the
// state itself (following or not) is decided on the server and passed in, so the button always
// reflects the database rather than optimistic guesswork. After the action, the page's
// revalidatePath re-renders this with the new `following`, and it flips.
//
// Signed out, there is nothing to post - following needs an account - so it becomes a sign-in
// link instead of a dead button.

export function FollowButton({
  eventId,
  following,
  signedIn,
  returnTo,
}: {
  eventId: string;
  following: boolean;
  signedIn: boolean;
  /** Where to land after signing in - the event page they were on. */
  returnTo?: string;
}) {
  if (!signedIn) {
    const href = returnTo
      ? `/account?returnTo=${encodeURIComponent(returnTo)}`
      : "/account";
    return (
      <a href={href} className="btn btn-ghost w-full">
        Sign in to follow
      </a>
    );
  }

  return (
    <form action={following ? unfollowEvent : followEvent}>
      <input type="hidden" name="eventId" value={eventId} />
      <Submit following={following} />
    </form>
  );
}

function Submit({ following }: { following: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-pressed={following}
      className={`btn w-full ${following ? "btn-ghost" : "btn-accent"} ${
        pending ? "opacity-60" : ""
      }`}
    >
      {pending ? "…" : following ? "Following ✓" : "Follow this show"}
    </button>
  );
}
