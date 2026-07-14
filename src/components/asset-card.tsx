import type { BrandAsset } from "@prisma/client";
import { brandAssetHref } from "@/lib/docs";
import { formatBytes } from "@/lib/format";

// One downloadable brand asset.
//
// Lifted out of docs/(reader)/brandassets so the public press kit and the staff library
// render the identical object. They are two audiences looking at the same file, and the
// second copy of this markup would have drifted within a month.
//
// The href ALWAYS comes from brandAssetHref() - never built by hand from a storagePath.
// Its own comment is the reason: "there is exactly one place in the codebase that can get
// the PUBLIC/INTERNAL split wrong, and it is three lines long." Keep it that way.

export function AssetCard({ asset }: { asset: BrandAsset }) {
  const href = brandAssetHref(asset);
  const isImage = asset.mime.startsWith("image/");

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="card flex gap-4 p-4 transition-colors hover:border-accent"
    >
      {isImage ? (
        // A plain <img>, not next/image: these are arbitrary uploads, and an INTERNAL one
        // sits behind /files/<id>, which the image optimiser could not fetch on the
        // reader's behalf anyway - it has no session.
        //
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={href}
          alt=""
          loading="lazy"
          className="h-16 w-16 shrink-0 rounded-lg border border-line bg-bg object-contain p-1"
        />
      ) : (
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-lg border border-line bg-bg text-[10px] font-bold uppercase tracking-wide text-faint">
          {asset.mime === "application/pdf" ? "PDF" : "File"}
        </span>
      )}

      <div className="min-w-0">
        <p className="font-medium">
          {asset.title}
          {/* Only ever rendered on the staff library - the press kit is filtered to PUBLIC
              before it gets here, so this badge cannot appear there. It stays in the
              shared component because the alternative is a prop that has exactly one
              caller and one truthful value. */}
          {asset.visibility === "INTERNAL" ? (
            <span className="ml-2 inline-flex items-center rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
              Internal
            </span>
          ) : null}
        </p>
        {asset.description ? (
          <p className="mt-1 text-sm text-muted">{asset.description}</p>
        ) : null}
        <p className="mt-1 text-xs text-faint">{formatBytes(asset.size)}</p>
      </div>
    </a>
  );
}
