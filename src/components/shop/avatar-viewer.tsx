"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { LEFT_LIMB, RIGHT_LIMB, TORSO, type Net } from "@/lib/merch/template";
import { netUVs } from "@/lib/merch/uv";

// A Roblox R6 character, wearing the shirt, in WebGL.
//
// Roblox will not render this for us: the official 3D thumbnail endpoint and the
// asset-download endpoint both 401 without a logged-in cookie. So the character is
// built here, out of boxes, and textured with the classic template RNL uploads -
// which is exactly what Roblox itself does, because a classic shirt IS a cube
// unwrap. See lib/merch/template.ts for where the rectangles came from.
//
// This file is a client component and must NEVER be server-rendered: three.js
// reaches for `window` at import time. It is only ever reached through a
// dynamic(..., { ssr: false }) in product-viewer.tsx.

/** Roblox R6 proportions, in studs. The torso's centre is the origin. */
const TORSO_SIZE: [number, number, number] = [2, 2, 1];
const LIMB_SIZE: [number, number, number] = [1, 2, 1];
const HEAD_SIZE: [number, number, number] = [1.25, 1.25, 1.25];

// The character faces +Z, toward the camera. So the character's RIGHT hand is at
// NEGATIVE x - on the viewer's left. Get this backwards and every logo comes out
// mirrored, which is the classic way to ship a shirt viewer that looks nearly right.
const RIGHT_X = -1.5;
const LEFT_X = 1.5;

/** Uncoloured skin, so the shirt is the only thing with an opinion. */
const SKIN = 0xb9b9b3;
const LIMB_BARE = 0xa8a8a2;

/**
 * Point every face of a cube at its rectangle of the template.
 *
 * The mapping itself lives in lib/merch/uv.ts, deliberately: it is pure arithmetic
 * with several non-obvious conventions in it (face order, the v flip, which side is
 * the character's right), none of which fail loudly - and keeping it out of here is
 * what lets it be checked against Roblox's own colour-coded template without a GPU.
 */
function applyNet(geometry: THREE.BoxGeometry, net: Net) {
  geometry.setAttribute("uv", new THREE.BufferAttribute(netUVs(net), 2));
}

type Kind = "SHIRT" | "TSHIRT" | "PANTS";

