import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { NET, useNet, type Peer } from "./net";
import { G } from "./state";

const COLORS = { red: ["#d43a3a", "#8f1c1c"], blue: ["#3a7bd4", "#1d4b8f"], other: ["#2fa84f", "#197a37"] } as const;
const LEGS = [[-2.4, -1.5], [2.4, -1.5], [-2.4, 1.5], [2.4, 1.5]] as const;

function RemoteTable({ peer }: { peer: Peer }) {
  const g = useRef<THREE.Group>(null);
  const tone = NET.kind === "pvp" ? COLORS[NET.colors[peer.id] ?? "other"] : COLORS.other;
  useFrame((_, dt) => {
    const p = NET.peers.get(peer.id);
    const m = g.current;
    if (!p || !m) return;
    m.visible = !p.dead && G.phase === "playing";
    const k = 1 - Math.exp(-14 * dt);
    m.position.lerp(new THREE.Vector3(p.x, p.y, p.z), k);
    let d = p.yaw + Math.PI - m.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    m.rotation.y += d * k;
  });
  return (
    <group ref={g} position={[peer.x, peer.y, peer.z]}>
      <group scale={0.6}>
        <mesh position={[0, 3.2, 0]} castShadow>
          <boxGeometry args={[6, 0.5, 4]} />
          <meshStandardMaterial color={tone[0]} roughness={0.4} />
        </mesh>
        {LEGS.map(([x, z], i) => (
          <mesh key={i} position={[x, 1.5, z]} castShadow>
            <boxGeometry args={[0.45, 3, 0.45]} />
            <meshStandardMaterial color={tone[1]} />
          </mesh>
        ))}
        {[-1, 1].map((x) => (
          <mesh key={x} position={[x, 3.3, 2.02]}>
            <boxGeometry args={[0.7, 0.25, 0.05]} />
            <meshStandardMaterial color="#111" />
          </mesh>
        ))}
      </group>
      <Html position={[0, 4.2, 0]} center distanceFactor={60} zIndexRange={[5, 0]}>
        <div className="pointer-events-none whitespace-nowrap rounded bg-hud-panel px-2 py-0.5 font-mono text-xs font-black text-hud">
          {NET.names[peer.id] ?? peer.name}
        </div>
      </Html>
    </group>
  );
}

/** Other players in the same online room. */
export function RemotePlayers() {
  const net = useNet();
  if (!net.online) return null;
  return (
    <>
      {[...net.peers.values()].map((p) => <RemoteTable key={p.id} peer={p} />)}
    </>
  );
}
