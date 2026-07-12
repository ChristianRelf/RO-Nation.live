import { env } from "@/lib/env";

/**
 * The public origin of a partner site: https://<slug>.ronation.live.
 *
 * Derived from RNL's own origin, so it follows the environment — in dev it
 * comes out as http://<slug>.localhost:3000, which is exactly the host you add
 * to /etc/hosts to exercise partner routing locally.
 */
export function partnerOrigin(slug: string) {
  const url = new URL(env.siteUrl);
  url.hostname = `${slug}.${url.hostname.replace(/^www\./, "")}`;
  return url.origin;
}
