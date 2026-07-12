import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/session";
import { submitApplication } from "@/app/actions/applications";
import { Kicker } from "@/components/ui";
import { toLines } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const career = await prisma.career.findUnique({
    where: { slug: params.slug },
  });
  if (!career) return { title: "Role not found" };
  return { title: career.title, description: career.summary };
}

export default async function CareerPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { applied?: string; error?: string };
}) {
  const career = await prisma.career.findUnique({
    where: { slug: params.slug },
  });
  if (!career || career.status === "DRAFT") notFound();

  const session = await getUserSession();
  const requirements = toLines(career.requirements);
  const closed = career.status === "CLOSED";

  return (
    <div className="relative">
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-56" />
      <div className="shell relative pt-14 sm:pt-16">
        <Link
          href="/careers"
          className="text-sm text-muted transition-colors hover:text-fg"
        >
          ← All roles
        </Link>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="pill">{career.department}</span>
          <span className="pill">{career.commitment}</span>
          <span className="pill">{career.location}</span>
        </div>
        <h1 className="display mt-4 max-w-3xl text-5xl sm:text-6xl">
          {career.title}
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted">{career.summary}</p>
      </div>

      <div className="shell grid gap-12 py-12 lg:grid-cols-[1.5fr_1fr] lg:gap-16">
        <div>
          <Kicker>The role</Kicker>
          <div className="mt-5 whitespace-pre-line text-[17px] leading-relaxed text-muted">
            {career.description}
          </div>

          {requirements.length ? (
            <>
              <h2 className="mt-10 font-display text-2xl">What we&apos;re after</h2>
              <ul className="mt-5 space-y-3">
                {requirements.map((r, i) => (
                  <li key={i} className="flex gap-3 text-muted">
                    <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] text-accent">
                      ✓
                    </span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>

        {/* Apply */}
        <aside id="apply" className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            <h2 className="font-display text-2xl">Apply now</h2>
            <p className="mt-1 text-sm text-muted">
              Takes two minutes. We reply to everyone in the Discord.
            </p>

            {searchParams.applied ? (
              <div className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
                Application received — thank you! Keep an eye on your Roblox DMs
                and the Discord.
              </div>
            ) : closed ? (
              <div className="mt-5 rounded-xl border border-line bg-bg px-4 py-3 text-sm text-muted">
                Applications for this role are currently closed.
              </div>
            ) : (
              <form action={submitApplication} className="mt-5 space-y-3">
                <input type="hidden" name="careerId" value={career.id} />
                <input type="hidden" name="slug" value={career.slug} />

                {searchParams.error === "invalid" ? (
                  <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                    Please add your Roblox username and a message of at least 20
                    characters.
                  </p>
                ) : null}

                <Field
                  name="robloxUsername"
                  label="Roblox username"
                  required
                  defaultValue={session?.username ?? ""}
                  placeholder="YourRobloxName"
                />
                <Field
                  name="discord"
                  label="Discord (optional)"
                  placeholder="username#0000 or @username"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Field name="timezone" label="Timezone" placeholder="GMT / EST" />
                  <Field
                    name="portfolio"
                    label="Portfolio / links"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                    Why you? <span className="text-accent">*</span>
                  </label>
                  <textarea
                    name="message"
                    required
                    rows={5}
                    placeholder="Tell us about your experience and why this role fits you."
                    className="w-full resize-none rounded-xl border border-line bg-bg px-4 py-3 text-sm outline-none transition-colors focus:border-accent"
                  />
                </div>
                <button className="btn btn-accent w-full">
                  Submit application
                </button>
                <p className="text-center text-xs text-faint">
                  By applying you agree to be contacted about this role.
                </p>
              </form>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  required,
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
        {label} {required ? <span className="text-accent">*</span> : null}
      </label>
      <input
        name={name}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm outline-none transition-colors focus:border-accent"
      />
    </div>
  );
}
