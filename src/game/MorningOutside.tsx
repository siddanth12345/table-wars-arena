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

/**
 * Sky textures + dome.
 * Night Milky Way (simplified from real structure):
 * - Thin galactic plane band across the sky
 * - Yellowish central bulge (stellar population in the core)
 * - Dark dust lane (Great Rift) cutting the band
 * - Sparse field stars outside the band; dense white stars in-band
 * - Soft purple / blue-white nebular patches near the plane
 * Day/evening: solid base color + soft cartoony clouds baked into ONE opaque map
 * so there is no transparent second sphere (that caused the polygon ghost).
 */
function hash2(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function makeDayEveningTexture(kind: "day" | "evening") {
  const w = 2048, h = 1024;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  // Gradient sky (horizon warmer, zenith cooler) — single bake, no second mesh
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  if (kind === "day") {
    grad.addColorStop(0, "#6eb0e8");
    grad.addColorStop(0.45, "#8fc4ee");
    grad.addColorStop(0.75, "#b7d9f5");
    grad.addColorStop(1, "#d5eaf8");
  } else {
    // Cooler evening: between day blue and warm sunset
    grad.addColorStop(0, "#3a5a8a");
    grad.addColorStop(0.35, "#7a6a9a");
    grad.addColorStop(0.55, "#c4785a");
    grad.addColorStop(0.75, "#e8a060");
    grad.addColorStop(1, "#f0c090");
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const clouds = kind === "day"
    ? [
        { x: 0.18, y: 0.22, sx: 0.26, sy: 0.1, a: 0.7 },
        { x: 0.52, y: 0.18, sx: 0.32, sy: 0.12, a: 0.65 },
        { x: 0.78, y: 0.28, sx: 0.22, sy: 0.09, a: 0.55 },
        { x: 0.35, y: 0.36, sx: 0.24, sy: 0.1, a: 0.5 },
        { x: 0.62, y: 0.4, sx: 0.28, sy: 0.11, a: 0.48 },
      ]
    : [
        { x: 0.2, y: 0.25, sx: 0.3, sy: 0.11, a: 0.55 },
        { x: 0.55, y: 0.2, sx: 0.34, sy: 0.12, a: 0.5 },
        { x: 0.8, y: 0.32, sx: 0.24, sy: 0.1, a: 0.45 },
        { x: 0.38, y: 0.38, sx: 0.26, sy: 0.1, a: 0.42 },
      ];
  for (const cl of clouds) {
    const cx = cl.x * w, cy = cl.y * h, rx = cl.sx * w, ry = cl.sy * h;
    for (let i = 0; i < 8; i++) {
      const ox = (hash2(cl.x * 10, i) - 0.5) * rx * 0.75;
      const oy = (hash2(i, cl.y * 10) - 0.5) * ry * 0.55;
      const rrx = rx * (0.32 + hash2(i, 3) * 0.38);
      const rry = ry * (0.38 + hash2(3, i) * 0.35);
      const g = ctx.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, Math.max(rrx, rry));
      if (kind === "day") {
        g.addColorStop(0, `rgba(255,255,255,${cl.a})`);
        g.addColorStop(0.5, `rgba(240,248,255,${cl.a * 0.55})`);
        g.addColorStop(1, "rgba(220,235,255,0)");
      } else {
        g.addColorStop(0, `rgba(255,230,210,${cl.a * 0.85})`);
        g.addColorStop(0.45, `rgba(255,180,140,${cl.a * 0.4})`);
        g.addColorStop(1, "rgba(200,100,80,0)");
      }
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(cx + ox, cy + oy, rrx, rry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function makeMilkyWayTexture() {
  const w = 2048, h = 1024;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  // Deep black sky
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, w, h);

  // Sparse field stars OUTSIDE the galactic ring
  for (let i = 0; i < 3500; i++) {
    const x = hash2(i, 1) * w;
    const y = hash2(2, i) * h;
    const b = 0.3 + hash2(i, 7) * 0.5;
    const s = hash2(9, i) > 0.94 ? 1.5 : 0.6;
    // mostly white, some cool blue-white, rare purple tint
    const roll = hash2(i, 8);
    let col: string;
    if (roll > 0.92) col = `rgba(180,140,255,${0.4 + b * 0.4})`;
    else if (roll > 0.7) col = `rgba(200,220,255,${0.4 + b * 0.4})`;
    else col = `rgba(255,255,255,${0.35 + b * 0.45})`;
    ctx.fillStyle = col;
    ctx.fillRect(x, y, s, s);
  }

  // ONE galactic ring / plane — narrow band
  const planeY = h * 0.5;
  const bulgeX = w * 0.30; // offset from moon direction
  const bandHalf = h * 0.055; // thin ring

  // Soft luminous band (cool white + purple edges)
  for (let x = 0; x < w; x += 1) {
    const dLon = Math.min(Math.abs(x - bulgeX), w - Math.abs(x - bulgeX)) / (w * 0.5);
    // intensity peaks at bulge, falls along plane
    const along = Math.exp(-dLon * dLon * 2.8);
    const edge = Math.exp(-dLon * dLon * 0.6);
    for (let dy = -bandHalf * 2.2; dy <= bandHalf * 2.2; dy += 1.2) {
      const ny = dy / bandHalf;
      const profile = Math.exp(-ny * ny * 1.6); // Gaussian cross-section of the ring
      if (profile < 0.02) continue;
      const y = planeY + dy + (hash2(x * 0.02, dy) - 0.5) * bandHalf * 0.15;
      // core of band: white; near bulge: yellow; edges: purple
      const purple = Math.max(0, Math.abs(ny) - 0.4) * edge;
      const yellow = along * (1 - Math.abs(ny) * 0.5);
      const r = Math.min(255, 160 + yellow * 95 + purple * 20);
      const g = Math.min(255, 155 + yellow * 70 - purple * 30);
      const b = Math.min(255, 180 + purple * 70 + (1 - yellow) * 30);
      const a = profile * (0.08 + along * 0.22);
      ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${a})`;
      ctx.fillRect(x, y, 1.5, 1.5);
    }
  }

  // Yellow bulge at galactic center
  {
    const g = ctx.createRadialGradient(bulgeX, planeY, 0, bulgeX, planeY, h * 0.11);
    g.addColorStop(0, "rgba(255,230,160,0.7)");
    g.addColorStop(0.25, "rgba(255,200,110,0.4)");
    g.addColorStop(0.55, "rgba(200,160,120,0.15)");
    g.addColorStop(1, "rgba(80,60,40,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(bulgeX, planeY, h * 0.14, h * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Purple nebular patches near plane (not the whole sky)
  for (let i = 0; i < 12; i++) {
    const x = (bulgeX + (hash2(i, 40) - 0.3) * w * 0.5 + w) % w;
    const y = planeY + (hash2(41, i) - 0.5) * bandHalf * 2.5;
    const g = ctx.createRadialGradient(x, y, 0, x, y, h * (0.04 + hash2(i, 42) * 0.05));
    g.addColorStop(0, `rgba(140,100,255,${0.12 + hash2(i, 43) * 0.1})`);
    g.addColorStop(1, "rgba(80,40,160,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, h * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }

  // Great Rift — dark dust cutting the band
  ctx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 28; i++) {
    const t = i / 28;
    const x = bulgeX + (t - 0.15) * w * 0.42;
    const y = planeY + Math.sin(t * 6) * bandHalf * 0.35;
    const g = ctx.createRadialGradient(x, y, 0, x, y, bandHalf * (0.9 + hash2(i, 50) * 0.5));
    g.addColorStop(0, "rgba(0,0,0,0.75)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, w * 0.03, bandHalf * 1.1, t * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";

  // Dense white stars along the ring only
  for (let i = 0; i < 5000; i++) {
    const x = hash2(i * 1.3, 60) * w;
    const dLon = Math.min(Math.abs(x - bulgeX), w - Math.abs(x - bulgeX)) / (w * 0.5);
    const y = planeY + (hash2(61, i) - 0.5) * bandHalf * (1.6 + dLon);
    // reject if too far from plane
    if (Math.abs(y - planeY) > bandHalf * 2.2) continue;
    const near = Math.exp(-dLon * dLon * 3);
    if (hash2(i, 62) > 0.45 + near * 0.4) continue;
    const s = hash2(i, 63) > 0.96 ? 2.0 : hash2(i, 64) > 0.8 ? 1.2 : 0.7;
    const roll = hash2(i, 65);
    if (roll > 0.93) ctx.fillStyle = "rgba(200,170,255,0.95)";
    else if (roll > 0.8) ctx.fillStyle = "rgba(255,240,200,0.95)";
    else ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillRect(x, y, s, s);
  }

  // A few bright point stars with tiny glow
  for (let i = 0; i < 60; i++) {
    const x = hash2(i, 70) * w;
    const y = hash2(71, i) * h;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 4);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(220,230,255,0.4)");
    g.addColorStop(1, "rgba(150,160,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

const ORB = {
  day: { color: "#fffef5", r: 70 },
  evening: { color: "#ffe8c0", r: 75 },
  night: { color: "#e8eeff", r: 32 },
};

function SkyDome({ tod }: { tod: "day" | "evening" | "night" }) {
  const map = useMemo(() => {
    if (tod === "night") return makeMilkyWayTexture();
    return makeDayEveningTexture(tod);
  }, [tod]);
  const orb = ORB[tod];
  // Galaxy orientation: plane across sky, bulge away from moon at (-475, 650, -1830)
  const rot: [number, number, number] = tod === "night" ? [-0.4, 2.4, 0.25] : [0, 0, 0];

  return (
    <group>
      {/* ONE opaque sky sphere only — no transparent overlay (fixes polygon ghost) */}
      <mesh rotation={rot}>
        <sphereGeometry args={[2600, 96, 64]} />
        <meshBasicMaterial map={map} side={THREE.BackSide} fog={false} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* Smooth sun / moon */}
      <mesh position={[-475, 650, -1830]}>
        <sphereGeometry args={[orb.r, 64, 48]} />
        <meshBasicMaterial color={orb.color} fog={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function MorningOutside({ roomRadius }: { roomRadius: number }) {
  const tod = useSettings().timeOfDay;
  return (
    <group>
      <SkyDome tod={tod} />
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