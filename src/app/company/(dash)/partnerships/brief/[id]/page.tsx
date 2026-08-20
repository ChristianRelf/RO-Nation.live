import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PartnerSiteBriefStatus } from "@prisma/client";
import { requireCompanyUser } from "@/lib/company";
import { prisma } from "@/lib/db";
import {
  assetSlotLabel,
  briefGaps,
  fontDirectionLabel,
} from "@/lib/partner-brief";
import { PARTNER_FEATURE_CHOICES, slugVerdict } from "@/lib/partners/registry";
import { partnerUrls } from "@/lib/partner-urls";
import { deleteSiteBrief } from "@/app/actions/partnerships";
import { CopyField } from "@/components/copy-field";
import { formatDate } from "@/lib/format";
import { Kicker } from "@/components/ui";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Site brief" };

// One site brief, as staff read it - and the button that turns it into a .zip.
//
// ---- This page shows, the zip delivers -------------------------------------
//
// Everything here is readable on screen EXCEPT the files, which are on the private volume
// and are not served at any URL. That is deliberate (see the schema note on
// PartnerSiteBriefAsset), and it means the download is not a convenience: it is the only
// way to get a partner's artwork out of the system, and it goes through a route that
// checks company rank on every request.
//
// ---- The slug is re-checked HERE, not trusted from the row -----------------
//
// A brief's subdomain was free when the partner typed it. It may not be now - another
// partner may have taken it, or a deploy may have reserved it. So the verdict is computed
// at read time and shown next to the value, because the moment somebody is about to build
// the site is exactly the moment that matters.

