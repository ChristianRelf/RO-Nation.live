"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { doorCheck, doorRedeem, type DoorState } from "@/app/actions/door";

// The door, as a crew member sees it.
//
// Designed for the actual situation: standing up, one hand, a queue, and a dark
// room. So the verdict is a single word in the biggest type on the site, colour
// coded, above everything else — because the person reading it is glancing, not
// studying. The detail sits underneath for when they need it.
//
// The input keeps focus and clears itself after every check. A barcode scanner is
// a keyboard: it types the code and presses Enter. That means a wedge scanner
// works here with no integration at all — plug it in, click the box once, and it
// checks a ticket every time somebody scans one.

const VERDICTS: Record<
  string,
  { label: string; tone: string; ring: string }
> = {
  ok: {
    label: "Admit",
    tone: "text-emerald-300",
    ring: "border-emerald-400/40 bg-emerald-400/10",
  },
  already_checked_in: {
    label: "Already used",
    tone: "text-amber-300",
    ring: "border-amber-400/40 bg-amber-400/10",
  },
  cancelled: {
    label: "Cancelled",
    tone: "text-red-300",
    ring: "border-red-500/40 bg-red-500/10",
  },
  wrong_event: {
    label: "Wrong show",
    tone: "text-red-300",
    ring: "border-red-500/40 bg-red-500/10",
  },
  not_found: {
    label: "Not found",
    tone: "text-red-300",
    ring: "border-red-500/40 bg-red-500/10",
  },
};

export function DoorCheck({
  /** A partner slug, or "" for RNL's own shows. Authorises nothing — the action re-checks. */
  scope,
  /** Pin the door to one show, so a ticket for another is refused. Optional but wanted. */
  events,
}: {
  scope: string;
  events: { id: string; title: string }[];
}) {
  const [state, submit] = useFormState<DoorState | null, FormData>(
    doorCheck,
    null,
  );
  const [redeemState, redeem] = useFormState<DoorState | null, FormData>(
    doorRedeem,
    null,
  );

  // Whichever ran last wins the screen.
  const shown = redeemState ?? state;

  const codeRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear and re-focus after every verdict, so the next scan just works. Without
  // this the scanner types the second code onto the end of the first one and the
  // door stops dead — which happens at the worst possible moment, mid-queue.
  useEffect(() => {
    if (!shown) return;
    if (codeRef.current) {
      codeRef.current.value = "";
      codeRef.current.focus();
    }
  }, [shown]);

  const result = shown?.state === "result" ? shown.result : null;
  const verdict = result ? VERDICTS[result.reason] : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[24rem_1fr]">
      {/* ---- The input ---- */}
      <form ref={formRef} action={submit} className="card h-fit p-6">
        <input type="hidden" name="scope" value={scope} />

        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
          Ticket code
        </label>
        <input
          ref={codeRef}
          name="code"
          autoFocus
          autoComplete="off"
          spellCheck={false}
          placeholder="RN-4K9QW2"
          className="w-full rounded-brand border border-line bg-bg px-4 py-3 text-center font-mono text-xl font-bold uppercase tracking-[0.2em] outline-none transition-colors focus:border-accent"
        />
        <p className="mt-2 text-xs text-faint">
          Scan the barcode or the QR, or type it in. A USB scanner works here —
          it types the code and presses Enter.
        </p>

        {events.length ? (
          <div className="mt-5">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Tonight&apos;s show
            </label>
            <select
              name="eventId"
              defaultValue={events[0]?.id ?? ""}
              className="w-full rounded-brand border border-line bg-bg px-4 py-2.5 text-sm outline-none focus:border-accent"
            >
              {/* Empty is allowed on purpose: without a show pinned, this answers
                  "is it a real ticket" rather than "is it real FOR TONIGHT", and a
                  genuine ticket for another date would be admitted. */}
              <option value="">Any show (not recommended)</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <Submit className="btn btn-accent mt-5 w-full text-base" busy="Checking…">
          Check ticket
        </Submit>

        {shown?.state === "error" ? (
          <p className="mt-4 rounded-brand border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
            {shown.message}
          </p>
        ) : null}
      </form>

      {/* ---- The verdict ---- */}
      {result && verdict ? (
        <div className={`rounded-brand border p-8 ${verdict.ring}`}>
          <p className={`display text-6xl leading-none sm:text-7xl ${verdict.tone}`}>
            {verdict.label.toUpperCase()}
          </p>
          <p className="mt-3 text-lg text-fg">{result.message}</p>

          {result.ticket ? (
            <>
              <dl className="mt-8 grid gap-x-8 gap-y-5 border-t border-line pt-6 sm:grid-cols-2">
                <Row label="Admission">
                  <span className="flex items-center gap-2">
                    <span className="text-fg">{result.ticket.admission.tier}</span>
                    {result.ticket.admission.kind === "VIP" ? (
                      <span className="pill border-accent/40 text-accent">VIP</span>
                    ) : null}
                  </span>
                </Row>
                <Row label="Holder">
                  <span className="text-fg">{result.holder.displayName}</span>{" "}
                  <span className="text-faint">@{result.holder.username}</span>
                </Row>
                <Row label="Show">
                  <span className="text-fg">{result.event.title}</span>
                </Row>
                <Row label="Ticket">
                  <span className="font-mono tracking-widest text-fg">
                    {result.ticket.code}
                  </span>
                </Row>
                <Row label="Security seal">
                  <span className="font-mono font-bold tracking-widest text-fg">
                    {result.ticket.seal}
                  </span>
                  <span className="ml-2 text-xs text-faint">
                    must match the ticket
                  </span>
                </Row>
                <Row label="Checked in">
                  <span className="text-fg">
                    {result.ticket.checkedInAt
                      ? new Date(result.ticket.checkedInAt).toLocaleString("en-GB")
                      : "Not yet"}
                  </span>
                </Row>
              </dl>

              {/* Redeeming is a SECOND, deliberate press. Auto-burning on lookup
                  would mean a crew member who checked a ticket to answer a question
                  has silently spent it, and the holder is turned away at the door
                  they were about to walk through. */}
              {result.admit ? (
                <form action={redeem} className="mt-8">
                  <input type="hidden" name="scope" value={scope} />
                  <input type="hidden" name="code" value={result.ticket.code} />
                  <input type="hidden" name="eventId" value={result.event.id} />
                  <Submit
                    className="btn btn-accent w-full text-base sm:w-auto"
                    busy="Checking in…"
                  >
                    Check in {result.holder.displayName} →
                  </Submit>
                </form>
              ) : null}
            </>
          ) : null}
        </div>
      ) : (
        <div className="grid place-items-center rounded-brand border border-dashed border-line p-8 text-center">
          <div>
            <p className="display text-3xl text-faint">Ready</p>
            <p className="mt-2 max-w-xs text-sm text-muted">
              Scan or type a ticket code. The result shows here.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Submit({
  children,
  className,
  busy,
}: {
  children: React.ReactNode;
  className: string;
  busy: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending}>
      {pending ? busy : children}
    </button>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-bold uppercase tracking-kicker text-faint">
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm">{children}</dd>
    </div>
  );
}
