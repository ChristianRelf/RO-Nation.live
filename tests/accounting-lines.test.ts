import { describe, it, expect } from "vitest";
import {
  buildTotals,
  formatQty,
  lineAmount,
  parseQty,
  parseRobux,
  readLineItems,
  MAX_AMOUNT,
  MAX_LINES,
} from "@/lib/accounting/lines";

// The arithmetic behind every hand-authored accounting document (lib/accounting/lines.ts).
//
// Pure functions, no database - which is the point. This is the one module in the
// accounting desk where a bug is silent: a wrong guard throws an error somebody sees,
// but a wrong SUM prints a number on a document that gets sent, paid and filed. So the
// things under test are the ones that fail quietly:
//
//   1. THE SERVER OWNS THE TOTAL. buildTotals derives every amount from the description,
//      quantity and unit price. Nothing it returns can be influenced by a posted total,
//      because it never reads one - a form that could post its own total could post any.
//
//   2. DECIMAL QUANTITIES ARE EXACT. "0.29 hours" through binary floating point is
//      28.999999999999996 centi, and Math.round hides that until the day it doesn't.
//      Quantity is parsed by splitting the string, and this asserts it.
//
//   3. THE CEILINGS HOLD. Every money column is a Postgres Int32. A figure past
//      MAX_AMOUNT has to be refused in here, because the alternative is not a silly
//      document - it is a failed write or a wrapped number.

const line = (description: string, qty: string, unit: string) => ({
  description,
  qty,
  unit,
});

describe("parseQty", () => {
  it("parses whole and decimal quantities to exact hundredths", () => {
    expect(parseQty("1")).toBe(100);
    expect(parseQty("7.5")).toBe(750);
    expect(parseQty("7.25")).toBe(725);
    expect(parseQty("0.05")).toBe(5);
  });

  it("is exact on the values binary floating point gets wrong", () => {
    // 0.29 * 100 === 28.999999999999996 in IEEE 754. The string split must not care.
    expect(parseQty("0.29")).toBe(29);
    expect(parseQty("1.15")).toBe(115);
    expect(parseQty("8.87")).toBe(887);
  });

  it("refuses zero, negatives, junk and over-precision", () => {
    // Zero is refused rather than coerced: a zero-quantity line is a line that should
    // not have been written, and silently keeping it puts a 0 R$ row on a document.
    expect(parseQty("0")).toBeNull();
    expect(parseQty("-1")).toBeNull();
    expect(parseQty("1.234")).toBeNull();
    expect(parseQty("abc")).toBeNull();
    expect(parseQty("")).toBeNull();
    expect(parseQty("1e3")).toBeNull();
  });
});

describe("formatQty", () => {
  it("renders hundredths back as a person would type them", () => {
    expect(formatQty(100)).toBe("1");
    expect(formatQty(750)).toBe("7.5");
    expect(formatQty(725)).toBe("7.25");
    expect(formatQty(705)).toBe("7.05");
    expect(formatQty(10)).toBe("0.1");
  });

  it("round-trips through parseQty", () => {
    // The edit page renders stored centi back into the builder's text inputs with this,
    // and the action parses them again on save. A lossy pair would quietly rewrite the
    // quantities on every edit of a draft.
    for (const centi of [1, 5, 10, 29, 100, 705, 725, 750, 999, 100_000]) {
      expect(parseQty(formatQty(centi))).toBe(centi);
    }
  });
});

describe("parseRobux", () => {
  it("accepts whole Robux, with or without separators", () => {
    expect(parseRobux("400")).toBe(400);
    expect(parseRobux(" 1,250 ")).toBe(1250);
    expect(parseRobux("0")).toBe(0);
  });

  it("refuses decimals and negatives unless negatives are allowed", () => {
    expect(parseRobux("12.5")).toBeNull();
    expect(parseRobux("-100")).toBeNull();
    expect(parseRobux("-100", true)).toBe(-100);
  });

  it("refuses anything past the Int32-safe ceiling", () => {
    expect(parseRobux(String(MAX_AMOUNT))).toBe(MAX_AMOUNT);
    expect(parseRobux(String(MAX_AMOUNT + 1))).toBeNull();
    expect(parseRobux(String(-MAX_AMOUNT - 1), true)).toBeNull();
  });
});

describe("lineAmount", () => {
  it("multiplies quantity by unit price and rounds to whole Robux", () => {
    expect(lineAmount(100, 500)).toBe(500);
    expect(lineAmount(750, 200)).toBe(1500);
    // 0.25 x 101 = 25.25 -> 25. Robux has no subunit, so a line amount is rounded once,
    // here, rather than accumulating fractions into the subtotal.
    expect(lineAmount(25, 101)).toBe(25);
  });
});

