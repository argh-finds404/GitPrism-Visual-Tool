"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { AnalysisResult, ImpactNode } from "@/features/impact-analysis/types";
import type { Placed, Projection, SceneEdge } from "../lens-layouts";
import { Scene2D } from "./Scene2D";

export type SceneProps = {
  projection: Projection;
  result: AnalysisResult;
  hovered: string | null;
  reduced: boolean;
  lensKey: string;
  focusId: string | null;
  focusTick: number;
  fitTick: number;
  resetTick: number;
  onSelect: (id: string) => void;
  onToggleContext: (id: string) => void;
  onHover: (id: string | null) => void;
  onFocusCluster: (id: string) => void;
  onFps?: (fps: number) => void;
  /** Screen pixels covered by HUD panels on each side; the camera centres on the free area. */
  insets?: { left: number; right: number };
};

/* ------------------------------------------------------------------ */
/* Visual language                                                     */
/* ------------------------------------------------------------------ */

export const STATUS_COLOR = { added: "#00D995", modified: "#FF007A", deleted: "#FF5D73", unchanged: "" } as const;
const KIND_COLOR = { file: "#8F7FE0", symbol: "#3FB8D0", test: "#41B27F" } as const;
export const nodeColor = (n: ImpactNode, p: Placed) => (p.status !== "unchanged" ? STATUS_COLOR[p.status] : KIND_COLOR[n.kind]);
const SIZE = { file: 0.42, symbol: 0.22, test: 0.2 } as const;

export const EDGE_COLOR: Record<SceneEdge["tone"], string> = {
  import: "#00F0FF",
  call: "#9D7BFF",
  test: "#41B27F",
  violation: "#FF3B5C",
  allowed: "#00D995",
  uncertain: "#FFB800",
};

type Positions = Map<string, THREE.Vector3>;

/* ------------------------------------------------------------------ */
/* Nodes                                                               */
/* ------------------------------------------------------------------ */

