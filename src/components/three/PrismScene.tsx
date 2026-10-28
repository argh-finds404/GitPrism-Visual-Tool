"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Edges, Environment, Lightformer, MeshTransmissionMaterial, PerformanceMonitor } from "@react-three/drei";

export type PrismVariant = "hero" | "finale";

type Props = {
  variant?: PrismVariant;
  background: string;
  reducedMotion?: boolean;
  /** Pixel element whose scroll progress drives the transformation. */
  scrollTarget?: React.RefObject<HTMLElement | null>;
  /** Called once the first frames have rendered, so a poster can hand over without a flash. */
  onReady?: () => void;
};

const SPECTRUM = ["#68D9F5", "#7C9BFF", "#B6A0FF", "#E85AC4", "#FFB36B"];

/* ------------------------------------------------------------------ */
/* Shared input refs (pointer + scroll), read inside useFrame          */
/* ------------------------------------------------------------------ */

function useWindowPointer() {
  const p = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      p.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      p.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);
  return p;
}

function useScrollProgress(target?: React.RefObject<HTMLElement | null>) {
  const p = useRef(0);
  useEffect(() => {
    let cachedHeight = window.innerHeight;
    const measure = () => {
      const el = target?.current;
      cachedHeight = Math.max(1, el ? el.offsetHeight : window.innerHeight);
    };
    const onScroll = () => {
      p.current = Math.min(1, Math.max(0, window.scrollY / cachedHeight));
    };
    measure();
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
    };
  }, [target]);
  return p;
}

/* ------------------------------------------------------------------ */
/* Geometry helpers                                                    */
/* ------------------------------------------------------------------ */

function useTriangularPrism() {
  return useMemo(() => {
    const R = 1.35;
    const shape = new THREE.Shape();
    const pts = [90, 210, 330].map((deg) => {
      const a = (deg * Math.PI) / 180;
      return new THREE.Vector2(Math.cos(a) * R, Math.sin(a) * R);
    });
    shape.moveTo(pts[0].x, pts[0].y);
    shape.lineTo(pts[1].x, pts[1].y);
    shape.lineTo(pts[2].x, pts[2].y);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: 1.05,
      bevelEnabled: true,
      bevelThickness: 0.07,
      bevelSize: 0.07,
      bevelSegments: 6,
      curveSegments: 1,
    });
    g.center();
    g.computeVertexNormals();
    return g;
  }, []);
}

/** A soft, fading strip of light from a to b. */
function useFadeTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 8;
    const ctx = c.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, 256, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.18, "rgba(255,255,255,1)");
    g.addColorStop(0.82, "rgba(255,255,255,1)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 8);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
}

