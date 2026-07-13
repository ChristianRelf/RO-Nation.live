"use client";

import { useState } from "react";
// useFormState, not React 19's useActionState — this app is on React 18, where
// that export does not exist. It compiles either way and fails in the browser.
import { useFormState, useFormStatus } from "react-dom";
import type { ApiKeyScope } from "@prisma/client";
import { createApiKey, revokeApiKey, type MintState } from "@/app/actions/api-keys";
import { cn } from "@/lib/utils";

// The API keys panel, shared by SHASHA and every partner portal.
//
// The one thing this screen has to get right is the moment a key is minted. The
// token exists in exactly one place — the response to the form POST — and after
// this render it is gone forever, because all we keep is a SHA-256 of it. So the
// reveal is a panel that has to be dismissed, not a line of text in a table that
// scrolls away while somebody is looking at their other monitor.

export type KeyRow = {
  id: string;
  name: string;
  keyId: string;
  scopes: ApiKeyScope[];
  createdByName: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  revokedByName: string | null;
};

export function ApiKeysPanel({
  scopeId,
  orgName,
  keys,
  scopeLabels,
  allScopes,
}: {
  /** The portal id — "shasha", or a partner slug. Bound into the actions. */
  scopeId: string;
  orgName: string;
  keys: KeyRow[];
  scopeLabels: Record<string, { title: string; detail: string }>;
  allScopes: string[];
}) {
  const create = createApiKey.bind(null, scopeId);
  const [state, action] = useFormState<MintState, FormData>(create, null);
  const [showForm, setShowForm] = useState(false);

  const live = keys.filter((k) => !k.revokedAt);
  const dead = keys.filter((k) => k.revokedAt);

  return (
    <div className="space-y-8">
      {state?.ok ? (
        <NewKey token={state.token} name={state.name} />
      ) : null}

      {state && !state.ok ? (
        <p className="border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {state.error}
        </p>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h2 className="display text-xl">Keys</h2>
            <p className="text-sm text-muted">
              A key lets a Roblox experience talk to {orgName}&rsquo;s tickets — and only{" "}
              {orgName}&rsquo;s. It can never see another organisation&rsquo;s shows.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="shrink-0 bg-accent px-4 py-2 text-sm font-bold text-accent-ink"
          >
            {showForm ? "Cancel" : "New key"}
          </button>
        </div>

        {showForm ? (
          <form action={action} className="space-y-5 border border-line p-5">
            <label className="block space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-kicker text-muted">
                What is it for?
              </span>
              <input
                name="name"
                required
                maxLength={80}
                placeholder="Main experience — door scanner"
                className="w-full border border-line bg-bg px-3 py-2 text-sm"
              />
              <span className="block text-xs text-faint">
                You will see this name, and never the key itself, so make it one you
                will recognise when you come to revoke it.
              </span>
            </label>

            <fieldset className="space-y-2">
              <legend className="text-xs font-bold uppercase tracking-kicker text-muted">
                What may it do?
              </legend>
              <p className="pb-1 text-xs text-faint">
                Tick only what this key actually needs. A door scanner that cannot
                issue tickets is a door scanner that cannot be turned into a ticket
                printer by whoever finds it.
              </p>
              {allScopes.map((s) => (
                <label
                  key={s}
                  className="flex cursor-pointer gap-3 border border-line p-3 transition-colors hover:border-accent/50"
                >
                  <input
                    type="checkbox"
                    name="scopes"
                    value={s}
                    className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
                  />
                  <span className="space-y-0.5">
                    <span className="block text-sm font-semibold">
                      {scopeLabels[s]?.title ?? s}
                    </span>
                    <span className="block text-xs text-muted">
                      {scopeLabels[s]?.detail}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>

            <Submit />
          </form>
        ) : null}

        {live.length === 0 && !showForm ? (
          <p className="border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
            No keys yet. Mint one to connect a Roblox experience to your door.
          </p>
        ) : null}

        {live.map((k) => (
          <KeyCard
            key={k.id}
            row={k}
            scopeId={scopeId}
            scopeLabels={scopeLabels}
          />
        ))}
      </section>

      {dead.length ? (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-kicker text-faint">
            Revoked
          </h2>
          {dead.map((k) => (
            <KeyCard
              key={k.id}
              row={k}
              scopeId={scopeId}
              scopeLabels={scopeLabels}
            />
          ))}
        </section>
      ) : null}
    </div>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-accent px-5 py-2.5 text-sm font-bold text-accent-ink disabled:opacity-50"
    >
      {pending ? "Minting…" : "Mint key"}
    </button>
  );
}

/**
 * The one and only sighting of the token.
 *
 * Deliberately loud, deliberately not dismissible by accident, and deliberately
 * says WHY it will not be shown again — "for security" teaches nobody anything,
 * and somebody who understands that we genuinely cannot retrieve it will actually
 * copy it now rather than assume they can come back for it.
 */
function NewKey({ token, name }: { token: string; name: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="border-2 border-accent bg-accent/5 p-5">
      <p className="text-xs font-bold uppercase tracking-kicker text-accent">
        {name} — copy it now
      </p>
      <p className="mt-2 text-sm text-muted">
        This is the only time this key will ever be shown. We keep a hash of it, not
        the key, so nobody — including us — can read it back to you. Lose it and you
        mint a new one.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <code className="flex-1 select-all break-all border border-line bg-bg px-3 py-2 font-mono text-sm">
          {token}
        </code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(token).then(
              () => setCopied(true),
              () => setCopied(false),
            );
          }}
          className="shrink-0 border border-accent px-4 py-2 text-sm font-bold text-accent"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <p className="mt-3 text-xs text-faint">
        Put it in your game&rsquo;s server scripts only — never in a LocalScript, and
        never in a place anybody can take a copy of. Anyone holding it can do
        everything you ticked.
      </p>
    </div>
  );
}

function KeyCard({
  row,
  scopeId,
  scopeLabels,
}: {
  row: KeyRow;
  scopeId: string;
  scopeLabels: Record<string, { title: string; detail: string }>;
}) {
  const revoke = revokeApiKey.bind(null, scopeId);
  const revoked = Boolean(row.revokedAt);

  return (
    <div
      className={cn(
        "border border-line p-4",
        revoked && "opacity-60",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-semibold">{row.name}</p>
          <p className="font-mono text-xs text-faint">
            rnl_{row.keyId}_{"•".repeat(8)}
          </p>
        </div>

        {revoked ? (
          <span className="shrink-0 text-xs font-bold uppercase tracking-kicker text-red-400">
            Revoked
          </span>
        ) : (
          <form action={revoke}>
            <input type="hidden" name="id" value={row.id} />
            <button
              type="submit"
              className="shrink-0 border border-line px-3 py-1.5 text-xs font-bold text-muted transition-colors hover:border-red-500/60 hover:text-red-400"
            >
              Revoke
            </button>
          </form>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {row.scopes.map((s) => (
          <span
            key={s}
            title={scopeLabels[s]?.detail}
            className="border border-line px-2 py-0.5 text-[11px] text-muted"
          >
            {scopeLabels[s]?.title ?? s}
          </span>
        ))}
      </div>

      <p className="mt-3 text-xs text-faint">
        Minted by {row.createdByName} · {row.createdAt}
        {" · "}
        {/* "Never used" is the useful thing to say about a key somebody is about
            to delete — it means nothing is pointing at it and it is safe to go. */}
        {row.lastUsedAt ? `last used ${row.lastUsedAt}` : "never used"}
        {revoked && row.revokedByName ? ` · revoked by ${row.revokedByName}` : ""}
      </p>
    </div>
  );
}
