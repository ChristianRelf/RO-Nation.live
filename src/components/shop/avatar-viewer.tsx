"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { FACE_ORDER } from "@/lib/merch/uv";
import { CELL, cellAt, gridFor, permutation, scrambles } from "@/lib/merch/scramble";

// A Roblox R6 character, wearing the shirt, in WebGL.
//
// Roblox will not render this for us: the official 3D thumbnail endpoint and the
// asset-download endpoint both 401 without a logged-in cookie. So the character is
// built here, out of boxes - which is exactly what Roblox itself does, because a
// classic shirt IS a cube unwrap.
//
// ---- It is never handed the shirt --------------------------------------------
//
// It used to take a `textureUrl` and point a TextureLoader at it, which meant the
// 585x559 template - the product itself, the thing a thief needs and nothing else -
// sat on a public path in the page source.
//
// It now takes a PLATE: eighteen sealed URLs, one per face of one cube, each one
// arriving shredded into 16px cells (lib/merch/scramble.ts). Each face is unshuffled
// into its own small canvas, uploaded to the GPU as its own texture, and mapped onto
// its own side of a box with the geometry's default UVs. The template is never
// reassembled - not in the DOM, not in a canvas, not in memory. There is no moment at
// which this component is holding the flat.
//
// Two consequences worth knowing before you change anything here:
//
//   • The atlas is gone, and with it netUVs(). A face texture is just the face, so the
//     default box UVs are already right. What survives from uv.ts is FACE_ORDER, which
//     is still the one non-obvious thing: three.js orders a box's materials
//     [+X, -X, +Y, -Y, +Z, -Z], and the character faces +Z, so the +X face is the
//     character's LEFT. Get that backwards and every logo comes out mirrored.
//   • preserveDrawingBuffer is left at its default of FALSE. That is not a
//     performance setting here: it means "Save image as…" on this canvas hands back a
//     blank PNG rather than a render of the shirt. Do not turn it on.
//
// This file is a client component and must NEVER be server-rendered: three.js reaches
// for `window` at import time. It is only ever reached through a dynamic(...,
// { ssr: false }) in product-stage.tsx.

/** Roblox R6 proportions, in studs. The torso's centre is the origin. */
const TORSO_SIZE: [number, number, number] = [2, 2, 1];
const LIMB_SIZE: [number, number, number] = [1, 2, 1];
const HEAD_SIZE: [number, number, number] = [1.25, 1.25, 1.25];

// The character faces +Z, toward the camera. So the character's RIGHT hand is at
// NEGATIVE x - on the viewer's left.
const RIGHT_X = -1.5;
const LEFT_X = 1.5;

/** Where the arms hinge, and where the legs do. Limbs hang from these. */
const SHOULDER_Y = 1;
const HIP_Y = -1;

/** The soles, in rig space. The floor goes here. */
const SOLE_Y = -3;
const CROWN_Y = 2.25;

/** Centre the frame on the BODY, not on the torso, or the legs fall out of shot. */
const RIG_Y = (Math.abs(SOLE_Y) - CROWN_Y) / 2;

/**
 * A slight A-pose.
 *
 * Roblox stands a character with its arms dead vertical, welded to the torso, and it
 * reads as a shop dummy - the sleeves disappear into the sides and you cannot see the
 * seam you are being sold. Four degrees of daylight under each arm is enough to make
 * it read as a person wearing a shirt rather than a stack of boxes, and it is what
 * makes the sleeve artwork visible at all from the front.
 *
 * Signed per side: +z rotation swings a hanging limb toward +x, so the character's
 * right arm (at -x) has to go the other way to swing OUT rather than into its ribs.
 */
const A_POSE = 0.075;

/** Uncoloured skin, so the shirt is the only thing with an opinion. */
const SKIN = 0xd6c39a;
const LIMB_BARE = 0xc9b48c;

type Kind = "SHIRT" | "TSHIRT" | "PANTS";

/** `tileId -> url`, straight from lib/merch/tiles.ts. */
type Plate = Record<string, string>;

// ---- Getting a face back ---------------------------------------------------

