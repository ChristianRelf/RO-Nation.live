"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * The squeegee: an accent blade rides down the stage once, as you arrive at it, and a
 * light over-print lays in behind it.
 *
 * It is ADDITIVE, and that is the whole design of it. The obvious version leaves the
 * artwork grey and desaturated until you touch it, and then "prints" it - which is a
 * lovely idea and completely wrong for a shop: shirt colour is the purchase signal,
 * and the first frame a kid sees arriving from a Discord link would be a washed-out
 * grey rectangle. So the artwork is fully painted, server-rendered, from the very
 * first frame, and this is a layer ON TOP that fires once and lifts off.
 *
 * Nothing here is ever hidden pending JavaScript. If this component never mounts, if
 * the observer never fires, if JS is off entirely - the page is already correct. The
 * sweep is the flourish, never the content.
 */
export function InkSweep({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Under reduced motion it does not observe and never adds the class - so the
    // blade is never drawn at all, rather than being drawn and then crushed to a
    // 0.001ms animation by the global rule. Cheaper, and it cannot flash.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.classList.add("is-pulled");
        io.disconnect(); // once. A squeegee pass you can re-trigger by scrolling is a toy.
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={cn("ink-sweep", className)}>
      {children}
    </div>
  );
}
