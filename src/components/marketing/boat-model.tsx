"use client";

// Yate "de cristal" con los equipos que instala Diplonautic: casco, cabina y flybridge
// transparentes, y adentro el generador, las baterías, la potabilizadora, el aire
// acondicionado, la refrigeración y la hélice de proa. Formas simples, sin modelos externos.

import { Edges } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useMemo, useRef, type MutableRefObject, type ReactNode } from "react";
import * as THREE from "three";

export type EquipmentKey = "generator" | "battery" | "water" | "ac" | "fridge" | "thruster";

export const EQUIPMENT: { id: EquipmentKey; name: string; description: string; label: [number, number, number] }[] = [
  { id: "generator", name: "Generador", description: "Energía a bordo sin depender del puerto: instalación, revisiones por horas y reparación.", label: [-4.4, 0.25, 0] },
  { id: "battery", name: "Baterías e inversor", description: "Baterías de litio, cargadores e inversores con material marino y cuadros a medida.", label: [-3.05, 0, 0] },
  { id: "water", name: "Potabilizadora", description: "Agua dulce del mar por ósmosis inversa, con mantenimiento de membranas y filtros.", label: [-1.7, 0.1, -0.8] },
  { id: "ac", name: "Aire acondicionado", description: "Climatización dimensionada para cada camarote y el salón, con sus conductos.", label: [-1.6, 1.95, 0.9] },
  { id: "fridge", name: "Refrigeración", description: "Neveras, congeladores y cámaras: instalación nueva, reparación y puesta a punto.", label: [-0.6, 1.95, -0.95] },
  { id: "thruster", name: "Hélice de proa", description: "Propulsores de proa y popa para maniobrar con precisión en el amarre.", label: [4.6, 0.05, 0] },
];

const BLUE = "#1d4ed8";
const IDLE = "#94a3b8";
/** El barco se dibuja levantado sobre el agua: las etiquetas suman el mismo desplazamiento */
export const BOAT_LIFT = 0.2;

/** Casco: planta de cubierta extruida hacia abajo, que se angosta hacia la quilla. */
function useHullGeometry() {
  return useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-6, -1.6);
    s.lineTo(-1, -2);
    s.quadraticCurveTo(4, -1.9, 6.3, 0);
    s.quadraticCurveTo(4, 1.9, -1, 2);
    s.lineTo(-6, 1.6);
    s.quadraticCurveTo(-6.25, 0, -6, -1.6);
    const g = new THREE.ExtrudeGeometry(s, { depth: 1.6, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 3, curveSegments: 32 });
    g.rotateX(-Math.PI / 2); // la planta queda en XZ y la extrusión sube en Y
    g.translate(0, -0.9, 0);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      // Fondo en V: cuanto más abajo, más angosto
      const t = THREE.MathUtils.clamp((0.7 - y) / 1.6, 0, 1);
      pos.setZ(i, pos.getZ(i) * (1 - 0.45 * t * t));
      // Arrufo: la cubierta sube hacia la proa
      const x = pos.getX(i);
      if (x > 2 && y > 0) pos.setY(i, y + 0.12 * ((x - 2) / 4.3));
    }
    g.computeVertexNormals();
    return g;
  }, []);
}

function deck(x0: number, x1: number, half: number, tip: number) {
  const s = new THREE.Shape();
  s.moveTo(x0, -half);
  s.lineTo(x1 - tip, -half);
  s.quadraticCurveTo(x1, -half * 0.6, x1, 0);
  s.quadraticCurveTo(x1, half * 0.6, x1 - tip, half);
  s.lineTo(x0, half);
  s.closePath();
  return s;
}

function Glass({ geometry, opacity }: { geometry: THREE.BufferGeometry; opacity: number }) {
  return (
    <mesh geometry={geometry} raycast={() => null}>
      <meshPhysicalMaterial color="#dbeafe" transparent opacity={opacity} roughness={0.15} depthWrite={false} side={THREE.DoubleSide} />
      <Edges threshold={20} color={BLUE} transparent opacity={0.55} />
    </mesh>
  );
}

function Shell() {
  const hull = useHullGeometry();
  const [cabin, fly] = useMemo(() => {
    const c = new THREE.ExtrudeGeometry(deck(-4.6, 2.6, 1.55, 1.6), { depth: 0.85, bevelEnabled: false, curveSegments: 24 });
    c.rotateX(-Math.PI / 2);
    c.translate(0, 0.78, 0);
    const f = new THREE.ExtrudeGeometry(deck(-2.6, 0.9, 1.25, 0.9), { depth: 0.45, bevelEnabled: false, curveSegments: 24 });
    f.rotateX(-Math.PI / 2);
    f.translate(0, 1.63, 0);
    return [c, f];
  }, []);
  return (
    <>
      <Glass geometry={hull} opacity={0.12} />
      <Glass geometry={cabin} opacity={0.08} />
      <Glass geometry={fly} opacity={0.06} />
    </>
  );
}