/**
 * Load one shredded tile and put it back together.
 *
 * The permutation is seeded on the tile's TOKEN - the last segment of its URL - which
 * is the same string the server seeded with, so the two agree without either of them
 * sending the other anything. See lib/merch/scramble.ts.
 *
 * The result is a canvas, not an <img>: nothing that holds face artwork is ever
 * attached to the document, so there is no element to right-click and none of it shows
 * up in the browser's image list.
 */
async function unshred(url: string): Promise<HTMLCanvasElement> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    // Same-origin, so no crossOrigin dance - and the route refuses anything that is
    // not same-origin anyway.
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error(`tile failed: ${url}`));
    el.src = url;
  });

  const w = img.naturalWidth;
  const h = img.naturalHeight;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");

  if (!scrambles(w, h)) {
    // The server could not shuffle this one (it would need whole 16px cells), so it
    // did not. Draw it straight.
    ctx.drawImage(img, 0, 0);
    return canvas;
  }

  const grid = gridFor(w, h);
  const perm = permutation(url.slice(url.lastIndexOf("/") + 1), grid.count);

  // The server wrote out[i] = src[perm[i]]. We are holding `out` and we want `src`, so
  // the cell sitting at slot i belongs at slot perm[i]. Same array, read backwards.
  for (let i = 0; i < grid.count; i++) {
    const from = cellAt(i, grid);
    const to = cellAt(perm[i], grid);
    ctx.drawImage(img, from.x, from.y, CELL, CELL, to.x, to.y, CELL, CELL);
  }

  return canvas;
}

function textureFrom(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  // Roblox templates are pixel art at 64px/stud. Linear filtering turns crisp artwork
  // into mush at this size; nearest keeps it looking like it does in-game.
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  return tex;
}

