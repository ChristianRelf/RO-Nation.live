import "server-only";
import { prisma } from "@/lib/db";

// HOW MANY SHOWS THIS PERSON HAS BEEN TO. Nobody had ever counted.
//
// lib/account.ts has always fetched the last ten attended shows - `take: 10`, no
// count beside it - so somebody forty shows deep saw the same ten rows as somebody
// on their eleventh, with nothing anywhere to say which of them they were. The
// number was one query away the whole time.
//
// ---- checkedInAt, never status ---------------------------------------------
//
// Attendance is the TIMESTAMP and nothing else. `status` can be walked back to
// RESERVED by a staff member from the attendees page ("Undo"), and a ticket that
// went through the door and was then undone is still a show this person went to.
// checkedInAt is only ever stamped by the door - see admit() in verify.ts - so it
// is the honest record and the one worth counting.
//
// Both queries below are served by @@index([userId, checkedInAt]) on tickets, which
// was added for exactly this - see the note on it in the schema.

/** How many shows they have actually turned up to. */
export function showsAttended(userId: string) {
  return prisma.ticket.count({
    where: { userId, checkedInAt: { not: null } },
  });
}

/**
 * Which number this show was for them - 1 for their first ever, 7 for their seventh.
 *
 * Counts everything they attended UP TO AND INCLUDING this check-in, rather than
 * their total, so a ticket's ordinal is fixed forever the moment it is stamped.
 * Reading it off the running total instead would mean last year's stub silently
 * relabelling itself every time they went to something new.
 */
export function attendanceOrdinal(userId: string, checkedInAt: Date) {
  return prisma.ticket.count({
    where: { userId, checkedInAt: { not: null, lte: checkedInAt } },
  });
}

/** An ordinal a person would say out loud: 1st, 2nd, 3rd, 4th… 11th, 12th, 13th. */
export function ordinalLabel(n: number) {
  // 11/12/13 are the exception every naive implementation gets wrong.
  const teens = n % 100;
  if (teens >= 11 && teens <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
