import Image from "next/image";
import type { Partner } from "@/lib/partners/registry";

/**
 * A partner's artwork behind the WHOLE site — every section, every page.
 *
 * Fixed, not scrolled: the content slides over a picture that stays put, so the
 * page reads as a lit room you are moving through rather than a poster you are
 * scrolling past. That is the entire effect, and it is one CSS property (`fixed`)
 * doing it.
 *
 * ---- The two things that make this work rather than ruin the site ----------
 *
 * IT SITS BEHIND EVERY SECTION, INCLUDING THE OPAQUE ONES. Sections with a
 * background of their own (the `bg-elev` bands, the paper About panel) will cover
 * it, and that is correct — the backdrop is glimpsed between them, not seen
 * through them. A backdrop visible at a constant strength down the entire page is
 * wallpaper; one that appears and disappears as you scroll is atmosphere.
 *
 * IT IS DARKER THAN LOOKS RIGHT IN ISOLATION. Every word on this site is set on
 * top of it. An image you can comfortably make out is an image that is competing
 * with the paragraph in front of it, and the person trying to read what time the
 * doors open does not care how good the artwork is. The scrim below is not
 * optional decoration — it is what keeps body copy legible, and it is why this can
 * be a photograph-dark image without the text turning to soup.
 *
 * Renders nothing at all when the partner has no backdrop, which is every partner
 * by default. Their site is unchanged.
 */
export function PartnerBackdrop({ partner }: { partner: Partner }) {
  const src = partner.backdropUrl;
  if (!src) return null;

  return (
    <div
      aria-hidden
      // -z-10 puts it under the page's content but still inside the body's own
      // background, so `bg-bg` remains the floor. `fixed` is what pins it while
      // the page moves; `pointer-events-none` keeps it from eating clicks.
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <Image
        src={src}
        alt=""
        fill
        priority
        sizes="100vw"
        // `cover`, and anchored to the BOTTOM. A backdrop crops, and what it crops
        // matters: this image has its subject standing on the ground at the foot of
        // the frame and its busiest foliage across the top, so centring it on a
        // tall viewport throws the subject away and keeps the noise. Bottom-anchored
        // keeps the ground line, and the clutter is the first thing off the top.
        //
        // `saturate` is the load-bearing filter. The photograph is magenta; the
        // brand is gold. At full chroma the two fight, and a paragraph set over a
        // pink bougainvillea is a paragraph nobody reads — so the colour is pulled
        // back to a dusk that the gold can sit on top of, without being drained to
        // grey, which would throw away the picture's whole character.
        className="object-cover object-bottom opacity-[0.75] saturate-[0.6] contrast-[0.95]"
      />

      {/* The scrim. Three layers, each doing a different job, and all three are
          load-bearing on a PHOTOGRAPH — line art needs far less:

            1. a flat wash of the page's own background, which pulls the image down
               into the palette rather than letting it sit on top of it;
            2. a vertical gradient, heavy at the top and bottom, so the header and
               the footer — where the smallest type lives — sit on near-solid black;
            3. a wash of the ACCENT, barely there, which tints the whole thing
               toward the brand's gold. It is what stops a magenta photograph and a
               gold palette reading as two unrelated things on one page. */}
      <div className="absolute inset-0 bg-bg/35" />
      <div className="absolute inset-0 bg-gradient-to-b from-bg via-bg/25 to-bg" />
      <div className="absolute inset-0 bg-accent/[0.05] mix-blend-overlay" />
    </div>
  );
}
