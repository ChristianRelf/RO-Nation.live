import { site } from "@/lib/site";

// The mark that says a form is RO. Nation LIVE's own.
//
// A form is the one place a visitor hands something over - a name, an email, an
// answer - and a survey makes that a genuinely hard call: survey.ronation.live/<CODE>
// is an opaque code on a subdomain that arrives by Discord link, with nothing on the
// page a stranger could check. This is the thing they check. It is the same job the
// "Official channels" section on /press already does for a journalist, done at the
// point where it matters to everyone else.
//
// ---- Why this is NEVER rendered from a shared form component ----------------
//
// RNL's careers page and every partner's careers page render the SAME ApplyForm, and
// ticket checkout works the same way. Partner events are fan-run and explicitly NOT
// official - lib/partners/registry.ts and legal/terms both say so in as many words,
// and p/[slug]/events/[event]/reserve prints the disclaimer directly above the form.
// A mark baked into a shared component would appear on a partner's page and flatly
// contradict the sentence beneath it.
//
// So this is rendered by the PAGE, which already knows whose form it is - ownership
// is decided server-side from the career's partnerId, never from the form. Absent by
// default, opted into once per RNL-owned page. A new partner form gets no mark by
// forgetting, which is the right way round: the cost of omission is a missing badge,
// the cost of inclusion is a lie.
export function OfficialMark({ className }: { className?: string }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border border-line bg-elev px-4 py-3 ${className ?? ""}`}
    >
      <span aria-hidden className="mt-px font-bold text-accent">
        ✓
      </span>

      <p className="text-xs leading-relaxed text-faint">
        <span className="font-semibold text-fg">Official {site.name} form.</span>{" "}
        Ours only ever live on {site.domain} and its subdomains. If anything else
        asks you this in our name, it isn&apos;t us.{" "}
        {/* A plain <a>, not a <Link>, because this crosses hosts. On the survey host
            /press is not in SURVEY_PATHS, so the middleware hands it to the main site;
            a <Link> would try that as a client RSC fetch, get a redirect to another
            origin, fail, and fall back to a hard navigation anyway. Same reasoning as
            the hardNav flag on the Merch nav item - see lib/site.ts.

            Relative, not absolute, for the reason the nav records too: the middleware
            already knows which host owns /press, so one href is right everywhere,
            including local dev where every host is one origin. */}
        <a
          href="/press#official-channels"
          className="whitespace-nowrap font-medium text-muted underline underline-offset-2 transition-colors hover:text-accent"
        >
          Verify our channels
        </a>
      </p>
    </div>
  );
}
