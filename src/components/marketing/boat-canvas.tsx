"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { BoatModel, EQUIPMENT, LabelProjector, type EquipmentKey } from "./boat-model";

/** Anillos que se abren en el agua alrededor del barco. */
function Ripples() {
  const rings = useRef<THREE.Mesh[]>([]);
  useFrame(({ clock }) => {
    rings.current.forEach((m, i) => {
      if (!m) return;
      const t = (clock.elapsedTime * 0.12 + i / 3) % 1;
      m.scale.setScalar(1 + t * 1.6);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - t);
    });
  });
  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          raycast={() => null}
          ref={(m) => {
            if (m) rings.current[i] = m;
          }}
        >
          <ringGeometry args={[5.2, 5.25, 96]} />
          <meshBasicMaterial color="#3b82f6" transparent opacity={0.3} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

/** Lienzo 3D del barco. El equipo activo llega desde afuera (hover en el barco, en un chip o en una tarjeta). */
export default function BoatCanvas({
  active,
  onHover,
  interactive,
  autoRotate,
}: {
  active: EquipmentKey | null;
  onHover: (id: EquipmentKey | null) => void;
  /** Con mouse se puede girar; en pantallas táctiles el barco gira solo y no captura el scroll */
  interactive: boolean;
  autoRotate: boolean;
}) {
  const activeRef = useRef<EquipmentKey | null>(active);
  const labelsRef = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  return (
    <div className="relative size-full">
      <Canvas
        camera={{ position: [12, 7, 13], fov: 30 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ pointerEvents: interactive ? "auto" : "none", cursor: interactive ? "grab" : "default" }}
        onPointerMissed={() => onHover(null)}
      >
        <ambientLight intensity={0.95} />
        <directionalLight position={[6, 10, 6]} intensity={1.4} />
        <directionalLight position={[-8, 4, -6]} intensity={0.5} color="#bfdbfe" />
        <BoatModel activeRef={activeRef} onHover={onHover} />
        <Ripples />
        <LabelProjector activeRef={activeRef} labelsRef={labelsRef} />
        <OrbitControls
          enabled={interactive}
          enableZoom={false}
          enablePan={false}
          enableDamping
          autoRotate={autoRotate}
          autoRotateSpeed={0.7}
          minPolarAngle={Math.PI * 0.22}
          maxPolarAngle={Math.PI * 0.47}
          target={[0, 0.3, 0]}
        />
      </Canvas>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {EQUIPMENT.map((e, i) => (
          <div
            key={e.id}
            ref={(el) => {
              labelsRef.current[i] = el;
            }}
            className="absolute top-0 left-0 rounded-full border border-blue-200 bg-white/95 px-3 py-1 font-mono text-[11px] tracking-wider whitespace-nowrap text-blue-700 opacity-0 shadow-sm transition-opacity duration-300"
          >
            {e.name.toUpperCase()}
          </div>
        ))}
      </div>
    </div>
  );
}
