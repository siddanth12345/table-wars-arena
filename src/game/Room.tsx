import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { G } from "./state";
import * as THREE from "three";
import { woodFloor, wallpaper, rug } from "./textures";
import { MorningOutside } from "./MorningOutside";
import { useSettings, lampIntensity } from "./settings";

// Cylinder with same floor area as the old 600x600 room, same ceiling height
export const ROOM = { r: Math.sqrt((600 * 600) / Math.PI), h: 600 };
const S = 10;
const WS = 15; // window scale: 1.5x the original panes
const WY = 144; // window centre height (keeps sills above the outside ground)

export type Solid = { x: number; z: number; hw: number; hd: number; y0: number; y1: number; yaw?: number; c?: string };

export const WINDOW_ANGLES = [0.6, 2.0, 2.55, 3.1, 3.65, 4.2, 5.3];

const FRAME_PARTS = [
  { p: [-6, 0, 0], s: [0.75, 9.5, 1.8] },
  { p: [6, 0, 0], s: [0.75, 9.5, 1.8] },
  { p: [0, 4.5, 0], s: [12.75, 0.7, 1.8] },
  { p: [0, -4.5, 0], s: [12.75, 0.7, 1.8] },
  { p: [0, 0, 0], s: [0.4, 9, 1.4] },
  { p: [0, -0.35, 0], s: [12, 0.32, 1.4] },
  { p: [0, -4.8, 0.45], s: [13.2, 0.65, 2.2] },
  { p: [0, -4.8, -0.45], s: [13.2, 0.65, 1.2] },
  { p: [-5.6, 0, -0.8], s: [0.38, 9, 0.4] },
  { p: [5.6, 0, -0.8], s: [0.38, 9, 0.4] },
  { p: [0, 4.25, -0.8], s: [11.5, 0.34, 0.4] },
  { p: [0, -4.25, -0.8], s: [11.5, 0.34, 0.4] },
] as const;

const windowFrameSolids: Solid[] = WINDOW_ANGLES.flatMap((angle) => {
  const yaw = angle + Math.PI;
  const bx = Math.sin(angle) * (ROOM.r - 1);
  const bz = Math.cos(angle) * (ROOM.r - 1);
  return FRAME_PARTS.map(({ p: [lx, ly, lz], s: [sx, sy, sz] }) => ({
    x: bx + (lx * Math.cos(yaw) + lz * Math.sin(yaw)) * WS,
    z: bz + (-lx * Math.sin(yaw) + lz * Math.cos(yaw)) * WS,
    hw: sx * WS / 2,
    hd: sz * WS / 2,
    y0: WY + (ly - sy / 2) * WS,
    y1: WY + (ly + sy / 2) * WS,
    yaw,
  }));
});

// Collidable, standable, grappleable solids (world units)
export const SOLIDS: Solid[] = [
  // sofas (seat + back)
  { x: 0, z: 170, hw: 50, hd: 20, y0: 0, y1: 23 },
  { x: 0, z: 186, hw: 50, hd: 5, y0: 0, y1: 46 },
  { x: -240, z: 0, hw: 20, hd: 50, y0: 0, y1: 23 },
  { x: -256, z: 0, hw: 5, hd: 50, y0: 0, y1: 46 },
  // tv stand + tv
  { x: 0, z: -205, hw: 60, hd: 12.5, y0: 0, y1: 24 },
  { x: 0, z: -212, hw: 50, hd: 2, y0: 24, y1: 77 },
  // bookshelf, armchair, plant pot
  { x: 260, z: -120, hw: 15, hd: 35, y0: 0, y1: 100 },
  { x: 220, z: 120, hw: 22, hd: 22, y0: 0, y1: 20 },
  { x: 260, z: 180, hw: 10, hd: 10, y0: 0, y1: 20 },
  // giant fridges
  { x: -170, z: -230, hw: 18, hd: 15, y0: 0, y1: 80, c: "#e9eef0" },
  { x: 150, z: 250, hw: 18, hd: 15, y0: 0, y1: 80, c: "#dfe7ea" },
  // carpet cavern: raised carpet slab on two carpet flaps, open front/back
  { x: -150, z: 120, hw: 45, hd: 35, y0: 14, y1: 16, c: "#7a2632" },
  { x: -194, z: 120, hw: 1, hd: 35, y0: 0, y1: 14, c: "#6a1f2a" },
  { x: -106, z: 120, hw: 1, hd: 35, y0: 0, y1: 14, c: "#6a1f2a" },
  // crates
  { x: 100, z: -120, hw: 12, hd: 12, y0: 0, y1: 24, c: "#a57b4f" },
  { x: 100, z: -120, hw: 8, hd: 8, y0: 24, y1: 40, c: "#b88c5c" },
  // book stack
  { x: -80, z: -120, hw: 20, hd: 14, y0: 0, y1: 10, c: "#2e5a8b" },
  { x: -80, z: -120, hw: 16, hd: 12, y0: 10, y1: 18, c: "#8b2e2e" },
  { x: -80, z: -120, hw: 12, hd: 9, y0: 18, y1: 24, c: "#c9a227" },
  // ottoman
  { x: 200, z: 0, hw: 18, hd: 18, y0: 0, y1: 14, c: "#5a4a6a" },
  ...windowFrameSolids,
];

