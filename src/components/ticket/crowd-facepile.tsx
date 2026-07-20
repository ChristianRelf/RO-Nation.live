import { ticketCrowd, crowdFaces, groupCount } from "@/lib/tickets/crowd";

// WHO ELSE IS COMING, as faces rather than a fraction.
//
// The reserve panel already has the inventory bar - "412/2000". This is the other
// half of the same fact, framed the way lib/tickets/crowd.ts argues for: a crowd to
// join, not stock to deplete. Overlapping avatars, then "1,247 going".
//
// ---- The privacy floor -----------------------------------------------------
//
// A face-pile on a show with three holders is not a crowd, it is three named people
// pinned to a public page. So below FACE_FLOOR going, no faces are shown at all -
// just the count if there is one worth saying. Avatars are public Roblox profile
// pictures, but "who is attending this show" is a fact this refuses to reveal one
// person at a time.

/** Below this many going, show the number but never the faces. */
const FACE_FLOOR = 3;

export async function CrowdFacepile({ eventId }: { eventId: string }) {
  // live:false - the "inside right now" count belongs on the ticket during doors,
  // not on a browse page. Here it is only going vs watching.
  const [crowd, faces] = await Promise.all([
    ticketCrowd(eventId, { live: false }),
    crowdFaces(eventId, 8),
  ]);

  // Nobody going and nobody watching: the panel's capacity line says enough, and an
  // empty "0 going" reads as "avoid this show". Say nothing.
  if (crowd.going === 0 && crowd.watching === 0) return null;

  const showFaces = crowd.going >= FACE_FLOOR;
  const pile = showFaces ? faces.slice(0, 5) : [];
  const overflow = crowd.going - pile.length;

  return (
    <div className="mb-4 flex items-center gap-3">
      {pile.length ? (
        <div className="flex -space-x-2">
          {pile.map((f, i) => (
            <Avatar key={i} face={f} />
          ))}
          {overflow > 0 ? (
            <span className="grid h-8 w-8 place-items-center rounded-full border border-line bg-elev text-[10px] font-bold text-muted">
              +{groupCount(overflow)}
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="text-sm leading-tight">
        {crowd.going > 0 ? (
          <p>
            <span className="font-semibold text-fg">{groupCount(crowd.going)}</span>{" "}
            <span className="text-muted">going</span>
          </p>
        ) : null}
        {crowd.watching > 0 ? (
          <p className="text-xs text-faint">{groupCount(crowd.watching)} watching</p>
        ) : null}
      </div>
    </div>
  );
}

function Avatar({ face }: { face: { avatarUrl: string | null; displayName: string } }) {
  if (face.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={face.avatarUrl}
        alt=""
        width={32}
        height={32}
        className="h-8 w-8 rounded-full border border-line bg-elev object-cover"
      />
    );
  }
  return (
    <span className="grid h-8 w-8 place-items-center rounded-full border border-line bg-accent text-xs font-bold text-accent-ink">
      {face.displayName.slice(0, 1).toUpperCase()}
    </span>
  );
}
