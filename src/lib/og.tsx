import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

// The RNL palette, written out as literal hex on purpose. next/og renders through
// Satori, which paints these into a PNG on a server with no stylesheet and no CSS
// custom properties - so `var(--accent)` would resolve to nothing. These four are
// the same values globals.css computes (--bg 10 10 10, --fg 236 233 225,
// --accent 43 107 255, --accent-ink white); if the brand shifts, they move here too.
const BG = "#0a0a0a";
const FG = "#ece9e1";
const ACCENT = "#2b6bff";
const ACCENT_INK = "#ffffff";
const MUTED = "#8a8880";

/** 1200×630 is the size every major platform crops its large card to. */
export const ogSize = { width: 1200, height: 630 };
export const ogContentType = "image/png";
export const ogAlt = `${site.name} - ${site.tagline}`;

/**
 * The default branded card, shared by the opengraph-image and twitter-image file
 * conventions. It carries no event poster or photo - it is the fallback a page
 * gets when it has no image of its own, so it says who RNL is and nothing it would
 * have to keep true. Detail pages (events, blog) override this with a real poster.
 */
export function renderOgCard() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: BG,
          color: FG,
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "18px",
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: MUTED,
          }}
        >
          <div style={{ width: 16, height: 16, backgroundColor: ACCENT }} />
          <div>Roblox Event Management</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 120,
              fontWeight: 800,
              lineHeight: 0.95,
              letterSpacing: -3,
            }}
          >
            {site.name}
          </div>
          <div style={{ display: "flex", marginTop: 28 }}>
            <div
              style={{
                backgroundColor: ACCENT,
                color: ACCENT_INK,
                fontSize: 36,
                fontWeight: 700,
                padding: "10px 22px",
              }}
            >
              {site.tagline}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 30,
          }}
        >
          <div style={{ color: MUTED }}>Reserve tickets · Join the crew</div>
          <div style={{ fontWeight: 700 }}>ronation.live</div>
        </div>
      </div>
    ),
    { ...ogSize },
  );
}
