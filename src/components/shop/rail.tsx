"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// THE RAIL. A scaffold pole bolted across the page with shirts hanging off it, and
// you shove them along it.
//
// ---- Why this is not a slider library --------------------------------------
//
// The scroller is a native `overflow-x: auto` with `scroll-snap-type: x mandatory`
// and `scroll-snap-stop: always` (see globals.css). That single line of CSS buys, for
// free and before any JavaScript runs: touch momentum (off the main thread, better
// than anything we could write), trackpad and shift-wheel, native keyboard scrolling,
// and the browser's own scroll-focus-into-view when you tab onto a card. With JS
// disabled it degrades to a scrollable strip of shirts, which is still a shop.
//
// Everything below is ENHANCEMENT on top of a thing that already works.
//
// ---- The composition rule (load-bearing) ------------------------------------
//
// A Client Component cannot import a Server Component. So this takes `children`, and
// the server pages compose <Rail><ProductCard/>...</Rail>. ProductCard therefore stays
// a Server Component and is never bundled to the browser - which is the entire reason
// a rail of twelve products costs about a kilobyte of JS instead of the product list.
// `.rail-scroller > *` (the snap alignment) and `--tilt` inheritance both reach the
// children through the DOM, not through props, so nothing is lost.

/** Velocity decay per frame during the glide. */
const FRICTION = 0.94;
/** Below this, the glide has stopped. */
const MIN_V = 0.4;
/** A glide is a flick, not a journey. */
const MAX_GLIDE_MS = 900;
/** Movement past this, in px, means you were dragging - not clicking. */
const DRAG_SLOP = 6;