/** The classic Roblox face, drawn rather than fetched. Two eyes and a smile. */
function faceTexture(): THREE.CanvasTexture {
  const S = 128;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;

  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#1b1b1b";

    // Eyes.
    for (const x of [0.32, 0.68]) {
      ctx.beginPath();
      ctx.ellipse(x * S, 0.38 * S, 0.075 * S, 0.1 * S, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Smile - an arc with a little weight to it, not a hairline.
    ctx.strokeStyle = "#1b1b1b";
    ctx.lineWidth = 0.05 * S;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0.5 * S, 0.56 * S, 0.2 * S, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export default function AvatarViewer({
  kind,
  plate,
  view = "front",
  paused = false,
}: {
  kind: Kind;
  plate: Plate;
  /** Which way the character is facing. Driven by the stage's tabs. */
  view?: "front" | "back";
  paused?: boolean;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  // The prop is a fresh object on every render of the server component above, so it
  // can never be a dependency directly - it would tear down and rebuild the WebGL
  // context on every parent render. Its CONTENT is what identifies the garment.
  const plateKey = useMemo(
    () => Object.entries(plate).sort().flat().join("|"),
    [plate],
  );

  const api = useRef<{
    rig: THREE.Group;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    stop: () => void;
    start: () => void;
    takeControl: () => void;
  } | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let cancelled = false;

    const scene = new THREE.Scene();

    // A long lens from far back. A wide one up close gives the character a bulging,
    // fish-eyed torso - the shirt is the subject, and perspective distortion across it
    // is exactly what a shopper reads as "the print is warped".
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0.2, 14);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
        // Deliberately absent: preserveDrawingBuffer. See the note at the top.
      });
    } catch {
      setFailed(true);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientWidth);

    // NO TONE MAPPING. Not an oversight, and please do not "improve" this to ACES.
    //
    // A filmic curve is the obvious next upgrade here and it is the wrong one: tone
    // mapping is a non-linear transform of the OUTPUT COLOUR. It rolls off the
    // highlights, lifts the shadows and desaturates the bright end - which is lovely on
    // a game, and a lie on a shop. This canvas is a product photograph, and the same law
    // that keeps the key light white applies to the curve that grades it: a buyer must
    // see the colours their avatar will actually wear, not a graded version of them.
    //
    // The lights below are balanced to land in range on their own instead. See the note
    // on the key light for the arithmetic.
    renderer.toneMapping = THREE.NoToneMapping;

    // A real shadow map, though. That IS free of colour - it is the single biggest
    // difference between "boxes in a void" and "an object standing on a table".
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    mount.appendChild(renderer.domElement);
    renderer.domElement.style.opacity = "0";
    renderer.domElement.style.transition = "opacity 420ms ease";

    // ---- Lighting, lit by the brand ------------------------------------
    //
    // The rim light is gelled with the page's own accent, read off the document's
    // computed style - so on Sleep Token the character is rimmed in dim gold rather
    // than in RNL's electric blue, with no branch and no second code path.
    //
    // THE KEY LIGHT STAYS WHITE ON EVERY BRAND, FOREVER. It is the light falling on the
    // artwork, and the artwork is the product: tinting it would misrepresent the
    // colours the buyer actually receives on their avatar. Atmosphere on the rim, truth
    // on the face.
    const css = getComputedStyle(document.documentElement);
    const channel = (name: string, fallback: number) => {
      const raw = css.getPropertyValue(name).trim(); // "43 107 255"
      const [r, g, b] = raw.split(/\s+/).map(Number);
      if ([r, g, b].some((n) => !Number.isFinite(n))) return new THREE.Color(fallback);
      return new THREE.Color(r / 255, g / 255, b / 255);
    };

    // ---- The exposure budget -------------------------------------------
    //
    // With no tone mapping, brightness has nowhere to hide: whatever lands above 1.0
    // clips, and a clipped shirt is a shirt whose artwork the buyer cannot see. three.js
    // divides diffuse by PI, so a surface lit by a total irradiance of PI comes back at
    // exactly its own colour - which is the target, because "the colour it actually is"
    // is the whole job.
    //
    // On the chest (normal +Z), the budget is spent like this:
    //
    //   hemisphere  1.00 x ~0.54  (a vertical face sees half sky, half floor)  0.54
    //   ambient     1.00                                                       1.00
    //   key         1.90 x  0.66  (N.L, from up and to the right)              1.25
    //   fill        0.30 x  0.82                                               0.25
    //   rim                       (behind the character - contributes nothing) 0.00
    //                                                                        -------
    //                                                                          3.04  ~= PI
    //
    // Change a number here and you are changing what the shirt looks like in the shop
    // versus what it looks like in-game. Do the sum.
    //
    // The hemisphere is what earns its place over a second ambient: the tops of the
    // shoulders and the head catch the room while the undersides fall away, and that is
    // what stops six flat-shaded boxes reading as a cut-out.
    const sky = new THREE.HemisphereLight(channel("--fg-rgb", 0xffffff), 0x141414, 1.0);
    scene.add(sky);
    scene.add(new THREE.AmbientLight(0xffffff, 1.0));

    const key = new THREE.DirectionalLight(0xffffff, 1.9);
    key.position.set(3.2, 6, 6);
    key.castShadow = true;
    // A tight ortho box around a character three studs tall. Left loose, the depth map
    // is spread over acres of empty scene and the contact shadow turns to porridge.
    key.shadow.camera.left = -5;
    key.shadow.camera.right = 5;
    key.shadow.camera.top = 5;
    key.shadow.camera.bottom = -5;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 25;
    key.shadow.mapSize.set(1024, 1024);
    // Boxes are flat-sided and axis-aligned: without a bias they shadow-acne all over
    // their own faces in bands.
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.02;
    scene.add(key);

    // The rim is the one coloured light, and it is behind the character - so it grazes
    // the silhouette and never falls on the front of the shirt. That is the whole trick
    // by which this scene can be gelled to a partner's brand without lying about the
    // product: atmosphere on the rim, truth on the face.
    const rim = new THREE.DirectionalLight(channel("--accent-rgb", 0xffffff), 1.5);
    rim.position.set(-4.5, 2.2, -5);
    scene.add(rim);

    const fill = new THREE.DirectionalLight(0xffffff, 0.3);
    fill.position.set(-2.5, -1.5, 4);
    scene.add(fill);

    // The floor. A ShadowMaterial is invisible except where something shadows it, so
    // the character casts onto the page's own background rather than onto a grey disc -
    // which is what lets the same scene sit on RNL's dark plinth and on a partner's
    // paper one without a second code path.
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.ShadowMaterial({ opacity: 0.34 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = SOLE_Y + RIG_Y;
    floor.receiveShadow = true;
    scene.add(floor);

    const rig = new THREE.Group();
    rig.position.y = RIG_Y;
    scene.add(rig);

    const disposables: Array<{ dispose: () => void }> = [
      floor.geometry,
      floor.material,
    ];

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.rotateSpeed = 0.85;
    controls.minDistance = 8;
    controls.maxDistance = 20;
    // Do not let the camera go under the floor. Orbiting below the soles puts you
    // underneath a character standing on a shadow, which looks like the scene broke.
    controls.minPolarAngle = 0.5;
    controls.maxPolarAngle = 2.15;
    controls.target.set(0, 0, 0);

    const stillPlease = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let interacted = stillPlease;
    controls.addEventListener("start", () => {
      interacted = true;
    });

    let raf = 0;
    let running = false;
    const clock = new THREE.Clock();
    let elapsed = 0;

    // Set once the body exists. Until then the loop still runs (so the controls damp
    // and the canvas is live) but there is nothing to breathe.
    let animate: ((t: number, dt: number) => void) | null = null;

    const render = () => {
      raf = requestAnimationFrame(render);

      const dt = clock.getDelta();
      elapsed += dt;

      if (!interacted) rig.rotation.y += dt * 0.35;
      if (animate && !stillPlease) animate(elapsed, dt);

      controls.update();
      renderer.render(scene, camera);
    };

    const start = () => {
      if (running) return;
      running = true;
      // Reset the clock, or the first frame after a pause is handed the entire paused
      // duration as its delta and the character snaps a quarter turn.
      clock.getDelta();
      render();
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

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

    // ---- The body ------------------------------------------------------
    //
    // Built only once every face has arrived. A character that dresses itself one
    // sleeve at a time as eighteen requests land is worse than one that appears a beat
    // later already wearing the shirt.
    (async () => {
      let faces: Record<string, THREE.CanvasTexture>;
      try {
        const ids = Object.keys(plate);
        const canvases = await Promise.all(ids.map((id) => unshred(plate[id])));
        if (cancelled) return;

        faces = Object.fromEntries(
          ids.map((id, i) => [id, textureFrom(canvases[i])]),
        );
      } catch {
        // A tile 404'd, or the product was pulled from the shelf between the page
        // rendering and the tiles being asked for. Not a blank box: fall through to the
        // stencil below.
        if (!cancelled) setFailed(true);
        return;
      }

      for (const t of Object.values(faces)) disposables.push(t);

      const bare = new THREE.MeshStandardMaterial({
        color: LIMB_BARE,
        roughness: 0.92,
        metalness: 0,
      });
      const skin = new THREE.MeshStandardMaterial({
        color: SKIN,
        roughness: 0.9,
        metalness: 0,
      });
      disposables.push(bare, skin);

      /** The six materials of one clothed cube, in three.js's face order. */
      const dressed = (part: "t" | "r" | "l") =>
        FACE_ORDER.map((face) => {
          const tex = faces[`${part}.${face}`];
          if (!tex) return bare;

          const mat = new THREE.MeshStandardMaterial({
            map: tex,
            // The templates carry an alpha channel, and the transparent parts must show
            // skin rather than a black hole.
            transparent: true,
            alphaTest: 0.01,
            roughness: 0.88,
            metalness: 0,
          });
          disposables.push(mat);
          return mat;
        });

      const box = (
        size: [number, number, number],
        material: THREE.Material | THREE.Material[],
      ) => {
        const geo = new THREE.BoxGeometry(...size);
        disposables.push(geo);
        const mesh = new THREE.Mesh(geo, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
      };

      // Pants texture the torso too - that is not a bug in the template, it is how
      // Roblox layers a shirt over the top of them. So every kind dresses the torso; only
      // the limbs differ.
      const dressesArms = kind === "SHIRT";
      const dressesLegs = kind === "PANTS";

      // ---- Head. Never clothed, and the reason the viewer works at all: a floating
      // torso is not a character, and the point is to show the shirt ON somebody.
      const faceMat = new THREE.MeshStandardMaterial({
        map: faceTexture(),
        color: SKIN,
        roughness: 0.9,
        metalness: 0,
        transparent: true,
      });
      disposables.push(faceMat, faceMat.map as THREE.Texture);

      // FACE_ORDER is [+X, -X, +Y, -Y, +Z, -Z] - index 4 is the front.
      const headMats = [skin, skin, skin, skin, faceMat, skin];
      const head = box(HEAD_SIZE, headMats);
      const headY = 1.5 + HEAD_SIZE[1] / 2;
      head.position.set(0, headY, 0);
      rig.add(head);

      // ---- Torso
      let torso: THREE.Mesh;
      if (kind === "TSHIRT") {
        // assetTypeId 2 is a plain image on the torso's FRONT face - no template, no
        // wrap, no sleeves. Building it out of the shirt net would put the artwork on
        // the character's back and both arms, which is confidently, silently wrong.
        const decal = faces["d"];
        const decalMat = decal
          ? new THREE.MeshStandardMaterial({
              map: decal,
              transparent: true,
              alphaTest: 0.01,
              roughness: 0.88,
              metalness: 0,
            })
          : bare;
        if (decal) disposables.push(decalMat);

        torso = box(TORSO_SIZE, [bare, bare, bare, bare, decalMat, bare]);
      } else {
        torso = box(TORSO_SIZE, dressed("t"));
      }
      torso.position.set(0, 0, 0);
      rig.add(torso);

      /**
       * A limb, hung from a pivot.
       *
       * The pivot is the point it should ROTATE about - a shoulder, a hip - and the mesh
       * hangs a stud below it, so the limb swings from its top rather than pinwheeling
       * about its middle. That is what the A-pose and the idle sway below both need,
       * and it is why these are groups rather than bare meshes.
       */
      const limb = (
        x: number,
        pivotY: number,
        material: THREE.Material | THREE.Material[],
      ) => {
        const joint = new THREE.Group();
        joint.position.set(x, pivotY, 0);

        const mesh = box(LIMB_SIZE, material);
        mesh.position.y = -LIMB_SIZE[1] / 2;
        joint.add(mesh);

        rig.add(joint);
        return joint;
      };

      const armR = limb(RIGHT_X, SHOULDER_Y, dressesArms ? dressed("r") : bare);
      const armL = limb(LEFT_X, SHOULDER_Y, dressesArms ? dressed("l") : bare);
      const legR = limb(-0.5, HIP_Y, dressesLegs ? dressed("r") : bare);
      const legL = limb(0.5, HIP_Y, dressesLegs ? dressed("l") : bare);

      armR.rotation.z = -A_POSE;
      armL.rotation.z = A_POSE;

      // ---- Idle. Not decoration: a character that is perfectly still reads as a
      // render, and one that breathes reads as a person you could put a shirt on. All
      // of it is small enough to sit under conscious notice, and all of it is skipped
      // entirely under prefers-reduced-motion - a continuously moving object is a
      // genuine problem for vestibular disorders, and the shirt is perfectly legible
      // standing still.
      animate = (t) => {
        const breath = Math.sin(t * 1.5);

        rig.position.y = RIG_Y + breath * 0.018;
        head.position.y = headY + breath * 0.012;
        // A slow look around the room, so the head is not welded dead-ahead.
        head.rotation.y = Math.sin(t * 0.37) * 0.09;

        const sway = breath * 0.022;
        armR.rotation.z = -A_POSE + sway;
        armL.rotation.z = A_POSE - sway;

        // The legs get a fraction of it, a beat behind. Enough to stop the lower half
        // looking bolted to the floor while the upper half moves.
        const shift = Math.sin(t * 1.5 - 0.5) * 0.006;
        legR.rotation.z = shift;
        legL.rotation.z = -shift;
      };

      if (cancelled) return;

      setReady(true);
      renderer.domElement.style.opacity = "1";
      start();
    })();

    // The loop runs from the first frame even while the tiles are in flight, so the
    // controls are live and the canvas is not a dead rectangle.
    start();

    return () => {
      // WebGL contexts are a finite resource - a browser gives you about sixteen, then
      // starts silently killing the oldest. A shopper clicking through ten products in
      // a row would blank the ones behind them without this.
      cancelled = true;
      api.current = null;
      stop();
      observer.disconnect();
      controls.dispose();
      for (const d of disposables) d.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [kind, plateKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- The view tabs -----------------------------------------------------
  //
  // Turning the character round is not just `rig.rotation.y = PI`, and the two things
  // it also has to do are both invisible until they bite:
  //
  //   1. OrbitControls moves the CAMERA, not the model. After any drag the camera is
  //      off at some azimuth of the user's choosing - so setting the rig to "front"
  //      would show you the front from three-quarters behind and to the left.
  //   2. The idle turntable is still running until something sets `interacted`, so the
  //      tween would land on the front and immediately rotate away from it - which
  //      looks like a bug in the tab rather than a feature of the scene.
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

    // Walk the CAMERA back to dead-on as well, in spherical coordinates about the orbit
    // target. Only theta is driven to zero; the radius and the polar angle are left
    // exactly where the user put them, so pressing BACK does not silently undo their
    // zoom or their height.
    const sph = new THREE.Spherical().setFromVector3(
      a.camera.position.clone().sub(a.controls.target),
    );
    const fromTheta = sph.theta;

    const place = (theta: number) => {
      sph.theta = theta;
      a.camera.position.setFromSpherical(sph).add(a.controls.target);
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
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // ease-in-out
      a.rig.rotation.y = from + delta * e;
      place(fromTheta * (1 - e));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [view, ready]);

  // A canvas nobody can see, re-rendering at 60fps, is not free - least of all on the
  // mid-range phone this audience is actually holding. Paused when the stage says so,
  // and paused when it scrolls out of the window.
  const [onScreen, setOnScreen] = useState(true);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const io = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      { rootMargin: "120px" },
    );
    io.observe(mount);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const a = api.current;
    if (!a) return;
    if (paused || !onScreen) a.stop();
    else a.start();
  }, [paused, onScreen, ready]);

  if (failed) {
    // No WebGL, or the tiles did not come back.
    //
    // It used to fall back to <img src={textureUrl}> - the flat, at full resolution,
    // handed to exactly the browser least likely to be a real shopper. It falls back to
    // the name now. The one thing this component will not do, in any state, is show the
    // template.
    return (
      <div className="panel-paper grid aspect-square place-items-center rounded-brand p-8">
        <p className="display text-center text-4xl leading-none text-paper-ink/[0.18]">
          {kind === "PANTS" ? "Pants" : "Shirt"}
        </p>
        <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-kicker text-faint">
          The 3D view needs WebGL
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        ref={mountRef}
        // The canvas is not a picture, and the browser should not treat it as one: no
        // drag-to-desktop, no context menu offering to save it. (Saving it would hand
        // back a blank PNG anyway - see preserveDrawingBuffer at the top - but an
        // empty file in somebody's downloads folder is a worse answer than no menu.)
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
        className="aspect-square w-full select-none [&>canvas]:block [&>canvas]:h-full [&>canvas]:w-full"
      />

      {!ready ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <p className="font-mono text-[10px] uppercase tracking-kicker text-faint">
            Dressing the mannequin
          </p>
        </div>
      ) : null}

      {/* The character stands ON the table rather than floating in a void. */}
      <div className="plinth-shadow" aria-hidden />

      <p className="pointer-events-none absolute bottom-3 left-0 right-0 text-center font-mono text-[10px] uppercase tracking-kicker text-faint">
        Drag to turn &middot; scroll to zoom
      </p>
    </div>
  );
}
