/**
 * Write the "deck" announcement into the blog.
 *
 *   docker compose exec web npm run blog:deck            # creates/updates a DRAFT
 *   docker compose exec web npm run blog:deck -- --publish
 *
 * ---- Why a script and not just typing it into the Studio -------------------
 *
 * /company/blog is the day-to-day tool and stays the day-to-day tool. This post
 * is a one-off exception for one reason: it is the launch note for a product on
 * ANOTHER host, and the body is full of URLs, feature names and limits that have
 * to agree with what deck.ronation.live actually says. Keeping it in the repo
 * next to src/app/deck/page.tsx means the two are reviewed together and drift
 * shows up in a diff rather than in a reader's face.
 *
 * ---- It writes a DRAFT ------------------------------------------------------
 *
 * Deliberately, and this is the whole reason it takes a flag. prisma/seed.ts was
 * deleted because it republished content nobody had chosen to publish, every
 * time a container booted (see scripts/grant-partner-owner.ts for the rest of
 * that story). Running this puts the post in the Studio, in draft, where a human
 * reads it and presses the button. `--publish` exists for when that human is the
 * one at the terminal.
 *
 * Idempotent, and careful about it: re-running never resets an ARCHIVED post to
 * DRAFT, and never re-stamps publishedAt on a post that is already live. The
 * body and the title are refreshed on every run, which is the point of keeping
 * the copy here.
 */

import { PrismaClient, PostStatus } from "@prisma/client";

const prisma = new PrismaClient();

const SLUG = "deck-the-dj-rig";
const TITLE = "deck: we built a DJ rig that lives in Discord";
const COVER = "/brand/brandassets/deckCover.png";
const AUTHOR = "RO. Nation LIVE";

const EXCERPT =
  "Two decks, a real mixer, effects and sample pads, on a control surface in your browser and streamed straight into a voice channel. It is called deck, it runs at deck.ronation.live, and access is going out in batches.";

// Markdown. Rendered by components/prose.tsx - headings, bold, links, lists,
// quotes, code and GFM tables all work; raw HTML deliberately does not, so do
// not reach for a <div> here. Blank lines separate paragraphs.
const BODY = `Every show we run ends the same way: somebody wants to play music in the
Discord afterwards, and what they get is a bot that takes a link, plays the file,
and stops. Which is fine, in the way a vending machine is fine. It is not
DJing — there is one source, no mixer, and nothing between the track and the
room except a volume slider.

So we built the other thing. It is called **deck**, it lives at
[deck.ronation.live](https://deck.ronation.live/home), and it is a DJ rig you
drive from your browser while the room hears it in a voice channel.

## It is a desk, not a playlist

Two decks, each with a waveform you can click into, a cue point, loop in and out
with halve and double, and a turntable-style pitch fader that runs from half
speed to double — with the pitch following the speed, the way a record does.

Between them sits an actual mixer. Per channel: trim, a three-band isolator EQ,
a single-knob filter that sweeps low-pass through high-pass, pan, mute, and a
fader with peak metering. The isolator **cuts**. Take a band to the bottom and it
is gone, not quieter — which is the entire reason to have one instead of a
regular EQ, and the thing most software gets politely wrong.

Then a crossfader with a blend-to-cut curve, a master fader, and a brickwall
limiter with gain-reduction metering behind it so an enthusiastic mix arrives at
the room loud rather than broken.

## The bits that make it fun

**Effects.** One send effect at a time — tape echo, a Schroeder reverb, or a
flanger — on a bus both decks feed post-fader. You can set the time in beats off
whichever deck is playing, and it follows that deck's pitch fader. Sends being
post-fader means pulling a channel down takes its tail with it; the wet return
is deliberately *not* crossfaded, because an echo thrown at the end of a track
has to survive the fade out of it.

**Sample pads.** Eight slots for stings and drops, each one-shot, loop or hold,
with their own bus level and an auto-duck that pulls the decks down under a pad
hit so the drop lands on top of the music instead of underneath it.

**Your own hardware.** If you own a MIDI controller, map it onto anything on the
console over Web MIDI — with pickup, jump and endless-encoder modes, because a
physical fader that teleports the virtual one is worse than no fader at all.

**A console you arrange.** The whole thing is a grid. Tools drag in from a tray,
move by their handle, size by their edges, snap, and never overlap. Your layout
lives in your browser rather than on the server, because two operators on two
screens want different consoles and tidying yours mid-set should not move
anybody else's furniture.

## One pair of hands

The part we are actually pleased with is the boring part: any number of DJs can
be signed in at once, and exactly one of them is holding the decks.

Everyone else watches the live console — faders moving, waveforms running, meters
bouncing — and queues up. Control hands over when the holder releases it, passes
it to somebody directly, disconnects (after a grace period, so a page refresh
does not cost you your set), or goes idle while somebody is waiting. Admins can
force-take when someone has clearly walked away.

And it is not a convention the interface politely follows. Every command — from
the web console and from the \`/dj\` slash commands alike — goes through one
server-side path where it is schema-validated and permission-checked. You cannot
step around the lock by talking to the socket directly, which we know because
that was the first thing we tried.

## What it will not do

Three things, and we would rather you read them here than find them out on your
first set:

- **It will not beatmatch for you.** BPM is a field you type. Matching tempo is
  done by ear, on the pitch fader.
- **There is no true headphone cue.** Discord gets one bus, so pre-listening
  happens locally in your own browser and is not sample-accurate against the live
  mix. It is enough to audition a track without it going to air, which is what it
  is for.
- **It is one rig per server.** A single guild, a single voice connection, one set
  of decks. Two rooms at once is not a setting.

## Getting on it

Access is not self-served. It is one rig, and a rig with fifty people queueing
for the decks is not a rig anybody gets to use — so names go down and get opened
up a handful at a time.

Put yours down at
[deck.ronation.live/home/access](https://deck.ronation.live/home/access). There
is a [help centre](https://deck.ronation.live/home/help) if you want to read the
manual first, and [a page on this site](/deck) with the shorter version of
everything above.

One thing worth saying plainly: deck signs in with **Discord**, not Roblox. It is
a separate service on its own host — your RO. Nation LIVE account and your
tickets have nothing to do with it, and it cannot see them.

Come and break it. Tell us what falls over.`;

async function main() {
  const publish = process.argv.slice(2).includes("--publish");

  // partnerId null = RNL's own blog. A partner's posts live on the partner's
  // own host, and the unique index is [partnerId, slug] - so this is not
  // decoration, it is half of the key.
  const existing = await prisma.post.findFirst({
    where: { partnerId: null, slug: SLUG },
  });

  // Status is a floor, never a reset. Somebody who archived this post did that
  // on purpose, and a re-run to fix a typo in the body must not quietly put it
  // back on the site.
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
    title: TITLE,
    excerpt: EXCERPT,
    coverUrl: COVER,
    body: BODY,
    status,
    publishedAt,
    authorName: AUTHOR,
  };

  if (existing) {
    await prisma.post.update({ where: { id: existing.id }, data });
  } else {
    await prisma.post.create({
      data: { partnerId: null, slug: SLUG, ...data },
    });
  }

  console.log(`\n✓ "${TITLE}"`);
  console.log(`  ${existing ? "updated" : "created"} · status ${status}`);

  if (status === PostStatus.PUBLISHED) {
    console.log(`  Live at /blog/${SLUG}\n`);
  } else {
    console.log(`  Draft. Read it and publish it at /company/blog\n`);
    console.log(`  (or re-run with --publish if you have already read it)\n`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
