import type { Metadata } from "next";
import Link from "next/link";
import { ALL_SCOPES, SCOPE_LABELS } from "@/lib/apikey";
import { loadApiKeys } from "@/lib/api/keys-view";
import { requirePartnerManager } from "@/lib/partners/guard";
import { ApiKeysPanel } from "@/components/portal/api-keys";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "API keys" };

// portal.ronation.live/<slug>/keys - a partner's own API keys.
//
// MANAGERS ONLY. Read-only staff can work the door and search the lists; they
// cannot mint a credential that does all of it from outside the portal. And the
// guard is called HERE, in the page, not left to the layout - a layout redirect
// still ships this page's RSC payload (i.e. somebody else's key list) in the body
// of the 307 that bounced it. See lib/partners/guard.ts.

export default async function PartnerKeysPage({
  params,
}: {
  params: { slug: string };
}) {
  const user = await requirePartnerManager(params.slug);
  const keys = await loadApiKeys(user.partner.slug);

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8">
        <p className="text-xs font-bold uppercase tracking-kicker text-accent">
          {user.partner.name}
        </p>
        <h1 className="display mt-1 text-3xl">API keys</h1>
        <p className="mt-2 text-muted">
          Connect your Roblox experience to your tickets - check people in at the
          door, hand out tickets in-game, read your line-up.{" "}
          <Link href="/docs/api" className="text-accent underline underline-offset-4">
            Read the API docs
          </Link>
          .
        </p>
      </header>

      <ApiKeysPanel
        scopeId={user.partner.slug}
        orgName={user.partner.name}
        keys={keys}
        scopeLabels={SCOPE_LABELS}
        allScopes={[...ALL_SCOPES]}
      />
    </div>
  );
}
