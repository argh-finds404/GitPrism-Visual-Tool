"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";

/** A small glass prism whose inner light takes the colour of the selected object type. */
function Prism({ color, turn, reduced }: { color: string; turn: number; reduced?: boolean }) {
  const group = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const target = useMemo(() => new THREE.Color(color), [color]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current = { x: (e.clientX / innerWidth) * 2 - 1, y: (e.clientY / innerHeight) * 2 - 1 };
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    // A triangle looks the same after a 120° turn, so each selection spins it one step.
    const tz = -turn * ((Math.PI * 2) / 3);
    g.rotation.z = THREE.MathUtils.damp(g.rotation.z, tz, reduced ? 50 : 3.5, dt);
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, reduced ? 0.35 : 0.35 + pointer.current.x * 0.3, 4, dt);
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, reduced ? 0.2 : 0.2 + pointer.current.y * 0.15, 4, dt);
    light.current?.color.lerp(target, Math.min(1, dt * 4));
  });

  return (
    <>
      <group ref={group}>
        {/* Triangle face toward the camera, like the logo. */}
        <mesh rotation={[Math.PI / 2, 0, 0]} scale={0.62}>
          <cylinderGeometry args={[1, 1, 0.9, 3, 1]} />
          <meshPhysicalMaterial
            transmission={0.92}
            thickness={1.2}
            roughness={0.08}
            ior={1.5}
            iridescence={0.6}
            clearcoat={1}
            color="#ffffff"
            envMapIntensity={1.4}
          />
        </mesh>
      </group>
      <pointLight ref={light} position={[0, 0, -0.4]} intensity={18} distance={4} color={color} />
      <mesh position={[0, 0, -1.6]}>
        <circleGeometry args={[1.05, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.22} toneMapped={false} />
      </mesh>
    </>
  );
}

export default function PrismLens({ color, turn, reduced }: { color: string; turn: number; reduced?: boolean }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 4.2], fov: 35 }}
      gl={{ alpha: true, antialias: true }}
      frameloop={reduced ? "demand" : "always"}
      aria-hidden="true"
      fallback={null}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[2, 3, 4]} intensity={1.4} />
      <Prism color={color} turn={turn} reduced={reduced} />
      <Environment resolution={64} frames={1}>
        <Lightformer form="rect" intensity={3} color="#ffffff" position={[0, 3, -2]} scale={[6, 1.5, 1]} />
        <Lightformer form="rect" intensity={2} color="#7654E8" position={[-3, 0, 1]} scale={[1.5, 4, 1]} rotation-y={Math.PI / 2} />
        <Lightformer form="rect" intensity={2} color="#68D9F5" position={[3, 0, 1]} scale={[1.5, 4, 1]} rotation-y={-Math.PI / 2} />
      </Environment>
    </Canvas>
  );
}
