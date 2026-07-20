import Link from "next/link";

/**
 * A link that is a next/link for same-host paths and a plain <a> for cross-host ones.
 *
 * /company lives on the main site and a partner's public site on its own subdomain -
 * both are absolute URLs to a DIFFERENT origin, and next/link would try to
 * client-navigate them, which does not work across hosts.
 *
 * Lifted out of app/hub/page.tsx so the area card, the attention chips and the
 * activity feed all make the same decision. They each carry `external` from the
 * same data, and three copies of this would be three chances to forget it.
 */
export function HubAnchor({
  href,
  external,
  className,
  children,
}: {
  href: string;
  external?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
