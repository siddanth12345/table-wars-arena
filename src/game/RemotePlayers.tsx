import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { NET, PVP_SCALE, useNet, myId, type Peer } from "./net";
import { G } from "./state";
import { DEFAULT_SKIN, type Skin } from "./skins";
import { createTableBot, skinKey, animateLavaMaterials } from "./tableBotFactory";

function RemoteTable({ peer }: { peer: Peer }) {
  const root = useRef<THREE.Group>(null);
  const botHost = useRef<THREE.Group>(null);
  const ropeRef = useRef<THREE.Mesh>(null);
  const big = NET.kind === "pvp" || NET.kind === "lobby" ? PVP_SCALE : 1;
  // Use each player's saved skin (no forced red/blue table colors in 1v1)
  const skin: Skin = {
    ...DEFAULT_SKIN,
    ...(peer.skin ?? {}),
  };
  const key = skinKey(skin) + "|" + peer.id + "|" + big;
  const bot = useMemo(
    () => createTableBot({ skin, scale: 0.6 * big, emitLight: true, lightIntensity: NET.kind === "pvp" || NET.kind === "lobby" ? 1.4 : 1 }),
    [key],
  );

  useEffect(() => {
    const host = botHost.current;
    if (!host) return;
    host.clear();
    host.add(bot);
    return () => {
      host.remove(bot);
      bot.traverse((o) => {
        const m = o as { geometry?: { dispose: () => void }; material?: { dispose: () => void } | { dispose: () => void }[] };
        m.geometry?.dispose();
        if (Array.isArray(m.material)) m.material.forEach((x) => x.dispose());
        else m.material?.dispose();
      });
    };
  }, [bot]);

  useFrame((_, dt) => {
    const p = NET.peers.get(peer.id);
    const m = root.current;
    if (!p || !m) return;
    animateLavaMaterials(bot);
    m.visible = !p.dead && G.phase === "playing";
    const k = 1 - Math.exp(-14 * dt);
    m.position.lerp(new THREE.Vector3(p.x, p.y, p.z), k);
    let d = p.yaw + Math.PI - m.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    m.rotation.y += d * k;

    // Grapple rope toward remote anchor
    const rope = ropeRef.current;
    if (rope) {
      if (p.grappling && p.gx != null && p.gy != null && p.gz != null) {
        rope.visible = true;
        const from = new THREE.Vector3(p.x, p.y + 2.2 * big, p.z);
        const to = new THREE.Vector3(p.gx, p.gy, p.gz);
        const mid = from.clone().add(to).multiplyScalar(0.5);
        const len = from.distanceTo(to);
        rope.position.copy(mid);
        rope.scale.set(0.12, len, 0.12);
        rope.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
      } else {
        rope.visible = false;
      }
    }
  });

  return (
    <group ref={root} position={[peer.x, peer.y, peer.z]}>
      <group ref={botHost} />
      <mesh ref={ropeRef} visible={false}>
        <cylinderGeometry args={[1, 1, 1, 6]} />
        <meshStandardMaterial color="#c8d0d8" metalness={0.4} roughness={0.45} />
      </mesh>
      <Html position={[0, 5.2 * big, 0]} center distanceFactor={60} zIndexRange={[5, 0]}>
        <div
          className="pointer-events-none whitespace-nowrap rounded bg-hud-panel px-3 py-1 font-mono font-black text-hud"
          style={{ fontSize: "2.45rem", lineHeight: 1.1 }} /* ~3.5× text-xs */
        >
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
      {[...net.peers.values()].filter((p) => p.id && p.id !== myId()).map((p) => (
        <RemoteTable key={p.id} peer={p} />
      ))}
    </>
  );
}
