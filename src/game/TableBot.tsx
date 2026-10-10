import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Skin, EyeDesign, LegDesign, TableDecoration } from "./skins";
import { DEFAULT_SKIN } from "./skins";

const LEG_POS: [number, number][] = [
  [-2.4, -1.5],
  [2.4, -1.5],
  [-2.4, 1.5],
  [2.4, 1.5],
];

function darken(hex: string, amount = 0.35) {
  try {
    const c = new THREE.Color(hex);
    c.multiplyScalar(1 - amount);
    return `#${c.getHexString()}`;
  } catch {
    return hex;
  }
}

function Eyes({ design, color }: { design: EyeDesign; color: string }) {
  if (design === "square") {
    return (
      <>
        {[-1, 1].map((x) => (
          <mesh key={x} position={[x * 0.9, 3.28, 2.02]}>
            <boxGeometry args={[0.55, 0.55, 0.06]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.4} />
          </mesh>
        ))}
      </>
    );
  }
  if (design === "triangle") {
    return (
      <>
        {[-1, 1].map((x) => (
          <mesh key={x} position={[x * 0.95, 3.28, 2.02]} rotation={[0, 0, x * 0.15]}>
            <coneGeometry args={[0.38, 0.7, 3]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.4} />
          </mesh>
        ))}
      </>
    );
  }
  // boss eyes — slanted bars
  return (
    <>
      {[-1, 1].map((x) => (
        <mesh key={x} position={[x * 0.95, 3.25, 2.02]} rotation={[0, 0, x * -0.35]}>
          <boxGeometry args={[0.9, 0.22, 0.05]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.6} />
        </mesh>
      ))}
    </>
  );
}

function Legs({ design, color }: { design: LegDesign; color: string }) {
  const legColor = darken(color, 0.28);
  if (design === "oneleg") {
    return (
      <mesh position={[0, 1.5, 0]} castShadow>
        <cylinderGeometry args={[0.55, 0.7, 3, 12]} />
        <meshStandardMaterial color={legColor} roughness={0.4} />
      </mesh>
    );
  }
  if (design === "minimal") {
    return (
      <>
        {[-2.0, 2.0].map((x) => (
          <mesh key={x} position={[x, 1.5, 0]} castShadow>
            <boxGeometry args={[0.28, 3, 0.28]} />
            <meshStandardMaterial color={legColor} roughness={0.35} />
          </mesh>
        ))}
      </>
    );
  }
  if (design === "triangle") {
    return (
      <>
        {LEG_POS.map(([x, z], i) => (
          <mesh key={i} position={[x, 1.5, z]} castShadow rotation={[0, 0, 0]}>
            <coneGeometry args={[0.45, 3, 3]} />
            <meshStandardMaterial color={legColor} roughness={0.4} />
          </mesh>
        ))}
      </>
    );
  }
  // conic default
  return (
    <>
      {LEG_POS.map(([x, z], i) => (
        <mesh key={i} position={[x, 1.5, z]} castShadow>
          <cylinderGeometry args={[0.18, 0.35, 3, 8]} />
          <meshStandardMaterial color={legColor} roughness={0.4} />
        </mesh>
      ))}
    </>
  );
}

function Decoration({ kind, color }: { kind: TableDecoration; color: string }) {
  if (kind === "none") return null;
  if (kind === "plates") {
    return (
      <>
        {[-1.2, 1.2].map((x) => (
          <mesh key={x} position={[x, 3.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.55, 0.55, 0.08, 20]} />
            <meshStandardMaterial color={color} roughness={0.3} metalness={0.2} />
          </mesh>
        ))}
      </>
    );
  }
  if (kind === "rug") {
    return (
      <mesh position={[0, 3.48, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4.2, 2.6]} />
        <meshStandardMaterial color={color} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
    );
  }
  if (kind === "office") {
    return (
      <group position={[0, 3.55, 0]}>
        <mesh>
          <boxGeometry args={[1.8, 0.12, 1.1]} />
          <meshStandardMaterial color={color} roughness={0.35} metalness={0.3} />
        </mesh>
        <mesh position={[0, 0.35, -0.35]} rotation={[0.4, 0, 0]}>
          <boxGeometry args={[1.6, 0.9, 0.06]} />
          <meshStandardMaterial color="#1a1a22" emissive="#223355" emissiveIntensity={0.4} />
        </mesh>
      </group>
    );
  }
  // birthday cake
  return (
    <group position={[0, 3.55, 0]}>
      <mesh>
        <cylinderGeometry args={[0.7, 0.8, 0.5, 16]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.5, 0.55, 0.35, 16]} />
        <meshStandardMaterial color="#fff5e6" roughness={0.7} />
      </mesh>
      {[-0.25, 0, 0.25].map((x) => (
        <mesh key={x} position={[x, 0.7, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.35, 8]} />
          <meshStandardMaterial color="#ffee88" emissive="#ffaa00" emissiveIntensity={1.2} />
        </mesh>
      ))}
    </group>
  );
}

export type TableBotProps = {
  skin?: Partial<Skin>;
  scale?: number;
  /** Emit a point light matching table light color */
  emitLight?: boolean;
  lightIntensity?: number;
  ghost?: boolean;
  /** Auto-spin for menus */
  spin?: boolean;
};

/** Shared 3D table bot used in skins preview, freecam body, and remote players. */
export function TableBot({
  skin: partial,
  scale = 1,
  emitLight = true,
  lightIntensity = 1,
  ghost = false,
  spin = false,
}: TableBotProps) {
  const skin: Skin = useMemo(() => ({ ...DEFAULT_SKIN, ...partial }), [partial]);
  const root = useRef<THREE.Group>(null);
  const opacity = ghost ? 0.35 : 1;

  useFrame((_, dt) => {
    if (spin && root.current) root.current.rotation.y += dt * 0.55;
  });

  return (
    <group ref={root} scale={scale}>
      <mesh position={[0, 3.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[6, 0.5, 4]} />
        <meshStandardMaterial
          color={skin.tablePrimary}
          roughness={0.28}
          metalness={0.08}
          envMapIntensity={2}
          transparent={ghost}
          opacity={opacity}
        />
      </mesh>
      <Legs design={skin.legDesign} color={skin.tablePrimary} />
      <Eyes design={skin.eyeDesign} color={skin.eyeColor} />
      <Decorations kind={skin.decoration} color={skin.decorationColor} />
      {emitLight && (
        <pointLight
          position={[0, 4.5, 0]}
          color={skin.lightColor}
          intensity={40 * lightIntensity}
          distance={120}
          decay={2}
        />
      )}
    </group>
  );
}

/** Circular stage under the bot for skins menu / showcase. */
export function StageDisc({ color = "#333", lightColor = "#4da861" }: { color?: string; lightColor?: string }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <circleGeometry args={[5.5, 64]} />
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.15} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[5.2, 5.5, 64]} />
        <meshStandardMaterial color={lightColor} emissive={lightColor} emissiveIntensity={0.6} />
      </mesh>
      <pointLight position={[0, 8, 0]} color={lightColor} intensity={25} distance={40} />
    </group>
  );
}