function Beam({
  from,
  to,
  color,
  width,
  opacity,
  map,
  fadeIn = true,
}: {
  from: [number, number, number];
  to: [number, number, number];
  color: string;
  width: number;
  opacity: number;
  map: THREE.Texture;
  fadeIn?: boolean;
}) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const len = a.distanceTo(b);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  return (
    <group position={mid} rotation={[0, 0, angle]}>
      {[1, 4].map((k) => (
        <mesh key={k} renderOrder={2}>
          <planeGeometry args={[len, width * k]} />
          <meshBasicMaterial
            color={color}
            map={fadeIn ? map : undefined}
            transparent
            opacity={k === 1 ? opacity : opacity * 0.18}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Floating geometric fragments                                        */
/* ------------------------------------------------------------------ */

/** Deterministic pseudo-random so the layout is stable between mounts. */
function seededRandom(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function Fragments({
  count,
  scroll,
  reducedMotion,
  dark,
}: {
  count: number;
  scroll: React.RefObject<number>;
  reducedMotion?: boolean;
  dark: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const seeds = useMemo(() => {
    const rnd = seededRandom(7);
    return Array.from({ length: count }, () => ({
      pos: new THREE.Vector3(-1.6 + rnd() * 6.2, (rnd() - 0.5) * 5.2, (rnd() - 0.5) * 4 - 1.2),
      dir: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.3).normalize(),
      scale: 0.03 + rnd() * 0.07,
      speed: 0.15 + rnd() * 0.35,
      phase: rnd() * Math.PI * 2,
    }));
  }, [count]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colors = useMemo(() => {
    const arr = new Float32Array(count * 3);
    const palette = dark ? ["#B6A0FF", "#68D9F5", "#E85AC4", "#ffffff"] : ["#7654E8", "#B6A0FF", "#68D9F5", "#9C86F5"];
    seeds.forEach((_, i) => {
      const c = new THREE.Color(palette[i % palette.length]);
      arr.set([c.r, c.g, c.b], i * 3);
    });
    return arr;
  }, [count, seeds, dark]);

  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const t = reducedMotion ? 0 : clock.elapsedTime;
    const spread = 1 + scroll.current * 2.2;
    seeds.forEach((s, i) => {
      dummy.position
        .copy(s.pos)
        .addScaledVector(s.dir, Math.sin(t * s.speed + s.phase) * 0.35)
        .multiplyScalar(spread);
      dummy.rotation.set(t * s.speed + s.phase, t * s.speed * 0.7, s.phase);
      dummy.scale.setScalar(s.scale * (1 + scroll.current * 1.5));
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <tetrahedronGeometry args={[1, 0]}>
        <instancedBufferAttribute attach="attributes-color" args={[colors, 3]} />
      </tetrahedronGeometry>
      <meshStandardMaterial vertexColors roughness={0.25} metalness={0.1} transparent opacity={dark ? 0.75 : 0.55} />
    </instancedMesh>
  );
}

/* ------------------------------------------------------------------ */
/* The hero prism                                                      */
/* ------------------------------------------------------------------ */

function HeroPrism({
  background,
  reducedMotion,
  pointer,
  scroll,
  quality,
}: {
  background: string;
  reducedMotion?: boolean;
  pointer: React.RefObject<{ x: number; y: number }>;
  scroll: React.RefObject<number>;
  quality: "high" | "low";
}) {
  const group = useRef<THREE.Group>(null);
  const prism = useRef<THREE.Mesh>(null);
  const sweep = useRef<THREE.PointLight>(null);
  const beams = useRef<THREE.Group>(null);
  const geometry = useTriangularPrism();
  const fade = useFadeTexture();
  const bg = useMemo(() => new THREE.Color(background), [background]);
  const dark = bg.getHSL({ h: 0, s: 0, l: 0 }).l < 0.4;
  const halo = useHalo(dark);
  const viewport = useThree((s) => s.viewport);
  // Fit the prism to the stage: never wider than ~40% of it, never taller than ~55%.
  const fit = Math.min(1, viewport.width / 5.6, viewport.height / 4.3);

  useFrame(({ clock }, dt) => {
    const t = reducedMotion ? 0 : clock.elapsedTime;
    const s = scroll.current;
    const g = group.current;
    if (g) {
      const targetY = Math.sin(t * 0.35) * 0.32 + (reducedMotion ? 0 : pointer.current.x * 0.35) + s * 1.6;
      const targetX = Math.sin(t * 0.27) * 0.08 + (reducedMotion ? 0 : pointer.current.y * 0.18) + s * 0.5;
      g.rotation.y = THREE.MathUtils.damp(g.rotation.y, targetY, 3, dt);
      g.rotation.x = THREE.MathUtils.damp(g.rotation.x, targetX, 3, dt);
      g.position.y = Math.sin(t * 0.8) * 0.06 - s * 1.4;
      g.scale.setScalar(fit * (1 - s * 0.35));
    }
    if (sweep.current) {
      sweep.current.position.set(Math.sin(t * 0.6) * 3, Math.cos(t * 0.45) * 1.6, 2.4);
    }
    if (beams.current) {
      beams.current.visible = s < 0.95;
      beams.current.children.forEach((c) =>
        c.traverse((o) => {
          const mat = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
          if (mat && "userData" in mat) {
            mat.userData.base ??= mat.opacity;
            mat.opacity = mat.userData.base * (1 - s) * (0.85 + Math.sin(t * 2.2) * 0.15);
          }
        }),
      );
    }
  });

  // Entry and exit points on the prism's left and right faces.
  const entry: [number, number, number] = [-0.58, 0.25, 0];
  const exit = (i: number): [number, number, number] => [0.5 + i * 0.03, 0.42 - i * 0.12, 0];
  const out = (i: number): [number, number, number] => [7, -0.4 - i * 0.55, 0];

  return (
    <>
      {/* Soft halo so the glass has colour to refract. */}
      <mesh position={[0.3, -0.1, -2.4]} scale={fit}>
        <planeGeometry args={[6, 6]} />
        <meshBasicMaterial transparent depthWrite={false} toneMapped={false} map={halo} />
      </mesh>

      <group ref={beams} scale={fit}>
        <Beam from={[-8, -1.0, 0]} to={entry} color="#ffffff" width={0.035} opacity={dark ? 1 : 0.95} map={fade} />
        <Beam from={[-8, -1.0, 0]} to={entry} color="#B6A0FF" width={0.06} opacity={dark ? 0.45 : 0.6} map={fade} />
        {SPECTRUM.map((c, i) => (
          <Beam key={`in-${c}`} from={entry} to={exit(i)} color={c} width={0.04} opacity={0.9} map={fade} fadeIn={false} />
        ))}
        {SPECTRUM.map((c, i) => (
          <Beam key={c} from={exit(i)} to={out(i)} color={c} width={0.045} opacity={dark ? 0.9 : 0.85} map={fade} />
        ))}
      </group>

      <group ref={group}>
        <mesh ref={prism} geometry={geometry}>
          <MeshTransmissionMaterial
            background={bg}
            samples={quality === "high" ? 3 : 2}
            resolution={quality === "high" ? 256 : 128}
            transmission={1}
            thickness={0.7}
            roughness={0.04}
            ior={1.45}
            chromaticAberration={0.9}
            anisotropicBlur={0.2}
            distortion={0.25}
            distortionScale={0.4}
            temporalDistortion={0}
            backside={false}
            color={dark ? "#e6ddff" : "#ffffff"}
            attenuationColor="#e4dbff"
            attenuationDistance={6}
            iridescence={0.7}
            iridescenceIOR={1.3}
            iridescenceThicknessRange={[120, 760]}
            clearcoat={1}
            clearcoatRoughness={0.05}
            envMapIntensity={dark ? 1.4 : 2.2}
          />
          <Edges threshold={20} color={dark ? "#b6a0ff" : "#7654e8"} lineWidth={1} transparent opacity={dark ? 0.55 : 0.4} />
        </mesh>
      </group>

      <pointLight ref={sweep} color="#9b7dff" intensity={18} distance={8} />
    </>
  );
}

function useHalo(dark: boolean) {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const ctx = c.getContext("2d")!;
    const blob = (x: number, y: number, r: number, color: string) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, color.replace(/[\d.]+\)$/, "0)"));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 512, 512);
    };
    const a = dark ? 0.42 : 0.22;
    blob(236, 236, 190, `rgba(118,84,232,${a})`);
    blob(300, 290, 140, `rgba(104,217,245,${a * 0.75})`);
    blob(250, 320, 120, `rgba(232,90,196,${a * 0.55})`);
    // A soft dispersion band through the middle, so the glass refracts a spectrum.
    const layer = document.createElement("canvas");
    layer.width = layer.height = 512;
    const lc = layer.getContext("2d")!;
    const band = lc.createLinearGradient(0, -70, 0, 70);
    const k = dark ? 0.55 : 0.42;
    band.addColorStop(0, "rgba(104,217,245,0)");
    band.addColorStop(0.2, `rgba(104,217,245,${k})`);
    band.addColorStop(0.4, `rgba(124,155,255,${k})`);
    band.addColorStop(0.55, `rgba(182,160,255,${k})`);
    band.addColorStop(0.7, `rgba(232,90,196,${k})`);
    band.addColorStop(0.85, `rgba(255,179,107,${k * 0.8})`);
    band.addColorStop(1, "rgba(255,179,107,0)");
    // Draw the band on its own layer, feather it with a radial mask, then composite.
    lc.translate(256, 256);
    lc.rotate(-0.42);
    lc.fillStyle = band;
    lc.fillRect(-256, -70, 512, 140);
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.globalCompositeOperation = "destination-in";
    const mask = lc.createRadialGradient(256, 256, 0, 256, 256, 170);
    mask.addColorStop(0, "rgba(0,0,0,1)");
    mask.addColorStop(0.6, "rgba(0,0,0,0.7)");
    mask.addColorStop(1, "rgba(0,0,0,0)");
    lc.fillStyle = mask;
    lc.fillRect(0, 0, 512, 512);
    ctx.drawImage(layer, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [dark]);
}

/* ------------------------------------------------------------------ */
/* Finale crystal (octahedron)                                         */
/* ------------------------------------------------------------------ */

function FinaleCrystal({ reducedMotion, pointer }: { reducedMotion?: boolean; pointer: React.RefObject<{ x: number; y: number }> }) {
  const ref = useRef<THREE.Group>(null);
  const bg = useMemo(() => new THREE.Color("#191720"), []);
  const halo = useHalo(true);
  useFrame(({ clock }, dt) => {
    const g = ref.current;
    if (!g) return;
    const t = reducedMotion ? 0 : clock.elapsedTime;
    g.rotation.y = t * 0.25 + (reducedMotion ? 0 : pointer.current.x * 0.4);
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, (reducedMotion ? 0 : pointer.current.y * 0.15) + 0.12, 3, dt);
    g.position.y = Math.sin(t * 0.7) * 0.08;
  });
  return (
    <>
    <mesh position={[0, 0, -2.4]}>
      <planeGeometry args={[6.5, 6.5]} />
      <meshBasicMaterial transparent depthWrite={false} toneMapped={false} map={halo} />
    </mesh>
    <group ref={ref}>
      <mesh scale={[0.95, 1.3, 0.95]}>
        <octahedronGeometry args={[1, 0]} />
        <MeshTransmissionMaterial
          background={bg}
          samples={3}
          resolution={256}
          transmission={1}
          thickness={2}
          roughness={0.08}
          ior={1.5}
          chromaticAberration={1}
          anisotropicBlur={0.3}
          distortion={0.2}
          distortionScale={0.3}
          temporalDistortion={0}
          color="#e2d8ff"
          iridescence={0.8}
          iridescenceIOR={1.3}
          clearcoat={1}
          envMapIntensity={1.6}
        />
        <Edges threshold={15} color="#b6a0ff" transparent opacity={0.5} />
      </mesh>
    </group>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Canvas                                                              */
/* ------------------------------------------------------------------ */

/** Reports readiness after two rendered frames: by then shaders have compiled and the image is real. */
function Ready({ onReady }: { onReady?: () => void }) {
  const frames = useRef(0);
  useFrame(() => {
    // One real frame is enough: shaders have compiled and the image is genuine by then.
    if (frames.current < 2 && ++frames.current === 1) onReady?.();
  });
  return null;
}

export default function PrismScene({ variant = "hero", background, reducedMotion, scrollTarget, onReady }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [quality] = useState<"high" | "low">(() =>
    typeof window !== "undefined" && (window.innerWidth < 768 || (navigator.hardwareConcurrency ?? 8) <= 4) ? "low" : "high",
  );
  const [dpr, setDpr] = useState(quality === "high" ? 1.5 : 1);
  const pointer = useWindowPointer();
  const scroll = useScrollProgress(scrollTarget);
  const dark = variant === "finale" || new THREE.Color(background).getHSL({ h: 0, s: 0, l: 0 }).l < 0.4;

  // Stop rendering entirely when the scene is off screen.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "100px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrap} className="absolute inset-0">
      <Canvas
        dpr={dpr}
        camera={{ position: [0, 0, variant === "hero" ? 7.2 : 6.2], fov: 35 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        frameloop={visible ? "always" : "never"}
        aria-hidden="true"
        style={{ pointerEvents: "none" }}
      >
        {/* If frames drop, render fewer pixels. Only the resolution changes: switching materials
            would recompile shaders, a bigger hitch than the one being avoided. */}
        <PerformanceMonitor onDecline={() => setDpr(1)} flipflops={2} />
        <Ready onReady={onReady} />
        <ambientLight intensity={dark ? 0.4 : 0.8} />
        <directionalLight position={[3, 4, 5]} intensity={dark ? 1.2 : 1.6} />

        {variant === "hero" ? (
          <HeroPrism background={background} reducedMotion={reducedMotion} pointer={pointer} scroll={scroll} quality={quality} />
        ) : (
          <FinaleCrystal reducedMotion={reducedMotion} pointer={pointer} />
        )}

        <Fragments count={quality === "high" ? 30 : 16} scroll={variant === "hero" ? scroll : { current: 0 }} reducedMotion={reducedMotion} dark={dark} />

        <Environment resolution={128} frames={1}>
          <Lightformer form="rect" intensity={dark ? 3 : 4} color="#ffffff" position={[0, 4, -3]} scale={[10, 2, 1]} />
          <Lightformer form="rect" intensity={3} color="#7654E8" position={[-5, 0, 2]} scale={[2, 8, 1]} rotation-y={Math.PI / 2} />
          <Lightformer form="rect" intensity={2.5} color="#68D9F5" position={[5, 1, 2]} scale={[2, 6, 1]} rotation-y={-Math.PI / 2} />
          <Lightformer form="ring" intensity={2} color="#E85AC4" position={[0, -3, 4]} scale={3} />
        </Environment>
      </Canvas>
    </div>
  );
}
