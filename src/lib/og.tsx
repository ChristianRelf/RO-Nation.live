import { ImageResponse } from "next/og";
import { site } from "@/lib/site";
import { ANTON_400, ARCHIVO_500, ARCHIVO_700 } from "@/lib/og-fonts.data";

// The RNL palette, written out as literal hex on purpose. next/og renders through
// Satori, which paints these into a PNG on a server with no stylesheet and no CSS
// custom properties - so `var(--accent)` would resolve to nothing. These are the same
// values globals.css computes (--bg, --fg, --accent, --accent-ink); if the brand
// shifts, they move here too.
const BG = "#0a0a0a";
const FG = "#ece9e1";
const ACCENT = "#2b6bff";
const MUTED = "#8a8880";
const LINE = "rgba(236, 233, 225, 0.14)";

/** 1200×630 is the size every major platform crops its large card to. */
export const ogSize = { width: 1200, height: 630 };
export const ogContentType = "image/png";
export const ogAlt = `${site.name} - ${site.tagline}`;

// ---- Fonts -----------------------------------------------------------------
//
// Satori has NO system fonts: every glyph it draws must come from a buffer we hand it.
// The old card passed none and fell back to a generic sans - which is exactly why the
// wordmark looked like a slide template rather than the site. So we feed it the two brand
// faces (Anton for display, Archivo for text - the same ones lib/partners/fonts.ts loads
// for the site).
//
// The fonts are SUBSET and base64-inlined (lib/og-fonts.data.ts). This route runs on the
// edge runtime, where fetching a bundled font asset by file:// URL is not reliable across
// dev, a self-hosted build and build-time prerender - a decoded string always is. Subsetting
// keeps all three faces under ~50KB, so inlining costs almost nothing. Decoded once and
// memoised, so it is paid at most once per cold start rather than per image.
type OgFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 500 | 700;
  style: "normal";
};

/** base64 → ArrayBuffer, using atob (present on the edge runtime). */
function decode(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

let cachedFonts: OgFont[] | null = null;

function ogFonts(): OgFont[] {
  if (!cachedFonts) {
    cachedFonts = [
      { name: "Anton", data: decode(ANTON_400), weight: 400, style: "normal" },
      { name: "Archivo", data: decode(ARCHIVO_500), weight: 500, style: "normal" },
      { name: "Archivo", data: decode(ARCHIVO_700), weight: 700, style: "normal" },
    ];
  }
  return cachedFonts;
}

/**
 * The default branded card, shared by the opengraph-image and twitter-image file
 * conventions. It carries no event poster - it is the fallback a page gets when it has
 * no image of its own, so it says who RNL is and nothing it would have to keep true.
 * Detail pages (events, blog) override this with a real poster when they have one.
 */
export function renderOgCard() {
  const fonts = ogFonts();

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: BG,
          color: FG,
          fontFamily: "Archivo",
          // The accent wash, bleeding in from the top-right corner - the same atmosphere as
          // .accent-glow on the site. A LINEAR gradient on purpose: Satori's radial-gradient
          // parser rejects the `<size> at <position>` form, and this reads the same.
          backgroundImage: `linear-gradient(210deg, rgba(43,107,255,0.32) 0%, rgba(43,107,255,0.05) 34%, rgba(10,10,10,0) 56%)`,
        }}
      >
        {/* Inset hairline frame, like the site's bordered cards. */}
        <div
          style={{
            position: "absolute",
            top: 40,
            left: 40,
            right: 40,
            bottom: 40,
            border: `1px solid ${LINE}`,
            display: "flex",
          }}
        />

        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            padding: 72,
          }}
        >
          {/* Eyebrow */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 13, height: 13, backgroundColor: ACCENT }} />
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: 5,
                textTransform: "uppercase",
                color: MUTED,
              }}
            >
              Roblox Event Management
            </div>
          </div>

          {/* Wordmark - the brand, big, in Anton, with LIVE carrying the accent. */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                fontFamily: "Anton",
                fontSize: 134,
                lineHeight: 0.87,
                letterSpacing: -1,
                textTransform: "uppercase",
              }}
            >
              <div style={{ display: "flex" }}>RO. Nation</div>
              <div style={{ display: "flex", color: ACCENT }}>Live</div>
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 26,
                fontSize: 28,
                fontWeight: 500,
                lineHeight: 1.35,
                color: MUTED,
                maxWidth: 820,
              }}
            >
              Live shows, showcases and tournaments - built and run inside
              Roblox. Tickets are free and tied to your account.
            </div>
          </div>

          {/* Footer bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: `1px solid ${LINE}`,
              paddingTop: 26,
              fontSize: 26,
            }}
          >
            <div style={{ display: "flex", fontWeight: 700 }}>ronation.live</div>
            <div style={{ display: "flex", color: MUTED }}>
              Reserve tickets · Join the crew
            </div>
          </div>
        </div>
      </div>
    ),
    { ...ogSize, fonts },
  );
}
