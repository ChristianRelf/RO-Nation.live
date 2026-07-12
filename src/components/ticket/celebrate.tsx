"use client";

import { useEffect, useRef } from "react";
import { partnerBySlug } from "@/lib/partners/registry";

// The confetti burst, and nothing else.
//
// This used to own the QR as well, which forced the whole ticket to be a client
// component. It doesn't any more: the ticket — and the QR inside it — renders on
// the server, and this renders nothing at all. It exists purely to fire once,
// when a ticket is issued or activated.

// RNL's burst: the accent, its lift, bone, and two warm sparks.
const RNL_CONFETTI = ["#2b6bff", "#7aa2ff", "#ece9e1", "#ffd166", "#ff5d73"];

/**
 * Confetti is painted to a <canvas>, which cannot read a CSS variable — so
 * unlike everything else on the page, these colours have to be literal. They
 * come from the partner preset, found via the `data-brand` the root layout put
 * on <html>.
 */
function confettiColors(): readonly string[] {
  const slug = document.documentElement.dataset.brand || null;
  return partnerBySlug(slug)?.confetti ?? RNL_CONFETTI;
}

// Self-contained confetti burst on a full-screen canvas — no dependencies.
export function fireConfetti() {
  if (typeof window === "undefined") return;
  const prefersReduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  if (prefersReduced) return;

  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:60";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  const resize = () => {
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener("resize", resize);

  const colors = confettiColors();
  const W = () => window.innerWidth;
  const H = () => window.innerHeight;

  type P = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    rot: number;
    vr: number;
    size: number;
    color: string;
  };

  const parts: P[] = [];
  const burst = (originX: number) => {
    for (let i = 0; i < 90; i++) {
      const angle = Math.random() * Math.PI - Math.PI / 2;
      const speed = 6 + Math.random() * 9;
      parts.push({
        x: originX,
        y: H() * 0.32,
        vx: Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1),
        vy: Math.sin(angle) * speed - 4,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        size: 5 + Math.random() * 7,
        color: colors[(Math.random() * colors.length) | 0],
      });
    }
  };
  burst(W() * 0.5);
  setTimeout(() => burst(W() * 0.5), 180);

  let frame = 0;
  const gravity = 0.32;
  const tick = () => {
    frame++;
    ctx.clearRect(0, 0, W(), H());
    for (const p of parts) {
      p.vy += gravity;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.5);
      ctx.restore();
    }
    if (frame < 220) {
      requestAnimationFrame(tick);
    } else {
      window.removeEventListener("resize", resize);
      canvas.remove();
    }
  };
  requestAnimationFrame(tick);
}

/** Fires once when `when` is true. Renders nothing. */
export function Celebrate({ when }: { when: boolean }) {
  const fired = useRef(false);
  useEffect(() => {
    if (when && !fired.current) {
      fired.current = true;
      const t = setTimeout(fireConfetti, 120);
      return () => clearTimeout(t);
    }
  }, [when]);

  return null;
}
