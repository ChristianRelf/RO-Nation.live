"use client";

import { useMemo, useState } from "react";
// useFormState, not React 19's useActionState - this app is on React 18, exactly as
// components/portal/api-keys.tsx notes.
import { useFormState, useFormStatus } from "react-dom";
import type { DocumentKind, PartnerAccountStatus } from "@prisma/client";
import type { DocumentFormState } from "@/app/actions/accounting";
import { kindConfig } from "@/lib/accounting/kinds";
import { lineAmount, parseQty, parseRobux, MAX_LINES } from "@/lib/accounting/lines";
import { formatRobux } from "@/lib/tickets/pricing";

// The document builder - the one screen where a document is written.
//
// The line rows post as ONE json field, not as line[0][desc] style indexed inputs, for
// the reason TierEditor documents at length: indexed names have to be re-assembled by
// hand server-side, and a gap in the indices (remove row 2 of 4) is exactly what that
// re-assembly gets subtly wrong. One field, parsed and validated in one place.
//
// The totals shown here are a PREVIEW and nothing else. They are recomputed from the
// same pure helpers the server uses (lines.ts), so the two agree - but the server
// recomputes from scratch and never reads a total off this form. See buildTotals(). If
// these two ever disagree, the server is right and this is a display bug.

export type LineDraft = { description: string; qty: string; unit: string };

const BLANK: LineDraft = { description: "", qty: "", unit: "" };

const inputClass =
  "w-full rounded-brand border border-line bg-bg px-3 py-2 text-sm outline-none transition-colors focus:border-accent";
const labelClass =
  "mb-1 block text-[10px] font-semibold uppercase tracking-wide text-faint";

export type RelatableDoc = { id: string; number: string; label: string };

/** A partner the document can be filed against - fills the name and scopes it to their portal. */
export type PartnerOption = { id: string; name: string; status: PartnerAccountStatus };

