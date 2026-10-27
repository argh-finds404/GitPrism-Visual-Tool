"use client";

import { useEffect, useRef } from "react";

/**
 * The banner's base layer: a field of hex digits, the alphabet every Git object ID is written in.
 * A beam enters from the left, strikes the prism, and the refracted spectrum lights the digits it
 * passes through. Background and hero object are one system rather than two decorations.
 *
 * Cost control: the dim base grid is drawn once into an offscreen canvas and blitted each frame.
 * Only the lit cells (a few hundred, their geometry precomputed per layout) are drawn per frame.
 */

const HEX = "0123456789abcdef";

/** Seconds into the intro when each layer arrives. Hero reads these, so type and canvas stay in step. */
export const INTRO = { field: 0.1, beam: 0.5, prism: 0.95, spectrum: 1.4, text: 1.9, chrome: 2.5, settle: 3.4 } as const;

/** The refracted fan: angle in radians from the prism, and the colour that ray carries. */
const RAYS: { angle: number; rgb: [number, number, number] }[] = [
  { angle: -0.4, rgb: [62, 224, 255] },
  { angle: -0.24, rgb: [124, 155, 255] },
  { angle: -0.08, rgb: [155, 123, 255] },
  { angle: 0.09, rgb: [255, 92, 184] },
  { angle: 0.26, rgb: [255, 193, 92] },
  { angle: 0.43, rgb: [75, 227, 166] },
];

/** Angular gap between neighbouring rays, so beam width can scale with their separation. */
const RAY_STEP = (RAYS[RAYS.length - 1].angle - RAYS[0].angle) / (RAYS.length - 1);

const CELL = 13;
const FONT_PX = 10.5;

type Lit = { x: number; y: number; col: number; row: number; t: number; rgb: [number, number, number]; edge: number };

