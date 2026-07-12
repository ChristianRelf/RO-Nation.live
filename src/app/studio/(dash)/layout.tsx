import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getStudioAccess } from "@/lib/studio";
import { StudioNav } from "@/components/studio-nav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { default: "Studio", template: "%s · Studio" },
  robots: { index: false, follow: false },
};

/**
 * The Studio gate.
 *
 * This MUST redirect rather than render a "no access" screen in place of
 * `children`. In the App Router a page segment renders and is serialised into
 * the RSC payload independently of whether its layout chooses to render
 * `children` — so swapping the UI would still ship the page's data (draft
 * events, post bodies) to someone who isn't allowed to see it. redirect()
 * aborts the whole route render, which is the only thing that actually withholds
 * it. The unauthorised messaging lives at /studio/access instead.
 */
export default async function StudioDashLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getStudioAccess();
  if (access.state !== "allowed") redirect("/studio/access");

  return (
    <div className="shell py-10">
      <div className="grid gap-8 lg:grid-cols-[210px_1fr]">
        <StudioNav
          user={{
            displayName: access.user.displayName,
            roleName: access.user.roleName,
            rank: access.user.rank,
          }}
        />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
