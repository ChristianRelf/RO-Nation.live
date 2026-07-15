import type { BrandAsset } from "@prisma/client";
import { brandAssetHref } from "@/lib/docs";
import { formatBytes } from "@/lib/format";

// One asset, shown in place rather than hidden behind a link.
//
// The old AssetCard was a link with a 64px thumbnail - fine for a logo, useless
// for a 24-page brand guideline nobody opens because opening it is a whole extra
// tab. This renders the file itself: a PDF in the browser's own viewer, an image
// at a size you can actually read, and anything else as a clear download.
//
// ---- Why the embed can be trusted, and why it still has a fallback ----------
//
// A PDF/image response is served with `frame-ancestors 'self'` (app/files/[id]
// for INTERNAL, the Caddy /uploads block for PUBLIC), so it may be framed by our
// own pages and nobody else's - the app's real pages keep `frame-ancestors
// 'none'`. If that carve-out is ever wrong in an environment, the browser simply
// shows a blank frame - so the Open / Download actions in the header are the
// load-bearing part, always present, and the frame is the enhancement. A viewer
// that assumed the frame worked would be a viewer that hid the file when it did
// not.
//
// Shared component, so the brand library and the templates area cannot drift into
// two ways of drawing the same file. The `href` ALWAYS comes from
// brandAssetHref() - the one place that gets the PUBLIC/INTERNAL split right.

export function AssetViewer({ asset }: { asset: BrandAsset }) {
  const href = brandAssetHref(asset);
  const isImage = asset.mime.startsWith("image/");
  const isPdf = asset.mime === "application/pdf";

  return (
    <figure className="card overflow-hidden">
      <figcaption className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium">
            <span className="truncate">{asset.title}</span>
            {asset.visibility === "INTERNAL" ? (
              <span className="inline-flex shrink-0 items-center rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                Internal
              </span>
            ) : null}
          </p>
          {asset.description ? (
            <p className="mt-1 text-sm text-muted">{asset.description}</p>
          ) : null}
          <p className="mt-1 text-xs text-faint">
            {label(asset.mime)} · {formatBytes(asset.size)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost gap-1.5 px-3 py-1.5 text-xs"
          >
            <OpenIcon />
            Open
          </a>
          {/* `download` hints the browser to save rather than render. Same-origin
              (both /files and /uploads), so the attribute is honoured and the real
              filename is restored. */}
          <a
            href={href}
            download={asset.filename}
            className="btn btn-ghost gap-1.5 px-3 py-1.5 text-xs"
          >
            <DownloadIcon />
            Download
          </a>
        </div>
      </figcaption>

      {isPdf ? (
        <iframe
          src={`${href}#view=FitH`}
          title={asset.title}
          loading="lazy"
          // Tall enough to read a page without scrolling the whole document into a
          // porthole; the browser's viewer supplies its own scroll, zoom and print.
          className="h-[75vh] max-h-[900px] min-h-[420px] w-full border-0 bg-white"
        />
      ) : isImage ? (
        // A neutral, faintly chequered stage so a transparent-background logo is
        // actually visible rather than invisible-on-invisible. Plain <img>, not
        // next/image: an INTERNAL asset sits behind /files/<id>, which the image
        // optimiser has no session to fetch on the reader's behalf.
        <div
          className="grid place-items-center bg-bg p-6"
          // A faint chequerboard so a transparent-background logo reads instead of
          // vanishing. Semi-transparent grey, so it works in light and dark alike.
          style={{
            backgroundImage:
              "repeating-conic-gradient(rgba(128,128,128,0.10) 0% 25%, transparent 0% 50%)",
            backgroundSize: "22px 22px",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={href}
            alt={asset.title}
            loading="lazy"
            className="max-h-[70vh] w-auto max-w-full object-contain"
          />
        </div>
      ) : (
        <div className="grid place-items-center gap-3 px-6 py-14 text-center">
          <FileIcon />
          <p className="text-sm text-muted">
            This file type can&rsquo;t be previewed here.
          </p>
          <a
            href={href}
            download={asset.filename}
            className="btn btn-accent gap-1.5 text-sm"
          >
            <DownloadIcon />
            Download {label(asset.mime)}
          </a>
        </div>
      )}
    </figure>
  );
}

/** A short, human label for a mime - "PDF", "PNG", "SVG", else the subtype. */
function label(mime: string): string {
  if (mime === "application/pdf") return "PDF";
  const sub = mime.split("/")[1] ?? mime;
  return sub.replace(/^svg\+xml$/, "svg").toUpperCase();
}

function OpenIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M21 14v7H3V3h7" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-10 w-10 text-faint"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}
