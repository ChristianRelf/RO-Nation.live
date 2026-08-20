import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PartnerSiteBriefStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { savePartnerBrief } from "@/app/actions/partner-brief";
import {
  BRIEF_ASSET_SLOTS,
  FONT_DIRECTIONS,
  briefGaps,
} from "@/lib/partner-brief";
import { PARTNER_FEATURE_CHOICES, explainSlug } from "@/lib/partners/registry";
import { BriefUploads } from "@/components/partner/brief-uploads";
import { ProgrammeShell } from "@/components/partner/programme-shell";
import { Kicker } from "@/components/ui";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

// NEVER indexed. The URL is the authorisation - see the schema note on PartnerSiteBrief -
// and a crawler that files one of these in an index has published somebody's unreleased
// brand assets.
export const metadata: Metadata = {
  title: "Your site brief",
  robots: { index: false, follow: false, nocache: true },
};

// partner.ronation.live/onboard/site/<uuid> - everything RNL needs to build a partner's
// site, asked of the partner.
//
// ---- Anonymous, on purpose -------------------------------------------------
//
// /onboard/site is on PROGRAMME_PUBLIC_PATHS while /onboard itself is not, and that one
// line is the whole design. The guided setup above it is a partner's own and stays behind
// the gate; this is a link they FORWARD - to their designer, their manager, whoever owns
// the brand - and those people have no Roblox account here and no reason to make one.
//
// The trade is deliberate and it is the same one a document share link makes: RNL would
// rather have the real answers from the person who knows them than the reachable answers
// from the person who happens to hold a login.
//
// ---- Why the fields are the registry's fields ------------------------------
//
// Near enough one for one with the `Partner` type in lib/partners/registry.ts. A brief
// shaped like the thing it becomes can be read straight down when the entry gets written,
// and the .zip on the company desk emits a draft of exactly that entry. See
// lib/partner-brief.ts.

const INPUT =
  "w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm outline-none transition-colors focus:border-accent";
const AREA =
  "w-full resize-y rounded-xl border border-line bg-bg px-4 py-3 text-sm outline-none transition-colors focus:border-accent";

