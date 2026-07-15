import { renderOgCard, ogSize, ogContentType, ogAlt } from "@/lib/og";

// next/og (@vercel/og) is built to run on the edge runtime - that is where it can
// locate its bundled font/wasm assets. Under the Node runtime it throws "Invalid
// URL" from fileURLToPath while prerendering at build time. Edge is the supported
// home for OG image generation and keeps this route a cached static asset.
export const runtime = "edge";

// The site-wide default OpenGraph card. Next merges file-based images down the
// segment tree, so every route that does not set its own openGraph.images gets
// this one; events/[slug] and blog/[slug] set a real poster and win, being deeper.
export const alt = ogAlt;
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOgCard();
}
