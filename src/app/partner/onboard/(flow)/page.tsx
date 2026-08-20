import { redirect } from "next/navigation";
import { requirePartnerAccount } from "@/lib/partner-account";
import { resumeSlug, startOnboarding } from "@/lib/partner-onboarding";

export const dynamic = "force-dynamic";

/**
 * /onboard - not a page, a resume.
 *
 * It creates the row if this is the first visit, then sends them to the step they were on.
 * That is the whole reason /onboard has no content of its own: it is the address people
 * bookmark, paste and are redirected to after accepting an invite, and what it should show
 * depends entirely on how far they got. A landing page here would mean somebody four steps
 * in gets "Welcome!" every time they come back.
 *
 * The guard is called for itself, not inherited from the layout - see the note there.
 */
export default async function OnboardIndex() {
  const user = await requirePartnerAccount();
  const row = await startOnboarding(user.account.id);
  redirect(`/onboard/${resumeSlug(row)}`);
}