describe("buildTotals", () => {
  it("derives every amount and the subtotal from the inputs", () => {
    const result = buildTotals(
      [line("Stage build", "7.5", "200"), line("Lighting rig", "1", "5000")],
      "",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.lines).toHaveLength(2);
    expect(result.value.lines[0].amountRobux).toBe(1500);
    expect(result.value.lines[1].amountRobux).toBe(5000);
    expect(result.value.subtotal).toBe(6500);
    expect(result.value.total).toBe(6500);
    // Reconciliation: the lines must add to the subtotal, exactly. This is the property
    // the whole document rests on.
    const summed = result.value.lines.reduce((n, l) => n + l.amountRobux, 0);
    expect(summed).toBe(result.value.subtotal);
  });

  it("treats a blank quantity as one, for a fixed fee", () => {
    const result = buildTotals([line("Commission", "", "12000")], "");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.lines[0].qtyCenti).toBe(100);
    expect(result.value.total).toBe(12000);
  });

  it("drops entirely blank rows but refuses half-filled ones", () => {
    // The builder always renders a spare row, so a trailing blank is the normal state
    // of a finished document - it must not be an error.
    const withBlank = buildTotals(
      [line("Work", "1", "100"), line("", "", "")],
      "",
    );
    expect(withBlank.ok).toBe(true);
    if (withBlank.ok) expect(withBlank.value.lines).toHaveLength(1);

    // A row with a price but no description is a mistake, not a spare row.
    const halfFilled = buildTotals(
      [line("Work", "1", "100"), line("", "", "500")],
      "",
    );
    expect(halfFilled.ok).toBe(false);
  });

  it("applies a negative adjustment as a deduction", () => {
    const result = buildTotals([line("Build", "1", "10000")], "-2500");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.subtotal).toBe(10000);
    expect(result.value.adjustmentRobux).toBe(-2500);
    expect(result.value.total).toBe(7500);
  });

  it("refuses a deduction larger than the subtotal", () => {
    // A document saying somebody owes a negative amount is a typo, and the total column
    // is where it would be believed. The right answer is a smaller deduction or a
    // credit note - never a negative document.
    const result = buildTotals([line("Build", "1", "1000")], "-5000");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/negative/i);
  });

  it("refuses an empty document", () => {
    expect(buildTotals([], "").ok).toBe(false);
    expect(buildTotals([line("", "", "")], "").ok).toBe(false);
  });

  it("refuses more lines than the cap", () => {
    const many = Array.from({ length: MAX_LINES + 1 }, (_, i) =>
      line(`Item ${i}`, "1", "1"),
    );
    expect(buildTotals(many, "").ok).toBe(false);
  });

  it("refuses a subtotal that would overflow the money column", () => {
    // Two lines each inside the per-line ceiling, whose SUM is not. The per-line check
    // alone would let this through and hand Postgres a number its Int column cannot
    // hold - the running check in buildTotals is what catches it.
    const result = buildTotals(
      [
        line("A", "1", String(MAX_AMOUNT)),
        line("B", "1", String(MAX_AMOUNT)),
      ],
      "",
    );
    expect(result.ok).toBe(false);
  });

  it("refuses a line whose quantity x price overflows", () => {
    const result = buildTotals([line("A", "10000", String(MAX_AMOUNT))], "");
    expect(result.ok).toBe(false);
  });

  it("names the offending line so the error can be acted on", () => {
    const result = buildTotals(
      [line("Fine", "1", "100"), line("Bad", "1", "not-a-number")],
      "",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Line 2/);
  });
});

describe("readLineItems", () => {
  it("reads back what buildTotals wrote", () => {
    const built = buildTotals([line("Stage build", "7.5", "200")], "");
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    // The round trip through the Json column - what the paper renders from.
    expect(readLineItems(built.value.lines)).toEqual(built.value.lines);
  });

  it("survives junk in the Json column rather than crashing the page", () => {
    // lineItems is a Json column, so the compiler guarantees nothing about it. A
    // document written by an older shape of this code still has to RENDER - an
    // unreadable line is a gap on the page, not a 500 on a document somebody was sent.
    expect(readLineItems(null)).toEqual([]);
    expect(readLineItems("nonsense")).toEqual([]);
    expect(readLineItems([{ description: "Only a description" }])).toEqual([
      { description: "Only a description", qtyCenti: 100, unitRobux: 0, amountRobux: 0 },
    ]);
  });

  it("trusts the stored amount over recomputing it", () => {
    // What was frozen is what the stored subtotal was built from. Recomputing here
    // would risk a document whose lines silently stop adding up to the total printed
    // beside them - which is exactly what a frozen document exists to prevent.
    expect(
      readLineItems([
        { description: "Legacy", qtyCenti: 100, unitRobux: 100, amountRobux: 999 },
      ])[0].amountRobux,
    ).toBe(999);
  });
});
