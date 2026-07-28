import type { RepoPost } from "../post";
import { deckPost } from "./deck-the-dj-rig";
import { scalePost } from "./arena-shows-and-festivals";

/**
 * The blog posts that live in this repo, keyed by slug.
 *
 * A CODE REGISTRY, the same shape as LEGAL_DOCS in src/lib/legal.ts and for a
 * near-identical reason: these are the posts whose text has to agree with
 * something else in the tree, so they are reviewed in a diff alongside it.
 *
 * ---- Almost every post does NOT belong here --------------------------------
 *
 * /company/blog is the tool. A show recap, an announcement, a note about the
 * weekend - all of that is typed into the Studio by whoever is writing it, and
 * putting it in the repo instead would mean a deploy to fix a typo.
 *
 * The bar for adding an entry is: does this post make a CLAIM that code can
 * falsify? The deck launch note names features and limits that must match
 * deck.ronation.live; the scale post describes seating, holds and the door API
 * as they actually are. When somebody changes those, the post is in the blast
 * radius, and it should be in the same pull request.
 */
export const POSTS: Record<string, RepoPost> = {
  [deckPost.slug]: deckPost,
  [scalePost.slug]: scalePost,
};
