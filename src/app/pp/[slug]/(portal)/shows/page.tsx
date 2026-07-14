import { permanentRedirect } from "next/navigation";
import { partnerPortalPath } from "@/lib/partners/urls";

// /<slug>/shows moved into the studio, at /<slug>/studio/events.
//
// Kept as a redirect rather than deleted: this was the partner portal's only
// authoring page for its whole life, so it is in bookmarks and in every link
// anyone has ever sent about a show. It costs one file to not break those.
//
// No guard, deliberately. It reads nothing and renders nothing - it just points
// at the new location, and the page it points at does its own guarding.
export default function ShowsRedirect({
  params,
}: {
  params: { slug: string };
}) {
  permanentRedirect(partnerPortalPath(params.slug, "/studio/events"));
}
