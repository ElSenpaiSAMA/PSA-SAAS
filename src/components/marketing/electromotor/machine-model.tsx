"use client";

// Los equipos que repara ElectroMotor, en 3D y "de cristal": carcasa transparente y
// adentro las piezas que revisa el taller. Se pueden desmontar (vista despiezada).
// Formas simples hechas con código, sin modelos externos, como el barco de la home.

import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useMemo, useRef, type MutableRefObject, type ReactNode } from "react";
import * as THREE from "three";

export type MachineId = "arranque" | "alternadores" | "dinamos" | "motores" | "bombas";

type V3 = [number, number, number];
type Kind = "metal" | "copper" | "glass";

export interface PartDef {
  key: string;
  name: string;
  pos: V3;
  /** Hacia dónde sale la pieza al desmontar */
  explode: V3;
  kind?: Kind;
  /** Altura de la etiqueta sobre la pieza */
  tag?: number;
  shape: (m: THREE.Material) => ReactNode;
}

const BLUE = "#1d4ed8";
const IDLE: Record<Kind, string> = { metal: "#94a3b8", copper: "#c2814f", glass: "#dbeafe" };
const AX: V3 = [0, 0, Math.PI / 2]; // cilindros acostados sobre el eje X
const RING: V3 = [0, Math.PI / 2, 0]; // toroides perpendiculares al eje X

// ── Piezas básicas ────────────────────────────────────────────────────────────

function Cyl({ m, r, h, x = 0, y = 0, z = 0, r2, seg = 40, rot = AX }: { m: THREE.Material; r: number; h: number; x?: number; y?: number; z?: number; r2?: number; seg?: number; rot?: V3 }) {
  return (
    <mesh material={m} position={[x, y, z]} rotation={rot}>
      <cylinderGeometry args={[r2 ?? r, r, h, seg]} />
    </mesh>
  );
}

function Ring({ m, r, t, x = 0 }: { m: THREE.Material; r: number; t: number; x?: number }) {
  return (
    <mesh material={m} position={[x, 0, 0]} rotation={RING}>
      <torusGeometry args={[r, t, 14, 48]} />
    </mesh>
  );
}

/** Piezas repetidas alrededor del eje X (aletas, dientes, garras, diodos). */
function Around({ n, r, children, offset = 0 }: { n: number; r: number; offset?: number; children: (i: number) => ReactNode }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + offset;
        return (
          <group key={i} rotation={[a, 0, 0]}>
            <group position={[0, r, 0]}>{children(i)}</group>
          </group>
        );
      })}
    </>
  );
}

/** Corona hueca (estator, carcasa con espesor). */
function Annulus({ m, rIn, rOut, h }: { m: THREE.Material; rIn: number; rOut: number; h: number }) {
  const g = useMemo(() => {
    const pts = [new THREE.Vector2(rIn, -h / 2), new THREE.Vector2(rOut, -h / 2), new THREE.Vector2(rOut, h / 2), new THREE.Vector2(rIn, h / 2), new THREE.Vector2(rIn, -h / 2)];
    return new THREE.LatheGeometry(pts, 56);
  }, [rIn, rOut, h]);
  return <mesh material={m} geometry={g} rotation={AX} />;
}

const box = (m: THREE.Material, size: V3, pos: V3 = [0, 0, 0], rot?: V3) => (
  <mesh material={m} position={pos} rotation={rot}>
    <boxGeometry args={size} />
  </mesh>
);

const pulley = (m: THREE.Material) => (
  <>
    <Cyl m={m} r={0.5} h={0.08} x={-0.13} />
    <Cyl m={m} r={0.36} h={0.2} />
    <Cyl m={m} r={0.5} h={0.08} x={0.13} />
    <Cyl m={m} r={0.12} h={0.4} />
  </>
);

const fan = (m: THREE.Material, r = 0.7) => (
  <>
    <Cyl m={m} r={r * 0.45} h={0.06} />
    <Around n={12} r={r * 0.68}>{() => box(m, [0.16, r * 0.5, 0.035], [0, 0, 0], [0.35, 0, 0])}</Around>
  </>
);

const bearing = (m: THREE.Material) => (
  <>
    <Ring m={m} r={0.2} t={0.055} />
    <Ring m={m} r={0.12} t={0.03} />
  </>
);

