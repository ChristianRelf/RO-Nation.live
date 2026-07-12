import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/session";
import { adminLogin } from "@/app/actions/admin";
import { Kicker } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin sign in", robots: { index: false } };

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  if (await isAdmin()) redirect("/admin");

  const message =
    searchParams.error === "invalid"
      ? "Incorrect username or password."
      : searchParams.error === "notset"
        ? "No admin password is configured on this server yet."
        : null;

  return (
    <div className="relative">
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-72" />
      <div className="shell relative flex min-h-[75vh] items-center justify-center py-16">
        <div className="w-full max-w-sm">
          <div className="text-center">
            <Kicker>Staff only</Kicker>
            <h1 className="display mt-4 text-4xl">Admin sign in</h1>
            <p className="mt-3 text-sm text-muted">
              Manage events, careers, tickets and applications.
            </p>
          </div>

          <form action={adminLogin} className="card mt-8 space-y-3 p-6">
            {message ? (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {message}
              </p>
            ) : null}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                Username
              </label>
              <input
                name="username"
                autoComplete="username"
                className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                Password
              </label>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm outline-none focus:border-accent"
              />
            </div>
            <button className="btn btn-accent w-full">Sign in</button>
          </form>
        </div>
      </div>
    </div>
  );
}
