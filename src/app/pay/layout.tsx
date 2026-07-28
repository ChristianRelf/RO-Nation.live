import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { default: "Payments", template: "%s · Payments" },
  // Nothing on this host is public. Even /access - which an anonymous visitor never
  // reaches, because the middleware's sign-in gate catches them first - is about one
  // person's relationship with RNL and has no business in an index.
  robots: { index: false, follow: false },
};

/**
 * The outermost segment of pay.ronation.live.
 *
 * Metadata only, and NO GUARD - deliberately. The guarded pages live in the (app) group
 * below this, which has its own layout; /access sits outside that group precisely so it
 * can be reached by somebody the guard has just turned away. A guard here would redirect
 * /access to /access, which is a loop with no way out and no error message to explain it.
 */
export default function PayLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
