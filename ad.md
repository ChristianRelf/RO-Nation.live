# Discord advertisement copy

Paste-ready ads for RO. Nation LIVE, written for Discord's flavour of markdown.

Each block below is the ad **exactly as it should be sent** - copy the contents of the
code fence, not the fence itself. Pick the one that fits the channel you're posting in.

**House rule for editing these:** every claim here is checkable against something the site
actually does, and there are **no numbers in any of them**. That is deliberate and it
matches `lib/stats.ts` - RNL only prints figures it counts, so an ad with "40+ shows" or
"120K seats" in it is an ad making a claim nothing can back. If you want a number in one of
these, take a real one off `/press` on the day you post it.

---

## 1. The main ad

For a general `#advertise`, `#server-promo` or partner channel. Comes in at roughly 1,400
characters, so it fits a normal 2,000-character Discord message with room to add a line
about a specific show.

```
# RO. NATION LIVE
**Live shows, showcases and tournaments - built inside Roblox.**

We don't drop a logo into a template. Every venue is built for the show it's holding, from the blockout up - stage, lighting, set pieces, the lot - then run live with hosts and a full run-of-show.

## 🎟️ Tickets are free. Properly free.
- One per Roblox account, and tied to that account
- Nothing to screenshot, nothing to sell on, nothing to fake
- Verified at the door **inside the experience**, over an API call the game server makes as you walk in
- Capacity is real and it's enforced - when a show fills up, that's it

## 🛠️ Running your own event?
We produce, build and ticket shows for other groups and creators. You get a show page, a capacity, a door that actually holds, a VIP list and a blacklist, and API keys scoped to your org that you can revoke yourself. Partners get their own branded site and box office on the same platform.

## 🎧 Want to be on the crew?
Builders, hosts, media, production. Most roles start as volunteer - the best move into paid production work.

## Come and find us
🌐 https://ronation.live
💬 https://discord.gg/ronationlive
🎮 https://www.roblox.com/communities/33033115/RoNation-Live
📩 hello@ronation.live

-# Shows drop in the Discord first. Capacity is finite - that isn't a marketing line, it's the door.
```

---

## 2. The short one

For cramped ad channels with a character cap, or where a wall of text gets deleted. About
480 characters.

```
## 🎤 RO. NATION LIVE - live Roblox shows, done properly
Custom-built venues, real production, and **free tickets** tied to your Roblox account - verified at the door inside the experience. No screenshots, no resale, no queue-jumping. Capacity is real, and the Discord gets the drop first.

Shows, crew spots and partnerships 👉 https://discord.gg/ronationlive
🌐 https://ronation.live
```

---

## 3. The one-liner

For a server bio, a partner list, or a `#partners` embed field.

```
**RO. Nation LIVE** - live shows, showcases and tournaments inside Roblox. Custom-built venues, free tickets tied to your account, and a door that actually holds. https://ronation.live
```

---

## 4. Crew recruitment

For `#hiring`, `#looking-for-work`, or Roblox dev/builder servers. Keep this one honest
about pay - it matches what `/careers` says, and overpromising here is how you lose people
in week two.

```
## 🎧 RO. Nation LIVE is looking for crew
We build and run live shows inside Roblox - custom venues from the blockout up, real production, hosts, and ticketing that holds at the door.

We're after reliable, creative people:
- **Builders** - venues, stages, set pieces
- **Hosts & production** - running the show on the night
- **Media** - capture, edits, graphics

Most roles start as **volunteer**, and the best move into paid production work. We'll say which is which up front, in writing, before you do any work.

Open roles 👉 https://ronation.live/careers
Come and talk to us 👉 https://discord.gg/ronationlive
```

---

## 5. For event organisers and partners

For `#partnerships`, or a DM to a group that runs its own shows. This is the one that leads
with what they get rather than what we do.

```
## 🛠️ Run your show with RO. Nation LIVE
You bring the show. We build the room and hold the door.

- **A venue built for it**, from the blockout up - not a template with your logo in it
- **A show page with real capacity**, and free tickets tied to Roblox accounts
- **A door that holds** - tickets verified in-experience over our API as people walk in, plus a manual check-in page for when it matters
- **A VIP list and a blacklist**, with an append-only history of who changed what
- **Your own API keys**, scoped to your org and revocable by you
- **Your own branded site and box office** on the same platform
- **The numbers afterwards** - who reserved, and who actually turned up

Nobody pays us in Robux for a ticket: every ticket on the platform is free today, so there's no payment flow to have to trust us with.

Tell us what you're planning 👉 https://ronation.live/contact
💬 https://discord.gg/ronationlive
```

---

## Posting notes

- **Character limit.** 2,000 per message without Nitro. Ad 1 leaves headroom; if you add a
  show name and date, check it still sends before you post it in twenty servers.
- **Headers and subtext.** `#`, `##`, `###` and `-#` (small text) all render in ordinary
  messages. `-#` is doing real work at the bottom of ad 1 - don't drop it for a plain line.
- **Link previews.** Discord will embed the first link and make the message tall. To stop
  that, wrap the URL in angle brackets: `<https://ronation.live>`. Worth doing when you're
  posting several links at once.
- **Masked links.** `[text](url)` renders on current clients, but not everywhere and not in
  every context - these ads use raw URLs on purpose so they can't render as bare text with
  the destination hidden.
- **The Roblox group link** is trimmed to
  `https://www.roblox.com/communities/33033115/RoNation-Live` - the `#!/about` fragment the
  site uses is unnecessary here and looks like a typo in a chat message.
- **Adding a show.** Put it directly under the first bold line of ad 1, like:
  `> 🔴 Next up: **<show name>** - <date>. Reserve free: https://ronation.live/events`
- **Keep it in step.** If the ticketing model ever changes - paid tiers switching on is the
  obvious one - "free" appears in four of these five ads and every one of them has to move
  in the same commit as the code.
