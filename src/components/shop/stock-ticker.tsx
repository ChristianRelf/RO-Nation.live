// The stock ticker: what is on the table, sliding past on an accent band.
//
// Built on EventTicker's exact construction, and the comment there is the one that
// matters: TWO identical strips sit side by side, each sliding left by its OWN full
// width (-100%, not -50%), so at the end of the cycle the second strip is
// pixel-for-pixel where the first began and the loop restarts invisibly. Get that
// wrong and a blank band scrolls through every forty seconds.
//
// The text is `text-accent-ink`, never `text-white`. On RNL the accent is electric
// blue and its ink is white; on Sleep Token the accent is a light gold and its ink is
// near-black. Hardcoding white here would produce bone-on-gold - the exact failure
// globals.css warns about on the --accent-ink token.

const FALLBACK = ["Nothing on the rail yet", "Check back before the next show"];

function Strip({ items, hidden }: { items: string[]; hidden?: boolean }) {
  return (
    <div
      aria-hidden={hidden}
      className="flex min-w-full shrink-0 animate-marquee items-center gap-6 pr-6"
    >
      {items.map((t, i) => (
        <span
          key={i}
          className="flex shrink-0 items-center gap-6 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.16em]"
        >
          {t}
          <span aria-hidden className="opacity-50">
            &#9670;
          </span>
        </span>
      ))}
    </div>
  );
}

export function StockTicker({ items }: { items: string[] }) {
  const source = items.length ? items : FALLBACK;

  // Repeat until the strip is long enough to read as a stream rather than as three
  // words drifting through a lot of empty accent.
  const strip = [...source];
  while (strip.length < 8) strip.push(...source);

  return (
    <div className="on-accent flex select-none overflow-hidden border-y border-line bg-accent py-2.5 text-accent-ink">
      <Strip items={strip} />
      <Strip items={strip} hidden />
    </div>
  );
}
