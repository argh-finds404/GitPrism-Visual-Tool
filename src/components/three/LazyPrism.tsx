"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { PrismVariant } from "./PrismScene";

const PrismScene = dynamic(() => import("./PrismScene"), { ssr: false });

type Props = {
  variant?: PrismVariant;
  background: string;
  reducedMotion?: boolean;
  scrollTarget?: React.RefObject<HTMLElement | null>;
  /** Fade the scene into the background at its edges. */
  fadeEdges?: boolean;
  /** Off when the caller already draws its own stand-in and wants the scene to crossfade over it. */
  poster?: boolean;
  /** Told when the real scene has rendered, so a caller's stand-in can step aside. */
  onReady?: () => void;
};

/**
 * A WebGL prism that never competes with the first paint or the first scroll: a static poster
 * shows at once, the 3D scene (and three.js itself) loads only near the viewport when the
 * browser is idle, and it fades in after its first real frames.
 */
export function LazyPrism({ variant = "hero", background, reducedMotion, scrollTarget, fadeEdges = true, poster = true, onReady }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [mount, setMount] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let handle: number | undefined;
    // Safari has no requestIdleCallback; a short timeout stands in for it. The poster is already
    // showing, so there's no rush to wait for a long idle gap: start as soon as the main thread
    // has a moment free, with a low ceiling so a busy page still gets the real scene quickly.
    const hasIdle = typeof window.requestIdleCallback === "function";
    const idle = (cb: () => void) => (hasIdle ? window.requestIdleCallback(cb, { timeout: 250 }) : window.setTimeout(cb, 120));
    const start = () => {
      io.disconnect();
      handle ??= idle(() => setMount(true));
    };
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) start();
      },
      { rootMargin: "400px" },
    );
    io.observe(el);

    // An observer only reports while the page is actually rendering, and a scene that is already
    // on screen shouldn't wait for that: measure once and start straight away when it is.
    const r = el.getBoundingClientRect();
    if (r.bottom > -400 && r.top < window.innerHeight + 400 && r.width > 0) start();
    return () => {
      io.disconnect();
      if (handle === undefined) return;
      if (hasIdle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, []);

  return (
    <div ref={ref} className="absolute inset-0" aria-hidden="true">
      {poster && <Poster variant={variant} hidden={ready} compiling={mount && !ready} />}
      {mount && (
        <div
          className="absolute inset-0 transition-[opacity,filter,transform] duration-500 ease-out"
          style={ready ? { opacity: 1, filter: "blur(0px)", transform: "scale(1)" } : { opacity: 0, filter: "blur(10px)", transform: "scale(0.97)" }}
        >
          <PrismScene
            variant={variant}
            background={background}
            reducedMotion={reducedMotion}
            scrollTarget={scrollTarget}
            onReady={() => {
              setReady(true);
              onReady?.();
            }}
          />
        </div>
      )}
      {fadeEdges && (
        // Static gradients instead of a CSS mask: a mask would be re-composited on every frame.
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `linear-gradient(to right, ${background}, transparent 18%, transparent 88%, ${background}), linear-gradient(to bottom, ${background}, transparent 10%, transparent 85%, ${background})`,
          }}
        />
      )}
    </div>
  );
}

/** The scene's silhouette in plain CSS and SVG, shown until the real one is ready (or if WebGL is unavailable). */
function Poster({ variant, hidden, compiling }: { variant: PrismVariant; hidden: boolean; compiling: boolean }) {
  return (
    <div className={`absolute inset-0 grid place-items-center transition-opacity duration-500 ${hidden ? "opacity-0" : "opacity-100"}`}>
      {/* A working indicator, not a decorative loop: it only plays while the real scene is compiling, and unmounts the moment it's ready. */}
      <div
        className={`absolute h-[60%] w-[60%] rounded-full ${compiling ? "animate-[prism-pulse_1.1s_ease-in-out_infinite]" : ""}`}
        style={{ background: "radial-gradient(circle, rgb(124 84 232 / 0.35), rgb(104 217 245 / 0.12) 45%, transparent 70%)" }}
      />
      <svg viewBox="0 0 200 180" className="relative h-[42%] max-h-[340px]">
        <defs>
          <linearGradient id={`poster-${variant}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#B6A0FF" stopOpacity="0.55" />
            <stop offset="0.55" stopColor="#7654E8" stopOpacity="0.35" />
            <stop offset="1" stopColor="#68D9F5" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        {variant === "hero" ? (
          <path d="M100 8 L188 168 H12 Z" fill={`url(#poster-${variant})`} stroke="#B6A0FF" strokeOpacity="0.5" />
        ) : (
          <path d="M100 4 L160 90 L100 176 L40 90 Z" fill={`url(#poster-${variant})`} stroke="#B6A0FF" strokeOpacity="0.5" />
        )}
      </svg>
    </div>
  );
}
