import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { NET, PVP_SCALE, useNet, type Peer } from "./net";
import { G } from "./state";
import { DEFAULT_SKIN, type Skin } from "./skins";
import { createTableBot, skinKey } from "./tableBotFactory";

function RemoteTable({ peer }: { peer: Peer }) {
  const root = useRef<THREE.Group>(null);
  const botHost = useRef<THREE.Group>(null);
  const big = NET.kind === "pvp" || NET.kind === "lobby" ? PVP_SCALE : 1;
  const skin: Skin = {
    ...DEFAULT_SKIN,
    ...(peer.skin ?? {}),
  };
  if (NET.kind === "pvp") {
    const tone = NET.colors[peer.id];
    if (tone === "red") skin.tablePrimary = "#d43a3a";
    if (tone === "blue") skin.tablePrimary = "#3a7bd4";
  }
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
    m.visible = !p.dead && G.phase === "playing";
    const k = 1 - Math.exp(-14 * dt);
    m.position.lerp(new THREE.Vector3(p.x, p.y, p.z), k);
    let d = p.yaw + Math.PI - m.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    m.rotation.y += d * k;
  });

  return (
    <group ref={root} position={[peer.x, peer.y, peer.z]}>
      <group ref={botHost} />
      <Html position={[0, 4.2 * big, 0]} center distanceFactor={60} zIndexRange={[5, 0]}>
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
      {[...net.peers.values()].map((p) => (
        <RemoteTable key={p.id} peer={p} />
      ))}
    </>
  );
}