/** Cheap value noise: hashed lattice, bilinearly interpolated. Gives the field its soft terrain bands. */
function noise(x: number, y: number) {
  const h = (i: number, j: number) => {
    const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = h(xi, yi);
  const b = h(xi + 1, yi);
  const c = h(xi, yi + 1);
  const d = h(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function HexField({
  dark,
  reduced,
  /** Where the prism sits, as a fraction of the stage. The beam and the fan start here. */
  origin = { x: 0.63, y: 0.47 },
  /** Off where there is no prism to refract: the field is then texture alone. */
  showFan = true,
  className = "",
}: {
  dark: boolean;
  reduced?: boolean;
  origin?: { x: number; y: number };
  showFan?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  // Props the animation loop reads without restarting it.
  const live = useRef({ dark, reduced, origin });
  useEffect(() => {
    live.current = { dark, reduced, origin };
  });

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let base: HTMLCanvasElement | null = null;
    let lit: Lit[] = [];
    let beam: Lit[] = [];
    let cols = 0;
    let rows = 0;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let visible = true;
    const started = performance.now();

    // Canvas can't read CSS variables, so resolve the real family name once.
    const family = getComputedStyle(canvas).getPropertyValue("--font-jetbrains").trim() || "ui-monospace";
    const font = (px: number) => `${px}px ${family}, ui-monospace, monospace`;

    /** Rebuild everything that only depends on size: the dim base image and the lit-cell geometry. */
    const layout = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(w / CELL) + 1;
      rows = Math.ceil(h / CELL) + 1;

      // Base layer: every cell, dim, drawn once.
      base = document.createElement("canvas");
      base.width = canvas.width;
      base.height = canvas.height;
      const b = base.getContext("2d")!;
      b.setTransform(dpr, 0, 0, dpr, 0, 0);
      b.font = font(FONT_PX);
      b.textBaseline = "top";
      const ink = live.current.dark ? "255,255,255" : "40,30,70";
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          // Terrain: a slow band across the field, so the texture has structure instead of static.
          const n = noise(col * 0.055, row * 0.085) * 0.75 + noise(col * 0.013, row * 0.02) * 0.25;
          const a = (live.current.dark ? 0.03 : 0.05) + n * (live.current.dark ? 0.1 : 0.09);
          b.fillStyle = `rgba(${ink},${a.toFixed(3)})`;
          b.fillText(HEX[(Math.random() * 16) | 0], col * CELL, row * CELL);
        }
      }

      // Lit geometry: the beam in, and the fan out. Precomputed once, animated cheaply per frame.
      const ox = w * live.current.origin.x;
      const oy = h * live.current.origin.y;
      const reach = Math.hypot(w, h);
      beam = [];
      lit = [];
      if (!showFan) return;
      for (let x = 0; x < ox; x += CELL) {
        const col = Math.round(x / CELL);
        const row = Math.round(oy / CELL);
        beam.push({ x: col * CELL, y: row * CELL, col, row, t: x / ox, rgb: [255, 255, 255], edge: 0 });
      }
      for (const ray of RAYS) {
        const dx = Math.cos(ray.angle);
        const dy = Math.sin(ray.angle);
        for (let d = CELL; d < reach; d += CELL * 0.8) {
          const x = ox + dx * d;
          const y = oy + dy * d;
          if (x > w + CELL || y < -CELL || y > h + CELL) break;
          const col = Math.round(x / CELL);
          const row = Math.round(y / CELL);
          // Beams widen as they travel, but never merge: half-width is tied to the gap to the
          // neighbouring ray at this distance, so six beams stay six at any screen width.
          const gapCells = (d * RAY_STEP) / CELL;
          const spread = Math.max(0, Math.min(3, Math.floor(gapCells / 2.8)));
          for (let s = -spread; s <= spread; s++) {
            const r = row + s;
            if (r < 0 || r > rows) continue;
            lit.push({
              x: col * CELL,
              y: r * CELL,
              col,
              row: r,
              t: d / reach,
              rgb: ray.rgb,
              edge: Math.abs(s) / (spread + 0.5),
            });
          }
        }
      }
    };

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (!visible || !base) return;
      const time = (now - started) / 1000;
      const { reduced: red } = live.current;
      // Under reduced motion the sequence is already finished on the first frame.
      const p = red ? 1 : Math.max(0, Math.min(1, (time - INTRO.beam) / (INTRO.spectrum - INTRO.beam + 0.9)));
      const beamP = red ? 1 : Math.max(0, Math.min(1, (time - INTRO.beam) / (INTRO.prism - INTRO.beam)));

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(base, 0, 0, w, h);
      ctx.font = font(FONT_PX);
      ctx.textBaseline = "top";

      // The beam: hex digits carrying the light that is about to be split. White on a dark field,
      // deep violet on a light one, so it reads either way.
      const beamInk = live.current.dark ? "255,255,255" : "92,56,190";
      for (const c of beam) {
        if (c.t > beamP) continue;
        const head = 1 - Math.min(1, (beamP - c.t) * 2.5);
        const a = (live.current.dark ? 0.12 : 0.2) + head * (live.current.dark ? 0.5 : 0.55);
        ctx.fillStyle = `rgba(${beamInk},${a.toFixed(3)})`;
        ctx.fillText(HEX[((c.col * 7 + ((time * 6) | 0)) | 0) % 16], c.x, c.y);
      }

      // The fan: each ray lights the digits it passes through, in its own colour.
      for (const c of lit) {
        if (c.t > p) continue;
        const arrive = Math.min(1, (p - c.t) * 3);
        // A slow pulse travelling outward keeps the field alive once the intro has landed.
        const pulse = red ? 0.82 : 0.72 + Math.sin(time * 1.6 - c.t * 7) * 0.28;
        // Light loses itself with distance, so the fan dissolves back into the field.
        // Gentle falloff: the rays have to carry to the edge of the screen, not die halfway.
        const a = arrive * pulse * (1 - c.edge * 0.7) * Math.pow(1 - c.t, 0.45) * 1.25;
        if (a < 0.02) continue;
        const [r, g, bl] = c.rgb;
        ctx.fillStyle = `rgba(${r},${g},${bl},${a.toFixed(3)})`;
        // Digits near the prism churn; far ones hold, so the eye reads movement at the source.
        const churn = red ? 0 : ((time * (9 - c.t * 7)) | 0) * 3;
        ctx.fillText(HEX[(c.col * 5 + c.row * 3 + churn) % 16], c.x, c.y);
      }
    };

    layout();
    raf = requestAnimationFrame(draw);

    const ro = new ResizeObserver(() => layout());
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { rootMargin: "120px" });
    io.observe(canvas);
    const onVis = () => (visible = !document.hidden);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
    // The base image bakes in the theme's ink, so a theme change rebuilds the field.
  }, [dark, showFan, origin.x, origin.y]);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
