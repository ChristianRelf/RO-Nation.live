import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { Kicker, SectionHeading } from "@/components/ui";
import { absoluteUrl } from "@/lib/url";
import { site } from "@/lib/site";

// deck - the DJ rig, on ronation.live.
//
// ---- Why this page exists here and not only on deck.ronation.live --------
//
// deck runs on its own host, its own container and its own database; it is a
// Discord bot with a React control surface, and it shares nothing with this
// codebase but a brand. It already has a product page of its own at
// deck.ronation.live/home, written for somebody who has landed there.
//
// This is the other half: the page for somebody who is HERE - reading the blog,
// looking at events, working out what RNL actually is - and has never heard of
// it. Nothing on ronation.live pointed at it, which meant the only way to find
// deck was to already know the hostname.
//
// So this page has one job: explain what the thing is, be honest about the fact
// that access is granted in batches rather than self-served, and hand the
// visitor over to the host that actually runs it. It is deliberately NOT a
// second copy of that site's marketing - when the two disagree, the one on the
// deck host wins, because it ships with the product.
//
// ---- Every claim here is checkable against the rig ------------------------
//
// Same discipline as /services: nothing aspirational. The isolator really does
// cut rather than dip, the effect time really does follow the pitch fader, the
// control lock really is enforced server-side in Engine.execute, and pre-listen
// really is local-only. The three items under "What it will not do" are the
// known limits from the project's own README, kept on the page rather than
// discovered after somebody has been granted access.
//
// ---- Links are plain <a>, not <Link> --------------------------------------
//
// Every destination is an absolute URL on another host. A next/link <Link> would
// prefetch an RSC payload for a route that does not exist in this app; a plain
// anchor is the navigation that was always going to happen. Same reasoning as
// the hardNav flag on /merch in lib/site.ts, arrived at from the other side.

const DECK = "https://deck.ronation.live";

export const metadata: Metadata = {
  title: "deck - the DJ rig",
  description:
    "deck is RO. Nation LIVE's DJ rig for Discord: two decks, a real mixer, effects and sample pads on a browser control surface, streamed live into a voice channel. Access is granted in batches.",
  alternates: { canonical: "/deck" },
  openGraph: {
    title: "deck - the DJ rig",
    description:
      "Two decks, a real mixer, effects and sample pads - streamed live into a Discord voice channel.",
    url: "/deck",
    images: [absoluteUrl("/brand/brandassets/deckCover.png")],
  },
};

// The console, top to bottom. Ordered the way a DJ meets it: the thing that
// makes noise, the thing that shapes it, the thing that decorates it, then the
// plumbing that keeps a set moving.
const console_ = [
  {
    title: "Two decks",
    body: "Waveform overview with click-to-seek, cue point, loop in and out with halve and double, and a turntable-style pitch fader from half speed to double. Pitch follows speed, the way a record does.",
  },
  {
    title: "A mixer that actually cuts",
    body: "Per channel: trim, three-band isolator EQ, a single-knob low-pass/high-pass filter, pan, mute and a fader with peak metering. A full cut on the isolator is a real kill, not a dip - which is the whole point of one.",
  },
  {
    title: "Crossfader and master",
    body: "A blend-to-cut crossfade curve, master fader, clip indication, and a brickwall limiter with gain-reduction metering behind it. Balance and a mono fold-down are there when a room needs them.",
  },
  {
    title: "One send effect, done properly",
    body: "Tape echo, Schroeder reverb or flanger, on a bus both decks feed post-fader. Time can be set in beats off whichever deck is playing, and it follows that deck's pitch fader.",
  },
  {
    title: "Eight sample pads",
    body: "Stings and drops, each one-shot, loop or hold, with their own bus level and an auto-duck that pulls the decks down under a pad hit so the drop lands on top rather than underneath.",
  },
  {
    title: "Your own hardware",
    body: "Map a MIDI controller onto anything on the console over Web MIDI, with pickup, jump and endless-encoder modes. Mappings live in your browser, and go out as ordinary commands - so the control lock still applies to them.",
  },
  {
    title: "A shared queue",
    body: "Anyone signed in can add to what plays next without holding the decks. Loading, reordering and clearing need control. Auto mode loads and plays the next track whenever a deck runs out.",
  },
  {
    title: "A media pool",
    body: "Drag-and-drop upload with rename, tags and BPM. Anything ffmpeg can read is accepted and decoded once, at upload. Drag a track straight onto a deck or a pad.",
  },
  {
    title: "Commands from Discord",
    body: "/dj panel, /dj now, /dj summon and /dj leave, for the times somebody just needs the bot in a channel and does not want to open a console to do it.",
  },
];

