import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useSettings } from "./settings";

const wallColors = ["#d19a6c", "#d7aa7a", "#c88868", "#e2b27b", "#bd8c70"];
const roofColors = ["#67483e", "#7b493d", "#4e4b4b", "#79503c"];

function House({ index, angle, distance }: { index: number; angle: number; distance: number }) {
  const width = 112 + (index % 3) * 18;
  const depth = 86 + (index % 2) * 14;
  const height = 82 + (index % 4) * 12;
  const roofRise = 28;
  const pitch = Math.atan2(roofRise, width / 2);
  const roofLength = Math.hypot(width / 2, roofRise) + 18;
  const gable = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, height - 2);
    shape.lineTo(width / 2, height - 2);
    shape.lineTo(0, height + roofRise + 1);
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth: depth + 2, bevelEnabled: false });
  }, [width, height, depth, roofRise]);
  const trim = index % 2 ? "#f0e8d7" : "#e1e5d9";
  return (
    <group position={[Math.sin(angle) * distance, 64, Math.cos(angle) * distance]} rotation-y={angle}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={wallColors[index % wallColors.length] ?? "#c8c8b4"} roughness={0.95} />
      </mesh>
      <mesh position={[0, 5, -depth / 2 - 1]} castShadow>
        <boxGeometry args={[width + 2, 10, 3]} />
        <meshStandardMaterial color="#a7a89b" roughness={1} />
      </mesh>
      <mesh geometry={gable} position={[0, 0, -depth / 2 - 1]} castShadow receiveShadow>
        <meshStandardMaterial color={wallColors[index % wallColors.length] ?? "#c8c8b4"} roughness={0.95} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * width / 4, height + roofRise / 2, 0]} rotation-z={-side * pitch} castShadow receiveShadow>
            <boxGeometry args={[roofLength, 5, depth + 18]} />
            <meshStandardMaterial color={roofColors[index % roofColors.length] ?? "#746961"} roughness={0.9} />
          </mesh>
          <mesh position={[side * (width / 4 + 2), height + roofRise / 2 - 3, -depth / 2 - 10]} rotation-z={-side * pitch} castShadow>
            <boxGeometry args={[roofLength + 1, 4, 3]} />
            <meshStandardMaterial color={trim} roughness={0.9} />
          </mesh>
        </group>
      ))}
      <mesh position={[-width / 3, height + roofRise * 0.75, 10]} castShadow>
        <boxGeometry args={[12, 28, 12]} />
        <meshStandardMaterial color="#887b6a" />
      </mesh>
      {[-width / 3, width / 3].map((x) => (
        <group key={x} position={[x, height * 0.56, -depth / 2 - 2]}>
          <mesh castShadow><boxGeometry args={[25, 34, 4]} /><meshStandardMaterial color={trim} /></mesh>
          <mesh position={[0, 0, -3]}><boxGeometry args={[19, 28, 1]} /><meshStandardMaterial color="#829eaa" roughness={0.28} metalness={0.1} /></mesh>
          <mesh position={[0, 0, -4]} castShadow><boxGeometry args={[2, 30, 2]} /><meshStandardMaterial color={trim} /></mesh>
          <mesh position={[0, 0, -4]} castShadow><boxGeometry args={[21, 2, 2]} /><meshStandardMaterial color={trim} /></mesh>
          <mesh position={[0, -19, -2]} castShadow><boxGeometry args={[30, 3, 10]} /><meshStandardMaterial color={trim} /></mesh>
        </group>
      ))}
      <mesh position={[0, 21, -depth / 2 - 3]} castShadow>
        <boxGeometry args={[24, 42, 4]} />
        <meshStandardMaterial color={index % 3 === 0 ? "#647d78" : "#8d765f"} roughness={0.8} />
      </mesh>
      <mesh position={[0, 23, -depth / 2 - 6]}><sphereGeometry args={[2, 8, 6]} /><meshStandardMaterial color="#d5b568" metalness={0.6} /></mesh>
      <mesh position={[0, 0.6, -depth / 2 - 32]} receiveShadow><boxGeometry args={[30, 1, 52]} /><meshStandardMaterial color="#b1aba0" /></mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (width / 2 - 9), 9, -depth / 2 - 15]} castShadow>
          <dodecahedronGeometry args={[12, 0]} />
          <meshStandardMaterial color={side === 1 ? "#607d54" : "#748850"} flatShading roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function StreetTree({ angle, radius, index }: { angle: number; radius: number; index: number }) {
  const h = 39 + (index % 4) * 5;
  return (
    <group position={[Math.sin(angle) * radius, 64, Math.cos(angle) * radius]}>
      <mesh position={[0, h / 2, 0]} castShadow><cylinderGeometry args={[2.2, 3.8, h, 7]} /><meshStandardMaterial color="#75634c" roughness={1} /></mesh>
      <mesh position={[0, h + 7, 0]} castShadow receiveShadow><dodecahedronGeometry args={[17 + index % 4, 1]} /><meshStandardMaterial color={index % 3 === 0 ? "#769564" : "#668b65"} roughness={1} flatShading /></mesh>
      <mesh position={[7, h + 2, 1]} castShadow><dodecahedronGeometry args={[12, 0]} /><meshStandardMaterial color="#87a46c" roughness={1} flatShading /></mesh>
    </group>
  );
}