export function DocumentBuilder({
  kind,
  documentId,
  action,
  initial,
  relatable,
  partnerAccounts,
  submitLabel,
  cancelHref,
}: {
  kind: DocumentKind;
  /** Set when editing an existing draft; omitted when writing a new one. */
  documentId?: string;
  /**
   * A useFormState action: it RETURNS an error rather than redirecting to one, so a
   * rejected document keeps every line the author typed. See the note in
   * actions/accounting.ts.
   */
  action: (
    prev: DocumentFormState,
    formData: FormData,
  ) => Promise<DocumentFormState>;
  initial?: {
    title: string;
    counterpartyName: string;
    counterpartyRef: string;
    counterpartyDetail: string;
    relatedId: string;
    lines: LineDraft[];
    adjustmentLabel: string;
    adjustment: string;
    terms: string;
    notes: string;
    documentDate: string;
    dueDate: string;
    partnerAccountId: string;
  };
  relatable: RelatableDoc[];
  partnerAccounts: PartnerOption[];
  submitLabel: string;
  cancelHref: string;
}) {
  const cfg = kindConfig(kind);
  const [state, formAction] = useFormState<DocumentFormState, FormData>(action, null);

  // One spare row on a fresh document, so the first thing you can do is type.
  const [lines, setLines] = useState<LineDraft[]>(
    initial?.lines?.length ? initial.lines : [{ ...BLANK }],
  );
  const [adjustment, setAdjustment] = useState(initial?.adjustment ?? "");
  // The picked partner, and the counterparty name it fills. Both are state so choosing a
  // partner can write the name - and the server treats the partner as authoritative anyway,
  // re-reading the entity's name at write time (see readForm in actions/accounting.ts).
  const [partnerAccountId, setPartnerAccountId] = useState(
    initial?.partnerAccountId ?? "",
  );
  const [counterpartyName, setCounterpartyName] = useState(
    initial?.counterpartyName ?? "",
  );

  const setLine = (i: number, patch: Partial<LineDraft>) =>
    setLines((prev) => prev.map((l, n) => (n === i ? { ...l, ...patch } : l)));

  const addLine = () =>
    setLines((prev) => (prev.length >= MAX_LINES ? prev : [...prev, { ...BLANK }]));

  // Never below one row: a document with no rows at all leaves nothing to type into and
  // no obvious way back.
  const removeLine = (i: number) =>
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, n) => n !== i)));

  // Preview maths. Anything unparseable counts as 0 rather than blowing up the preview -
  // a half-typed "12." is the normal state of a field somebody is still filling in, and
  // the server is what actually refuses bad input.
  const totals = useMemo(() => {
    let subtotal = 0;
    const amounts = lines.map((l) => {
      const qty = l.qty.trim() ? parseQty(l.qty) : 100;
      const unit = parseRobux(l.unit);
      if (qty === null || unit === null) return null;
      const amt = lineAmount(qty, unit);
      subtotal += amt;
      return amt;
    });
    const adj = adjustment.trim() ? (parseRobux(adjustment, true) ?? 0) : 0;
    return { amounts, subtotal, adj, total: subtotal + adj };
  }, [lines, adjustment]);

  return (
    <form action={formAction} className="space-y-8">
      {/* The rows, as json. The visible inputs below are deliberately unnamed - they
          feed state, and state feeds this. */}
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      {/* Kind is fixed by the route, not chosen in the form; on an edit, `id` says
          which draft this is. The server re-reads both rather than trusting them - a
          posted id only ever selects a row, and only a DRAFT row can be written. */}
      <input type="hidden" name="kind" value={kind} />
      {documentId ? <input type="hidden" name="id" value={documentId} /> : null}

      {state?.error ? (
        <p
          role="alert"
          className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          {state.error}
        </p>
      ) : null}

      {/* ---- Who and what ------------------------------------------------ */}
      <section className="card space-y-4 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Who and what
        </h2>

        {partnerAccounts.length ? (
          <div>
            <label className={labelClass} htmlFor="doc-partner">
              Partner <span className="text-faint">(optional)</span>
            </label>
            <select
              id="doc-partner"
              name="partnerAccountId"
              value={partnerAccountId}
              onChange={(e) => {
                const id = e.target.value;
                setPartnerAccountId(id);
                const picked = partnerAccounts.find((p) => p.id === id);
                if (picked) setCounterpartyName(picked.name);
              }}
              className={inputClass}
            >
              <option value="">- None (free text) -</option>
              {partnerAccounts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.status === "POTENTIAL" ? " · potential" : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-faint">
              Pick a partner to file this in their portal too. Leave as free text otherwise.
            </p>
          </div>
        ) : null}

        <div>
          <label className={labelClass} htmlFor="doc-party">
            {cfg.partyFieldLabel}
          </label>
          <input
            id="doc-party"
            name="counterpartyName"
            required
            maxLength={200}
            value={counterpartyName}
            onChange={(e) => setCounterpartyName(e.target.value)}
            placeholder="Name, studio or handle"
            className={inputClass}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="doc-ref">
              Their reference <span className="text-faint">(optional)</span>
            </label>
            <input
              id="doc-ref"
              name="counterpartyRef"
              maxLength={200}
              defaultValue={initial?.counterpartyRef ?? ""}
              placeholder="@handle, Roblox ID or email"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="doc-title">
              What this is for
            </label>
            <input
              id="doc-title"
              name="title"
              required
              maxLength={200}
              defaultValue={initial?.title ?? ""}
              placeholder="Stage build, July shows"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="doc-detail">
            Address or extra detail <span className="text-faint">(optional)</span>
          </label>
          <textarea
            id="doc-detail"
            name="counterpartyDetail"
            rows={2}
            maxLength={500}
            defaultValue={initial?.counterpartyDetail ?? ""}
            className={inputClass}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="doc-date">
              Document date
            </label>
            <input
              id="doc-date"
              name="documentDate"
              type="date"
              required
              defaultValue={initial?.documentDate ?? today()}
              className={inputClass}
            />
          </div>
          {cfg.hasDueDate ? (
            <div>
              <label className={labelClass} htmlFor="doc-due">
                Due date <span className="text-faint">(optional)</span>
              </label>
              <input
                id="doc-due"
                name="dueDate"
                type="date"
                defaultValue={initial?.dueDate ?? ""}
                className={inputClass}
              />
            </div>
          ) : null}
        </div>

        {cfg.relates ? (
          <div>
            <label className={labelClass} htmlFor="doc-related">
              {cfg.relates.label}{" "}
              <span className="text-faint">(optional)</span>
            </label>
            <select
              id="doc-related"
              name="relatedId"
              defaultValue={initial?.relatedId ?? ""}
              className={inputClass}
            >
              <option value="">Nothing - this stands alone</option>
              {relatable.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted">{cfg.relates.hint}</p>
          </div>
        ) : null}
      </section>

      {/* ---- The lines ---------------------------------------------------- */}
      <section className="card space-y-3 p-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Lines
          </h2>
          <p className="text-xs text-faint">
            Leave quantity blank for a one-off fee. Robux, whole numbers.
          </p>
        </div>

        <div className="space-y-2">
          {lines.map((l, i) => (
            <div
              key={i}
              className="grid grid-cols-1 gap-2 border-b border-line pb-2 last:border-0 sm:grid-cols-[1fr_5rem_7rem_7rem_2rem] sm:items-center"
            >
              <input
                aria-label={`Line ${i + 1} description`}
                value={l.description}
                onChange={(e) => setLine(i, { description: e.target.value })}
                maxLength={300}
                placeholder="What was done"
                className={inputClass}
              />
              <input
                aria-label={`Line ${i + 1} quantity`}
                value={l.qty}
                onChange={(e) => setLine(i, { qty: e.target.value })}
                inputMode="decimal"
                placeholder="1"
                className={`${inputClass} text-right tabular-nums`}
              />
              <input
                aria-label={`Line ${i + 1} unit price`}
                value={l.unit}
                onChange={(e) => setLine(i, { unit: e.target.value })}
                inputMode="numeric"
                placeholder="R$ each"
                className={`${inputClass} text-right tabular-nums`}
              />
              <p className="self-center text-right text-sm tabular-nums text-muted">
                {totals.amounts[i] === null ? "-" : formatRobux(totals.amounts[i]!)}
              </p>
              <button
                type="button"
                onClick={() => removeLine(i)}
                disabled={lines.length <= 1}
                aria-label={`Remove line ${i + 1}`}
                className="justify-self-end rounded-lg px-2 py-1 text-sm text-muted transition-colors hover:text-red-400 disabled:opacity-30"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addLine}
          disabled={lines.length >= MAX_LINES}
          className="btn btn-ghost text-sm disabled:opacity-40"
        >
          + Add line
        </button>
      </section>

      {/* ---- Adjustment and totals ---------------------------------------- */}
      <section className="card space-y-4 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Adjustment and total
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="doc-adj-label">
              Adjustment label <span className="text-faint">(optional)</span>
            </label>
            <input
              id="doc-adj-label"
              name="adjustmentLabel"
              maxLength={100}
              defaultValue={initial?.adjustmentLabel ?? ""}
              placeholder="Advance already paid"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="doc-adj">
              Adjustment <span className="text-faint">(negative to deduct)</span>
            </label>
            <input
              id="doc-adj"
              name="adjustment"
              value={adjustment}
              onChange={(e) => setAdjustment(e.target.value)}
              inputMode="numeric"
              placeholder="-5000"
              className={`${inputClass} text-right tabular-nums`}
            />
          </div>
        </div>

        <dl className="ml-auto w-full max-w-xs space-y-1.5 border-t border-line pt-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Subtotal</dt>
            <dd className="tabular-nums">{formatRobux(totals.subtotal)}</dd>
          </div>
          {totals.adj !== 0 ? (
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Adjustment</dt>
              <dd className="tabular-nums">
                {totals.adj < 0 ? "− " : "+ "}
                {formatRobux(Math.abs(totals.adj))}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4 border-t border-line pt-1.5">
            <dt className="font-semibold">{cfg.totalLabel}</dt>
            <dd
              className={`font-bold tabular-nums ${totals.total < 0 ? "text-red-400" : ""}`}
            >
              {formatRobux(totals.total)}
            </dd>
          </div>
          {totals.total < 0 ? (
            <p className="text-xs text-red-400">
              The deduction is bigger than the subtotal. This won&apos;t save.
            </p>
          ) : null}
        </dl>
      </section>

      {/* ---- Terms and notes ---------------------------------------------- */}
      <section className="card space-y-4 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Terms and notes
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="doc-terms">
              Terms
            </label>
            <textarea
              id="doc-terms"
              name="terms"
              rows={3}
              maxLength={1000}
              defaultValue={initial?.terms ?? cfg.defaultTerms}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="doc-notes">
              Notes <span className="text-faint">(prints on the document)</span>
            </label>
            <textarea
              id="doc-notes"
              name="notes"
              rows={3}
              maxLength={1000}
              defaultValue={initial?.notes ?? ""}
              placeholder="Paid via Roblox group payout to @handle"
              className={inputClass}
            />
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <Submit label={submitLabel} />
        <a href={cancelHref} className="text-sm text-muted hover:text-fg">
          Cancel
        </a>
      </div>
    </form>
  );
}

/**
 * The submit button, disabled while the action is in flight.
 *
 * Its own component because useFormStatus only reports the status of the form ABOVE it
 * in the tree - called in the same component as the <form>, it always reads "idle".
 */
function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-accent disabled:opacity-50">
      {pending ? "Saving…" : label}
    </button>
  );
}

/** Today as yyyy-mm-dd, in the browser's own zone - it is the date they mean. */
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
