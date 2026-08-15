import type { RepoPost } from "../post";
// The invite comes from the site record, not from a string typed into this post. An invite
// that lives in two places is an invite that gets regenerated in one of them - and a dead
// link in a published post is not something anybody goes back and checks.
import { site } from "@/lib/site";

// Where the shows are going next: arenas and festivals.
//
// In the repo rather than the Studio because it is a claims-heavy post about
// machinery that exists. Every capability it names is in SEATING.md and in the
// schema - SeatMode.SECTION and .SEAT, VenueMap, PurchaseIntent holds,
// Event.presale, the /api/v1 door - and the two things it says are NOT built are
// as checkable as the rest. If somebody changes the seating model, this post is
// in the blast radius and belongs in the same diff.
//
// The discipline is the one /services already follows: nothing aspirational
// stated as shipped, no dates, and no attendance figures. A number in a post is
// a number nobody will remember to update.

const EXCERPT =
  "We have spent a year building the box office for shows bigger than the ones we have run. Seated rooms, sectioned fields, holds that survive a thousand people pressing the same button. Here is what is already standing, and what still is not.";

// Markdown. Rendered by components/prose.tsx - headings, bold, links, lists,
// quotes, code and GFM tables all work; raw HTML deliberately does not, so do
// not reach for a <div> here. Blank lines separate paragraphs.
const BODY = `There is a size of show where the hard part stops being the show.

Up to a point, running a night inside Roblox is a production problem: build the
venue, light it, get the set right, get people in the room. We are good at that
part. But somewhere past a full room, the production stops being the thing that
breaks. What breaks is the door - who is allowed in, where they stand, what
happens when four times the capacity arrives at once, and whether the answer to
any of that survives contact with a few thousand people pressing the same button
in the same second.

That is the problem we have spent this year on. Not the stage. The box office
behind it.

## What changes when a room gets big

Three things, and they are not the things people expect.

**Capacity stops being a number and becomes geography.** For a normal show,
capacity is one integer and the door either lets you in or does not. For an arena
it is a map: a pit that holds one amount, a balcony that holds another, gates
that fill at different rates. "Sold out" is no longer one fact - it is true of
section C and false of section H, and a ticket has to know which one it is for.

**One door becomes many.** A single check-in queue is fine for a few hundred
people. It is not fine when the crowd arrives in one burst, which is exactly what
happens with a scheduled start time and a countdown everybody is watching.

**A line-up becomes a schedule.** One set at one time is a show. Six sets across
two stages is a festival, and that is a different object - one with a shape our
event model does not have yet. More on that below, because it is the honest gap.

## What is already standing

None of the following is a plan. It is built, it is in the codebase, and most of
it has been run against a real database at real concurrency.

**You can draw the room.** There is a venue designer: sections as rectangles,
polygons or ellipses, dragged and resized, each one assigned to a ticket tier.
The map is saved as a layout and attached to a show.

**Two ways to sell a big room.** A show can be general admission, exactly as
every show has been. Or it can be *sectioned* - you buy an area, the area has its
own cap, and that is the whole transaction. Standing pits, gates, a tier of the
balcony. That is the festival shape. Or it can be *seated* - row K, seat 12,
picked off a map. That is the arena shape.

**The seat you picked is actually held.** Choosing a seat takes a real hold for
ten minutes while you check out, and the hold is enforced under a row lock rather
than by hoping. We have run a dozen people at the same chair simultaneously:
exactly one wins, nobody gets sold a seat twice, and the losers are routed to
another seat instead of being bounced with an error. That test exists because the
alternative - finding out on the night - is not a test, it is an incident.

**The door knows where you are meant to be.** A ticket carries its section and
seat, draws its own map, and the in-experience check-in says the same thing the
ticket does. Nobody is standing at a barrier comparing two screenshots.

**Your own game server can run the booth.** The whole hold-allocate-settle path
is on the API, so an experience can operate its own ticket window - hold a place,
take the action, settle the receipt - without us writing a line of Luau for it.
That is what makes a big show possible without every attendee having to leave the
game to sort themselves out.

**Announce before you sell.** A show can be published and completely
public - page, line-up, artwork, countdown - with tickets deliberately not yet on
sale. Presale exists as its own state precisely because "the announcement" and
"the on-sale" are two different moments, and cramming them into one is how you
end up announcing at three in the morning because that is when the tickets were
ready.

And the boring, load-bearing things are all still there: a VIP list, a blacklist
with an append-only history of who changed what, API keys scoped to one
organisation and revocable by the people who hold them.

## What is not built, and we are not going to pretend otherwise

**A festival is not yet one object.** Right now a show has a start time, a door
time and an end time. That describes a set; it does not describe two stages and a
running order across a weekend. You can absolutely run a festival today by
creating each set as its own show - and that works, and it is what we would do
this month - but the schedule lives in a graphic rather than in the system, which
means nothing can be clever about it. Making the line-up a real object is the
next substantial piece of work.

**Roblox still decides how many people fit in one place.** Server capacity is a
platform constraint and no amount of ticketing solves it. A genuinely large
audience gets split across instances, and splitting an audience is a design
decision about the show - a main room and overflow rooms, or a synchronised
broadcast, or something better - not something the box office can quietly fix
underneath you. We would rather say that plainly than sell a room we cannot fill.

## Two things that are not changing

**Tickets stay free, and stay tied to your account.** Everything above is about
making a bigger room work, not about finding somebody to charge for it. There is
no ticket on this platform you pay for, and the paid rails that exist in the code
are switched off at three separate keys.

**We are not building a queue simulator.** The point of all of this is that
turning up should be boring - you have a ticket, the ticket says where you go, the
door agrees, and you get to watch the show. If any of this becomes visible to the
person attending, it has failed.

## If you are running something big

We would rather build this against real shows than in the abstract, and that
includes other people's. If you are planning something at this scale - your own
group, your own audience - [tell us what you are planning](/services), or come and
argue about it with us in the
[Discord](${site.socials.discord}).

The stage is the easy part. Come and use the rest of it.`;

export const scalePost: RepoPost = {
  slug: "arena-shows-and-festivals",
  title: "Bigger rooms: arena shows and festivals, and what we built for them",
  cover: "/brand/blog/scale-cover.png",
  excerpt: EXCERPT,
  body: BODY,
};