export default function AvatarViewer({
  kind,
  textureUrl,
  name,
  view = "front",
  paused = false,
}: {
  kind: Kind;
  textureUrl: string;
  name: string;
  /** Which way the character is facing. Driven by the stage's tabs. */
  view?: "front" | "back";
  /** True while the FLAT PRINT tab is up: the canvas is hidden, so stop rendering. */
  paused?: boolean;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  // The live scene, so the view/pause effects below can reach it without tearing the
  // whole thing down and rebuilding a WebGL context on every tab press.
  const api = useRef<{
    rig: THREE.Group;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    stop: () => void;
    start: () => void;
    /** Silences the idle turntable, exactly as a user drag does. */
    takeControl: () => void;
  } | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    // A long lens from far back. A wide one up close gives the character a bulging,
    // fish-eyed torso - the shirt is the subject, and perspective distortion across
    // it is exactly the thing a shopper would read as "the print is warped".
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0.2, 14);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      // No WebGL - an old machine, a locked-down browser, a headless bot. Fall back
      // rather than throwing a blank box at somebody trying to buy a shirt.
      setFailed(true);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientWidth);
    mount.appendChild(renderer.domElement);

    // ---- Lighting, lit by the brand ------------------------------------
    //
    // The rim light is gelled with the page's own accent, read off the document's
    // computed style - so on Sleep Token the character is rimmed in dim gold rather
    // than in RNL's electric blue, with no branch and no second code path. The room
    // the shop is in lights the thing standing in it.
    //
    // THE KEY LIGHT STAYS WHITE ON EVERY BRAND, FOREVER. It is the light falling on
    // the artwork, and the artwork is the product: tinting it would misrepresent the
    // colours the buyer actually receives on their avatar. Atmosphere on the rim,
    // truth on the face. Nothing anywhere in this shop casts coloured light on a
    // product image.
    const css = getComputedStyle(document.documentElement);
    const channel = (name: string, fallback: number) => {
      const raw = css.getPropertyValue(name).trim(); // "43 107 255"
      const [r, g, b] = raw.split(/\s+/).map(Number);
      if ([r, g, b].some((n) => !Number.isFinite(n))) return new THREE.Color(fallback);
      return new THREE.Color(r / 255, g / 255, b / 255);
    };

    scene.add(new THREE.AmbientLight(channel("--fg-rgb", 0xffffff), 1.45));

    const key = new THREE.DirectionalLight(0xffffff, 1.9);
    key.position.set(3, 5, 6);
    scene.add(key);

    const rim = new THREE.DirectionalLight(channel("--accent-rgb", 0xffffff), 1.25);
    rim.position.set(-4.5, 2.2, -5);
    scene.add(rim);

    const fill = new THREE.DirectionalLight(channel("--fg-rgb", 0xffffff), 0.35);
    fill.position.set(-2, -3, 4);
    scene.add(fill);

    const rig = new THREE.Group();
    scene.add(rig);

    const disposables: Array<{ dispose: () => void }> = [];

    const texture = new THREE.TextureLoader().load(
      textureUrl,
      undefined,
      undefined,
      () => setFailed(true),
    );
    // Roblox templates are pixel art at 64px/stud. Linear filtering turns crisp
    // artwork into mush at this size; nearest keeps it looking like it does in-game.
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    disposables.push(texture);

    const clothed = new THREE.MeshLambertMaterial({
      map: texture,
      // The templates carry an alpha channel, and the transparent parts must show
      // skin rather than a black hole.
      transparent: true,
      alphaTest: 0.01,
    });
    const bare = new THREE.MeshLambertMaterial({ color: LIMB_BARE });
    const skin = new THREE.MeshLambertMaterial({ color: SKIN });
    disposables.push(clothed, bare, skin);

    /** One body part: a box, UV'd into `net` when the garment covers it. */
    function part(
      size: [number, number, number],
      pos: [number, number, number],
      net: Net | null,
      material: THREE.Material,
    ) {
      const geo = new THREE.BoxGeometry(...size);
      if (net) applyNet(geo, net);
      disposables.push(geo);
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.set(...pos);
      rig.add(mesh);
      return mesh;
    }

    const dressesTorso = kind === "SHIRT" || kind === "PANTS" || kind === "TSHIRT";
    const dressesArms = kind === "SHIRT";
    const dressesLegs = kind === "PANTS";

    // Head - never clothed. It is here because a floating torso is not a character,
    // and the whole point of this viewer is to show the shirt ON somebody.
    part(HEAD_SIZE, [0, 1.5 + 0.125, 0], null, skin);

    if (kind === "TSHIRT") {
      // A T-Shirt (assetTypeId 2) is a flat image on the torso's front face only -
      // no template, no wrap. Building it out of the shirt net would put the artwork
      // on the character's back and both arms, which is confidently, silently wrong.
      const geo = new THREE.BoxGeometry(...TORSO_SIZE);
      const uv = geo.attributes.uv as THREE.BufferAttribute;
      // Face 4 is +Z, the front. Give it the whole image; leave every other face's
      // default UVs pointing at a corner, and paint them with the bare material.
      uv.setXY(16, 0, 1);
      uv.setXY(17, 1, 1);
      uv.setXY(18, 0, 0);
      uv.setXY(19, 1, 0);
      uv.needsUpdate = true;
      disposables.push(geo);

      const mats = [bare, bare, bare, bare, clothed, bare];
      const torso = new THREE.Mesh(geo, mats);
      rig.add(torso);
    } else {
      part(TORSO_SIZE, [0, 0, 0], dressesTorso ? TORSO : null, dressesTorso ? clothed : bare);
    }

    part(
      LIMB_SIZE,
      [RIGHT_X, 0, 0],
      dressesArms ? RIGHT_LIMB : null,
      dressesArms ? clothed : bare,
    );
    part(
      LIMB_SIZE,
      [LEFT_X, 0, 0],
      dressesArms ? LEFT_LIMB : null,
      dressesArms ? clothed : bare,
    );

    part(
      LIMB_SIZE,
      [-0.5, -2, 0],
      dressesLegs ? RIGHT_LIMB : null,
      dressesLegs ? clothed : bare,
    );
    part(
      LIMB_SIZE,
      [0.5, -2, 0],
      dressesLegs ? LEFT_LIMB : null,
      dressesLegs ? clothed : bare,
    );

    // Centre the frame on the BODY, not on the torso. The torso is the origin, but the
    // character runs from the top of the head (+2.25) to the soles (-3), so orbiting
    // around the origin would swing the whole figure around a point in its chest and
    // leave the legs falling out of the bottom of the frame.
    rig.position.y = (3 - 2.25) / 2;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 8;
    controls.maxDistance = 22;
    controls.target.set(0, 0, 0);

    // A slow idle turn, so it reads as "you can spin this" without a tooltip - and
    // stops the moment a hand is on it, because fighting a user's drag is obnoxious.
    //
    // Honoured for prefers-reduced-motion, which is not box-ticking: a continuously
    // moving object is a genuine problem for vestibular disorders, and the shirt is
    // perfectly legible standing still. It also happens to make the viewer
    // deterministic, which is what lets it be screenshot-tested front-on.
    const stillPlease = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let interacted = stillPlease;
    controls.addEventListener("start", () => {
      interacted = true;
    });

    let raf = 0;
    let running = false;
    const clock = new THREE.Clock();

    const render = () => {
      raf = requestAnimationFrame(render);
      if (!interacted) rig.rotation.y += clock.getDelta() * 0.35;
      else clock.getDelta();
      controls.update();
      renderer.render(scene, camera);
    };

    const start = () => {
      if (running) return;
      running = true;
      // Reset the clock, or the first frame after a pause gets handed the entire
      // paused duration as its delta and the character snaps a quarter turn.
      clock.getDelta();
      render();
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    start();

    api.current = {
      rig,
      camera,
      controls,
      start,
      stop,
      takeControl: () => {
        interacted = true;
      },
    };

    const resize = () => {
      if (!mount.clientWidth) return;
      renderer.setSize(mount.clientWidth, mount.clientWidth);
      camera.aspect = 1;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    return () => {
      // WebGL contexts are a finite resource - a browser gives you about sixteen,
      // then starts silently killing the oldest. A shopper clicking through ten
      // products in a row would blank the ones behind them without this.
      api.current = null;
      stop();
      observer.disconnect();
      controls.dispose();
      for (const d of disposables) d.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [kind, textureUrl]);

  // ---- The view tabs -----------------------------------------------------
  //
  // Turning the character round is not just `rig.rotation.y = PI`, and the two things
  // it also has to do are both invisible until they bite:
  //
  //   1. OrbitControls moves the CAMERA, not the model. After any drag, the camera is
  //      off at some azimuth of the user's choosing - so setting the rig to "front"
  //      would show you the front from three-quarters behind and to the left. The
  //      camera has to be walked back to zero too.
  //   2. The idle turntable is still running at 0.35 rad/s until something sets
  //      `interacted`. Without that, the tween lands on the front and the turntable
  //      immediately carries on rotating away from it, which looks like a bug in the
  //      tab rather than a feature of the scene.
  useEffect(() => {
    const a = api.current;
    if (!a) return;

    a.takeControl();

    const target = view === "back" ? Math.PI : 0;
    const from = a.rig.rotation.y;
    // Shortest way round, so FRONT from 359 degrees turns 1 degree, not 359.
    let delta = (target - from) % (Math.PI * 2);
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;

    // Walk the CAMERA back to dead-on as well, in spherical coordinates about the
    // orbit target. Only theta (the azimuth) is driven to zero; the radius and the
    // polar angle are left exactly where the user put them, so pressing BACK does not
    // silently undo their zoom or their height. (OrbitControls has no public setter
    // for the azimuth in this version, and reaching for one is how this breaks on the
    // next three.js bump anyway - spherical maths does not go out of date.)
    const sph = new THREE.Spherical().setFromVector3(
      a.camera.position.clone().sub(a.controls.target),
    );
    const fromTheta = sph.theta;

    const place = (theta: number) => {
      sph.theta = theta;
      a.camera.position
        .setFromSpherical(sph)
        .add(a.controls.target);
      a.camera.lookAt(a.controls.target);
      a.controls.update();
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      a.rig.rotation.y = target;
      place(0);
      return;
    }

    const DUR = 520;
    const t0 = performance.now();
    let frame = 0;

    const tick = () => {
      const t = Math.min(1, (performance.now() - t0) / DUR);
      // ease-in-out
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      a.rig.rotation.y = from + delta * e;
      place(fromTheta * (1 - e));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [view]);

  // A canvas nobody can see, re-rendering at 60fps, is not free - least of all on the
  // mid-range phone this audience is actually holding.
  useEffect(() => {
    const a = api.current;
    if (!a) return;
    if (paused) a.stop();
    else a.start();
  }, [paused]);

  if (failed) {
    // No WebGL. Fall through to the artwork itself, framed as what it is: the garment
    // cut flat. Not an error state - a different, equally true object.
    return (
      <div className="pattern-piece grid aspect-square place-items-center overflow-hidden rounded-brand p-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={textureUrl}
          alt={name}
          className="max-h-full max-w-full object-contain"
        />
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        ref={mountRef}
        className="aspect-square w-full [&>canvas]:block [&>canvas]:h-full [&>canvas]:w-full"
      />
      {/* The character stands ON the table rather than floating in a void. The single
          highest-value line on this page. */}
      <div className="plinth-shadow" aria-hidden />
      <p className="pointer-events-none absolute bottom-3 left-0 right-0 text-center font-mono text-[10px] uppercase tracking-kicker text-faint">
        Drag to turn &middot; scroll to zoom
      </p>
    </div>
  );
}
