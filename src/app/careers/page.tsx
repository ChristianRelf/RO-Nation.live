import type { Metadata } from "next";
import Link from "next/link";
import { getOpenCareers } from "@/lib/queries";
import { Reveal } from "@/components/reveal";
import { Kicker } from "@/components/ui";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Careers",
  description:
    "Join the RO. Nation LIVE crew — hosts, builders, moderators, editors and more. Open volunteer and paid roles.",
};

export default async function CareersPage() {
  const careers = await getOpenCareers();

  return (
    <div className="relative">
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-64" />
      <div className="shell relative pt-16 sm:pt-20">
        <Kicker>Join the crew</Kicker>
        <h1 className="display mt-5 text-5xl sm:text-6xl md:text-7xl">
          Careers
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">
          Every sold-out show is built by people who love this. We&apos;re always
          looking for reliable, creative crew — most roles start as volunteer and
          the best move into paid production work.
        </p>
      </div>

      <section className="shell py-14">
        {careers.length ? (
          <div className="grid gap-4">
            {careers.map((c, i) => (
              <Reveal key={c.id} delay={i * 50}>
                <Link
                  href={`/careers/${c.slug}`}
                  className="group card flex flex-col gap-5 p-6 transition-all hover:border-line-strong sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="pill">{c.department}</span>
                      <span className="pill">{c.commitment}</span>
                      <span className="pill">{c.location}</span>
                    </div>
                    <h2 className="mt-3 font-display text-2xl transition-colors group-hover:text-accent sm:text-3xl">
                      {c.title}
                    </h2>
                    <p className="mt-2 text-muted">{c.summary}</p>
                  </div>
                  <span className="btn btn-ghost shrink-0 self-start sm:self-auto">
                    View role →
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="card grid place-items-center px-6 py-20 text-center">
            <p className="font-display text-2xl">No open roles right now</p>
            <p className="mt-2 max-w-sm text-muted">
              We open new positions before every season of events. Follow the
              Discord and keep an eye out.
            </p>
            <a href={site.socials.discord} className="btn btn-ghost mt-6">
              Join the Discord
            </a>
          </div>
        )}
      </section>

      <div className="shell pb-8">
        <div className="card flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
          <p className="text-muted">
            Don&apos;t see your role but think you&apos;d be an asset?
          </p>
          <Link href="/contact" className="btn btn-ghost">
            Pitch us →
          </Link>
        </div>
      </div>
    </div>
  );
}
