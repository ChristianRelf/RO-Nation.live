import { cn } from "@/lib/utils";

// Voices from the floor, drifting past. Built exactly like EventTicker - two
// identical strips side by side, each sliding left by its own full width, so the
// loop restarts on identical pixels and the seam never shows. See that file for
// the full note on why -100% and not -50%.

export type Quote = { body: string; author: string; meta: string };

function Strip({ quotes, hidden }: { quotes: Quote[]; hidden?: boolean }) {
  return (
    <div
      aria-hidden={hidden}
      className="flex min-w-full shrink-0 animate-marquee items-stretch gap-5 pr-5"
    >
      {quotes.map((q, i) => (
        <figure
          key={i}
          className="card flex w-[320px] shrink-0 flex-col justify-between p-6 sm:w-[380px]"
        >
          <blockquote className="text-[15px] leading-relaxed text-fg">
            <span className="mr-1 font-display text-2xl leading-none text-accent">
              &ldquo;
            </span>
            {q.body}
          </blockquote>
          <figcaption className="mt-5 flex items-center gap-2.5 border-t border-line pt-4">
            <span className="grid h-7 w-7 place-items-center rounded-brand bg-accent-soft font-display text-xs text-accent">
              {q.author.slice(0, 2).toUpperCase()}
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-fg">
              {q.author}
            </span>
            <span className="text-[11px] text-faint">{q.meta}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

export function QuoteMarquee({
  quotes,
  className,
}: {
  quotes: Quote[];
  className?: string;
}) {
  if (!quotes.length) return null;

  // Repeat until the strip is wide enough to read as a stream rather than a
  // couple of cards drifting through empty space.
  const strip = [...quotes];
  while (strip.length < 6) strip.push(...quotes);

  return (
    <div className={cn("mask-fade-r flex select-none overflow-hidden", className)}>
      <Strip quotes={strip} />
      <Strip quotes={strip} hidden />
    </div>
  );
}
