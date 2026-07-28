/**
 * Write a repo-authored blog post into the database.
 *
 *   docker compose exec web npm run blog -- <slug>            # creates/updates a DRAFT
 *   docker compose exec web npm run blog -- <slug> --publish
 *   docker compose exec web npm run blog                      # lists what is available
 *
 * ---- Why any post lives in the repo at all ---------------------------------
 *
 * /company/blog is the day-to-day tool and stays it. The exception this exists
 * for is a post whose text can be falsified by code: the deck launch note names
 * features and limits that must match deck.ronation.live, and the scale post
 * describes seating, holds and the door API as they actually work. Keeping those
 * two in the tree means a change to the thing they describe shows up in the same
 * diff, rather than in a reader's face six weeks later.
 *
 * See scripts/posts/index.ts for the bar an entry has to clear.
 *
 * ---- It writes a DRAFT ------------------------------------------------------
 *
 * Deliberately, and that is the whole reason it takes a flag. prisma/seed.ts was
 * deleted because it republished content nobody had chosen to publish, every
 * time a container booted (see scripts/grant-partner-owner.ts for the rest of
 * that story). Running this puts the post in the Studio, in draft, where a human
 * reads it and presses the button. `--publish` exists for when that human is the
 * one at the terminal.
 *
 * Idempotent, and careful about it: re-running never resets an ARCHIVED post to
 * DRAFT, and never re-stamps publishedAt on a post that is already live. The
 * title, excerpt, cover and body ARE refreshed every run - that is the point of
 * keeping the copy here.
 */

import { PrismaClient, PostStatus } from "@prisma/client";

/** One post, as authored in scripts/posts/. Markdown body, rendered by Prose. */
export type RepoPost = {
  slug: string;
  title: string;
  excerpt: string;
  /** Site-relative path under public/. */
  cover: string;
  body: string;
  authorName?: string;
};

const prisma = new PrismaClient();

const DEFAULT_AUTHOR = "RO. Nation LIVE";

function usage(POSTS: Record<string, RepoPost>, message?: string): never {
  if (message) console.error(`\n✗ ${message}`);
  console.error("\n  Usage: npm run blog -- <slug> [--publish]\n");
  console.error("  Posts in this repo:");
  for (const p of Object.values(POSTS)) {
    console.error(`    ${p.slug.padEnd(28)} ${p.title}`);
  }
  console.error("");
  process.exit(message ? 1 : 0);
}

async function main() {
  // Imported here rather than at the top so the registry's own imports are not
  // pulled in before the Prisma client is constructed - and so a syntax error in
  // one post reports against this file's usage text rather than a bare stack.
  const { POSTS } = await import("./posts/index");

  const args = process.argv.slice(2);
  const publish = args.includes("--publish");
  const slug = args.find((a) => !a.startsWith("--"));

  if (!slug) usage(POSTS);

  const post = POSTS[slug];
  if (!post) usage(POSTS, `"${slug}" is not a post in this repo.`);

  // partnerId null = RNL's own blog. A partner's posts live on the partner's own
  // host, and the unique index is [partnerId, slug] - so this is not decoration,
  // it is half of the key.
  const existing = await prisma.post.findFirst({
    where: { partnerId: null, slug: post.slug },
  });

  // Status is a floor, never a reset. Somebody who archived this post did that on
  // purpose, and a re-run to fix a typo in the body must not quietly put it back
  // on the site.
  const status = existing
    ? publish && existing.status === PostStatus.DRAFT
      ? PostStatus.PUBLISHED
      : existing.status
    : publish
      ? PostStatus.PUBLISHED
      : PostStatus.DRAFT;

  // Stamped the first time it goes live and never again - the same rule the
  // Studio follows. Re-running this on a live post must not move it back to the
  // top of the blog.
  const publishedAt =
    status === PostStatus.PUBLISHED
      ? (existing?.publishedAt ?? new Date())
      : existing?.publishedAt;

  const data = {
    title: post.title,
    excerpt: post.excerpt,
    coverUrl: post.cover,
    body: post.body,
    status,
    publishedAt,
    authorName: post.authorName ?? DEFAULT_AUTHOR,
  };

  if (existing) {
    await prisma.post.update({ where: { id: existing.id }, data });
  } else {
    await prisma.post.create({
      data: { partnerId: null, slug: post.slug, ...data },
    });
  }

  console.log(`\n✓ "${post.title}"`);
  console.log(`  ${existing ? "updated" : "created"} · status ${status}`);

  if (status === PostStatus.PUBLISHED) {
    console.log(`  Live at /blog/${post.slug}\n`);
  } else {
    console.log(`  Draft. Read it and publish it at /company/blog`);
    console.log(`  (or re-run with --publish if you have already read it)\n`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
