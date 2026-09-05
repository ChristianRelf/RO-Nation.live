import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";
import { formatDateTime } from "@/lib/format";

// Reservation confirmation emails, over Resend.
//
// The account itself is Roblox-only (see User in schema.prisma) - there is no
// email/password anywhere in this system, and an address here is never required
// to hold a ticket. It is volunteered, once, on the checkout step, for exactly
// one reason: somewhere to send "you're going" and, later, a reminder. Nobody
// is ever emailed who did not type an address in on purpose.
//
// Same three properties as notify() (lib/notify.ts), and for the same reasons:
//
//   • fire-and-forget  - callers do `void sendTicketReservationEmail(...)`. A
//     confirmation email is not part of the checkout the buyer is watching, and
//     must never add latency to it.
//   • never throws     - a bad API key, a Resend outage, a malformed address:
//     every one is swallowed here. A failed email must NEVER turn an issued
//     ticket into an error page for somebody who already has one.
//   • degrades to no-op - no API key configured → it returns silently. That is
//     the default in dev, and the safe default until Resend is actually set up.

let client: Resend | null = null;

/** Lazy, so a missing key never throws at import time - only when it would send. */
function resendClient(): Resend | null {
  if (!env.resendApiKey) return null;
  if (!client) client = new Resend(env.resendApiKey);
  return client;
}

// RNL electric blue (globals.css --accent-rgb), as a hex value - email clients
// do not run our CSS, so the brand colour is inlined everywhere it appears.
const ACCENT = "#2b6bff";
const BG = "#0a0a0a";
const CARD = "#141414";
const LINE = "#262626";
const MUTED = "#a3a3a3";

export type TicketReservationEmailInput = {
  to: string;
  eventTitle: string;
  eventStartsAt: Date;
  venue?: string | null;
  tierName?: string | null;
  /** Absolute URL - the ticket's own host, RNL's or a partner's. */
  ticketUrl: string;
};

function ticketConfirmationHtml(input: TicketReservationEmailInput): string {
  const { eventTitle, eventStartsAt, venue, tierName, ticketUrl } = input;

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:480px;" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-bottom:28px;text-align:center;">
                <span style="display:inline-block;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${ACCENT};">
                  RO. Nation LIVE
                </span>
              </td>
            </tr>
            <tr>
              <td style="background:${CARD};border:1px solid ${LINE};border-radius:16px;padding:32px;">
                <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${ACCENT};">
                  You&rsquo;re going
                </p>
                <h1 style="margin:0 0 20px;font-size:24px;line-height:1.3;color:#ffffff;">
                  Thanks for reserving your ticket
                </h1>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${LINE};border-bottom:1px solid ${LINE};margin:0 0 24px;">
                  <tr>
                    <td style="padding:16px 0;">
                      <p style="margin:0;font-size:17px;font-weight:600;color:#ffffff;">${escapeHtml(eventTitle)}</p>
                      <p style="margin:6px 0 0;font-size:14px;color:${MUTED};">${escapeHtml(formatDateTime(eventStartsAt))}</p>
                      ${venue ? `<p style="margin:2px 0 0;font-size:14px;color:${MUTED};">${escapeHtml(venue)}</p>` : ""}
                      ${tierName ? `<p style="margin:10px 0 0;font-size:13px;color:${MUTED};">${escapeHtml(tierName)}</p>` : ""}
                    </td>
                  </tr>
                </table>

                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius:10px;background:${ACCENT};">
                      <a href="${ticketUrl}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">
                        View your ticket
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:${MUTED};">
                  Your ticket is verified at the door against your Roblox account - nothing
                  else to bring. If you didn&rsquo;t make this reservation, you can safely
                  ignore this email.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding-top:20px;text-align:center;">
                <p style="margin:0;font-size:12px;color:${MUTED};">RO. Nation LIVE &middot; ronation.live</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * "Thanks for reserving" - sent once, right after a ticket is issued, only when
 * the holder typed an email in at checkout. See the header for the guarantees:
 * this can fail in any way at all and the reservation the buyer is watching
 * will not notice.
 */
export async function sendTicketReservationEmail(
  input: TicketReservationEmailInput,
): Promise<void> {
  try {
    const resend = resendClient();
    if (!resend) return; // no key configured → no-op, same as notify()

    await resend.emails.send({
      from: env.emailFrom,
      to: input.to,
      subject: `You're going: ${input.eventTitle}`,
      html: ticketConfirmationHtml(input),
    });
  } catch (err) {
    // Swallowed on purpose - see the header. Logged so a misconfigured key or a
    // Resend outage shows up in server logs without ever reaching the buyer.
    console.warn("[email] Ticket confirmation failed:", err);
  }
}