const gear = (m: THREE.Material, r: number, h: number, n = 11) => (
  <>
    <Cyl m={m} r={r} h={h} />
    <Around n={n} r={r}>{() => box(m, [h, 0.1, 0.09])}</Around>
  </>
);

const commutator = (m: THREE.Material, r: number, h: number) => (
  <>
    <Cyl m={m} r={r} h={h} seg={20} />
    <Around n={14} r={r}>{() => box(m, [h * 1.02, 0.02, 0.025])}</Around>
  </>
);

const armature = (m: THREE.Material, r: number, h: number) => (
  <>
    <Cyl m={m} r={r} h={h} />
    <Around n={16} r={r}>{() => box(m, [h * 1.04, 0.07, 0.07])}</Around>
  </>
);

const brushes = (m: THREE.Material, r: number) => (
  <>
    <Ring m={m} r={r} t={0.035} />
    <Around n={4} r={r} offset={Math.PI / 4}>
      {() => box(m, [0.16, 0.2, 0.14], [0, -0.05, 0])}
    </Around>
  </>
);

const shaft = (m: THREE.Material, len: number) => <Cyl m={m} r={0.07} h={len} seg={16} />;

// ── Los cinco equipos ───────────────────────────────────────────────────────────

export const MACHINES: Record<MachineId, PartDef[]> = {
  alternadores: [
    { key: "polea", name: "Polea", pos: [-2.15, 0, 0], explode: [-1.7, 0, 0], shape: pulley },
    { key: "ventilador", name: "Ventilador", pos: [-1.75, 0, 0], explode: [-1.15, 0, 0], shape: (m) => fan(m, 0.8) },
    { key: "tapa-del", name: "Tapa delantera", kind: "glass", pos: [-1.2, 0, 0], explode: [-0.6, 0, 0], shape: (m) => <Cyl m={m} r={1.05} r2={0.85} h={0.55} /> },
    { key: "rodamientos", name: "Rodamientos", pos: [-1.2, 0, 0], explode: [-0.6, -1.1, 0], tag: 0.4, shape: (m) => <>{bearing(m)}<group position={[2.45, 0, 0]}>{bearing(m)}</group></> },
    { key: "estator", name: "Estator", kind: "copper", pos: [-0.05, 0, 0], explode: [0, 1.55, 0], tag: 1.2, shape: (m) => <><Annulus m={m} rIn={0.72} rOut={1.02} h={0.75} /><Ring m={m} r={0.86} t={0.07} x={-0.42} /><Ring m={m} r={0.86} t={0.07} x={0.42} /></> },
    { key: "rotor", name: "Rotor", pos: [-0.05, 0, 0], explode: [0, 0, 0], shape: (m) => <>{shaft(m, 4.2)}<Cyl m={m} r={0.58} h={0.72} /><Around n={6} r={0.6}>{(i) => box(m, [0.5, 0.05, 0.3], [i % 2 ? 0.12 : -0.12, 0, 0])}</Around></> },
    { key: "anillos", name: "Anillos colectores", kind: "copper", pos: [0.72, 0, 0], explode: [0.45, 0, 0], tag: 0.45, shape: (m) => <><Cyl m={m} r={0.17} h={0.08} x={-0.08} /><Cyl m={m} r={0.17} h={0.08} x={0.08} /></> },
    { key: "tapa-tras", name: "Tapa trasera", kind: "glass", pos: [1.12, 0, 0], explode: [1.05, 0, 0], shape: (m) => <Cyl m={m} r={0.9} r2={1.05} h={0.55} /> },
    { key: "rectificador", name: "Puente rectificador", pos: [1.55, 0, 0], explode: [1.75, 0, 0], tag: 1.05, shape: (m) => <><mesh material={m} rotation={AX}><cylinderGeometry args={[0.82, 0.82, 0.07, 40, 1, false, 0.4, Math.PI * 1.45]} /></mesh><Around n={6} r={0.6} offset={0.6}>{() => <Cyl m={m} r={0.07} h={0.18} x={0.1} seg={12} />}</Around></> },
    { key: "regulador", name: "Escobillas y regulador", pos: [1.55, 0.72, 0.25], explode: [1.9, 1.25, 0], tag: 0.45, shape: (m) => <>{box(m, [0.4, 0.28, 0.5])}{box(m, [0.12, 0.3, 0.1], [-0.1, -0.25, -0.12])}{box(m, [0.12, 0.3, 0.1], [-0.1, -0.25, 0.12])}</> },
  ],
  arranque: [
    { key: "pinon", name: "Piñón", pos: [-2.25, 0, 0], explode: [-1.6, 0, 0], tag: 0.5, shape: (m) => gear(m, 0.26, 0.32) },
    { key: "nariz", name: "Carcasa delantera", kind: "glass", pos: [-1.75, 0, 0], explode: [-1.05, 0, 0], shape: (m) => <Cyl m={m} r={0.75} r2={0.45} h={0.75} /> },
    { key: "solenoide", name: "Solenoide", pos: [-0.9, 0.98, 0], explode: [0, 1.4, 0], tag: 0.5, shape: (m) => <><Cyl m={m} r={0.34} h={1.35} /><Cyl m={m} r={0.08} h={0.2} x={0.75} y={0.12} seg={12} /><Cyl m={m} r={0.08} h={0.2} x={0.75} y={-0.12} seg={12} /></> },
    { key: "carcasa", name: "Carcasa del motor", kind: "glass", pos: [-0.1, 0, 0], explode: [0, -1.65, 0], tag: 0.9, shape: (m) => <Cyl m={m} r={0.78} h={1.7} /> },
    { key: "inducido", name: "Inducido", kind: "copper", pos: [-0.1, 0, 0], explode: [0, 0, 0], tag: 0.75, shape: (m) => <>{shaft(m, 4.1)}{armature(m, 0.52, 1.2)}</> },
    { key: "colector", name: "Colector", kind: "copper", pos: [0.85, 0, 0], explode: [0.5, 0, 0], tag: 0.45, shape: (m) => commutator(m, 0.3, 0.38) },
    { key: "escobillas", name: "Escobillas", pos: [1.2, 0, 0], explode: [1.15, 0, 0], tag: 0.75, shape: (m) => brushes(m, 0.45) },
    { key: "tapa", name: "Tapa trasera", kind: "glass", pos: [1.5, 0, 0], explode: [1.7, 0, 0], shape: (m) => <Cyl m={m} r={0.6} r2={0.78} h={0.3} /> },
  ],
  dinamos: [
    { key: "polea", name: "Polea", pos: [-2.4, 0, 0], explode: [-1.5, 0, 0], shape: pulley },
    { key: "tapa-del", name: "Tapa delantera", kind: "glass", pos: [-1.85, 0, 0], explode: [-0.95, 0, 0], shape: (m) => <Cyl m={m} r={0.72} r2={0.6} h={0.3} /> },
    { key: "cuerpo", name: "Cuerpo y bobinas", kind: "glass", pos: [-0.35, 0, 0], explode: [0, -1.5, 0], tag: 0.85, shape: (m) => <Cyl m={m} r={0.72} h={2.7} /> },
    { key: "inducido", name: "Inducido", kind: "copper", pos: [-0.5, 0, 0], explode: [0, 0, 0], tag: 0.65, shape: (m) => <>{shaft(m, 4.6)}{armature(m, 0.45, 1.9)}</> },
    { key: "colector", name: "Colector", kind: "copper", pos: [0.85, 0, 0], explode: [0.55, 0, 0], tag: 0.45, shape: (m) => commutator(m, 0.3, 0.5) },
    { key: "escobillas", name: "Escobillas", pos: [1.25, 0, 0], explode: [1.15, 0, 0], tag: 0.75, shape: (m) => brushes(m, 0.45) },
    { key: "rodamientos", name: "Rodamientos (engrase)", pos: [-1.85, 0, 0], explode: [-0.95, 1.2, 0], tag: 0.4, shape: (m) => <>{bearing(m)}<group position={[3.5, 0, 0]}>{bearing(m)}</group></> },
    { key: "regulador", name: "Regulador", pos: [-0.3, 1.25, 0], explode: [0, 1.3, 0], tag: 0.4, shape: (m) => <>{box(m, [1.1, 0.42, 0.6])}{box(m, [0.3, 0.12, 0.3], [-0.25, 0.27, 0])}{box(m, [0.3, 0.12, 0.3], [0.25, 0.27, 0])}</> },
  ],
  motores: [
    { key: "ventilador", name: "Ventilador", pos: [-2.0, 0, 0], explode: [-1.1, 0, 0], shape: (m) => fan(m, 0.75) },
    { key: "carcasa", name: "Carcasa con aletas", kind: "glass", pos: [0, 0, 0], explode: [0, -1.7, 0], tag: 1.05, shape: (m) => <><Cyl m={m} r={0.92} h={2.6} /><Around n={16} r={0.94}>{() => box(m, [2.4, 0.14, 0.03])}</Around></> },
    { key: "bobinas", name: "Bobinas del estator", kind: "copper", pos: [0, 0, 0], explode: [0, 1.6, 0], tag: 1.05, shape: (m) => <><Annulus m={m} rIn={0.6} rOut={0.84} h={1.5} /><Ring m={m} r={0.72} t={0.08} x={-0.8} /><Ring m={m} r={0.72} t={0.08} x={0.8} /></> },
    { key: "rotor", name: "Rotor", pos: [0, 0, 0], explode: [0, 0, 0], tag: 0.6, shape: (m) => <>{shaft(m, 4.4)}<Cyl m={m} r={0.5} h={1.45} /><Around n={14} r={0.5}>{() => box(m, [1.5, 0.05, 0.05])}</Around></> },
    { key: "rodamientos", name: "Rodamientos", pos: [-1.35, 0, 0], explode: [-0.7, 0, 0], tag: 0.4, shape: (m) => <>{bearing(m)}<group position={[2.7, 0, 0]}>{bearing(m)}</group></> },
    { key: "bornera", name: "Caja de bornes", pos: [0.2, 1.08, 0], explode: [0.3, 2.7, 0], tag: 0.35, shape: (m) => <>{box(m, [0.7, 0.32, 0.6])}{[-0.2, 0, 0.2].map((x) => <Cyl key={x} m={m} r={0.05} h={0.14} x={x} y={0.22} rot={[0, 0, 0]} seg={10} />)}</> },
    { key: "base", name: "Patas", pos: [0, -1.0, 0], explode: [0, -2.6, 0], tag: 0.3, shape: (m) => <>{box(m, [0.35, 0.12, 1.5], [-0.9, 0, 0])}{box(m, [0.35, 0.12, 1.5], [0.9, 0, 0])}</> },
  ],
  bombas: [
    { key: "voluta", name: "Cuerpo de bomba", kind: "glass", pos: [-1.65, 0, 0], explode: [-1.3, 0, 0], tag: 1.0, shape: (m) => <><mesh material={m} rotation={RING}><torusGeometry args={[0.55, 0.32, 18, 40]} /></mesh><Cyl m={m} r={0.24} h={0.9} x={-0.35} y={0} rot={AX} /><Cyl m={m} r={0.2} h={0.6} y={0.95} rot={[0, 0, 0]} /></> },
    { key: "impulsor", name: "Impulsor", kind: "copper", pos: [-1.65, 0, 0], explode: [-0.65, 1.3, 0], tag: 0.6, shape: (m) => <><Cyl m={m} r={0.5} h={0.05} /><Around n={8} r={0.3}>{() => box(m, [0.22, 0.38, 0.04], [0, 0, 0], [0.6, 0, 0])}</Around></> },
    { key: "juntas", name: "Juntas", pos: [-1.2, 0, 0], explode: [-0.45, -1.1, 0], tag: 0.45, shape: (m) => <><Ring m={m} r={0.62} t={0.035} /><Ring m={m} r={0.4} t={0.03} x={0.12} /></> },
    { key: "cierre", name: "Cierre mecánico", pos: [-0.95, 0, 0], explode: [-0.2, 0.9, 0], tag: 0.4, shape: (m) => <><Cyl m={m} r={0.24} h={0.22} /><Ring m={m} r={0.24} t={0.04} x={-0.12} /></> },
    { key: "motor", name: "Motor", kind: "glass", pos: [0.6, 0, 0], explode: [1.0, 0, 0], tag: 0.95, shape: (m) => <><Cyl m={m} r={0.82} h={2.2} /><Around n={14} r={0.84}>{() => box(m, [2.0, 0.12, 0.03])}</Around></> },
    { key: "eje", name: "Eje y rotor", pos: [0.6, 0, 0], explode: [0.4, 0, 0], tag: 0.55, shape: (m) => <>{shaft(m, 3.3)}<Cyl m={m} r={0.45} h={1.4} /></> },
    { key: "base", name: "Base", pos: [0.3, -0.92, 0], explode: [0, -1.5, 0], tag: 0.3, shape: (m) => box(m, [3.4, 0.1, 1.3]) },
  ],
};

