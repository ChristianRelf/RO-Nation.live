import Image from "next/image";
import type { Partner } from "@/lib/partners/registry";
import { cn } from "@/lib/utils";

// A partner's artwork: the mark, the crest, and the disclaimer that has to sit
// near both of them.
//
// All three are here together on purpose. A partner whose site carries a real
// act's marks is a partner whose disclaimer is doing real work, and keeping the
// two in one file means nobody can add the artwork to a new partner without
// walking straight past the thing that has to go with it.

/**
 * The partner's logo mark — the small one, for a header or a byline.
 *
 * Falls back to nothing (not to a broken image, and not to a placeholder box):
 * a partner with no mark has a wordmark instead, and the header renders that. See
 * PartnerHeader.
 */
export function PartnerMark({
  partner,
  className,
  size = 32,
}: {
  partner: Partner;
  className?: string;
  size?: number;
}) {
  if (!partner.logoUrl) return null;

  return (
    <Image
      src={partner.logoUrl}
      alt=""
      width={size}
      height={size}
      // Decorative. The partner's NAME is always rendered in text beside it, so
      // announcing the logo as well would just make a screen reader say it twice.
      aria-hidden
      className={cn("h-auto w-auto object-contain", className)}
      priority
    />
  );
}

/**
 * The crest, behind the hero: enormous, dim, bled off the bottom of the section.
 *
 * It is a BACKDROP, and the type sits on top of it, so it is deliberately drawn
 * far darker than looks right in isolation. A crest you can comfortably read every
 * line of is a crest that is competing with the headline in front of it — this is
 * meant to be *glimpsed*, the way a thing is glimpsed in a dark room.
 *
 * `src` is passed in rather than read from the partner, because the partner's
 * editable heroImageUrl overrides the registry's crest — see the hero.
 */
export function HeroCrest({ src }: { src: string }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* A pool of gold light behind the crest, so it reads as lit rather than as
          a sticker laid on the black. Drawn in CSS off --accent, so it follows the
          brand rather than hard-coding this one. */}
      <div
        className="absolute left-1/2 top-1/2 h-[75vh] w-[75vh] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.06] blur-3xl"
        style={{ background: "radial-gradient(circle, var(--accent), transparent 65%)" }}
      />

      <div className="absolute left-1/2 top-1/2 h-[132%] w-auto -translate-x-1/2 -translate-y-1/2">
        <Image
          src={src}
          alt=""
          width={1280}
          height={1900}
          priority
          className="h-full w-auto object-contain opacity-[0.22]"
          // Fade the crest out into the black at the bottom, so it does not stop
          // at a hard horizontal edge halfway down the page. The mask is the whole
          // reason this reads as depth rather than as a pasted PNG.
          style={{
            maskImage:
              "linear-gradient(to bottom, transparent 0%, black 18%, black 62%, transparent 92%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent 0%, black 18%, black 62%, transparent 92%)",
          }}
        />
      </div>
    </div>
  );
}

/**
 * The disclaimer. Not decoration, and not fine print.
 *
 * A partner whose name references a real-world act carries one, and on a site that
 * now carries that act's actual marks it is the ONLY thing telling a visitor whose
 * site they are on. So it is rendered at readable size, in readable colour, in the
 * flow of the page — never a tooltip, never 10px grey-on-grey, never behind a
 * "legal" link somebody has to go looking for.
 *
 * If a future redesign finds it inconvenient, that is the disclaimer working.
 */
export function PartnerDisclaimer({
  partner,
  className,
}: {
  partner: Partner;
  className?: string;
}) {
  if (!partner.disclaimer) return null;

  return (
    <p
      className={cn(
        "max-w-3xl text-sm leading-relaxed text-muted",
        className,
      )}
    >
      {partner.disclaimer}
    </p>
  );
}
