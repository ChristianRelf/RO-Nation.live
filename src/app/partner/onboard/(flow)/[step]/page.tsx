import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { PartnerOnboarding } from "@prisma/client";
import { requirePartnerAccount } from "@/lib/partner-account";
import {
  ONBOARDING_STEPS,
  canOpenStep,
  resumeSlug,
  startOnboarding,
  stepBySlug,
  stepIndex,
} from "@/lib/partner-onboarding";
import { PROGRAMME_OFFERS } from "@/lib/partner-program";
import { PARTNER_AGREEMENTS } from "@/lib/legal";
import {
  advanceOnboarding,
  saveOnboardingDetails,
  saveOnboardingInterests,
} from "@/app/actions/partner-onboarding";
import { OnboardRail } from "@/components/partner/onboard-rail";
import { TimezoneField } from "@/components/partner/timezone-field";
import { payUrls } from "@/lib/accounting/urls";
import { Kicker } from "@/components/ui";

export const dynamic = "force-dynamic";

// Every step of the guided setup, in one route.
//
// One file rather than five, because four of the five are the same page with different
// words in it - a heading, a body, and a button that advances the counter. Splitting them
// would mean four copies of the guard, the rail and the footer nav, and the day somebody
// changes the nav they would change three of them.
//
// The step's CONTENT is a switch at the bottom. That is the part that genuinely differs,
// and keeping it in one place makes the flow readable top to bottom in the order a partner
// walks it - which is the property worth having in a file about a sequence.
//
// ---- Two guards, and they answer different questions -----------------------
//
//   requirePartnerAccount()  may this person be here at all?
//   canOpenStep()            may they be on THIS step yet?
//
// The second is not security - there is nothing behind step five worth stealing - it is
// coherence. A flow whose last page can be typed into the address bar is one where "your
// setup is complete" gets read by somebody who has done none of it.

export async function generateMetadata({
  params,
}: {
  params: { step: string };
}): Promise<Metadata> {
  const step = stepBySlug(params.step);
  return { title: step?.title ?? "Setting up" };
}

// There is deliberately NO generateStaticParams() here, and it is the obvious thing to
// add: the five slugs are a closed set sitting right there in ONBOARDING_STEPS.
//
// Adding it makes Next treat this as a statically-generated route (the build output flips
// this line from a dynamic route to an SSG one and lists all five paths under it) and
// walk them AT BUILD TIME - into requirePartnerAccount(), with no session and, in CI or
// on a dev machine, no database. `dynamic = "force-dynamic"` above does not prevent it.
// Every one of those pages is per-partner and guarded, so there is nothing to gain from
// the attempt and a build that touches the database to lose.
//
// The closed set is enforced by stepBySlug() below, which 404s anything else. That is the
// check that matters; the params list would only ever have been documentation.