// How a set actually runs. Five steps, same shape as /services - it is the
// question everybody asks second, after "what is it".
const run = [
  {
    step: "01",
    title: "Sign in",
    body: "Discord OAuth2. Membership and roles are verified server-side with a bot token, so the gate cannot be faked by the browser asking nicely.",
  },
  {
    step: "02",
    title: "Take control",
    body: "One person drives at a time. Everyone else watches the live state - faders, waveforms, meters - and queues up for their turn.",
  },
  {
    step: "03",
    title: "Load and cue",
    body: "Pull a track out of the pool onto a deck. Pre-listen in your own headphones without it going to air, set a cue, find the loop.",
  },
  {
    step: "04",
    title: "Go live",
    body: "Pick a voice channel and the bot joins it. From there the room hears the master bus - and it is the mix, not a file being played back.",
  },
  {
    step: "05",
    title: "Hand over",
    body: "Release the decks and the next DJ in the queue takes them. Control also hands over on disconnect or on idling out while somebody is waiting, so a set never stalls on someone who closed their laptop.",
  },
];

export default function DeckPage() {
  return (
    <div className="relative">
      <div className="accent-glow pointer-events-none absolute inset-x-0 top-0 h-64" />

      {/* ---- HERO ---- */}
      <div className="shell relative pt-16 sm:pt-20">
        <Kicker>Another thing we built</Kicker>

        {/* The wordmark IS the product name - it is lowercase, and setting it in
            Anton as an <h1> would be a different logo. So the mark does the
            headline's job and carries the accessible name; the <h1> underneath
            says what it is. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/brandassets/deckLogo.png"
          alt="deck"
          width={1747}
          height={798}
          className="mt-6 h-16 w-auto sm:h-20 md:h-24"
        />

        <h1 className="display mt-6 text-4xl sm:text-5xl md:text-6xl">
          A DJ rig
          <br />
          that lives in Discord.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          Two decks, a real mixer, effects and sample pads - on a control surface
          in your browser, streamed straight into a voice channel. Any number of
          DJs signed in, one pair of hands on the decks.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <a href={`${DECK}/home/access`} className="btn btn-accent">
            Request access
          </a>
          <a href={`${DECK}/home`} className="btn btn-ghost">
            deck.ronation.live
          </a>
        </div>
      </div>

      {/* ---- THE CONSOLE ---- */}
      <section className="shell py-20">
        <SectionHeading
          kicker="What you get"
          title={
            <>
              It is a desk,
              <br className="hidden sm:block" /> not a playlist.
            </>
          }
        />
        <p className="mt-5 max-w-2xl text-muted">
          Most music bots take a link and play it. This one gives you the
          equipment: two sources, a mixer between them, and everything you would
          reach for mid-set within a keystroke.
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {console_.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 55}>
              <div className="card h-full p-7">
                <h3 className="font-display text-xl">{f.title}</h3>
                <p className="mt-3 text-muted">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <p className="mt-8 max-w-2xl text-sm text-faint">
          The console is a grid you arrange yourself - tools dragged in from a
          tray, moved and sized, snapped and never overlapping. The layout lives
          in your browser, not on the server: two operators on two screens want
          different consoles, and tidying yours mid-set should not move anybody
          else&apos;s furniture.
        </p>
      </section>

      {/* ---- HOW A SET RUNS ---- */}
      <section className="border-y border-line bg-elev">
        <div className="shell py-20">
          <SectionHeading kicker="How it goes" title={<>Sign in to hand over.</>} />
          <div className="mt-10 divide-y divide-line border-y border-line">
            {run.map((p, i) => (
              <Reveal key={p.step} delay={i * 55}>
                <div className="grid gap-4 py-7 md:grid-cols-[6rem_14rem_1fr] md:items-baseline">
                  <span className="font-display text-4xl text-accent">
                    {p.step}
                  </span>
                  <h3 className="font-display text-2xl">{p.title}</h3>
                  <p className="text-muted">{p.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---- THE CONTROL LOCK ---- */}
      {/* The one feature worth a section of its own. Everything else on this page
          is a control; this is the reason more than one person can use the rig
          without it becoming a fight. */}
      <section className="shell py-20">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <SectionHeading
              kicker="The part that makes it a crew tool"
              title="One pair of hands"
            />
            <p className="mt-6 text-muted">
              Everyone signed in sees the same live console - the faders moving,
              the waveforms running, the meters. Exactly one person is holding it.
              The rest queue up, and control hands over when the holder releases
              it, passes it to somebody directly, disconnects, or goes idle while
              someone is waiting.
            </p>
            <p className="mt-4 text-muted">
              It is not a convention the interface politely follows. Every command
              - from the web console and from the slash commands alike - goes
              through one server-side path where it is schema-validated and
              permission-checked, so the lock cannot be stepped around by talking
              to the socket directly.
            </p>
          </div>

          <div className="card p-8">
            <h3 className="font-display text-2xl">Also true</h3>
            <ul className="mt-5 space-y-3 text-muted">
              {[
                "A refresh does not cost you the decks - there is a disconnect grace period",
                "Admins can force-take when somebody has walked away mid-set",
                "Pre-listen is local to your browser; it never goes to air",
                "The account the room hears can be swapped without a restart",
                "Bot tokens are encrypted at rest and never sent back to a browser",
                "Your MIDI mappings and your console layout are yours, not the server's",
              ].map((l) => (
                <li key={l} className="flex gap-3">
                  <span className="text-accent">✦</span>
                  {l}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ---- UNDER IT ---- */}
      <section className="border-y border-line bg-elev">
        <div className="shell py-20">
          <SectionHeading
            kicker="Under it"
            title={<>The mix is rendered, not replayed.</>}
          />
          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <div className="space-y-4 text-muted">
              <p>
                Uploads are decoded once, at upload time, into exactly the format
                the Opus encoder wants. Nothing on the realtime path touches a
                codec, and seeking is a byte offset rather than a re-decode.
              </p>
              <p>
                The mix graph renders in twenty-millisecond blocks - one Opus
                frame. Each deck resamples for pitch, runs its isolator and filter,
                applies its fader and pan; the mixer sums both through the
                crossfader, adds the pad bus and the effects return, then master
                gain, the limiter and a soft clipper behind it.
              </p>
            </div>
            <div className="space-y-4 text-muted">
              <p>
                Rendering is pulled by the voice player, so Discord&apos;s own
                packet cadence clocks the mix and no buffer can drift. When the bot
                is not in a channel a local timer takes over, so deck positions stay
                truthful while you cue up.
              </p>
              <p>
                Effect sends are taken post-fader, so pulling a channel down takes
                its tail with it - and the wet return is deliberately not
                crossfaded, because an echo thrown at the end of a track has to
                survive the fade out of it.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---- LIMITS ---- */}
      {/* On the page, before access rather than after it. A limit somebody finds
          out about on their first set is a complaint; a limit they read here is a
          specification. */}
      <section className="shell py-20">
        <SectionHeading kicker="Before you ask" title="What it will not do" />
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {[
            {
              title: "No beatmatching for you",
              body: "BPM is a field you type. Matching tempo is done by ear, on the pitch fader, like it was before software started doing it.",
            },
            {
              title: "No true headphone cue",
              body: "Discord gets one bus, so pre-listen happens in your own browser. It is not sample-accurate against the live mix.",
            },
            {
              title: "One rig per server",
              body: "A single guild, a single voice connection, one set of decks. Two rooms at once is not a setting - it is a different build.",
            },
          ].map((l, i) => (
            <Reveal key={l.title} delay={i * 55}>
              <div className="card h-full p-7">
                <h3 className="font-display text-xl">{l.title}</h3>
                <p className="mt-3 text-muted">{l.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---- ACCESS ---- */}
      <section className="border-t border-line bg-elev">
        <div className="shell py-20">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
            <div>
              <Kicker>Getting on it</Kicker>
              <h2 className="display mt-4 text-4xl sm:text-5xl">
                Access goes out
                <br />
                in batches.
              </h2>
              <p className="mt-5 max-w-md text-muted">
                It is one rig, and a rig with fifty people queueing for the decks
                is not a rig anybody gets to use. So it is not self-served: you
                put your name down, and it is opened up a handful at a time.
              </p>
              <p className="mt-5 max-w-md text-muted">
                Crew are usually already in. If you are not sure, ask in the{" "}
                <a
                  href={site.socials.discord}
                  target="_blank"
                  rel="noreferrer"
                  className="link-underline text-accent"
                >
                  Discord
                </a>{" "}
                before you fill anything in.
              </p>
            </div>

            <div className="card p-8">
              <div className="flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand/brandassets/deckFavicon.png"
                  alt=""
                  width={690}
                  height={707}
                  className="h-11 w-11 shrink-0"
                />
                <div>
                  <p className="font-display text-xl">deck.ronation.live</p>
                  <p className="text-sm text-faint">
                    Signs in with Discord, not Roblox
                  </p>
                </div>
              </div>

              <div className="mt-7 flex flex-col gap-3">
                <a href={`${DECK}/home/access`} className="btn btn-accent">
                  Put your name down
                </a>
                <a href={`${DECK}/home/help`} className="btn btn-ghost">
                  Read the help centre
                </a>
              </div>

              <p className="mt-6 text-sm text-faint">
                deck is a separate service on its own host. Your RO. Nation LIVE
                account and your tickets have nothing to do with it, and it cannot
                see them.
              </p>
            </div>
          </div>

          <p className="mt-12 text-sm text-faint">
            Curious what else the crew has been building?{" "}
            <Link href="/blog" className="link-underline text-accent">
              The blog
            </Link>{" "}
            has the rest, and{" "}
            <Link href="/services" className="link-underline text-accent">
              /services
            </Link>{" "}
            is what we do for other groups.
          </p>
        </div>
      </section>
    </div>
  );
}
