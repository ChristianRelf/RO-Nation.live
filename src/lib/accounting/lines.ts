// The arithmetic of a document, and the parsing that feeds it.
//
// PURE, and deliberately so - no prisma, no server-only - because the same rules have to
// hold in three places: the builder form previewing a total, the server action storing
// one, and the printed page rendering it back. One implementation means those three can
// never drift into disagreeing about what a document is worth.
//
// THE RULE THIS FILE EXISTS FOR: a posted total is never trusted. The form sends
// descriptions, quantities and unit prices; every amount, the subtotal and the total are
// computed HERE, server-side, from those inputs. A form that could post its own total
// could post any total.
//
// Everything is integer Robux, like the rest of the money in this codebase (see
// lib/settlement.ts). Quantity is the one thing that is genuinely fractional - "7.5
// hours at 200 R$" is a real contractor line - so it is carried as HUNDREDTHS in an
// integer (`qtyCenti`, 750), never as a float. Floats accumulate error, and a document
// about money that is out by a Robux is worse than one that refuses to be written.

/**
 * The largest figure any single amount, the subtotal or the total may reach.
 *
 * One billion Robux, which is absurdly beyond any real document, and - the actual
 * reason for the number - comfortably inside a Postgres `Int` (max 2,147,483,647). The
 * columns are Int32; without a ceiling here a fat-fingered unit price would not be a
 * silly document, it would be a failed write or a wrapped number.
 */
export const MAX_AMOUNT = 1_000_000_000;

/** Quantity ceiling, in hundredths: 10,000.00 of anything. */
export const MAX_QTY_CENTI = 1_000_000;

/** More lines than this is a spreadsheet, not a document. */
export const MAX_LINES = 60;

/** How long one line's description may be. */
export const MAX_DESC = 300;

/** One line of a document, exactly as it is stored in the `lineItems` JSON column. */
export type LineItem = {
  description: string;
  /** Quantity × 100. "7.5 hours" is 750. Always ≥ 1. */
  qtyCenti: number;
  /** Price per unit, integer Robux. */
  unitRobux: number;
  /** qtyCenti × unitRobux ÷ 100, rounded. Computed, never posted. */
  amountRobux: number;
};

export type DocumentTotals = {
  lines: LineItem[];
  subtotal: number;
  adjustmentRobux: number;
  total: number;
};

/** Format hundredths back to the decimal a person typed: 750 → "7.5", 100 → "1". */
export function formatQty(qtyCenti: number): string {
  const whole = Math.trunc(qtyCenti / 100);
  const frac = qtyCenti % 100;
  if (frac === 0) return String(whole);
  // Two decimals, then trailing zero trimmed - 7.50 reads as 7.5, 7.25 stays 7.25.
  return `${whole}.${String(frac).padStart(2, "0")}`.replace(/0$/, "");
}

/**
 * Parse a typed quantity ("7.5", "2", "0.25") into hundredths.
 *
 * Returns null on anything that is not a positive number with at most two decimals.
 * Null is not zero: a zero-quantity line is a line that should not have been written,
 * and silently coercing it would put a 0 R$ row on a document somebody signs.
 */
export function parseQty(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(trimmed)) return null;
  // Via string maths rather than Math.round(parseFloat * 100): 0.29 * 100 is
  // 28.999999999999996 in binary floating point, and rounding hides that only until it
  // doesn't. Splitting the decimal keeps it exact.
  const [whole, frac = ""] = trimmed.split(".");
  const centi = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  if (centi < 1 || centi > MAX_QTY_CENTI) return null;
  return centi;
}

/**
 * Parse an integer Robux figure. Accepts "1,250" and " 400 ", rejects everything else.
 *
 * `allowNegative` is only ever true for the adjustment, which is the one figure on a
 * document that may legitimately be a deduction.
 */
export function parseRobux(raw: string, allowNegative = false): number | null {
  const trimmed = raw.trim().replace(/,/g, "");
  if (!trimmed) return null;
  const re = allowNegative ? /^-?\d{1,12}$/ : /^\d{1,12}$/;
  if (!re.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isSafeInteger(n)) return null;
  if (n > MAX_AMOUNT || n < (allowNegative ? -MAX_AMOUNT : 0)) return null;
  return n;
}

/** The amount for one line. The single definition of that multiplication. */
export function lineAmount(qtyCenti: number, unitRobux: number): number {
  return Math.round((qtyCenti * unitRobux) / 100);
}

