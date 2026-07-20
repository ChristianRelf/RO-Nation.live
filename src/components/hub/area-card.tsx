import type { AttentionItem, HubAreaLive } from "@/lib/hub-dashboard";
import type { HubLink } from "@/lib/hub";
import { CapacityMeter } from "./capacity-meter";
import { HubAnchor } from "./hub-anchor";

// One area, with what is actually going on inside it.
//
// The card was a name, a role and a row of links. Everything added below is there
// to answer "do I need to open this?" without opening it - which is the entire
// difference between a launcher and a dashboard.

const KIND_LABEL: Record<HubAreaLive["kind"], string> = {
  partner: "Partner",
  company: "Company",
  shasha: "Roster",
};

export function AreaCard({ area }: { area: HubAreaLive }) {
  return (
    <article className="card card-hover flex flex-col p-6">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-xl uppercase">{area.name}</h3>
          <p
            className={`mt-1 text-[10px] font-bold uppercase tracking-kicker ${
              area.canWrite ? "text-accent" : "text-faint"
            }`}
          >
            {area.roleLabel}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-line px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-faint">
          {KIND_LABEL[area.kind]}
        </span>
      </header>

      <p className="mt-3 text-sm text-muted">{area.blurb}</p>

      {/* Three states, and they have to read differently - see HubAreaLive.
          hasShows false is ABSENT, not zeroed. */}
      {area.hasShows ? (
        <div className="mt-5 border-t border-line pt-4">
          <p className="text-[10px] font-bold uppercase tracking-kicker text-faint">
            Next show
          </p>
          {area.nextShow ? (
            <>
              <HubAnchor
                href={area.nextShow.href}
                external={area.nextShow.external}
                className="mt-1 block font-semibold transition-colors hover:text-accent"
              >
                {area.nextShow.title}
              </HubAnchor>
              <p className="mt-0.5 text-xs text-muted">
                <span className="text-fg">{area.nextShow.relative}</span> ·{" "}
                {area.nextShow.when}
              </p>
              <CapacityMeter show={area.nextShow} />
            </>
          ) : (
            <p className="mt-1 text-sm text-muted">
              No shows scheduled.{" "}
              {/* Only offered to somebody who can actually do it. A link that
                  bounces read-only staff is worse than no link - the same call
                  PortalNav makes about its keys item. */}
              {area.canWrite ? (
                <HubAnchor
                  href={
                    area.links.find((l) => l.label === "Events")?.href ??
                    `${area.home.href}/studio/events`
                  }
                  external={area.kind === "company"}
                  className="font-semibold text-accent transition-opacity hover:opacity-80"
                >
                  Plan one →
                </HubAnchor>
              ) : null}
            </p>
          )}
        </div>
      ) : null}

      {area.stats.length ? (
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
          {area.stats.map((s) => (
            <div key={s.label}>
              <p className="tnum font-display text-3xl leading-none">
                {s.value.toLocaleString()}
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-kicker text-faint">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {area.attention.length ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {area.attention.map((item) => (
            <AttentionChip key={item.label} item={item} />
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {area.links.map((l) => (
          <LinkChip key={l.href + l.label} link={l} />
        ))}
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <HubAnchor
          href={area.home.href}
          external={area.home.external}
          className="text-sm font-semibold text-accent transition-opacity hover:opacity-80"
        >
          {area.home.label} →
        </HubAnchor>
      </div>
    </article>
  );
}

/**
 * Something to go and look at. The palette is roster-audit.tsx's, on purpose -
 * amber and red already mean "check this" and "this is bad" everywhere else in the
 * portal, and a fourth colour vocabulary is a fourth thing to learn.
 */
function AttentionChip({ item }: { item: AttentionItem }) {
  return (
    <HubAnchor
      href={item.href}
      external={item.external}
      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-opacity hover:opacity-80 ${
        item.tone === "danger"
          ? "border-red-500/30 bg-red-500/10 text-red-300"
          : "border-amber-400/30 bg-amber-400/10 text-amber-300"
      }`}
    >
      {item.label}
    </HubAnchor>
  );
}

function LinkChip({ link }: { link: HubLink }) {
  return (
    <HubAnchor
      href={link.href}
      external={link.external}
      className="rounded-full border border-line px-3 py-1 text-xs text-muted transition-colors hover:border-line-strong hover:text-fg"
    >
      {link.label}
      {link.external ? " ↗" : ""}
    </HubAnchor>
  );
}