export default async function OnboardStepPage({
  params,
  searchParams,
}: {
  params: { step: string };
  searchParams: { error?: string };
}) {
  const step = stepBySlug(params.step);
  if (!step) notFound();

  const user = await requirePartnerAccount();
  const row = await startOnboarding(user.account.id);
  const index = stepIndex(step.slug);

  // Too far ahead. Sent to where they actually are rather than 404'd - they have not
  // reached a page that does not exist, they have reached one that is not their turn.
  if (!canOpenStep(row, index)) redirect(`/onboard/${resumeSlug(row)}`);

  return (
    <div className="grid gap-10 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-14">
      <OnboardRail current={index} row={row} />

      <div className="min-w-0 max-w-2xl">
        <Kicker>{step.kicker}</Kicker>
        <h1 className="display mt-4 text-4xl leading-none sm:text-5xl">{step.title}</h1>
        <p className="mt-4 text-muted">{step.blurb}</p>

        {searchParams.error ? (
          <p
            role="alert"
            className="mt-6 rounded-brand border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
          >
            Check the email address and the group link - one of them wasn&apos;t a valid
            address, so nothing on this step was saved.
          </p>
        ) : null}

        <div className="mt-9">
          <StepBody slug={step.slug} row={row} accountName={user.account.name} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The steps
// ---------------------------------------------------------------------------

const INPUT =
  "w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm outline-none transition-colors focus:border-accent";
const AREA =
  "w-full resize-y rounded-xl border border-line bg-bg px-4 py-3 text-sm outline-none transition-colors focus:border-accent";

function StepBody({
  slug,
  row,
  accountName,
}: {
  slug: string;
  row: PartnerOnboarding;
  accountName: string;
}) {
  switch (slug) {
    case "welcome":
      return <Welcome accountName={accountName} />;
    case "programme":
      return <Programme row={row} />;
    case "details":
      return <Details row={row} />;
    case "agreements":
      return <Agreements />;
    case "done":
      return <Done />;
    default:
      // Unreachable - stepBySlug() already 404'd anything else - and here so that adding
      // a step to the list without writing its body fails loudly rather than rendering a
      // page with a heading and nothing under it.
      return null;
  }
}

function Welcome({ accountName }: { accountName: string }) {
  return (
    <>
      <p className="text-lg">
        <span className="text-fg">{accountName}</span> now has an account with RO. Nation
        LIVE, and this Roblox login opens it.
      </p>

      <ul className="mt-8 divide-y divide-line/60 border-y border-line">
        {[
          {
            title: "This takes about five minutes",
            body: "Two of the steps ask you things; the others just explain what you have. You can stop at any point and pick it up from where you left off.",
          },
          {
            title: "Nothing here commits you",
            body: "The agreements come later in this flow, and reading them is not signing them. Being on the books as a potential partner costs you nothing.",
          },
          {
            title: "We are already reachable",
            body: "Anything that does not fit in a form goes to whoever invited you. This is setup, not a support queue.",
          },
        ].map((item) => (
          <li key={item.title} className="py-5">
            <p className="font-display text-lg leading-tight">{item.title}</p>
            <p className="mt-1 text-sm text-muted">{item.body}</p>
          </li>
        ))}
      </ul>

      <Advance from="welcome" label="Start" />
    </>
  );
}

function Programme({ row }: { row: PartnerOnboarding }) {
  const chosen = new Set(row.interests);

  return (
    <form action={saveOnboardingInterests}>
      <p>
        Every part of the programme is switched on per partner. Tick the ones you want -
        this is not binding, it tells us what to set up and what to leave alone.
      </p>

      <div className="mt-8 space-y-3">
        {PROGRAMME_OFFERS.map((offer) => (
          <label
            key={offer.id}
            className="group flex cursor-pointer gap-4 rounded-brand border border-line p-4 transition-colors hover:border-line-strong has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
          >
            <input
              type="checkbox"
              name="interests"
              value={offer.id}
              defaultChecked={chosen.has(offer.id)}
              className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
            />
            <span className="min-w-0">
              <span className="block font-display text-lg leading-tight">
                {offer.title}
              </span>
              <span className="mt-1 block text-sm text-muted">{offer.body}</span>
              {offer.terms ? (
                <span className="mt-2 block text-xs font-semibold text-accent">
                  {offer.terms}
                </span>
              ) : null}
            </span>
          </label>
        ))}
      </div>

      <SubmitRow label="Save and continue" />
    </form>
  );
}

function Details({ row }: { row: PartnerOnboarding }) {
  return (
    <form action={saveOnboardingDetails}>
      <p>
        None of this is required, and all of it saves somebody a message later. It is
        visible to RO. Nation LIVE only.
      </p>

      <div className="mt-8 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Who we should ask for" hint="The person, not the group.">
            <input
              name="contactName"
              defaultValue={row.contactName ?? ""}
              maxLength={120}
              className={INPUT}
            />
          </Field>
          <Field label="Email" hint="For anything that needs a paper trail.">
            <input
              type="email"
              name="contactEmail"
              defaultValue={row.contactEmail ?? ""}
              maxLength={160}
              className={INPUT}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Discord" hint="For everything else, which is most of it.">
            <input
              name="contactDiscord"
              defaultValue={row.contactDiscord ?? ""}
              maxLength={80}
              className={INPUT}
            />
          </Field>
          <Field
            label="Timezone"
            hint="So booking a slot isn't three messages of 'what time is that for you'."
          >
            <TimezoneField
              name="timezone"
              defaultValue={row.timezone ?? ""}
              className={INPUT}
            />
          </Field>
        </div>

        <Field
          label="Roblox group"
          hint="Public link. It goes on your site and nowhere near your access."
        >
          <input
            type="url"
            name="robloxGroupUrl"
            defaultValue={row.robloxGroupUrl ?? ""}
            maxLength={300}
            className={INPUT}
            placeholder="https://www.roblox.com/groups/..."
          />
        </Field>

        <Field
          label="What you run"
          hint="In your own words. We reuse this when we brief your site, so it is worth a minute."
        >
          <textarea
            name="about"
            rows={5}
            defaultValue={row.about ?? ""}
            maxLength={4000}
            className={AREA}
          />
        </Field>
      </div>

      <SubmitRow label="Save and continue" />
    </form>
  );
}

function Agreements() {
  return (
    <>
      <p>
        Three documents. They set the split, what we may do with your assets, and how
        ticketing works. They are public, they are written to be read, and anything you
        want changed is changed before either side commits to it.
      </p>

      <div className="mt-8 divide-y divide-line border-y border-line">
        {PARTNER_AGREEMENTS.map((doc) => (
          <a
            key={doc.href}
            href={doc.href}
            target="_blank"
            rel="noreferrer"
            className="group flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-5"
          >
            <span className="min-w-0">
              <span className="font-display text-xl transition-colors group-hover:text-accent">
                {doc.title}
              </span>
              <span className="mt-1 block text-sm text-muted">{doc.blurb}</span>
            </span>
            <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] text-faint">
              Updated {doc.updated} ↗
            </span>
          </a>
        ))}
      </div>

      {/* Deliberately NOT a tick-box saying "I have read these". A checkbox here would
          record a click, not an agreement, and the place where acceptance is actually
          captured - with a frozen copy of what was shown - is the payment terms gate on
          pay.ronation.live. Inventing a weaker second record of the same idea would make
          the real one look optional. */}
      <p className="mt-6 text-xs text-faint">
        Nothing is signed here. When there is money to move, you will be asked to accept
        the payment terms properly - with a copy of exactly what you agreed to, kept
        against your name.
      </p>

      <Advance from="agreements" label="Continue" />
    </>
  );
}

function Done() {
  return (
    <>
      <p>That is the setup. Here is where everything lives from now on.</p>

      <ul className="mt-8 divide-y divide-line/60 border-y border-line">
        {[
          {
            title: "Your partner area",
            body: "Your agreements, who can sign in on your behalf, and anything we have raised with you. It is the page this finishes on.",
          },
          {
            title: "Your money",
            body: "Payouts, invoices, receipts and credit notes get their own home on our payment site once you are a full partner - and you can ask to be paid from there.",
          },
          {
            title: "Your site",
            body: "If you are having one, we will send you a brief to fill in. It is a link of its own and you can hand it to whoever knows your brand best.",
          },
          {
            title: "Your contact",
            body: "Whoever invited you is still the person to ask. Nothing here replaces that.",
          },
        ].map((item) => (
          <li key={item.title} className="py-5">
            <p className="font-display text-lg leading-tight">{item.title}</p>
            <p className="mt-1 text-sm text-muted">{item.body}</p>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-xs text-faint">
        Payments open at{" "}
        <span className="font-mono">{new URL(payUrls.home()).host}</span> once you are a
        full partner - there is nothing to see there until there is money to account for.
      </p>

      <Advance from="done" label="Finish" />
    </>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

/**
 * The "next" button on a step that gathers nothing.
 *
 * A form, not a link, and the reason is in the action's own note: the step counter has to
 * advance on every step or resuming lands people back at the last one that happened to
 * have fields on it.
 */
function Advance({ from, label }: { from: string; label: string }) {
  return (
    <form action={advanceOnboarding}>
      <input type="hidden" name="from" value={from} />
      <SubmitRow label={label} />
    </form>
  );
}

function SubmitRow({ label }: { label: string }) {
  return (
    <div className="mt-10 flex flex-wrap items-center gap-4 border-t border-line pt-6">
      <button type="submit" className="btn btn-accent">
        {label}
      </button>
      <Link
        href="/hub"
        className="text-[11px] font-bold uppercase tracking-kicker text-faint transition-colors hover:text-accent"
      >
        {label === "Finish" ? "Skip to my area" : "Finish this later"}
      </Link>
    </div>
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
