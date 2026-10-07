"use client";

import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { LabelProjector, MACHINES, MachineModel, type MachineId } from "./machine-model";

/** Anima el desmontaje hacia 0 (armado) o 1 (despiezado). */
function ExplodeDriver({ exploded, explodeRef }: { exploded: boolean; explodeRef: React.MutableRefObject<number> }) {
  useFrame((_, dt) => {
    explodeRef.current = THREE.MathUtils.damp(explodeRef.current, exploded ? 1 : 0, 3.2, dt);
  });
  return null;
}

export default function MachineCanvas({
  id,
  active,
  exploded,
  onHover,
  interactive,
  autoRotate,
}: {
  id: MachineId;
  active: string | null;
  exploded: boolean;
  onHover: (key: string | null) => void;
  interactive: boolean;
  autoRotate: boolean;
}) {
  const activeRef = useRef<string | null>(active);
  const explodeRef = useRef(0);
  const labelsRef = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  return (
    <div className="relative size-full">
      <Canvas
        camera={{ position: [7.3, 3.9, 9.3], fov: 30 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ pointerEvents: interactive ? "auto" : "none", cursor: interactive ? "grab" : "default" }}
        onPointerMissed={() => onHover(null)}
      >
        <ambientLight intensity={0.9} />
        <directionalLight position={[6, 10, 6]} intensity={1.5} />
        <directionalLight position={[-8, 4, -6]} intensity={0.6} color="#bfdbfe" />
        <ExplodeDriver exploded={exploded} explodeRef={explodeRef} />
        <group position={[0, 0.25, 0]}>
          <MachineModel key={id} id={id} activeRef={activeRef} explodeRef={explodeRef} onHover={onHover} />
        </group>
        <ContactShadows position={[0, -1.05, 0]} opacity={0.35} scale={12} blur={2.6} far={3} color="#1e3a8a" />
        <LabelProjector id={id} activeRef={activeRef} explodeRef={explodeRef} labelsRef={labelsRef} lift={0.25} />
        <OrbitControls
          enabled={interactive}
          enableZoom={false}
          enablePan={false}
          enableDamping
          autoRotate={autoRotate}
          autoRotateSpeed={0.6}
          minPolarAngle={Math.PI * 0.2}
          maxPolarAngle={Math.PI * 0.48}
          target={[0, 0.2, 0]}
        />
      </Canvas>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {MACHINES[id].map((p, i) => (
          <div
            key={`${id}-${p.key}`}
            ref={(el) => {
              labelsRef.current[i] = el;
            }}
            className="absolute top-0 left-0 rounded-full border border-blue-200 bg-white/95 px-3 py-1 font-mono text-[11px] tracking-wider whitespace-nowrap text-blue-700 opacity-0 shadow-sm transition-opacity duration-300"
          >
            {p.name.toUpperCase()}
          </div>
        ))}
      </div>
    </div>
  );
}
