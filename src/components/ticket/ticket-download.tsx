"use client";

import { useState } from "react";
import { barcodeBars } from "@/lib/tickets/barcode";
import { formatInstant } from "@/lib/format";
import { qrMatrix } from "@/lib/qr";

// "Download ticket" - draws the ticket to a canvas and hands back a PNG.
//
// It is drawn, not screenshotted. The tempting approach is to serialise the DOM
// into an SVG <foreignObject> and rasterise that, and it half-works until it
// doesn't: web fonts don't load inside the sandboxed image, CSS custom properties
// resolve to nothing, and you ship a ticket with the wrong typeface and no colour.
//
// Drawing it explicitly costs this file, and buys a PNG that is identical for
// everybody and can be made any size we like (it renders at 2×, so it survives
// being opened on a phone and pinched).
//
// The two marks come from the SAME encoders the on-screen ticket uses -
// lib/tickets/barcode.ts and lib/qr.ts - so the downloaded ticket physically
// cannot encode a different code from the one on the page. A second, "just for
// the PNG" barcode implementation is how you end up with a printout that scans to
// somebody else's ticket.

const W = 1000;
const H = 380;
const RAIL = 108; // barcode rail
const STUB = 240; // QR stub
const SCALE = 2;

/** Resolve a CSS custom property to a real colour, on the client, at draw time. */
function cssColor(name: string, fallback: string) {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  if (!raw) return fallback;
  // The palette is stored as bare channels ("235 230 214") so Tailwind can add an
  // alpha. Canvas wants a colour, so put it back together.
  return /^[\d\s./]+$/.test(raw) ? `rgb(${raw})` : raw;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export type DownloadTicket = {
  code: string;
  eventTitle: string;
  /**
   * The show's start as an ISO instant - NOT pre-formatted. It is rendered into the
   * PNG in the DOWNLOADER's own timezone at draw time (see draw()), so the ticket a
   * holder saves reads in their clock, with the zone named. The download runs on the
   * client, which is the one place the viewer's zone is known.
   */
  startsAtIso: string;
  venue: string | null;
  tierName: string;
  holder: string;
  paid: string;
  brandName: string;
  brandMark: string;
  /** The issuer's wordmark. NULL draws the lettered badge instead. */
  brandLogo: string | null;
  /** The ticket's opaque reference. */
  reference: string;
  /** The security seal - see lib/tickets/seal.ts. */
  seal: string;
  ticketUrl: string;
};

/**
 * Load an image for the canvas, or give up.
 *
 * It resolves to null on failure rather than rejecting, and the caller falls back
 * to the lettered badge. A logo that 404s must cost you the logo, not the whole
 * download - the point of the button is to hand somebody their ticket.
 *
 * crossOrigin is set because an uploaded logo could be served from another origin
 * one day, and a canvas that has drawn a cross-origin image without CORS is
 * TAINTED: toDataURL() then throws, and the download dies at the last step for a
 * reason nothing on screen would explain.
 */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export function TicketDownload({ ticket }: { ticket: DownloadTicket }) {
  const [busy, setBusy] = useState(false);

  async function draw() {
    setBusy(true);
    try {
      // The display face is loaded by next/font. Without waiting, the first click
      // can rasterise the fallback - the ticket renders in Arial and looks like a
      // different product.
      if ("fonts" in document) await document.fonts.ready;

      // Loaded BEFORE anything is drawn. Canvas drawing is synchronous, so an
      // image awaited halfway through would land on top of text that had already
      // been painted over it.
      const logo = ticket.brandLogo ? await loadImage(ticket.brandLogo) : null;

      const canvas = document.createElement("canvas");
      canvas.width = W * SCALE;
      canvas.height = H * SCALE;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(SCALE, SCALE);

      const paper = cssColor("--paper-rgb", "rgb(235 230 214)");
      const ink = cssColor("--paper-ink-rgb", "rgb(15 15 15)");
      const accent = cssColor("--accent-rgb", "rgb(60 110 255)");
      const accentInk = cssColor("--accent-ink-rgb", "rgb(255 255 255)");

      const display = getComputedStyle(document.documentElement)
        .getPropertyValue("--font-display")
        .trim();
      const face = display ? `${display}, Impact, sans-serif` : "Impact, sans-serif";
      const sans = "system-ui, -apple-system, Segoe UI, sans-serif";
      const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

      // The card.
      ctx.fillStyle = paper;
      roundRect(ctx, 0, 0, W, H, 10);
      ctx.fill();

      // ---- Barcode rail -------------------------------------------------
      const { bars, modules } = barcodeBars(ticket.code);
      const railH = 210;
      const railY = (H - railH) / 2;
      const unit = railH / modules;

      ctx.fillStyle = ink;
      for (const bar of bars) {
        ctx.fillRect(RAIL / 2 - 22, railY + bar.x * unit, 44, bar.width * unit);
      }

      // The code, and the brand, running up the rail.
      ctx.save();
      ctx.translate(RAIL / 2, railY + railH + 44);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = ink;
      ctx.globalAlpha = 0.6;
      ctx.font = `bold 11px ${mono}`;
      ctx.textAlign = "left";
      ctx.fillText(ticket.code, 0, 4);
      ctx.restore();

      ctx.save();
      ctx.translate(RAIL / 2, railY - 16);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = ink;
      ctx.globalAlpha = 0.4;
      ctx.font = `bold 9px ${sans}`;
      ctx.textAlign = "right";
      ctx.fillText(ticket.brandName.toUpperCase(), 0, 4);
      ctx.restore();
      ctx.globalAlpha = 1;

      // Perforation between rail and body.
      ctx.strokeStyle = ink;
      ctx.globalAlpha = 0.25;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(RAIL, 0);
      ctx.lineTo(RAIL, H);
      ctx.stroke();

      // ...and between body and stub.
      ctx.beginPath();
      ctx.moveTo(W - STUB, 0);
      ctx.lineTo(W - STUB, H);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // ---- Issuer bar ---------------------------------------------------
      const barH = 46;
      ctx.fillStyle = ink;
      ctx.fillRect(RAIL, 0, W - RAIL - STUB, barH);

      if (logo) {
        // Fixed height, width from the logo's own aspect ratio - so a wide
        // wordmark and a square one both sit on the bar without being squashed.
        const logoH = 22;
        const logoW = (logo.width / logo.height) * logoH;
        ctx.drawImage(logo, RAIL + 24, barH / 2 - logoH / 2, logoW, logoH);
      } else {
        ctx.fillStyle = accent;
        roundRect(ctx, RAIL + 24, barH / 2 - 12, 24, 24, 4);
        ctx.fill();
        ctx.fillStyle = accentInk;
        ctx.font = `800 11px ${sans}`;
        ctx.textAlign = "center";
        ctx.fillText(ticket.brandMark, RAIL + 36, barH / 2 + 4);

        ctx.fillStyle = paper;
        ctx.font = `bold 12px ${sans}`;
        ctx.textAlign = "left";
        ctx.fillText(ticket.brandName.toUpperCase(), RAIL + 58, barH / 2 + 4);
      }

      ctx.fillStyle = paper;
      ctx.globalAlpha = 0.6;
      ctx.textAlign = "right";
      ctx.font = `bold 10px ${sans}`;
      ctx.fillText("ADMIT ONE", W - STUB - 24, barH / 2 + 4);
      ctx.globalAlpha = 1;

      // ---- Body ---------------------------------------------------------
      const bx = RAIL + 24;
      ctx.textAlign = "left";

      ctx.fillStyle = ink;
      ctx.font = `400 44px ${face}`;
      ctx.fillText(fit(ctx, ticket.eventTitle.toUpperCase(), W - RAIL - STUB - 48), bx, 118);

      ctx.globalAlpha = 0.15;
      ctx.fillRect(bx, 140, W - RAIL - STUB - 48, 1);
      ctx.globalAlpha = 1;

      ctx.font = `600 15px ${sans}`;
      ctx.globalAlpha = 0.8;
      const whenText = formatInstant(ticket.startsAtIso, "datetime", undefined, true);
      ctx.fillText(
        fit(ctx, [whenText, ticket.venue].filter(Boolean).join("  ·  "), W - RAIL - STUB - 48),
        bx,
        170,
      );
      ctx.globalAlpha = 1;

      const cols = [
        ["ADMISSION", ticket.tierName],
        ["HOLDER", ticket.holder],
        ["PAID", ticket.paid],
      ] as const;
      cols.forEach(([label, value], i) => {
        const x = bx + i * ((W - RAIL - STUB - 48) / 3);
        ctx.globalAlpha = 0.45;
        ctx.font = `bold 9px ${sans}`;
        ctx.fillText(label, x, 226);
        ctx.globalAlpha = 1;
        ctx.font = `600 15px ${sans}`;
        ctx.fillText(fit(ctx, value, (W - RAIL - STUB - 60) / 3), x, 248);
      });

      // The reference and the seal, printed together and low - the same pair the
      // on-screen ticket carries, in the same place.
      ctx.globalAlpha = 0.15;
      ctx.fillRect(bx, 282, W - RAIL - STUB - 48, 1);
      ctx.globalAlpha = 0.55;
      ctx.font = `bold 10px ${mono}`;
      ctx.fillText(`REF ${ticket.reference}`, bx, 304);
      ctx.fillText(`SEC ${ticket.seal}`, bx + 300, 304);
      ctx.globalAlpha = 1;

      // The microtext band across the foot. Security print, not decoration: too
      // fine to redraw by hand, and it turns to mush the moment somebody rescales
      // a screenshot of it into a forgery. It carries the brand, the reference and
      // the seal, so all three have to be faked together and consistently.
      const bandY = H - 22;
      ctx.globalAlpha = 0.04;
      ctx.fillRect(RAIL, bandY, W - RAIL - STUB, 22);
      ctx.globalAlpha = 0.35;
      ctx.font = `bold 7px ${mono}`;
      ctx.fillText(
        fit(
          ctx,
          `${ticket.brandName} · ${ticket.reference} · ${ticket.seal} · `.repeat(8),
          W - RAIL - STUB - 32,
        ),
        bx,
        bandY + 14,
      );
      ctx.globalAlpha = 1;

      // ---- Stub: the QR --------------------------------------------------
      const m = qrMatrix(ticket.ticketUrl);
      const n = m.length;
      const qrSize = 150;
      const cell = qrSize / n;
      const qx = W - STUB + (STUB - qrSize) / 2;
      const qy = 58;

      // The quiet zone is part of the mark, and it is FOUR MODULES - not "a bit of
      // padding that looks right". A QR butted up against other ink does not decode,
      // and the card is cream anyway, so this rect only matters at the edges.
      const quiet = cell * 4;
      ctx.fillStyle = paper;
      ctx.fillRect(qx - quiet, qy - quiet, qrSize + quiet * 2, qrSize + quiet * 2);
      ctx.fillStyle = ink;
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          if (m[y][x]) ctx.fillRect(qx + x * cell, qy + y * cell, cell, cell);
        }
      }

      ctx.textAlign = "center";
      ctx.fillStyle = ink;
      ctx.font = `bold 15px ${mono}`;
      ctx.fillText(ticket.code, W - STUB / 2, qy + qrSize + 36);

      ctx.globalAlpha = 0.6;
      ctx.font = `bold 11px ${mono}`;
      ctx.fillText(`SEC ${ticket.seal}`, W - STUB / 2, qy + qrSize + 54);

      ctx.globalAlpha = 0.5;
      ctx.font = `bold 9px ${sans}`;
      ctx.fillText(ticket.brandName.toUpperCase(), W - STUB / 2, qy + qrSize + 72);
      ctx.globalAlpha = 0.4;
      ctx.fillText("NON-TRANSFERABLE", W - STUB / 2, qy + qrSize + 87);
      ctx.globalAlpha = 1;

      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `${ticket.code}.png`;
      a.click();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button onClick={draw} disabled={busy} className="btn btn-ghost">
      {busy ? "Preparing…" : "Download ticket (PNG)"}
    </button>
  );
}

/** Truncate to fit a width, so a long venue name can't run off the card. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > max) s = s.slice(0, -1);
  return `${s}…`;
}
