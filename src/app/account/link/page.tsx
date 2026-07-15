import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserSession } from "@/lib/session";
import {
  getDiscordLinkByUser,
  rotateLinkCode,
  LINK_CODE_TTL_SECONDS,
} from "@/lib/discord-link";
import { LinkCodePanel } from "@/components/link-code-panel";
import { Kicker } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Link Discord",
  robots: { index: false, follow: false },
};

export default async function AccountLinkPage() {
  const session = await getUserSession();
  // A code is minted per signed-in account, so there is nothing to show a stranger -
  // send them to sign in and straight back here.
  if (!session) redirect("/account?returnTo=/account/link");

  // Mint the first code on load (rotating replaces it), and read the current link
  // status, together.
  const [initial, link] = await Promise.all([
    rotateLinkCode(session.uid),
    getDiscordLinkByUser(session.uid),
  ]);

  return (
    <div className="relative">
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-72" />
      <div className="shell relative flex min-h-[70vh] items-center justify-center py-16">
        <div className="w-full max-w-md">
          <div className="text-center">
            <Kicker>Members</Kicker>
            <h1 className="display mt-4 text-4xl sm:text-5xl">Link Discord</h1>
            <p className="mt-4 text-muted">
              Connect your Roblox account - signed in as{" "}
              <span className="text-fg">@{session.username}</span> - to Discord with
              the rotating code below.
            </p>
          </div>

          <div className="mt-8">
            <LinkCodePanel
              initialCode={initial.code}
              initialExpiresAt={initial.expiresAt.getTime()}
              ttlSeconds={LINK_CODE_TTL_SECONDS}
              linked={
                link
                  ? {
                      discordId: link.discordId,
                      discordUsername: link.discordUsername,
                      linkedAt: link.linkedAt.getTime(),
                    }
                  : null
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
