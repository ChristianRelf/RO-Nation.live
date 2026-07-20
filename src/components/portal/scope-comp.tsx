import type { RosterScope } from "@/lib/portal-scope";
import type { CompOption } from "@/lib/comp-options";
import { compVipsToShow } from "@/app/actions/comp";

// Comp the whole VIP list into a show. Shared by /shasha and a partner portal,
// pointed at one scope. The action does the work (and every issueTicket guard); this
// is the form. One select carries the show AND the tier as a single "eventId::tierId"
// choice, so no client-side filtering is needed.

const inputClass =
  "w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm outline-none transition-colors focus:border-accent";

export function ScopeComp({
  scope,
  options,
  vipCount,
  status,
}: {
  scope: RosterScope;
  /** show × tier combinations, value = "eventId::tierId" (tierId "" = implicit GA). */
  options: CompOption[];
  vipCount: number;
  status?: { ok?: string; issued?: string; already?: string; capped?: string; error?: string };
}) {
  return (
    <section>
      <div className="mb-6 border-b border-line pb-4">
        <h2 className="font-display text-2xl uppercase">Comp VIPs</h2>
        <p className="mt-2 text-sm text-muted">
          Hand every player on {scope.name}&apos;s VIP list a ticket to a show, in one
          go. No money changes hands - a comp is a gift - and each ticket is stamped
          with who gave it. A blacklisted player is never included; a revoked one is
          skipped; anyone already holding a ticket keeps the one they have.
        </p>
        <p className="mt-2 text-xs text-faint">
          {vipCount} {vipCount === 1 ? "player" : "players"} currently on the VIP list.
        </p>
      </div>

      {status?.ok ? (
        <p className="mb-6 border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-300">
          Comped {status.issued ?? 0} new ticket
          {status.issued === "1" ? "" : "s"}
          {status.already && status.already !== "0"
            ? ` · ${status.already} already held one`
            : ""}
          {status.capped ? " · list was capped at 500 for this run" : ""}.
        </p>
      ) : status?.error ? (
        <p className="mb-6 border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {status.error === "required"
            ? "Pick a show first."
            : status.error === "slowdown"
              ? "That's a lot of comp runs in a short time - give it a little while."
              : status.error === "badshow"
                ? "That show isn't one you can comp to."
                : "Something went wrong. Try again."}
        </p>
      ) : null}

      {vipCount === 0 ? (
        <div className="card grid place-items-center px-6 py-16 text-center">
          <p className="font-display text-xl">No VIPs yet</p>
          <p className="mt-2 max-w-sm text-sm text-muted">
            Add players to the VIP list and you can comp them all into a show from here.
          </p>
        </div>
      ) : options.length ? (
        <form action={compVipsToShow} className="card space-y-5 p-6">
          <input type="hidden" name="scope" value={scope.id} />

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Show &amp; tier
            </label>
            <select name="pick" required defaultValue="" className={inputClass}>
              <option value="" disabled>
                Pick a show…
              </option>
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <button className="btn btn-accent">Comp the VIP list</button>
            <span className="text-xs text-faint">
              Issues up to {vipCount} ticket{vipCount === 1 ? "" : "s"} in one run.
            </span>
          </div>
        </form>
      ) : (
        <div className="card grid place-items-center px-6 py-16 text-center">
          <p className="font-display text-xl">No published shows</p>
          <p className="mt-2 max-w-sm text-sm text-muted">
            Publish a show first - there is nothing to comp anyone into yet.
          </p>
        </div>
      )}
    </section>
  );
}