function NodeObject({
  node,
  placed,
  positions,
  hovered,
  reduced,
  geometry,
  onSelect,
  onToggleContext,
  onHover,
  onFocusCluster,
}: {
  node: ImpactNode;
  placed: Placed;
  positions: Positions;
  hovered: boolean;
  reduced: boolean;
  geometry: THREE.SphereGeometry;
  onSelect: (id: string) => void;
  onToggleContext: (id: string) => void;
  onHover: (id: string | null) => void;
  onFocusCluster: (id: string) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.MeshStandardMaterial>(null);
  const halo = useRef<THREE.Mesh>(null);
  const pulse = useRef<THREE.Mesh>(null);
  const pulseT = useRef(placed.pulse && !reduced ? 0 : 1);
  const target = useMemo(() => new THREE.Vector3(...placed.pos), [placed.pos]);
  const color = nodeColor(node, placed);
  const size = SIZE[node.kind] * (placed.scale ?? 1) * (placed.emphasis === "selected" ? 1.35 : 1);
  const opacity = placed.emphasis === "dim" ? 0.16 : placed.status === "deleted" ? 0.45 : 1;

  useEffect(() => {
    if (placed.pulse && !reduced) pulseT.current = 0;
  }, [placed.pulse, placed.pos, reduced]);

  // Register this node's live position so edges can follow it.
  useEffect(() => {
    const g = group.current!;
    g.position.copy(target);
    positions.set(node.id, g.position);
    return () => {
      if (positions.get(node.id) === g.position) positions.delete(node.id);
    };
  }, [node.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    if (reduced) g.position.copy(target);
    else {
      g.position.x = THREE.MathUtils.damp(g.position.x, target.x, 5, dt);
      g.position.y = THREE.MathUtils.damp(g.position.y, target.y, 5, dt);
      g.position.z = THREE.MathUtils.damp(g.position.z, target.z, 5, dt);
    }
    if (halo.current) {
      halo.current.quaternion.copy(state.camera.quaternion);
      const s = placed.emphasis === "selected" ? 1 + Math.sin(state.clock.elapsedTime * 3) * (reduced ? 0 : 0.06) : 1;
      halo.current.scale.setScalar(s);
    }
    if (pulse.current) {
      pulseT.current = Math.min(1, pulseT.current + dt / 1.4);
      const t = pulseT.current;
      pulse.current.visible = t < 1;
      pulse.current.scale.setScalar(1 + t * 5);
      (pulse.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.6;
      pulse.current.quaternion.copy(state.camera.quaternion);
    }
    if (core.current) core.current.emissiveIntensity = THREE.MathUtils.damp(core.current.emissiveIntensity, hovered ? 1.6 : placed.emphasis === "focus" || placed.emphasis === "selected" ? 1.1 : 0.45, 8, dt);
  });

  return (
    <group ref={group}>
      <mesh
        geometry={geometry}
        scale={size}
        onClick={(e) => {
          e.stopPropagation();
          if (e.shiftKey) onToggleContext(node.id);
          else onSelect(node.id);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onFocusCluster(node.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(node.id);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          onHover(null);
          document.body.style.cursor = "";
        }}
      >
        <meshStandardMaterial
          ref={core}
          color={color}
          emissive={color}
          emissiveIntensity={0.45}
          roughness={0.35}
          metalness={0.1}
          transparent
          opacity={opacity}
          wireframe={placed.status === "deleted"}
        />
      </mesh>
      {(placed.emphasis === "selected" || hovered) && (
        <mesh ref={halo}>
          <ringGeometry args={[size * 1.55, size * 1.8, 48]} />
          <meshBasicMaterial color={placed.emphasis === "selected" ? "#FFFFFF" : color} transparent opacity={0.9} toneMapped={false} />
        </mesh>
      )}
      {placed.status !== "unchanged" && placed.emphasis !== "dim" && (
        <mesh scale={size * 2.4}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.08} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      {placed.pulse && !reduced && (
        <mesh ref={pulse}>
          <ringGeometry args={[size * 1.2, size * 1.35, 48]} />
          <meshBasicMaterial color={color} transparent opacity={0.6} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Edges: one line set per style, rebuilt each frame from live positions */
/* ------------------------------------------------------------------ */

function EdgeSet({ edges, positions, color, strong, dashed }: { edges: SceneEdge[]; positions: Positions; color: string; strong: boolean; dashed: boolean }) {
  const ref = useRef<THREE.LineSegments>(null);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(edges.length * 6), 3));
    return g;
  }, [edges.length]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(() => {
    const attr = geometry.getAttribute("position") as THREE.BufferAttribute;
    edges.forEach((e, i) => {
      const a = positions.get(e.source);
      const b = positions.get(e.target);
      if (!a || !b) return;
      attr.setXYZ(i * 2, a.x, a.y, a.z);
      attr.setXYZ(i * 2 + 1, b.x, b.y, b.z);
    });
    attr.needsUpdate = true;
    geometry.computeBoundingSphere();
    if (dashed) ref.current?.computeLineDistances();
  });

  return (
    <lineSegments ref={ref} geometry={geometry}>
      {dashed ? (
        <lineDashedMaterial color={color} dashSize={0.25} gapSize={0.18} transparent opacity={strong ? 0.9 : 0.35} toneMapped={false} />
      ) : (
        <lineBasicMaterial color={color} transparent opacity={strong ? 0.95 : 0.22} toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} />
      )}
    </lineSegments>
  );
}

/** Small lights travelling along strong edges, from dependent to dependency. */
function Pulses({ edges, positions }: { edges: SceneEdge[]; positions: Positions }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    edges.forEach((e, i) => {
      const a = positions.get(e.source);
      const b = positions.get(e.target);
      if (!a || !b) return;
      const t = (clock.elapsedTime * 0.45 + i * 0.37) % 1;
      dummy.position.lerpVectors(a, b, t);
      dummy.scale.setScalar(0.07);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      m.setColorAt(i, color.set(EDGE_COLOR[e.tone]));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  if (!edges.length) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, edges.length]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

/* ------------------------------------------------------------------ */
/* Lens furniture                                                      */
/* ------------------------------------------------------------------ */

function circle(radius: number, y = 0, n = 96) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(a) * radius, y, Math.sin(a) * radius);
  });
}

function Rings({ rings, reduced, centerKey }: { rings: NonNullable<Projection["rings"]>; reduced: boolean; centerKey: string }) {
  const wave = useRef<THREE.Mesh>(null);
  const t = useRef(reduced ? 1 : 0);
  useEffect(() => {
    t.current = reduced ? 1 : 0;
  }, [centerKey, reduced]);
  const max = rings.at(-1)?.radius ?? 4;
  useFrame((_, dt) => {
    t.current = Math.min(1, t.current + dt / 1.6);
    if (!wave.current) return;
    wave.current.visible = t.current < 1;
    wave.current.scale.setScalar(0.01 + t.current * max);
    (wave.current.material as THREE.MeshBasicMaterial).opacity = (1 - t.current) * 0.35;
  });
  return (
    <group>
      {rings.map((r, i) => (
        <Line key={r.radius} points={circle(r.radius)} color="#FF007A" transparent opacity={0.5 - i * 0.1} lineWidth={1.2} dashed={i > 0} dashSize={0.4} gapSize={0.25} />
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <circleGeometry args={[max + 1.2, 96]} />
        <meshBasicMaterial color="#FF007A" transparent opacity={0.035} depthWrite={false} />
      </mesh>
      <mesh ref={wave} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.96, 1, 96]} />
        <meshBasicMaterial color="#FF007A" transparent opacity={0.35} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Planes({ planes }: { planes: NonNullable<Projection["planes"]> }) {
  return (
    <group>
      {planes.map((p) => (
        <group key={p.id} position={[0, p.y - 0.35, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[12, 7]} />
            <meshBasicMaterial color={p.id === "unclassified" ? "#FFB800" : "#00D995"} transparent opacity={0.045} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
          <Line
            points={[
              [-6, 0, -3.5],
              [6, 0, -3.5],
              [6, 0, 3.5],
              [-6, 0, 3.5],
              [-6, 0, -3.5],
            ]}
            color={p.id === "unclassified" ? "#FFB800" : "#00D995"}
            transparent
            opacity={0.35}
            lineWidth={1}
          />
        </group>
      ))}
    </group>
  );
}

function ContextPrism({ height }: { height: number }) {
  const geo = useMemo(() => new THREE.EdgesGeometry(new THREE.CylinderGeometry(3.4, 3.4, height + 1.5, 3, 1)), [height]);
  return (
    <lineSegments geometry={geo} position={[0, 4 - height / 2 + 0.6, 0]} rotation={[0, Math.PI / 6 + Math.PI / 2, 0]}>
      <lineBasicMaterial color="#7C3AED" transparent opacity={0.7} toneMapped={false} />
    </lineSegments>
  );
}

/* ------------------------------------------------------------------ */
/* Camera                                                              */
/* ------------------------------------------------------------------ */

function CameraRig({ projection, positions, focusId, focusTick, fitTick, resetTick, reduced, insets }: Pick<SceneProps, "projection" | "focusId" | "focusTick" | "fitTick" | "resetTick" | "reduced" | "insets"> & { positions: Positions }) {
  const { camera, controls, size } = useThree() as unknown as { camera: THREE.PerspectiveCamera; controls: OrbitControlsImpl | null; size: { width: number; height: number } };
  const goal = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const left = insets?.left ?? 0;
  const right = insets?.right ?? 0;

  // Shift the projection centre into the space between the HUD panels.
  useEffect(() => {
    camera.setViewOffset(size.width, size.height, (right - left) / 2, 0, size.width, size.height);
    camera.updateProjectionMatrix();
    return () => {
      camera.clearViewOffset();
    };
  }, [camera, size.width, size.height, left, right]);

  const fit = () => {
    const pts = [...projection.nodes.values()].filter((p) => p.emphasis !== "dim").map((p) => new THREE.Vector3(...p.pos));
    if (!pts.length) return;
    const sphere = new THREE.Sphere().setFromPoints(pts);
    // Fit to the narrower of the vertical field and the free horizontal area.
    const vHalf = THREE.MathUtils.degToRad(camera.fov / 2);
    const freeAspect = Math.max(0.3, (size.width - left - right) / size.height);
    const hHalf = Math.atan(Math.tan(vHalf) * freeAspect);
    const dist = Math.max(8, sphere.radius / Math.sin(Math.min(vHalf, hHalf)) + 1);
    const dir = new THREE.Vector3(0, 0.55, 1).normalize();
    goal.current = { pos: sphere.center.clone().addScaledVector(dir, dist), target: sphere.center.clone() };
  };

  useEffect(fit, [fitTick]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    goal.current = { pos: new THREE.Vector3(0, 13, 24), target: new THREE.Vector3(0, 0, 0) };
  }, [resetTick]);
  useEffect(() => {
    if (!focusId || !focusTick) return;
    const p = projection.nodes.get(focusId);
    if (!p) return;
    const target = new THREE.Vector3(...p.pos);
    const dir = camera.position.clone().sub(controls?.target ?? new THREE.Vector3()).normalize();
    goal.current = { pos: target.clone().addScaledVector(dir, 14), target };
  }, [focusTick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!controls) return;
    const cancel = () => (goal.current = null);
    controls.addEventListener("start", cancel);
    return () => controls.removeEventListener("start", cancel);
  }, [controls]);

  useFrame((_, dt) => {
    const g = goal.current;
    if (!g || !controls) return;
    const k = reduced ? 1 : 1 - Math.exp(-dt * 5.5);
    camera.position.lerp(g.pos, k);
    controls.target.lerp(g.target, k);
    controls.update();
    if (camera.position.distanceTo(g.pos) < 0.02) goal.current = null;
  });
  void positions;
  return null;
}

function FpsMeter({ onFps }: { onFps?: (fps: number) => void }) {
  const frames = useRef(0);
  const last = useRef(0);
  useFrame(({ clock }) => {
    frames.current++;
    const t = clock.elapsedTime;
    if (t - last.current >= 0.5) {
      onFps?.(Math.round(frames.current / (t - last.current)));
      frames.current = 0;
      last.current = t;
    }
  });
  return null;
}

function Stars() {
  const geo = useMemo(() => {
    let s = 11;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const arr = new Float32Array(900 * 3);
    for (let i = 0; i < arr.length; i += 3) {
      const r = 40 + rnd() * 40;
      const a = rnd() * Math.PI * 2;
      const b = Math.acos(2 * rnd() - 1);
      arr.set([r * Math.sin(b) * Math.cos(a), r * Math.cos(b), r * Math.sin(b) * Math.sin(a)], i);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return g;
  }, []);
  return (
    <points geometry={geo}>
      <pointsMaterial color="#6E62A8" size={0.12} transparent opacity={0.55} sizeAttenuation />
    </points>
  );
}

/* ------------------------------------------------------------------ */
/* Scene                                                               */
/* ------------------------------------------------------------------ */

type Label = {
  id: string;
  nodeId?: string;
  at?: [number, number, number];
  lift: number;
  text: string;
  sub?: string;
  color: string;
  tone: "selected" | "normal" | "dim" | "ring" | "plane" | "plane-warn";
};

/** Moves DOM labels to their nodes' screen positions every frame. */
function LabelProjector({ labels, positions, els }: { labels: Label[]; positions: Positions; els: Map<string, HTMLDivElement> }) {
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    for (const l of labels) {
      const el = els.get(l.id);
      if (!el) continue;
      const p = l.nodeId ? positions.get(l.nodeId) : null;
      if (l.nodeId && !p) {
        el.style.visibility = "hidden";
        continue;
      }
      if (p) v.set(p.x, p.y + l.lift, p.z);
      else v.set(...l.at!);
      v.project(camera);
      el.style.visibility = v.z > 1 || v.z < -1 ? "hidden" : "visible";
      el.style.transform = `translate(${(v.x * 0.5 + 0.5) * size.width}px, ${(-v.y * 0.5 + 0.5) * size.height}px) translate(-50%, -100%)`;
    }
  });
  return null;
}

function buildLabels(props: SceneProps): Label[] {
  const { projection, result, hovered } = props;
  const byId = new Map(result.nodes.map((n) => [n.id, n]));
  const out: Label[] = [];
  for (const [id, p] of projection.nodes) {
    const n = byId.get(id);
    if (!n || !(p.label || hovered === id)) continue;
    out.push({
      id: `n:${id}`,
      nodeId: id,
      lift: SIZE[n.kind] * (p.scale ?? 1) * (p.emphasis === "selected" ? 1.35 : 1) + 0.28,
      text: n.kind === "symbol" ? `${n.name}()` : n.name,
      sub: p.ring !== undefined && p.ring > 0 ? `r${p.ring}` : undefined,
      color: nodeColor(n, p),
      tone: p.emphasis === "selected" ? "selected" : p.emphasis === "dim" && hovered !== id ? "dim" : "normal",
    });
  }
  projection.rings?.forEach((r) => out.push({ id: `r:${r.radius}`, at: [r.radius + 0.2, 0.15, 0], lift: 0, text: r.label, color: "#FF007A", tone: "ring" }));
  projection.planes?.forEach((p) =>
    out.push({ id: `p:${p.id}`, at: [-6.2, p.y - 0.25, -3.5], lift: 0, text: p.label, color: "#00D995", tone: p.id === "unclassified" ? "plane-warn" : "plane" }),
  );
  return out;
}

const LABEL_CLASS: Record<Label["tone"], string> = {
  selected: "rounded-md bg-white px-1.5 py-0.5 text-[#100E16] shadow",
  normal: "rounded-md bg-[#1A1623]/85 px-1.5 py-0.5 text-[#F3EEF8] shadow",
  dim: "rounded-md bg-[#1A1623]/60 px-1.5 py-0.5 text-[#8d86a0]",
  ring: "text-[#FF7AB6]",
  plane: "text-[11px] text-[#5CE7B5]",
  "plane-warn": "text-[11px] text-[#FFB800]",
};

function Scene(props: SceneProps & { positions: Positions; labels: Label[]; labelEls: Map<string, HTMLDivElement> }) {
  const { projection, result, hovered, reduced, positions } = props;
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 28, 28), []);
  const byId = useMemo(() => new Map(result.nodes.map((n) => [n.id, n])), [result]);

  // Group edges by style so each style is a single draw call.
  const groups = useMemo(() => {
    const m = new Map<string, SceneEdge[]>();
    for (const e of projection.edges) {
      if (!projection.nodes.has(e.source) || !projection.nodes.has(e.target)) continue;
      const strong = e.strong || (!!hovered && (e.source === hovered || e.target === hovered));
      const key = `${e.tone}|${strong ? 1 : 0}|${e.kind === "tests" ? 1 : 0}`;
      (m.get(key) ?? m.set(key, []).get(key)!).push({ ...e, strong });
    }
    return [...m.entries()];
  }, [projection, hovered]);
  const pulseEdges = useMemo(() => (reduced ? [] : groups.filter(([k]) => k.split("|")[1] === "1").flatMap(([, e]) => e).slice(0, 60)), [groups, reduced]);

  return (
    <>
      <color attach="background" args={["#100E16"]} />
      <fog attach="fog" args={["#100E16", 28, 70]} />
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 14, 10]} intensity={60} color="#B9A6FF" />
      <pointLight position={[-12, -6, -8]} intensity={30} color="#00F0FF" />
      <Stars />
      <gridHelper args={[60, 60, "#2A2338", "#1B1724"]} position={[0, -4.5, 0]} />

      {projection.rings && <Rings rings={projection.rings} reduced={reduced} centerKey={`${props.lensKey}:${projection.radius?.center}`} />}
      {projection.planes && <Planes planes={projection.planes} />}
      {projection.prism && <ContextPrism height={projection.prism.height} />}

      {groups.map(([key, edges]) => {
        const [tone, strong, dashed] = key.split("|");
        return <EdgeSet key={key + edges.length} edges={edges} positions={positions} color={EDGE_COLOR[tone as SceneEdge["tone"]]} strong={strong === "1"} dashed={dashed === "1"} />;
      })}
      <Pulses key={pulseEdges.length} edges={pulseEdges} positions={positions} />

      {[...projection.nodes.entries()].map(([id, placed]) => {
        const node = byId.get(id);
        if (!node) return null;
        return (
          <NodeObject
            key={id}
            node={node}
            placed={placed}
            positions={positions}
            hovered={hovered === id}
            reduced={reduced}
            geometry={geometry}
            onSelect={props.onSelect}
            onToggleContext={props.onToggleContext}
            onHover={props.onHover}
            onFocusCluster={props.onFocusCluster}
          />
        );
      })}

      <LabelProjector labels={props.labels} positions={positions} els={props.labelEls} />
      <CameraRig projection={projection} positions={positions} focusId={props.focusId} focusTick={props.focusTick} fitTick={props.fitTick} resetTick={props.resetTick} reduced={reduced} insets={props.insets} />
      {props.onFps && <FpsMeter onFps={props.onFps} />}
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={3} maxDistance={60} />
    </>
  );
}

