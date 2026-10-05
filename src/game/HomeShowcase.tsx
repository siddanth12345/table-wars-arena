import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { G } from "./state";
import { ROOM } from "./Room";

// The title-screen battle is visual only: it never touches the playable actor pools.
function ShowcaseTable({ color, legColor, eyes = false, scale = 1 }: { color: string; legColor: string; eyes?: boolean; scale?: number }) {
  return (
    <group scale={scale}>
      <mesh position={[0, 3.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[6, 0.5, 4]} />
        <meshStandardMaterial color={color} roughness={0.24} metalness={0.08} envMapIntensity={2} />
      </mesh>
      {[-2.4, 2.4].flatMap((x) => [-1.5, 1.5].map((z) => (
        <mesh key={`${x}-${z}`} position={[x, 1.5, z]} castShadow>
          <boxGeometry args={[0.45, 3, 0.45]} />
          <meshStandardMaterial color={legColor} roughness={0.33} envMapIntensity={2} />
        </mesh>
      )))}
      {eyes && [-1, 1].map((x) => (
        <mesh key={x} position={[x, 3.25, 2.02]} rotation-z={x * -0.35}>
          <boxGeometry args={[0.9, 0.22, 0.05]} />
          <meshStandardMaterial color="#ffd058" emissive="#ffae34" emissiveIntensity={1.5} />
        </mesh>
      ))}
    </group>
  );
}

const brownPositions = [
  [-95, -155], [70, -165], [170, -105], [-180, 50], [105, 165], [-30, 205],
] as const;
const bluePositions = [[-155, -85], [185, 45], [-110, 170], [70, 80]] as const;

export function HomeShowcase() {
  const root = useRef<THREE.Group>(null);
  const boss = useRef<THREE.Group>(null);
  const green = useRef<THREE.Group>(null);
  const browns = useRef<(THREE.Group | null)[]>([]);
  const blues = useRef<(THREE.Group | null)[]>([]);
  const shots = useRef<(THREE.Mesh | null)[]>([]);
  const wave = useRef<THREE.Mesh>(null);
  const elapsed = useRef(0);

  useFrame((_, rawDt) => {
    const home = G.phase === "home";
    if (root.current) root.current.visible = home;
    if (!home) return;
    const dt = Math.min(rawDt, 0.05);
    elapsed.current += dt;
    const t = elapsed.current;
    if (boss.current) {
      const beat = (t % 3.4) / 3.4;
      boss.current.position.y = beat < 0.22 ? 16 * Math.sin(beat / 0.22 * Math.PI) : 0;
      boss.current.rotation.x = beat < 0.22 ? -0.2 * Math.sin(beat / 0.22 * Math.PI) : 0;
      boss.current.rotation.y = Math.sin(t * 0.5) * 0.3;
    }
    if (wave.current) {
      const progress = ((t % 3.4) - 0.74) / 2;
      wave.current.visible = progress > 0 && progress < 1;
      wave.current.scale.setScalar(45 + Math.max(0, progress) * 250);
      (wave.current.material as THREE.MeshBasicMaterial).opacity = 0.65 * (1 - Math.max(0, progress));
    }
    browns.current.forEach((actor, i) => {
      if (!actor) return;
      const [x, z] = brownPositions[i] ?? [0, 0];
      actor.position.set(x + Math.sin(t * 0.9 + i * 2) * 17, Math.max(0, Math.sin(t * 2.8 + i * 2.1)) * 5, z + Math.cos(t * 0.8 + i) * 13);
      actor.rotation.y = Math.atan2(-actor.position.x, -actor.position.z);
    });
    blues.current.forEach((actor, i) => {
      if (!actor) return;
      const [x, z] = bluePositions[i] ?? [0, 0];
      const rush = Math.sin(t * 1.7 + i * 1.8);
      actor.position.set(x + rush * 25, Math.max(0, Math.sin(t * 3 + i)) * 2, z + rush * 18);
      actor.rotation.y = Math.atan2(-actor.position.x, -actor.position.z);
    });
    if (green.current) {
      const a = t * 1.45 + 1.1;
      const radius = ROOM.r - 16;
      green.current.position.set(Math.sin(a) * radius, 58 + 21 * Math.sin(t * 2.9) ** 2, Math.cos(a) * radius);
      green.current.rotation.set(0, a + Math.PI / 2, 0.18 * Math.sin(t * 2.9));
    }
    shots.current.forEach((shot, i) => {
      if (!shot) return;
      const source = browns.current[i % browns.current.length];
      if (!source) return;
      const travel = (t * 0.9 + i * 0.27) % 1;
      shot.position.set(source.position.x * (1 - travel), 5 + 22 * travel, source.position.z * (1 - travel));
      shot.scale.setScalar(1 - travel * 0.5);
    });
  });

  return (
    <group ref={root} visible={false}>
      <group ref={boss} position={[0, 0, 0]}>
        <ShowcaseTable color="#b3121b" legColor="#8a0d14" eyes scale={12} />
      </group>
      {brownPositions.map(([x, z], i) => (
        <group key={`brown-${i}`} ref={(node) => { browns.current[i] = node; }} position={[x, 0, z]}>
          <ShowcaseTable color="#96653f" legColor="#75492e" scale={1.5} />
        </group>
      ))}
      {bluePositions.map(([x, z], i) => (
        <group key={`blue-${i}`} ref={(node) => { blues.current[i] = node; }} position={[x, 0, z]}>
          <ShowcaseTable color="#2f6fd6" legColor="#1f4fa8" scale={1.5} />
        </group>
      ))}
      <group ref={green}>
        <ShowcaseTable color="#4da861" legColor="#277b44" scale={2.7} />
      </group>
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={i} ref={(node) => { shots.current[i] = node; }}>
          <boxGeometry args={[1.6, 1.6, 5]} />
          <meshStandardMaterial color="#ffc56b" emissive="#d1732c" emissiveIntensity={0.6} />
        </mesh>
      ))}
      <mesh ref={wave} rotation-x={-Math.PI / 2} position={[0, 0.3, 0]} visible={false}>
        <ringGeometry args={[0.94, 1, 80]} />
        <meshBasicMaterial color="#e6452c" transparent opacity={0.6} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}