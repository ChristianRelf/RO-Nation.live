import "server-only";
import { env } from "@/lib/env";
import { absoluteUrl } from "@/lib/url";

// Push, don't poll.
//
// New applications, enquiries and ticket reservations used to write a database row
// and tell nobody - staff had to remember to open a dashboard to find out anything
// had happened. This posts a compact Discord embed the moment one lands, with a
// link straight to the row it is about.
//
// Three properties it MUST keep, all load-bearing:
//
//   • fire-and-forget  - callers do `void notify(...)`. It is kicked off before the
//     action redirects and is never awaited, so it cannot add a millisecond to a
//     submission or hold up the visitor's navigation.
//   • never throws      - a down webhook, a network blip, a malformed URL: every one
//     is swallowed here. A notification failing must NEVER turn a saved enquiry or a
//     reserved ticket into an error page the visitor sees.
//   • degrades to no-op - no webhook configured → it returns silently. That is the
//     default in dev, and the safe default in prod until a URL is set.

type NotifyField = { name: string; value: string; inline?: boolean };

/**
 * WHICH channel, and it is not a styling choice - it decides who reads this.
 *
 *   "inbox"     staff ops. Applications, enquiries, data requests, reservations.
 *               DISCORD_WEBHOOK_URL, with a per-partner override and a fallback
 *               to RNL's - a partner without a channel of their own still gets
 *               their applications seen by somebody.
 *   "announce"  the public. A show going live, written for members.
 *               DISCORD_ANNOUNCE_WEBHOOK_URL, with a per-partner override and NO
 *               fallback in either direction. See env.ts for why.
 */
export type NotifyChannel = "inbox" | "announce";

export type NotifyInput = {
  /**
   * Whose channel. A partner slug routes to DISCORD_WEBHOOK_URL_<SLUG> when that is
   * set, and falls back to RNL's DISCORD_WEBHOOK_URL. null → RNL's directly.
   */
  partnerId?: string | null;
  /** Defaults to "inbox" - every call site that predates announcements is one. */
  channel?: NotifyChannel;
  title: string;
  description?: string;
  fields?: NotifyField[];
  /** A site-relative path or an absolute URL; linked from the embed title. */
  url?: string;
  /**
   * A site-relative path or absolute URL for the embed's big image - a show's
   * thumbnail. Discord fetches this itself, so it has to be reachable from the
   * public internet; absoluteUrl() makes a stored /uploads/… path so, and a
   * localhost origin in dev simply renders without the picture.
   */
  image?: string;
  color?: number;
};

// RNL electric blue (globals.css --accent), as a Discord integer colour.
const BRAND_COLOR = 0x2b6bff;

/** partner slug → env key suffix. sleeptoken-ro → SLEEPTOKEN_RO */
const envSuffix = (partnerId: string) =>
  partnerId.toUpperCase().replace(/-/g, "_");

/**
 * The webhook for a slug on a channel. The per-partner key is a CONVENTION
 * resolved from the environment, not a registry entry, because a webhook URL is a
 * secret: DISCORD_WEBHOOK_URL_<SLUG>, uppercased with hyphens as underscores
 * (sleeptoken-ro → DISCORD_WEBHOOK_URL_SLEEPTOKEN_RO).
 *
 * The two channels resolve DIFFERENTLY at the last step, and the difference is
 * the whole reason this takes a channel:
 *
 *   inbox     falls back to RNL's. A partner with no channel of their own still
 *             has their job applications land somewhere a human reads.
 *   announce  does NOT. RNL's announcement channel is RNL's members, who did not
 *             sign up for a partner's line-up - so a partner without their own
 *             announcement webhook is announced nowhere, which is the correct
 *             quiet failure. RNL's own shows (partnerId null) are unaffected:
 *             they read the top-level variable directly, as they always would.
 */
function webhookFor(
  partnerId: string | null | undefined,
  channel: NotifyChannel,
): string | null {
  if (channel === "announce") {
    if (partnerId) {
      return process.env[`DISCORD_ANNOUNCE_WEBHOOK_URL_${envSuffix(partnerId)}`] || null;
    }
    return env.discordAnnounceWebhookUrl || null;
  }

  if (partnerId) {
    const perPartner = process.env[`DISCORD_WEBHOOK_URL_${envSuffix(partnerId)}`];
    if (perPartner) return perPartner;
  }
  return env.discordWebhookUrl || null;
}

export async function notify(input: NotifyInput): Promise<void> {
  try {
    const webhook = webhookFor(input.partnerId, input.channel ?? "inbox");
    if (!webhook) return; // no channel configured → no-op

    // Discord's own limits, clamped here so a long message can never make the POST
    // itself fail (which the catch would swallow, but silently losing the ping is
    // worse than a truncated one).
    const embed = {
      title: input.title.slice(0, 256),
      description: input.description?.slice(0, 2000) || undefined,
      url: input.url ? absoluteUrl(input.url) : undefined,
      image: input.image ? { url: absoluteUrl(input.image) } : undefined,
      color: input.color ?? BRAND_COLOR,
      fields: input.fields?.slice(0, 25).map((f) => ({
        name: f.name.slice(0, 256),
        value: (f.value || "-").slice(0, 1024),
        inline: f.inline,
      })),
      timestamp: new Date().toISOString(),
    };

    await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
      // A slow Discord must not keep a Node request handle alive indefinitely.
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    // Swallowed on purpose - see the header. Logged so a misconfiguration shows up
    // in the server logs without ever reaching the visitor.
    console.warn("[notify] Discord webhook failed:", err);
  }
}
