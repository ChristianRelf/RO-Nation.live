import "server-only";
import { createHmac } from "crypto";
import { env } from "@/lib/env";

// The security seal printed on a ticket.
//
// Six characters, derived from the ticket's id and code with an HMAC keyed by
// AUTH_SECRET. Two honest things about what it is and is not:
//
//   It IS unforgeable without the key. You cannot invent a ticket code and work
//   out the seal that belongs with it. So a photoshopped ticket — a real one with
//   the code painted over, or an invented code in the right typeface — carries a
//   seal that does not match, and a crew member who knows to look can see that
//   without a scanner, a phone or a signal.
//
//   It is NOT what actually admits you. That is the database: the door scans the
//   barcode or the QR, looks the ticket up, and checks it is real, unused and
//   yours. The seal is for the eyeball check in the queue, before the scan — and
//   for the case where the scanner is dead and staff are working off paper.
//
// Printed in two places on the ticket, deliberately far apart: forging one and
// forgetting the other is the commonest way a faked ticket gives itself away.

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford — no I, L, O, U

/**
 * `ticketSeal("cmri…", "RN-4K9QW2")` → "7QK2XM".
 *
 * Bound to the id AND the code together, so a seal lifted from one ticket does
 * not validate on another.
 */
export function ticketSeal(id: string, code: string) {
  const mac = createHmac("sha256", env.authSecret)
    .update(`${id}:${code}`)
    .digest();

  let out = "";
  for (let i = 0; i < 6; i++) out += ALPHABET[mac[i] % ALPHABET.length];
  return out;
}