function Box({ p, s, c, r = 0 }: { p: [number, number, number]; s: [number, number, number]; c: string; r?: number }) {
  return (
    <mesh position={p} rotation-y={r} castShadow receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} roughness={0.8} />
    </mesh>
  );
}

function Sofa({ p, r = 0 }: { p: [number, number, number]; r?: number }) {
  return (
    <group position={p} rotation-y={r}>
      <Box p={[0, 1, 0]} s={[10, 2, 4]} c="#3f5e5a" />
      <Box p={[0, 2.8, -1.6]} s={[10, 3.6, 1]} c="#365250" />
      <Box p={[-4.6, 2.2, 0]} s={[1, 2.4, 4]} c="#365250" />
      <Box p={[4.6, 2.2, 0]} s={[1, 2.4, 4]} c="#365250" />
      <Box p={[-2.2, 2.3, -0.3]} s={[4, 0.6, 3]} c="#4a6d68" />
      <Box p={[2.2, 2.3, -0.3]} s={[4, 0.6, 3]} c="#4a6d68" />
    </group>
  );
}

export function Room() {
  const { r, h } = ROOM;
  const tod = useSettings().timeOfDay;
  const lampI = lampIntensity(tod);
  const floor = useMemo(() => {
    const t = woodFloor();
    t.repeat.multiplyScalar(11);
    return t;
  }, []);
  const wall = useMemo(() => {
    const t = wallpaper();
    t.repeat.set(420, 120);
    return t;
  }, []);
  const rugT = useMemo(rug, []);
  // Home screen: interior floor, carpet and furniture get 1.5x reflectivity.
  const interior = useRef<THREE.Group>(null);
  const shinyHome = useRef<boolean | null>(null);
  useFrame(() => {
    const home = G.phase === "home";
    if (!interior.current || shinyHome.current === home) return;
    shinyHome.current = home;
    const visit = (o: THREE.Object3D) => {
      if (o.userData["outside"]) return;
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m && "roughness" in m) {
        if (m.userData["baseRough"] === undefined) { m.userData["baseRough"] = m.roughness; m.userData["baseEnv"] = m.envMapIntensity; }
        m.roughness = home ? m.userData["baseRough"] / 1.5 : m.userData["baseRough"];
        m.envMapIntensity = home ? m.userData["baseEnv"] * 1.5 : m.userData["baseEnv"];
      }
      o.children.forEach(visit);
    };
    visit(interior.current);
  });
  // The four original windows plus three new panes between the pair facing the starting camera.
  const windows = WINDOW_ANGLES;
  const halfOpening = 90 / r; // 180 world-unit-wide panes.
  const wallAngles = windows;
  const wallSpans = wallAngles.reduce<{ start: number; end: number }[]>((spans, angle, i) => {
    spans.push({ start: i ? wallAngles[i - 1]! + halfOpening : 0, end: angle - halfOpening });
    return spans;
  }, []);
  wallSpans.push({ start: wallAngles[wallAngles.length - 1]! + halfOpening, end: Math.PI * 2 });
  return (
    <group ref={interior}>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[r, 96]} />
        <meshStandardMaterial map={floor} roughness={0.6} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position={[0, h, 0]}>
        <circleGeometry args={[r, 96]} />
        <meshStandardMaterial color="#efe6d4" />
      </mesh>
      <group userData={{ outside: true }}><MorningOutside roomRadius={r} /></group>
      {/* The wall is truly open in the window bays, rather than painted sky panels. */}
      <mesh position={[0, 36.5, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[r, r, 73, 128, 1, true]} />
        <meshStandardMaterial map={wall} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, (h + 216) / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[r, r, h - 216, 128, 1, true]} />
        <meshStandardMaterial map={wall} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      {wallSpans.map(({ start, end }) => (
        <mesh key={start} position={[0, WY, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[r, r, 143, Math.max(2, Math.ceil((end - start) * 32)), 1, true, start, end - start]} />
           <meshStandardMaterial map={wall} roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh position={[0, 4, 0]}>
        <cylinderGeometry args={[r - 1, r - 1, 8, 128, 1, true]} />
        <meshStandardMaterial color="#f4ede0" side={THREE.BackSide} />
      </mesh>
      {windows.map((a) => (
        <group key={a} position={[Math.sin(a) * (r - 1), WY, Math.cos(a) * (r - 1)]} rotation-y={a + Math.PI} scale={WS}>
          {/* Clear, faintly reflective glazing; the exterior is visible through it. */}
          <mesh position={[0, 0, -0.08]}>
            <planeGeometry args={[12, 9]} />
            <meshPhysicalMaterial color="#dbeef0" transparent opacity={0.1} depthWrite={false} roughness={0.08} metalness={0.05} side={THREE.DoubleSide} />
          </mesh>
           {/* Deep box sections continue through the wall, with solid jambs and exterior trim. */}
            {FRAME_PARTS.map(({ p, s }, i) => (
              <Box key={i} p={[...p]} s={[...s]} c={i < 6 ? "#f0e3cf" : i < 8 ? "#e4d8c5" : "#fff0d9"} />
            ))}
        </group>
      ))}
      {/* new props rendered straight from their collision boxes */}
      {SOLIDS.filter((s) => s.c).map((s, i) => (
        <Box key={i} p={[s.x, (s.y0 + s.y1) / 2, s.z]} s={[s.hw * 2, s.y1 - s.y0, s.hd * 2]} c={s.c ?? "#a57b4f"} />
      ))}
      {/* fridge details */}
      {([[-170, -230], [150, 250]] as const).map(([x, z]) => {
        const face = z < 0 ? 1 : -1;
        return (
          <group key={x} position={[x, 0, z + face * 15.3]}>
            <Box p={[0, 52, 0]} s={[36, 0.6, 0.6]} c="#9aa6ab" />
            <Box p={[12, 65, face * 1]} s={[1.5, 16, 1.5]} c="#7c878c" />
            <Box p={[12, 35, face * 1]} s={[1.5, 24, 1.5]} c="#7c878c" />
          </group>
        );
      })}
      <group scale={S}>
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, 0]} receiveShadow>
          <planeGeometry args={[22, 16]} />
          <meshStandardMaterial map={rugT} roughness={1} />
        </mesh>
        <Sofa p={[0, 0, 17]} r={Math.PI} />
        <Sofa p={[-24, 0, 0]} r={Math.PI / 2} />
        <Box p={[0, 1.2, -20.5]} s={[12, 2.4, 2.5]} c="#4b3424" />
        <Box p={[0, 5, -21.2]} s={[10, 5.5, 0.4]} c="#151515" />
        <group position={[26, 0, -12]}>
          <Box p={[0, 5, 0]} s={[3, 10, 7]} c="#5b3d27" />
          {[2, 4.5, 7].map((y) =>
            [-2.5, -1, 0.5, 2].map((z, i) => (
              <Box key={`${y}${z}`} p={[-1.2, y + 0.9, z]} s={[0.8, 1.6, 1.2]} c={["#8b2e2e", "#2e5a8b", "#c9a227", "#3c7a4a"][i]!} />
            )),
          )}
        </group>
        <group position={[22, 0, 12]} rotation-y={-Math.PI / 1.4}>
          <Box p={[0, 1, 0]} s={[4, 2, 4]} c="#a0522d" />
          <Box p={[0, 3, -1.6]} s={[4, 3, 0.8]} c="#8b4726" />
        </group>
        {([[-26, -18], [-8, 29]] as const).map(([x, z]) => (
          <group key={x} position={[x, 0, z]}>
            <Box p={[0, 4, 0]} s={[0.3, 8, 0.3]} c="#2b2b2b" />
            <mesh position={[0, 8.5, 0]}>
              <coneGeometry args={[1.5, 2, 16, 1, true]} />
              <meshStandardMaterial color="#f7e3b0" emissive="#ffcf7a" emissiveIntensity={tod === "night" ? 1.4 : 0.6} side={2} />
            </mesh>
            <pointLight position={[0, 8, 0]} intensity={lampI} distance={260} color="#ffcf8a" />
          </group>
        ))}
        <group position={[26, 0, 18]}>
          <Box p={[0, 1, 0]} s={[2, 2, 2]} c="#b5651d" />
          <mesh position={[0, 3.5, 0]} castShadow>
            <icosahedronGeometry args={[2, 0]} />
            <meshStandardMaterial color="#3f7d3a" flatShading />
          </mesh>
        </group>
      </group>
    </group>
  );
}
