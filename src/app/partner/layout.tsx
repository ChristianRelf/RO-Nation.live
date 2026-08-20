import type { Metadata } from "next";
import { partnerProgramOrigin } from "@/lib/partner-urls";

// The whole of partner.ronation.live. Everything under app/partner is served on that host
// and nowhere else - see the programme branch in src/middleware.ts, which rewrites the
// host onto this prefix exactly as accounts and pay are rewritten onto theirs.
//
// This layout holds NO chrome, deliberately. The host has two audiences and therefore two
// shells - ProgrammeShell out front, PartnerShell behind the gate - and each page picks the
// one it needs. What is shared is the title template and the metadata base, which is worth
// having in one place: without metadataBase pointing at THIS origin, an Open Graph image on
// the programme page resolves against ronation.live and shares the wrong site's card.
//
// robots is NOT set here, and that is the point of putting it per-page instead. The
// programme page wants indexing - it is the front door of a commercial offer. The hub, the
// invitations and the briefs very much do not, and each says so for itself.
export const metadata: Metadata = {
  metadataBase: new URL(partnerProgramOrigin()),
  title: {
    default: "Partner with RO. Nation LIVE",
    template: "%s · RNL Partners",
  },
};

export default function PartnerHostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
