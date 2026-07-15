// The kinds of data request somebody can make, in one place.
//
// A pure-data registry, in the same spirit as lib/legal.ts and lib/merch/collections.ts:
// no prisma, no env, no "server-only". It is imported by BOTH the client form
// (components/data-request-form.tsx) and the server action (app/actions/data-requests.ts),
// which is exactly why it cannot live in either of them - a "use server" file may only
// export async functions, and a client component cannot import server code. A shared const
// module is the one place both sides can read the same list from.
//
// These mirror the rights described on /legal/data-requests. If you change one, change that
// page in the same commit - the form offering a right the policy does not describe, or the
// policy promising one the form does not offer, is the drift this shared list exists to stop.

export type DataRequestType = {
  /** Stored on the enquiry and validated in the action. Stable - do not rename. */
  value: "ACCESS" | "CORRECT" | "DELETE" | "RESTRICT" | "PORTABILITY" | "OTHER";
  /** The button label on the form. */
  label: string;
  /** One line under it, and the human name that goes into the staff inbox subject. */
  blurb: string;
};

export const DATA_REQUEST_TYPES: readonly DataRequestType[] = [
  {
    value: "ACCESS",
    label: "A copy of my data",
    blurb: "Everything we hold about you - a subject access request.",
  },
  {
    value: "CORRECT",
    label: "Correct something",
    blurb: "Fix something we hold that is wrong or out of date.",
  },
  {
    value: "DELETE",
    label: "Delete my account",
    blurb: "Remove your account and the data attached to it.",
  },
  {
    value: "RESTRICT",
    label: "Restrict or object",
    blurb: "Stop a particular use of your data.",
  },
  {
    value: "PORTABILITY",
    label: "Port my data",
    blurb: "Give your data to you in a portable form.",
  },
  {
    value: "OTHER",
    label: "Something else",
    blurb: "A privacy question or request that isn't one of the above.",
  },
];

/** The valid values, for a zod enum in the action. Never widens without the list above. */
export const DATA_REQUEST_VALUES = DATA_REQUEST_TYPES.map((t) => t.value) as [
  DataRequestType["value"],
  ...DataRequestType["value"][],
];

/** Human label for a stored value, for the inbox subject and the confirmation copy. */
export function dataRequestLabel(value: string): string {
  return DATA_REQUEST_TYPES.find((t) => t.value === value)?.label ?? "Data request";
}
