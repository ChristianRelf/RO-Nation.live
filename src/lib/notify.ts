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

export type NotifyInput = {
  /**
   * Whose channel. A partner slug routes to DISCORD_WEBHOOK_URL_<SLUG> when that is
   * set, and falls back to RNL's DISCORD_WEBHOOK_URL. null → RNL's directly.
   */
  partnerId?: string | null;
  title: string;
  description?: string;
  fields?: NotifyField[];
  /** A site-relative path or an absolute URL; linked from the embed title. */
  url?: string;
  color?: number;
};

// RNL electric blue (globals.css --accent), as a Discord integer colour.
const BRAND_COLOR = 0x2b6bff;

/**
 * The webhook for a slug. The per-partner key is a CONVENTION resolved from the
 * environment, not a registry entry, because a webhook URL is a secret:
 * DISCORD_WEBHOOK_URL_<SLUG>, uppercased with hyphens as underscores
 * (sleeptoken-ro → DISCORD_WEBHOOK_URL_SLEEPTOKEN_RO). No per-partner URL, or no
 * partner at all, falls back to RNL's one channel.
 */
function webhookFor(partnerId?: string | null): string | null {
  if (partnerId) {
    const key = `DISCORD_WEBHOOK_URL_${partnerId
      .toUpperCase()
      .replace(/-/g, "_")}`;
    const perPartner = process.env[key];
    if (perPartner) return perPartner;
  }
  return env.discordWebhookUrl || null;
}

export async function notify(input: NotifyInput): Promise<void> {
  try {
    const webhook = webhookFor(input.partnerId);
    if (!webhook) return; // no channel configured → no-op

    // Discord's own limits, clamped here so a long message can never make the POST
    // itself fail (which the catch would swallow, but silently losing the ping is
    // worse than a truncated one).
    const embed = {
      title: input.title.slice(0, 256),
      description: input.description?.slice(0, 2000) || undefined,
      url: input.url ? absoluteUrl(input.url) : undefined,
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
