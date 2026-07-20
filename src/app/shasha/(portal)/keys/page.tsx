import type { Metadata } from "next";
import Link from "next/link";
import { ALL_SCOPES, SCOPE_LABELS } from "@/lib/apikey";
import { keysSummary, loadApiKeys } from "@/lib/api/keys-view";
import { env } from "@/lib/env";
import { requireScopeManager, SHASHA_SCOPE } from "@/lib/portal-scope";
import { ApiKeysPanel } from "@/components/portal/api-keys";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "API keys" };

// portal.ronation.live/shasha/keys - RO. Nation LIVE's OWN API keys.
//
// Keys minted here carry `partnerId: null`, which is what RNL's own events carry,
// so they see RNL's shows and no partner's. That is the same rule every partner's
// key follows - RNL is not a special case, it is just the org whose id is NULL.
//
// Management rank (SHASHA_MANAGER_RANK, 245+) only, and guarded in the page rather
// than the layout for the usual reason.

export default async function ShashaKeysPage() {
  await requireScopeManager(SHASHA_SCOPE);
  const keys = await loadApiKeys(SHASHA_SCOPE);

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8">
        <p className="text-xs font-bold uppercase tracking-kicker text-accent">
          RO. Nation LIVE
        </p>
        <h1 className="display mt-1 text-3xl">API keys</h1>
        <p className="mt-2 text-muted">
          Connect RNL&rsquo;s Roblox experiences to RNL&rsquo;s tickets.{" "}
          <Link href="/docs/api" className="text-accent underline underline-offset-4">
            Read the API docs
          </Link>
          .
        </p>
      </header>

      {env.gameApiKey ? (
        // The env-var key predates this table and is still live in RNL's game
        // servers. It is unscoped and holds every capability - it can reach into
        // every partner's shows, which is exactly what no key minted below can do.
        // Say so, here, where somebody can act on it, rather than only in a source
        // comment nobody in this portal will ever read.
        <div className="mb-8 border border-amber-500/40 bg-amber-500/5 p-4">
          <p className="text-xs font-bold uppercase tracking-kicker text-amber-400">
            The old root key is still live
          </p>
          <p className="mt-2 text-sm text-muted">
            <code className="font-mono text-xs">GAME_API_KEY</code> is set in the
            environment. It is unscoped - it can verify, redeem, issue and void
            tickets for <em>every</em> show on the platform, including partners&rsquo;
            - and it cannot be revoked from this page, only unset on the server.
            Move RNL&rsquo;s game servers onto a key minted below, then remove it.
          </p>
        </div>
      ) : null}

      <ApiKeysPanel
        scopeId={SHASHA_SCOPE}
        orgName="RO. Nation LIVE"
        keys={keys}
        summary={keysSummary(keys)}
        scopeLabels={SCOPE_LABELS}
        allScopes={[...ALL_SCOPES]}
      />
    </div>
  );
}