interface PartProps {
  id: EquipmentKey;
  activeRef: MutableRefObject<EquipmentKey | null>;
  onHover: (id: EquipmentKey | null) => void;
  position?: [number, number, number];
  rotation?: [number, number, number];
  geometry?: THREE.BufferGeometry;
  children?: ReactNode;
}

/** Un equipo: gris en reposo, azul con brillo cuando está activo. Responde al mouse. */
function Part({ id, activeRef, onHover, position, rotation, geometry, children }: PartProps) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const target = useMemo(() => new THREE.Color(), []);
  useFrame((_, dt) => {
    if (!mat.current) return;
    const on = activeRef.current === id;
    target.set(on ? BLUE : IDLE);
    mat.current.color.lerp(target, Math.min(1, dt * 6));
    mat.current.emissiveIntensity = THREE.MathUtils.damp(mat.current.emissiveIntensity, on ? 0.55 : 0, 6, dt);
  });
  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onHover(id);
  };
  return (
    <mesh position={position} rotation={rotation} geometry={geometry} onPointerOver={over} onPointerOut={() => onHover(null)}>
      {children}
      <meshStandardMaterial ref={mat} color={IDLE} emissive={BLUE} emissiveIntensity={0} roughness={0.45} metalness={0.2} />
    </mesh>
  );
}

function Equipment({ activeRef, onHover }: { activeRef: MutableRefObject<EquipmentKey | null>; onHover: (id: EquipmentKey | null) => void }) {
  const duct = useMemo(
    () =>
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(0.6, -0.15, 1.05),
          new THREE.Vector3(0.6, 1.45, 1.05),
          new THREE.Vector3(-0.5, 1.5, 0.9),
          new THREE.Vector3(-3.8, 1.5, 0.9),
        ]),
        64,
        0.07,
        8,
      ),
    [],
  );
  const p = { activeRef, onHover };
  return (
    <group>
      {/* Generador, en la sala de máquinas (popa) */}
      <Part id="generator" {...p} position={[-4.4, -0.38, 0]}>
        <boxGeometry args={[1.1, 0.6, 0.8]} />
      </Part>
      {/* Baterías */}
      {([-0.9, -0.45, 0.45, 0.9] as const).map((z) => (
        <Part key={z} id="battery" {...p} position={[-3.05, -0.48, z]}>
          <boxGeometry args={[0.5, 0.36, 0.32]} />
        </Part>
      ))}
      {/* Potabilizadora: membrana + bomba */}
      <Part id="water" {...p} position={[-1.7, -0.4, -1.05]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.16, 0.16, 1.3, 20]} />
      </Part>
      <Part id="water" {...p} position={[-1.7, -0.48, -0.55]}>
        <boxGeometry args={[0.7, 0.35, 0.35]} />
      </Part>
      {/* Aire acondicionado: unidad + conducto por el techo del salón */}
      <Part id="ac" {...p} position={[0.6, -0.4, 1.05]}>
        <boxGeometry args={[0.7, 0.45, 0.5]} />
      </Part>
      <Part id="ac" {...p} geometry={duct} />
      {/* Refrigeración en la cocina */}
      <Part id="fridge" {...p} position={[-0.6, 1.2, -0.95]}>
        <boxGeometry args={[0.55, 0.8, 0.5]} />
      </Part>
      {/* Hélice de proa: túnel de banda a banda bajo la flotación */}
      <Part id="thruster" {...p} position={[4.6, -0.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.24, 0.24, 1.6, 24, 1, true]} />
      </Part>
      <Part id="thruster" {...p} position={[4.6, -0.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.4, 12]} />
      </Part>
    </group>
  );
}

export function BoatModel({ activeRef, onHover }: { activeRef: MutableRefObject<EquipmentKey | null>; onHover: (id: EquipmentKey | null) => void }) {
  return (
    <group position={[0, BOAT_LIFT, 0]}>
      <Shell />
      <Equipment activeRef={activeRef} onHover={onHover} />
    </group>
  );
}

/** Proyecta las etiquetas a la pantalla y muestra solo la del equipo activo. */
export function LabelProjector({
  activeRef,
  labelsRef,
}: {
  activeRef: MutableRefObject<EquipmentKey | null>;
  labelsRef: MutableRefObject<(HTMLDivElement | null)[]>;
}) {
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    EQUIPMENT.forEach((e, i) => {
      const el = labelsRef.current[i];
      if (!el) return;
      v.set(e.label[0], e.label[1] + BOAT_LIFT, e.label[2]).project(camera);
      const on = activeRef.current === e.id && v.z < 1;
      el.style.transform = `translate(${(v.x + 1) * 0.5 * size.width}px, ${(1 - v.y) * 0.5 * size.height}px) translate(-50%, ${on ? "-115%" : "-85%"})`;
      el.style.opacity = on ? "1" : "0";
    });
  });
  return null;
}