// ── Piezas animadas ─────────────────────────────────────────────────────────────

interface Shared {
  activeRef: MutableRefObject<string | null>;
  explodeRef: MutableRefObject<number>;
  onHover: (key: string | null) => void;
}

const tmp = new THREE.Color();

/** Funde el material hacia azul (pieza activa) o hacia su color en reposo. */
function tint(mat: THREE.MeshStandardMaterial, kind: Kind, on: boolean, dt: number) {
  mat.color.lerp(tmp.set(on ? BLUE : IDLE[kind]), Math.min(1, dt * 6));
  mat.emissiveIntensity = THREE.MathUtils.damp(mat.emissiveIntensity, on ? 0.5 : 0, 6, dt);
  if (kind === "glass") mat.opacity = THREE.MathUtils.damp(mat.opacity, on ? 0.38 : 0.16, 6, dt);
}

function Part({ def, activeRef, explodeRef, onHover }: { def: PartDef } & Shared) {
  const kind = def.kind ?? "metal";
  const group = useRef<THREE.Group>(null);
  const mat = useMemo(
    () =>
      kind === "glass"
        ? new THREE.MeshPhysicalMaterial({ color: IDLE.glass, transparent: true, opacity: 0.16, roughness: 0.15, depthWrite: false, side: THREE.DoubleSide, emissive: BLUE, emissiveIntensity: 0 })
        : new THREE.MeshStandardMaterial({ color: IDLE[kind], roughness: 0.42, metalness: kind === "copper" ? 0.45 : 0.25, emissive: BLUE, emissiveIntensity: 0 }),
    [kind],
  );
  useFrame((_, dt) => {
    tint(mat, kind, activeRef.current === def.key, dt);
    const t = explodeRef.current;
    group.current?.position.set(def.pos[0] + def.explode[0] * t, def.pos[1] + def.explode[1] * t, def.pos[2] + def.explode[2] * t);
  });
  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onHover(def.key);
  };
  return (
    <group ref={group} position={def.pos} onPointerOver={over} onPointerOut={() => onHover(null)}>
      {def.shape(mat)}
    </group>
  );
}