export type TotalsResult =
  | { ok: true; value: DocumentTotals }
  | { ok: false; error: string };

/**
 * Build the totals from raw line inputs, validating as it goes.
 *
 * Every failure is a message a person can act on, because every one of them is
 * something they typed. The caller shows it and keeps their draft on screen.
 */
export function buildTotals(
  rawLines: { description: string; qty: string; unit: string }[],
  rawAdjustment: string,
): TotalsResult {
  // Blank rows are normal - the builder always renders a spare one - so they are
  // dropped rather than rejected. A row with SOME content but not all is a mistake,
  // and is caught below.
  const present = rawLines.filter(
    (l) => l.description.trim() || l.qty.trim() || l.unit.trim(),
  );

  if (!present.length) return { ok: false, error: "Add at least one line." };
  if (present.length > MAX_LINES) {
    return { ok: false, error: `A document can hold at most ${MAX_LINES} lines.` };
  }

  const lines: LineItem[] = [];
  let subtotal = 0;

  for (const [i, raw] of present.entries()) {
    const at = `Line ${i + 1}`;
    const description = raw.description.trim();
    if (!description) return { ok: false, error: `${at} needs a description.` };
    if (description.length > MAX_DESC) {
      return { ok: false, error: `${at}'s description is too long.` };
    }

    // An empty quantity means "one of these" - the overwhelmingly common case for a
    // fixed-fee line, where making somebody type "1" is friction for nothing.
    const qtyCenti = raw.qty.trim() ? parseQty(raw.qty) : 100;
    if (qtyCenti === null) {
      return {
        ok: false,
        error: `${at} has an invalid quantity. Use a positive number, at most two decimals.`,
      };
    }

    const unitRobux = parseRobux(raw.unit);
    if (unitRobux === null) {
      return {
        ok: false,
        error: `${at} has an invalid unit price. Use whole Robux, 0 or more.`,
      };
    }

    const amountRobux = lineAmount(qtyCenti, unitRobux);
    if (amountRobux > MAX_AMOUNT) {
      return { ok: false, error: `${at} comes to more than this desk will write.` };
    }

    subtotal += amountRobux;
    if (subtotal > MAX_AMOUNT) {
      return { ok: false, error: "The subtotal is larger than this desk will write." };
    }

    lines.push({ description, qtyCenti, unitRobux, amountRobux });
  }

  const adjustmentRobux = rawAdjustment.trim()
    ? parseRobux(rawAdjustment, true)
    : 0;
  if (adjustmentRobux === null) {
    return {
      ok: false,
      error: "The adjustment must be whole Robux - negative for a deduction.",
    };
  }

  const total = subtotal + adjustmentRobux;
  // A document that says somebody owes a negative amount is not a document, it is a
  // typo - almost always a deduction entered larger than the work it comes off. The
  // right answer is a smaller deduction, or a credit note.
  if (total < 0) {
    return {
      ok: false,
      error: "The deduction is larger than the subtotal, so the total would be negative.",
    };
  }
  if (total > MAX_AMOUNT) {
    return { ok: false, error: "The total is larger than this desk will write." };
  }

  return { ok: true, value: { lines, subtotal, adjustmentRobux, total } };
}

/**
 * Read stored `lineItems` JSON back into typed lines.
 *
 * Defensive on every field: this is a Json column, so the compiler guarantees nothing
 * about what is in it, and a document written by an older shape of this code must still
 * render rather than crash the page it is on. Anything unreadable is dropped.
 */
export function readLineItems(value: unknown): LineItem[] {
  if (!Array.isArray(value)) return [];
  const out: LineItem[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const qtyCenti = typeof r.qtyCenti === "number" ? r.qtyCenti : 100;
    const unitRobux = typeof r.unitRobux === "number" ? r.unitRobux : 0;
    out.push({
      description: typeof r.description === "string" ? r.description : "",
      qtyCenti,
      unitRobux,
      // Trust the STORED amount when it is there - it is what was frozen and what the
      // stored subtotal was built from. Recomputing would risk a document whose lines
      // silently stop adding up to the total printed beside them.
      amountRobux:
        typeof r.amountRobux === "number"
          ? r.amountRobux
          : lineAmount(qtyCenti, unitRobux),
    });
  }
  return out;
}
