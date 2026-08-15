import type { ReactNode } from "react";
import type { PaymentTerms } from "@/lib/accounting/terms";

// The terms block at the foot of a printed accounting sheet, and the one piece of inline
// markup its prose is allowed.
//
// ---- Why bold, and only bold ----------------------------------------------
//
// The clauses are authored as plain strings in lib/accounting/terms.ts, deliberately, for
// the reason legal-doc.tsx gives about policy prose: it is easier to read, review and diff
// as prose than as a tree of elements. But this block is nine paragraphs of terms on a
// page somebody is scanning for a number, and the three phrases that change what they DO -
// "does not constitute payment", "held pending a valid payment request", "only a confirmed
// payment ... constitutes completion" - have to survive the scan.
//
// So `**...**` becomes a <strong> and nothing else is interpreted. No links (this is paper;
// a blue underline that cannot be clicked is worse than the address written out), no
// italics, no lists. The token is narrow enough that ordinary prose never trips it - it
// needs a doubled asterisk on both sides - and an unclosed one is left as written rather
// than swallowing the rest of the paragraph.
const BOLD = /\*\*([^*]+)\*\*/g;

function renderBold(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let last = 0;
  let key = 0;

  for (const m of text.matchAll(BOLD)) {
    const at = m.index ?? 0;
    if (at > last) parts.push(text.slice(last, at));
    parts.push(
      <strong key={key} className="font-semibold text-black">
        {m[1]}
      </strong>,
    );
    last = at + m[0].length;
    key++;
  }

  // The common case allocates nothing and renders identically to a bare string.
  if (key === 0) return text;
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/**
 * The block itself: a rule, a heading, the clauses, and the facts strip.
 *
 * `break-before-page` is deliberately NOT set. On a one-page document the terms should sit
 * under the total where they can be read alongside it; on a longer one the print rules in
 * the parent (`section { break-inside: avoid }`) push the whole block to the next page
 * rather than slicing it. What must never happen is a sheet whose terms are a separate
 * page that somebody prints without.
 */
export function TermsBlock({ terms }: { terms: PaymentTerms }) {
  return (
    <section className="mt-12 border-t-2 border-black pt-5">
      <h2 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-black">
        {terms.heading}
      </h2>

      <div className="mt-3 space-y-2 text-[10px] leading-[1.55] text-neutral-700">
        {terms.clauses.map((c, i) => (
          // Index as key: the clause list is a frozen constant, never reordered at runtime.
          <p key={i}>{renderBold(c)}</p>
        ))}
      </div>

      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-1.5 border-t border-neutral-300 pt-3 text-[10px]">
        {terms.facts.map((f) => (
          <div key={f.label} className="flex items-baseline gap-1.5">
            <dt className="font-bold uppercase tracking-wide text-neutral-500">
              {f.label}
            </dt>
            <dd className="font-semibold text-black">{f.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