export function MachineModel({ id, ...shared }: { id: MachineId } & Shared) {
  const group = useRef<THREE.Group>(null);
  // Al cambiar de equipo, el nuevo entra creciendo
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const s = THREE.MathUtils.damp(g.scale.x, 1, 5, dt);
    g.scale.setScalar(s);
  });
  return (
    <group ref={group} scale={0.6}>
      {MACHINES[id].map((def) => (
        <Part key={def.key} def={def} {...shared} />
      ))}
    </group>
  );
}

/** Proyecta las etiquetas a la pantalla y muestra solo la de la pieza activa. */
export function LabelProjector({
  id,
  activeRef,
  explodeRef,
  labelsRef,
  lift = 0,
}: {
  id: MachineId;
  activeRef: MutableRefObject<string | null>;
  explodeRef: MutableRefObject<number>;
  labelsRef: MutableRefObject<(HTMLDivElement | null)[]>;
  lift?: number;
}) {
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    const t = explodeRef.current;
    MACHINES[id].forEach((p, i) => {
      const el = labelsRef.current[i];
      if (!el) return;
      v.set(p.pos[0] + p.explode[0] * t, p.pos[1] + p.explode[1] * t + (p.tag ?? 0.8) + lift, p.pos[2] + p.explode[2] * t).project(camera);
      const on = activeRef.current === p.key;
      el.style.transform = `translate(${(v.x + 1) * 0.5 * size.width}px, ${(1 - v.y) * 0.5 * size.height}px) translate(-50%, -100%)`;
      el.style.opacity = on ? "1" : "0";
    });
  });
  return null;
}
