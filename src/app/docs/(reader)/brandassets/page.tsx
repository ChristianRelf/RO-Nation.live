import type { Metadata } from "next";
import { requireDocsReader } from "@/lib/docs-guard";
import { brandAssetsByCategory, brandAssetHref } from "@/lib/docs";
import { formatBytes } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Brand assets" };

export default async function DocsBrandAssetsPage() {
  await requireDocsReader();

  const groups = await brandAssetsByCategory();

  return (
    <div>
      <header className="max-w-2xl">
        <h1 className="display text-4xl sm:text-5xl">Brand assets</h1>
        <p className="mt-4 text-sm text-muted">
          Logos, artwork and the guidelines. Anything marked{" "}
          <span className="font-semibold text-fg">internal</span> is served only to
          somebody signed in here — its link will not work for anybody else, so
          send the file, not the URL.
        </p>
      </header>

      {groups.length ? (
        <div className="mt-10 space-y-10">
          {groups.map((g) => (
            <section key={g.category}>
              <h2 className="text-[11px] font-semibold uppercase tracking-kicker text-accent">
                {g.category}
              </h2>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {g.assets.map((a) => {
                  const href = brandAssetHref(a);
                  const isImage = a.mime.startsWith("image/");

                  return (
                    <a
                      key={a.id}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="card flex gap-4 p-4 transition-colors hover:border-accent"
                    >
                      {isImage ? (
                        // A plain <img>, not next/image: these are arbitrary
                        // uploads, and an internal one is behind /files/<id>,
                        // which the optimiser cannot fetch on the reader's behalf
                        // anyway — it has no session.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={href}
                          alt=""
                          className="h-16 w-16 shrink-0 rounded-lg border border-line bg-bg object-contain p-1"
                        />
                      ) : (
                        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-lg border border-line bg-bg text-[10px] font-bold uppercase tracking-wide text-faint">
                          {a.mime === "application/pdf" ? "PDF" : "File"}
                        </span>
                      )}

                      <div className="min-w-0">
                        <p className="font-medium">
                          {a.title}
                          {a.visibility === "INTERNAL" ? (
                            <span className="ml-2 inline-flex items-center rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                              Internal
                            </span>
                          ) : null}
                        </p>
                        {a.description ? (
                          <p className="mt-1 text-sm text-muted">
                            {a.description}
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs text-faint">
                          {formatBytes(a.size)}
                        </p>
                      </div>
                    </a>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="card mt-10 grid place-items-center px-6 py-20 text-center">
          <p className="font-display text-2xl">Nothing here yet</p>
          <p className="mt-2 text-sm text-muted">
            The logos and guidelines are on their way up.
          </p>
        </div>
      )}
    </div>
  );
}