export default async function BriefPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  await requireCompanyUser();

  const brief = await prisma.partnerSiteBrief.findUnique({
    where: { id: params.id },
    include: {
      assets: { orderBy: { createdAt: "asc" } },
      partnerAccount: { select: { id: true, name: true } },
    },
  });
  if (!brief) notFound();

  const gaps = briefGaps(brief, brief.assets.length);
  const submitted = brief.status === PartnerSiteBriefStatus.SUBMITTED;
  const slugCheck = brief.slug ? slugVerdict(brief.slug) : null;

  return (
    <div className="max-w-3xl">
      <Link
        href="/company/partnerships"
        className="text-[10px] font-bold uppercase tracking-kicker text-faint transition-colors hover:text-accent"
      >
        ← Partnerships
      </Link>

      <Kicker className="mt-6">Site brief</Kicker>
      <h1 className="display mt-4 text-4xl leading-none sm:text-5xl">
        {brief.siteName || brief.label}
      </h1>
      <p className="mt-3 text-sm text-muted">
        Raised by {brief.issuedByName} on {formatDate(brief.createdAt)}
        {brief.partnerAccount ? ` · ${brief.partnerAccount.name}` : " · no account linked"}
        {submitted && brief.submittedAt
          ? ` · handed in ${formatDate(brief.submittedAt)}`
          : " · still a draft"}
      </p>

      {searchParams.error === "confirm" ? (
        <p
          role="alert"
          className="mt-6 rounded-brand border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          Type <span className="font-mono">delete</span> in the box to confirm.
        </p>
      ) : null}

      {/* ---- The download -------------------------------------------- */}
      <div className="card mt-8 border-accent/30 p-5">
        <h2 className="font-display text-xl">Everything, in one archive</h2>
        <p className="mt-2 text-sm text-muted">
          The brief as markdown, the same thing as JSON, a draft registry entry to edit, and
          every file they attached. It is the only way to get the artwork out - nothing here
          is served on the web.
        </p>
        {/* A plain <a>, not a Link. It is a file download, and a client-side navigation to
            one is a router that fetches an RSC payload and finds a zip. */}
        <a
          href={`/company/partnerships/brief/${brief.id}/zip`}
          className="btn btn-accent mt-4"
        >
          Download the .zip
        </a>
        {gaps.length ? (
          <p className="mt-3 text-xs text-faint">
            Missing: {gaps.join(", ")}. The archive is still worth having - it just has
            gaps in it.
          </p>
        ) : null}
      </div>

      {/* ---- The brief ------------------------------------------------ */}
      <Section title="The site">
        <Row label="Name" value={brief.siteName} />
        <Row label="Short name" value={brief.shortName} />
        <Row
          label="Subdomain"
          value={brief.slug ? `${brief.slug}.${site.domain}` : null}
          note={
            slugCheck && slugCheck !== "ok"
              ? `Not available any more (${slugCheck})`
              : slugCheck === "ok"
                ? "Free, as of right now"
                : undefined
          }
          warn={Boolean(slugCheck && slugCheck !== "ok")}
        />
        <Row label="Tagline" value={brief.tagline} />
        <Row label="Ticket prefix" value={brief.ticketPrefix} />
        <Row label="Roblox group" value={brief.robloxGroupUrl} />
        <Row
          label="Features"
          value={
            brief.features
              .map(
                (f) => PARTNER_FEATURE_CHOICES.find((c) => c.id === f)?.label ?? f,
              )
              .join(", ") || null
          }
        />
      </Section>

      <Prose title="Description" body={brief.description} />
      {brief.disclaimer ? (
        <Prose
          title="Disclaimer"
          body={brief.disclaimer}
          note="Their words. Check it before it ships - an ambiguous one on an RNL subdomain is our problem too."
        />
      ) : null}

      <Section title="Look">
        <Row label="Accent" value={brief.accentColour} swatch={brief.accentColour} />
        <Row
          label="Type on accent"
          value={brief.accentInkColour}
          swatch={brief.accentInkColour}
        />
        <Row label="Type direction" value={fontDirectionLabel(brief.fontChoice)} />
      </Section>

      <Prose title="Notes on the look" body={brief.moodNotes} />

      {brief.referenceUrls.length ? (
        <section className="mt-10">
          <h2 className="text-[11px] font-bold uppercase tracking-kicker text-faint">
            References
          </h2>
          <ul className="mt-3 space-y-1">
            {brief.referenceUrls.map((url) => (
              <li key={url}>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="link-underline break-all font-mono text-xs text-muted transition-colors hover:text-accent"
                >
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Section title="Who to ask">
        <Row label="Name" value={brief.contactName} />
        <Row label="Email" value={brief.contactEmail} />
        <Row label="Discord" value={brief.contactDiscord} />
      </Section>

      {/* ---- Files ---------------------------------------------------- */}
      <section className="mt-10">
        <h2 className="text-[11px] font-bold uppercase tracking-kicker text-faint">
          Files ({brief.assets.length})
        </h2>
        {brief.assets.length ? (
          <ul className="mt-3 divide-y divide-line/60 border-y border-line">
            {brief.assets.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm">{a.filename}</span>
                  <span className="block font-mono text-[11px] text-faint">
                    {assetSlotLabel(a.slot)} · {a.mime} · {Math.round(a.size / 1024)} KB ·
                    from {a.uploadedBy}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 border-y border-line py-5 text-sm text-faint">
            Nothing attached yet.
          </p>
        )}
        <p className="mt-3 text-xs text-faint">
          These are on the private volume and are not served at any URL. Download the
          archive above to see them.
        </p>
      </section>

      {/* ---- The link ------------------------------------------------- */}
      <section className="mt-12 border-t border-line pt-10">
        <h2 className="display text-2xl leading-none">Their link</h2>
        <p className="mt-2 text-sm text-muted">
          Anybody holding this can read and change the brief. That is the point of it -
          it goes to whoever knows the brand - but send it accordingly.
        </p>
        <div className="mt-4">
          <CopyField value={partnerUrls.brief(brief.token)} label="Brief link" />
        </div>
      </section>

      {/* ---- Delete --------------------------------------------------- */}
      <section className="mt-12 border-t border-line pt-10">
        <h2 className="display text-2xl leading-none">Delete it</h2>
        <p className="mt-2 max-w-xl text-sm text-muted">
          The brief and every file on it, gone from the database and off the disk. Download
          the archive first if there is anything in it you want - there is no undo and no
          backup of the artwork anywhere else.
        </p>
        <form action={deleteSiteBrief} className="mt-4 flex flex-wrap items-center gap-3">
          <input type="hidden" name="id" value={brief.id} />
          <input
            name="confirm"
            required
            placeholder="Type: delete"
            className="w-40 rounded-xl border border-line bg-bg px-4 py-2.5 font-mono text-sm outline-none transition-colors focus:border-red-500"
          />
          <button className="btn btn-ghost border-red-500/30 text-red-400">
            Delete this brief
          </button>
        </form>
      </section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-[11px] font-bold uppercase tracking-kicker text-faint">
        {title}
      </h2>
      <dl className="mt-3 divide-y divide-line/60 border-y border-line">{children}</dl>
    </section>
  );
}

function Row({
  label,
  value,
  note,
  warn,
  swatch,
}: {
  label: string;
  value: string | null;
  note?: string;
  warn?: boolean;
  swatch?: string | null;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3">
      <dt className="shrink-0 text-sm text-faint">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2 text-right">
        {swatch ? (
          <span
            aria-hidden
            className="h-4 w-4 shrink-0 rounded border border-line"
            style={{ backgroundColor: swatch }}
          />
        ) : null}
        <span className={`break-words text-sm ${value ? "" : "text-faint"}`}>
          {value || "Not answered"}
        </span>
        {note ? (
          <span
            className={`shrink-0 text-[10px] font-bold uppercase tracking-kicker ${
              warn ? "text-amber-400" : "text-faint"
            }`}
          >
            {note}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

function Prose({
  title,
  body,
  note,
}: {
  title: string;
  body: string | null;
  note?: string;
}) {
  if (!body) return null;
  return (
    <section className="mt-10">
      <h2 className="text-[11px] font-bold uppercase tracking-kicker text-faint">
        {title}
      </h2>
      {note ? <p className="mt-1 text-xs text-amber-400">{note}</p> : null}
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{body}</p>
    </section>
  );
}