export default async function SiteBriefPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { ok?: string; error?: string; verdict?: string };
}) {
  const brief = await prisma.partnerSiteBrief.findUnique({
    where: { token: params.token },
    include: { assets: { orderBy: { createdAt: "asc" } } },
  });
  // A flat 404 for a bad token, a mistyped one and a deleted brief alike. There is nothing
  // useful to distinguish, and nothing worth telling somebody trying codes.
  if (!brief) notFound();

  const submitted = brief.status === PartnerSiteBriefStatus.SUBMITTED;
  const gaps = briefGaps(brief, brief.assets.length);
  const chosenFeatures = new Set(brief.features);

  return (
    <ProgrammeShell cta={null}>
      <div className="relative">
        <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-64" />

        <div className="shell relative max-w-3xl py-16">
          <Kicker>Site brief</Kicker>
          <h1 className="display mt-4 text-4xl leading-none sm:text-5xl">
            {brief.siteName || brief.label}
          </h1>
          <p className="mt-5 max-w-xl text-muted">
            Everything we need to build your site. Nothing here is final and nothing is
            binding - it is a description, and we will talk it through before anything gets
            made.
          </p>

          <Banner ok={searchParams.ok} error={searchParams.error} verdict={searchParams.verdict} />

          <Progress submitted={submitted} gaps={gaps} />

          <form action={savePartnerBrief} className="mt-12 space-y-12">
            <input type="hidden" name="token" value={brief.token} />

            {/* ---- The site ------------------------------------------- */}
            <Section n="01" title="The site">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" hint="What the site is called. Usually your group's name.">
                  <input
                    name="siteName"
                    defaultValue={brief.siteName ?? ""}
                    maxLength={120}
                    className={INPUT}
                  />
                </Field>
                <Field
                  label="Short name"
                  hint="For places the full name won't fit - nav, footer, ticket stubs."
                >
                  <input
                    name="shortName"
                    defaultValue={brief.shortName ?? ""}
                    maxLength={60}
                    className={INPUT}
                  />
                </Field>
              </div>

              <Field
                label="Subdomain"
                hint={`Your address: yourname.${site.domain}. Lowercase letters, numbers and hyphens.`}
              >
                <div className="flex items-center gap-2">
                  <input
                    name="slug"
                    defaultValue={brief.slug ?? ""}
                    maxLength={40}
                    pattern="[a-z0-9]([a-z0-9-]*[a-z0-9])?"
                    className={INPUT}
                    placeholder="yourname"
                  />
                  <span className="shrink-0 font-mono text-xs text-faint">
                    .{site.domain}
                  </span>
                </div>
              </Field>

              <Field label="Tagline" hint="One line. It sits under your name on the homepage.">
                <input
                  name="tagline"
                  defaultValue={brief.tagline ?? ""}
                  maxLength={200}
                  className={INPUT}
                />
              </Field>

              <Field
                label="Description"
                hint="A paragraph about what you put on. Used on the site and in search results."
              >
                <textarea
                  name="description"
                  rows={5}
                  defaultValue={brief.description ?? ""}
                  maxLength={4000}
                  className={AREA}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Ticket prefix"
                  hint="Ticket codes read PREFIX-XXXXXX. Two to six letters."
                >
                  <input
                    name="ticketPrefix"
                    defaultValue={brief.ticketPrefix ?? ""}
                    maxLength={6}
                    className={`${INPUT} uppercase`}
                    placeholder="ST"
                  />
                </Field>
                <Field label="Roblox group" hint="Public link. Linked from your site.">
                  <input
                    type="url"
                    name="robloxGroupUrl"
                    defaultValue={brief.robloxGroupUrl ?? ""}
                    maxLength={300}
                    className={INPUT}
                  />
                </Field>
              </div>

              <Field
                label="Features"
                hint="Each one is a whole section of the site. Leave off anything you won't use - an empty blog looks worse than no blog."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {PARTNER_FEATURE_CHOICES.map((f) => (
                    <label
                      key={f.id}
                      className="flex cursor-pointer gap-3 rounded-brand border border-line p-4 transition-colors hover:border-line-strong has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
                    >
                      <input
                        type="checkbox"
                        name="features"
                        value={f.id}
                        defaultChecked={chosenFeatures.has(f.id)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{f.label}</span>
                        <span className="mt-0.5 block text-xs text-muted">{f.blurb}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </Field>

              {/* Only asked because it is legally load-bearing for one kind of partner,
                  and the reason is said rather than implied. See Partner.disclaimer. */}
              <Field
                label="Disclaimer"
                hint="If you run tribute or fan events for a real-world act, this line goes in your footer saying the act isn't involved. Leave it blank if it doesn't apply."
              >
                <textarea
                  name="disclaimer"
                  rows={3}
                  defaultValue={brief.disclaimer ?? ""}
                  maxLength={1000}
                  className={AREA}
                />
              </Field>
            </Section>

            {/* ---- The look ------------------------------------------- */}
            <Section n="02" title="The look">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Accent colour"
                  hint="The one colour the site is built around. Buttons, links, highlights."
                >
                  <ColourInput name="accentColour" value={brief.accentColour} />
                </Field>
                <Field
                  label="Type on the accent"
                  hint="The colour of writing ON that colour. Usually near-black or white."
                >
                  <ColourInput name="accentInkColour" value={brief.accentInkColour} />
                </Field>
              </div>

              <Field
                label="Type"
                hint="A direction, not a font name - we'll match it to something we can licence."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {FONT_DIRECTIONS.map((f) => (
                    <label
                      key={f.id}
                      className="flex cursor-pointer gap-3 rounded-brand border border-line p-4 transition-colors hover:border-line-strong has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
                    >
                      <input
                        type="radio"
                        name="fontChoice"
                        value={f.id}
                        defaultChecked={brief.fontChoice === f.id}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{f.label}</span>
                        <span className="mt-0.5 block text-xs text-muted">{f.blurb}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </Field>

              <Field
                label="Anything else about the look"
                hint="This is the box that actually helps. What it should feel like, what it must not look like, anything you've already got."
              >
                <textarea
                  name="moodNotes"
                  rows={6}
                  defaultValue={brief.moodNotes ?? ""}
                  maxLength={4000}
                  className={AREA}
                />
              </Field>

              <Field
                label="References"
                hint="One link per line. Sites, socials, artwork - anything you want it to feel like."
              >
                <textarea
                  name="referenceUrls"
                  rows={4}
                  defaultValue={brief.referenceUrls.join("\n")}
                  className={`${AREA} font-mono text-xs`}
                  placeholder="https://..."
                />
              </Field>
            </Section>

            {/* ---- Who to ask ----------------------------------------- */}
            <Section n="03" title="Who to ask">
              <p className="text-sm text-muted">
                Whoever should answer questions about the brand while we build it - which
                may well be whoever is reading this rather than the person we invited.
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Name">
                  <input
                    name="contactName"
                    defaultValue={brief.contactName ?? ""}
                    maxLength={120}
                    className={INPUT}
                  />
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    name="contactEmail"
                    defaultValue={brief.contactEmail ?? ""}
                    maxLength={160}
                    className={INPUT}
                  />
                </Field>
                <Field label="Discord">
                  <input
                    name="contactDiscord"
                    defaultValue={brief.contactDiscord ?? ""}
                    maxLength={80}
                    className={INPUT}
                  />
                </Field>
              </div>
            </Section>

            {/* ---- Save ----------------------------------------------- */}
            <div className="flex flex-wrap items-center gap-4 border-t border-line pt-8">
              <button
                type="submit"
                name="intent"
                value="save"
                className="btn btn-ghost"
              >
                Save for now
              </button>
              <button
                type="submit"
                name="intent"
                value="submit"
                className="btn btn-accent"
              >
                {submitted ? "Send the changes" : "Hand it in"}
              </button>
              <p className="text-xs text-faint">
                You can come back to this link and change anything, before or after.
              </p>
            </div>
          </form>

          {/* ---- Files ------------------------------------------------
              OUTSIDE the form, deliberately. Nested forms are invalid HTML, and these
              upload on their own the moment a file is picked - see the note in
              BriefUploads for why that is not hidden. */}
          <section className="mt-16 border-t border-line pt-10">
            <div className="flex items-baseline gap-3">
              <span aria-hidden className="tnum display text-2xl leading-none text-faint">
                04
              </span>
              <h2 className="font-display text-2xl">Your artwork</h2>
              <span aria-hidden className="h-px flex-1 bg-line" />
            </div>
            <p className="mt-3 max-w-xl text-sm text-muted">
              The files we build from. Everything here stays private to RO. Nation LIVE -
              nothing you upload is served on the web.
            </p>

            <div className="mt-6">
              <BriefUploads
                token={brief.token}
                initial={brief.assets.map((a) => ({
                  id: a.id,
                  slot: a.slot,
                  filename: a.filename,
                  mime: a.mime,
                  size: a.size,
                }))}
              />
            </div>
          </section>

          <p className="mt-12 border-t border-line pt-6 text-xs text-faint">
            This link is yours to forward to whoever knows the brand best - they do not
            need an account with us. Treat it like a shared document: anybody holding it
            can read and change this brief.
          </p>
        </div>
      </div>
    </ProgrammeShell>
  );
}

/**
 * What is still missing, or the fact that it has been handed in.
 *
 * A count and a list rather than a percentage bar: "three things left, and here they are"
 * is actionable, and "72% complete" is a number somebody has to reverse-engineer.
 */
function Progress({ submitted, gaps }: { submitted: boolean; gaps: string[] }) {
  if (submitted && !gaps.length) {
    return (
      <p className="mt-8 rounded-brand border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-accent">
        Handed in, and nothing missing. Change anything you like - we will see the update.
      </p>
    );
  }

  if (!gaps.length) {
    return (
      <p className="mt-8 rounded-brand border border-line px-4 py-3 text-sm text-muted">
        Everything is filled in. Press <span className="text-fg">Hand it in</span> at the
        bottom when you are happy with it.
      </p>
    );
  }

  return (
    <div className="mt-8 rounded-brand border border-line px-4 py-3">
      <p className="text-sm text-muted">
        {submitted ? "Handed in, but still missing" : "Still to fill in"}:{" "}
        <span className="text-fg">{gaps.join(", ")}</span>.
      </p>
      <p className="mt-1 text-xs text-faint">
        None of it is compulsory - you can hand it in as it stands and we will ask about
        the rest.
      </p>
    </div>
  );
}

function Banner({
  ok,
  error,
  verdict,
}: {
  ok?: string;
  error?: string;
  verdict?: string;
}) {
  if (error === "slug") {
    // The registry's own explanation, so the form and the deploy-time check cannot give
    // two different reasons for the same refusal. See explainSlug().
    const why =
      explainSlug((verdict ?? "invalid") as Parameters<typeof explainSlug>[0]) ??
      "That subdomain cannot be used.";
    return (
      <p
        role="alert"
        className="mt-8 rounded-brand border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
      >
        {why} Nothing else on the form was saved.
      </p>
    );
  }

  if (error) {
    return (
      <p
        role="alert"
        className="mt-8 rounded-brand border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
      >
        Check the email address and the group link - one of them was not a valid address,
        so nothing was saved.
      </p>
    );
  }

  if (ok === "submitted") {
    return (
      <p className="mt-8 rounded-brand border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-accent">
        That is with us. We will be in touch about anything that needs a conversation.
      </p>
    );
  }

  if (ok === "saved") {
    return (
      <p className="mt-8 rounded-brand border border-line px-4 py-3 text-sm text-muted">
        Saved. Come back to this link whenever you like.
      </p>
    );
  }

  return null;
}

/**
 * A hex box with a swatch beside it.
 *
 * The text input is the field; the swatch is a coloured square with no input in it at
 * all. Deliberately not <input type="color">: that would need JavaScript to keep the two
 * in step, and it opens a colour wheel - which is the wrong tool entirely for somebody
 * who already knows their brand hex and simply wants to type it.
 *
 * The swatch shows the SAVED value rather than what is being typed, and that is the
 * honest thing for it to show on a server-rendered form: it is a confirmation of what
 * RNL currently holds, not a live preview.
 */
function ColourInput({ name, value }: { name: string; value: string | null }) {
  return (
    <div className="flex items-center gap-2">
      <input
        name={name}
        defaultValue={value ?? ""}
        maxLength={7}
        className={`${INPUT} font-mono`}
        placeholder="#2b6bff"
      />
      <span
        aria-hidden
        className="h-10 w-10 shrink-0 rounded-brand border border-line"
        style={value ? { backgroundColor: value } : undefined}
      />
    </div>
  );
}

function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div className="flex items-baseline gap-3">
        <span aria-hidden className="tnum display text-2xl leading-none text-faint">
          {n}
        </span>
        <h2 className="font-display text-2xl">{title}</h2>
        <span aria-hidden className="h-px flex-1 bg-line" />
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-bold uppercase tracking-kicker text-faint">
        {label}
      </span>
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}
