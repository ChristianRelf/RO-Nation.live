// A Live-Nation-style scrolling marquee on a bold blue band. Pure CSS, no JS.

function Strip({ items }: { items: string[] }) {
  return (
    <div className="flex shrink-0 animate-marquee items-center gap-5 whitespace-nowrap pr-5">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-5">
          <span className="font-display text-sm tracking-tight text-white">
            {item}
          </span>
          <span className="text-[9px] text-white/60">◆</span>
        </span>
      ))}
    </div>
  );
}

export function EventTicker({ items }: { items: string[] }) {
  const row = items.length ? items : ["More shows dropping soon"];
  const loop = [...row, ...row, ...row, ...row];

  return (
    <div className="relative flex select-none overflow-hidden border-y border-black/20 bg-accent py-2.5">
      <Strip items={loop} />
      <div aria-hidden="true" className="flex">
        <Strip items={loop} />
      </div>
    </div>
  );
}