export function Rail({
  label,
  count,
  children,
  className,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
  className?: string;
}) {
  const scroller = useRef<HTMLUListElement | null>(null);
  const wrap = useRef<HTMLDivElement | null>(null);

  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  // Read once, then subscribe. A user can toggle this mid-session and the rail must
  // notice - a value captured on mount and never refreshed is a bug that only ever
  // shows up in an accessibility audit.
  const still = useRef(false);

  // Layout extents, cached. Read on mount and on resize, never per frame: a
  // scrollWidth read inside a rAF loop forces a synchronous reflow every 16ms, which
  // is precisely the jank this whole design is trying not to have.
  const extent = useRef({ max: 0, card: 260 });

  const raf = useRef(0);
  const drag = useRef({
    active: false,
    id: -1,
    startX: 0,
    lastX: 0,
    startScroll: 0,
    v: 0,
    moved: false,
  });

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const first = el.firstElementChild as HTMLElement | null;
    extent.current = {
      max: el.scrollWidth - el.clientWidth,
      card: first ? first.offsetWidth + 20 : 260,
    };
  }, []);

  /** The progress rule, and the arrow disabled states. Passive, rAF-throttled. */
  const readScroll = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const max = extent.current.max;
    const p = max > 0 ? el.scrollLeft / max : 0;

    // Write a CSS variable rather than setState: this fires on every scroll frame,
    // and a React re-render per frame would be the most expensive thing on the page.
    wrap.current?.style.setProperty("--rail-progress", String(p));

    // These DO go through state, because they change once at each end rather than
    // sixty times a second.
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(max <= 0 || el.scrollLeft >= max - 1);
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    still.current = mq.matches;
    const onMq = (e: MediaQueryListEvent) => {
      still.current = e.matches;
    };
    mq.addEventListener("change", onMq);

    measure();
    readScroll();

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        readScroll();
        ticking = false;
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });

    const ro = new ResizeObserver(() => {
      measure();
      readScroll();
    });
    ro.observe(el);

    return () => {
      mq.removeEventListener("change", onMq);
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
      cancelAnimationFrame(raf.current);
    };
  }, [measure, readScroll]);

  // ---- The shove --------------------------------------------------------
  //
  // MOUSE ONLY, and this is not a nicety. Pointer events fire for touch as well, so a
  // naive `scrollLeft -= dx` here would run ON TOP OF the browser's own native touch
  // scrolling and the rail would move at double speed on every phone in the world.
  // Touch is left entirely to the native scroller, which is better than this code
  // anyway: it runs off the main thread.

  const setTilt = (deg: number) => {
    wrap.current?.style.setProperty("--tilt", `${deg}deg`);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLUListElement>) => {
    if (e.pointerType !== "mouse") return;
    const el = scroller.current;
    if (!el) return;

    cancelAnimationFrame(raf.current);
    drag.current = {
      active: true,
      id: e.pointerId,
      startX: e.clientX,
      lastX: e.clientX,
      startScroll: el.scrollLeft,
      v: 0,
      moved: false,
    };
    el.setPointerCapture(e.pointerId);
    el.classList.add("is-dragging");
  };

  const onPointerMove = (e: React.PointerEvent<HTMLUListElement>) => {
    const d = drag.current;
    const el = scroller.current;
    if (!d.active || !el || e.pointerId !== d.id) return;

    const dx = e.clientX - d.lastX;
    d.lastX = e.clientX;
    d.v = dx;
    if (Math.abs(e.clientX - d.startX) > DRAG_SLOP) d.moved = true;

    el.scrollLeft = d.startScroll - (e.clientX - d.startX);

    // The shirts lag behind your hand. Push the rail left, they trail right.
    //
    // The honest cost: an unregistered custom property inside a transform is a style
    // recalc for the inheriting subtree, not a free composite. That is why it is
    // mouse-only, and why it is off entirely under reduced motion.
    if (!still.current) {
      const tilt = Math.max(-7, Math.min(7, d.v * 0.4));
      setTilt(tilt);
    }
  };

  const endDrag = (e: React.PointerEvent<HTMLUListElement>) => {
    const d = drag.current;
    const el = scroller.current;
    if (!d.active || !el || e.pointerId !== d.id) return;

    d.active = false;
    el.releasePointerCapture?.(d.id);
    el.classList.remove("is-dragging");
    setTilt(0); // the 700ms transition on .hanger-body springs them home

    // A drag that ends over a card must not navigate. Every card is a <Link>, so
    // without this the single gesture the whole metaphor rests on would take you off
    // the page. One capturing, one-shot listener that removes itself.
    if (d.moved) {
      const swallow = (ev: MouseEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
      };
      el.addEventListener("click", swallow, { capture: true, once: true });
      // If the click never comes (the pointer went up outside a link), do not leave a
      // listener armed to eat the NEXT legitimate click.
      window.setTimeout(
        () => el.removeEventListener("click", swallow, { capture: true }),
        0,
      );
    }

    if (still.current) return; // no inertia: a release stops dead

    // The glide.
    let v = d.v * 1.6;
    const started = performance.now();
    // Snap is disabled for the duration (via .is-dragging in CSS) or it re-engages
    // mid-glide and yanks the rail back like a fish on a line.
    el.classList.add("is-dragging");

    const step = () => {
      if (Math.abs(v) < MIN_V || performance.now() - started > MAX_GLIDE_MS) {
        el.classList.remove("is-dragging");
        return;
      }
      el.scrollLeft -= v;
      v *= FRICTION;
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  };

  // ---- Buttons and keys -------------------------------------------------

  const nudge = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({
      left: dir * extent.current.card,
      behavior: still.current ? "auto" : "smooth",
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    const el = scroller.current;
    if (!el) return;
    const b: ScrollBehavior = still.current ? "auto" : "smooth";

    if (e.key === "ArrowRight") {
      e.preventDefault();
      nudge(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      nudge(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      el.scrollTo({ left: 0, behavior: b });
    } else if (e.key === "End") {
      e.preventDefault();
      el.scrollTo({ left: extent.current.max, behavior: b });
    }
  };

  const arrows = count > 1;

  return (
    <section
      ref={wrap}
      aria-labelledby={`rail-${label.replace(/\W+/g, "-").toLowerCase()}`}
      className={cn("relative", className)}
    >
      <div className="shell flex items-end justify-between gap-6 pb-4">
        <h2
          id={`rail-${label.replace(/\W+/g, "-").toLowerCase()}`}
          className="kicker"
        >
          {label}
          <span className="ml-3 tabular-nums text-faint">
            {count} {count === 1 ? "item" : "items"}
          </span>
        </h2>

        {arrows ? (
          <div className="flex gap-2">
            {/* aria-disabled, never disabled: a disabled button drops out of the tab
                order, and a keyboard user who reaches the end of the rail would find
                the control they were using vanish under them. */}
            <button
              type="button"
              onClick={() => nudge(-1)}
              aria-label="Previous"
              aria-disabled={atStart}
              className={cn(
                "btn btn-ghost !px-3.5 !py-2",
                atStart && "pointer-events-none opacity-35",
              )}
            >
              &#9664;
            </button>
            <button
              type="button"
              onClick={() => nudge(1)}
              aria-label="Next"
              aria-disabled={atEnd}
              className={cn(
                "btn btn-ghost !px-3.5 !py-2",
                atEnd && "pointer-events-none opacity-35",
              )}
            >
              &#9654;
            </button>
          </div>
        ) : null}
      </div>

      {/* The pole. It does NOT move - the hangers slide along it. That is the correct
          physics and it is the whole visual payoff of the thing. */}
      <div className="shell">
        <div className="rail-bar" aria-hidden />
      </div>

      <ul
        ref={scroller}
        // A scrollable region must be focusable, or a keyboard user cannot reach its
        // contents at all. Almost every carousel on the web forgets this.
        tabIndex={0}
        role="region"
        aria-label={label}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        // The horizontal padding lives in .rail-scroller, not here: it has to be derived
        // from the shell's width so the first shirt lines up with the column above it.
        className="rail-scroller mask-fade-r pb-2 pt-0"
      >
        {children}
      </ul>

      {/* A length of rail walked, not "3 of 8". */}
      <div className="shell mt-4">
        <div className="h-px w-full bg-line">
          <div className="rail-progress h-px bg-accent" aria-hidden />
        </div>
      </div>
    </section>
  );
}