function GrassTufts() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const spots = useMemo(() => Array.from({ length: 160 }, (_, i) => {
    const a = i * 2.399963;
    const radius = 535 + ((i * 37) % 290);
    return { x: Math.sin(a) * radius, z: Math.cos(a) * radius, size: 1.2 + (i % 5) * 0.5 };
  }), []);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    spots.forEach(({ x, z, size }, i) => {
      dummy.position.set(x, 64 + size / 2, z);
      dummy.rotation.y = i * 1.7;
      dummy.scale.set(size, size, size);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [spots]);
  return <instancedMesh ref={ref} args={[undefined, undefined, spots.length]} castShadow>
    <coneGeometry args={[1, 1, 3]} />
    <meshStandardMaterial color="#789b60" flatShading roughness={1} />
  </instancedMesh>;
}

/** Solid houses, planted verges and a circular residential street beyond the open windows. */
const SKY = {
  day: { color: "#8fc4ee", emissive: "#bcdcf7", ei: 0.55, orb: "#ffffff", r: 52 },
  evening: { color: "#d96c32", emissive: "#a94320", ei: 0.28, orb: "#fff0ad", r: 52 },
  night: { color: "#0b1430", emissive: "#050a1c", ei: 0.4, orb: "#e8eeff", r: 38 },
};

export function MorningOutside({ roomRadius }: { roomRadius: number }) {
  const sky = SKY[useSettings().timeOfDay];
  return (
    <group>
      <mesh position={[0, 520, 0]}>
        <cylinderGeometry args={[2400, 2400, 1100, 64, 1, true]} />
        <meshStandardMaterial color={sky.color} emissive={sky.emissive} emissiveIntensity={sky.ei} side={THREE.BackSide} roughness={1} fog={false} />
      </mesh>
      <mesh position={[-475, 650, -1830]}>
        <sphereGeometry args={[sky.r, 20, 12]} />
        <meshBasicMaterial color={sky.orb} fog={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 63, 0]} receiveShadow>
        <ringGeometry args={[roomRadius + 3, 2400, 96]} />
        <meshStandardMaterial color="#7d754d" roughness={1} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 64.05, 0]} receiveShadow>
        <ringGeometry args={[405, 495, 128]} />
        <meshStandardMaterial color="#626a68" roughness={1} side={THREE.DoubleSide} />
      </mesh>
      {[397, 502].map((radius) => (
        <mesh key={radius} rotation-x={-Math.PI / 2} position={[0, 64.15, 0]} receiveShadow>
          <ringGeometry args={[radius - 5, radius + 5, 128]} />
          <meshStandardMaterial color="#c6c2ad" roughness={1} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {Array.from({ length: 32 }, (_, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[0, 64.2, 0]}>
          <ringGeometry args={[448, 451, 5, 1, i * Math.PI / 16, Math.PI / 32]} />
          <meshStandardMaterial color="#e0d5ab" side={THREE.DoubleSide} />
        </mesh>
      ))}
      {Array.from({ length: 18 }, (_, index) => {
        const angle = ((index + 0.3) / 18) * Math.PI * 2;
        return <House key={index} index={index} angle={angle} distance={625 + (index % 3) * 58} />;
      })}
      {Array.from({ length: 22 }, (_, index) => (
        <StreetTree key={index} index={index} angle={((index + 0.75) / 22) * Math.PI * 2} radius={545 + (index % 2) * 22} />
      ))}
      <GrassTufts />
    </group>
  );
}