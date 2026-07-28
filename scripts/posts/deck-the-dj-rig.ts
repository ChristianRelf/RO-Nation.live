import type { RepoPost } from "../post";

// The deck launch note.
//
// In the repo rather than the Studio because every claim in it is checkable
// against RNL_DJ_BOT and against src/app/deck/page.tsx - the feature names, the
// three known limits, the fact that access goes out in batches. When one of
// those changes, this is in the blast radius and belongs in the same diff.
// See scripts/posts/index.ts for the bar, and scripts/post.ts to write it.

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

export const deckPost: RepoPost = {
  slug: "deck-the-dj-rig",
  title: "deck: we built a DJ rig that lives in Discord",
  cover: "/brand/brandassets/deckCover.png",
  excerpt: EXCERPT,
  body: BODY,
};
