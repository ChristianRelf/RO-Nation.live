import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { absoluteUrl } from "@/lib/url";

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

// Flat and near-monochrome on purpose: one accent, used once, everywhere else is
// black/white/grey. The card-in-a-card with a colour-coded pill and a badge
// (this file's first draft) read as decoration; the ticket itself already
// carries that language and does not need to be re-performed by an email.
const ACCENT = "#2b6bff";
const BG = "#000000";
const TEXT = "#f5f5f7";
const MUTED = "#8a8a92";
const FAINT = "#5a5a60";
const LINE = "#1f1f23";
const BUTTON_BG = "#f1efe9";
const BUTTON_TEXT = "#0a0a0a";

// The wordmark, on white, transparent background - reads on the black header
// the same way it does on the site's own dark theme. Absolute, because Resend
// fetches it from the public internet, same reasoning as notify()'s image field.
const LOGO_URL = absoluteUrl("/brand/RNL_standard_white_clear_logo.png");
const LOGO_W = 220;
const LOGO_H = Math.round((LOGO_W * 687) / 3871); // the file's own aspect ratio

export type TicketReservationEmailInput = {
  to: string;
  /** The Roblox display name they're signed in as - who this is FOR, not who typed the email. */
  holderName: string;
  eventTitle: string;
  eventStartsAt: Date;
  venue?: string | null;
  tierName?: string | null;
  /** Absolute URL - the ticket's own host, RNL's or a partner's. */
  ticketUrl: string;
};

/**
 * Hidden inbox-preview text - the line a phone's notification or an inbox list
 * shows next to the subject, BEFORE the email is opened. Without one, clients
 * fall back to whatever text sits first in the body, which wastes the one line
 * an inbox gives an unopened email to earn the open.
 *
 * The trailing run of zero-width joiners is the standard trick for stopping
 * that same fallback from tacking the card's own visible text on after this
 * line - Gmail in particular keeps reading until it fills its preview budget.
 */
function preheader(text: string): string {
  const pad = "&zwnj;&nbsp;".repeat(40);
  return `<div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0;mso-hide:all;">${escapeHtml(text)}${pad}</div>`;
}

/** A full-width hairline - the only divider this template uses, instead of nested cards. */
function rule(): string {
  return `<tr><td style="padding:0 40px;"><div style="border-top:1px solid ${LINE};"></div></td></tr>`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ticketConfirmationHtml(input: TicketReservationEmailInput): string {
  const { holderName, eventTitle, eventStartsAt, venue, tierName, ticketUrl } = input;

  const privacyUrl = `${env.siteUrl}/legal/privacy`;
  const dataUrl = `${env.siteUrl}/legal/data-requests`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
  </head>
  <body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    ${preheader(`You're in - ${eventTitle} on ${formatDateTime(eventStartsAt)}.`)}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:600px;" cellpadding="0" cellspacing="0">

            <!-- Header -->
            <tr>
              <td style="padding:40px 40px 28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td valign="middle">
                      <img
                        src="${LOGO_URL}"
                        width="${LOGO_W}"
                        height="${LOGO_H}"
                        alt="RO. Nation LIVE"
                        style="display:block;width:${LOGO_W}px;height:${LOGO_H}px;border:0;"
                      />
                    </td>
                    <td align="right" valign="middle" style="font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${FAINT};">
                      Ticket
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            ${rule()}

            <!-- Headline -->
            <tr>
              <td style="padding:32px 40px 0;">
                <p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${ACCENT};">
                  Reservation confirmed
                </p>
                <h1 style="margin:0;font-size:32px;line-height:1.2;color:${TEXT};font-weight:800;">
                  You&rsquo;re going.
                </h1>
                <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:${MUTED};">
                  Thanks, ${escapeHtml(holderName)}. Your ticket to ${escapeHtml(eventTitle)} is
                  confirmed.
                </p>
              </td>
            </tr>

            ${rule()}

            <!-- The show -->
            <tr>
              <td style="padding:28px 40px 0;">
                <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${FAINT};">
                  Your show
                </p>
                <p style="margin:0;font-size:24px;line-height:1.3;font-weight:800;color:${TEXT};">
                  ${escapeHtml(eventTitle)}
                </p>
                <p style="margin:8px 0 0;font-size:14px;line-height:1.7;color:${MUTED};">
                  ${escapeHtml(formatDateTime(eventStartsAt))}${venue ? `<br />${escapeHtml(venue)}` : ""}${tierName ? `<br />${escapeHtml(tierName)}` : ""}
                </p>
              </td>
            </tr>

            ${rule()}

            <!-- What to expect + CTA -->
            <tr>
              <td style="padding:28px 40px 0;">
                <p style="margin:0;font-size:13px;line-height:1.7;color:${MUTED};">
                  Verified at the door against your Roblox account - nothing to print, nothing
                  else to bring.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 40px 36px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius:6px;background:${BUTTON_BG};">
                      <a href="${ticketUrl}" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:700;color:${BUTTON_TEXT};text-decoration:none;border-radius:6px;">
                        View your ticket
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            ${rule()}

            <!-- Fine print -->
            <tr>
              <td style="padding:24px 40px 40px;">
                <p style="margin:0;font-size:12px;line-height:1.7;color:${FAINT};">
                  You&rsquo;re receiving this because you added an email at checkout - it&rsquo;s
                  optional and never required to hold a ticket. This is a one-off confirmation;
                  we don&rsquo;t add you to any mailing list, so there&rsquo;s nothing to
                  unsubscribe from. If you didn&rsquo;t make this reservation, you can safely
                  ignore it.
                </p>
                <p style="margin:16px 0 0;font-size:12px;line-height:1.7;color:${FAINT};">
                  RO. Nation LIVE &middot;
                  <a href="${env.siteUrl}" style="color:${FAINT};text-decoration:underline;">ronation.live</a>
                  &middot;
                  <a href="${privacyUrl}" style="color:${FAINT};text-decoration:underline;">Privacy</a>
                  &middot;
                  <a href="${dataUrl}" style="color:${FAINT};text-decoration:underline;">Manage your data</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
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