export default function ImpactScene(props: SceneProps) {
  // Live node positions, written by nodes each frame and read by edges and labels.
  const positions = useMemo<Positions>(() => new Map(), []);
  const labelEls = useMemo(() => new Map<string, HTMLDivElement>(), []);
  const { projection, result, hovered } = props;
  const labels = useMemo(() => buildLabels({ ...props, projection, result, hovered }), [projection, result, hovered]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative h-full w-full">
      <Canvas
        camera={{ position: [0, 13, 24], fov: 45 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onPointerMissed={() => props.onHover(null)}
        fallback={<Scene2D {...props} />}
      >
        <Scene {...props} positions={positions} labels={labels} labelEls={labelEls} />
      </Canvas>
      {/* One plain DOM layer for every label: no extra React roots, always under the HUD. */}
      <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden" aria-hidden="true">
        {labels.map((l) => (
          <div
            key={l.id}
            ref={(el) => {
              if (el) labelEls.set(l.id, el);
              else labelEls.delete(l.id);
            }}
            className={`absolute left-0 top-0 whitespace-nowrap font-mono text-[10.5px] leading-tight ${LABEL_CLASS[l.tone]}`}
            style={{ visibility: "hidden", borderLeft: l.nodeId ? `2px solid ${l.color}` : undefined }}
          >
            {l.text}
            {l.sub && <span className="ml-1 text-[#FF7AB6]">{l.sub}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
