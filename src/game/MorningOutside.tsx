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
 * Equirectangular sky textures.
 * Night: Milky Way inspired by galactic structure (central bulge, Great Rift dust lane,
 * denser star field along the plane). Oriented so the galactic center sits off the moon.
 */
function hash2(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function makeCloudTexture(kind: "day" | "evening") {
  const w = 2048, h = 1024;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  // clear (transparent) — base sky color comes from scene.background
  ctx.clearRect(0, 0, w, h);
  const clouds = kind === "day"
    ? [
        { x: 0.18, y: 0.28, sx: 0.28, sy: 0.12, a: 0.55 },
        { x: 0.55, y: 0.22, sx: 0.34, sy: 0.14, a: 0.5 },
        { x: 0.78, y: 0.34, sx: 0.22, sy: 0.1, a: 0.45 },
        { x: 0.35, y: 0.42, sx: 0.26, sy: 0.11, a: 0.4 },
        { x: 0.08, y: 0.5, sx: 0.2, sy: 0.09, a: 0.35 },
        { x: 0.62, y: 0.48, sx: 0.3, sy: 0.12, a: 0.42 },
      ]
    : [
        { x: 0.22, y: 0.32, sx: 0.36, sy: 0.13, a: 0.55 },
        { x: 0.6, y: 0.26, sx: 0.32, sy: 0.12, a: 0.5 },
        { x: 0.85, y: 0.38, sx: 0.24, sy: 0.1, a: 0.45 },
        { x: 0.4, y: 0.45, sx: 0.28, sy: 0.11, a: 0.4 },
        { x: 0.12, y: 0.55, sx: 0.22, sy: 0.09, a: 0.38 },
      ];
  for (const cl of clouds) {
    const cx = cl.x * w, cy = cl.y * h, rx = cl.sx * w, ry = cl.sy * h;
    // puffy stacked ellipses (cartoony but soft)
    for (let i = 0; i < 7; i++) {
      const ox = (hash2(cl.x * 10, i) - 0.5) * rx * 0.7;
      const oy = (hash2(i, cl.y * 10) - 0.5) * ry * 0.55;
      const rrx = rx * (0.35 + hash2(i, 3) * 0.35);
      const rry = ry * (0.4 + hash2(3, i) * 0.35);
      const g = ctx.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, Math.max(rrx, rry));
      if (kind === "day") {
        g.addColorStop(0, `rgba(255,255,255,${cl.a * 0.95})`);
        g.addColorStop(0.45, `rgba(245,250,255,${cl.a * 0.55})`);
        g.addColorStop(1, "rgba(220,235,255,0)");
      } else {
        g.addColorStop(0, `rgba(255,210,160,${cl.a * 0.9})`);
        g.addColorStop(0.4, `rgba(255,150,90,${cl.a * 0.5})`);
        g.addColorStop(1, "rgba(180,60,40,0)");
      }
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(cx + ox, cy + oy, rrx, rry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function makeMilkyWayTexture() {
  const w = 2048, h = 1024;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  // Deep space
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, w, h);

  // Background stars (faint field everywhere)
  for (let i = 0; i < 6000; i++) {
    const x = hash2(i, 1) * w;
    const y = hash2(2, i) * h;
    const b = 0.25 + hash2(i, 7) * 0.55;
    const s = hash2(9, i) > 0.92 ? 1.6 : 0.7;
    ctx.fillStyle = `rgba(${200 + b * 55 | 0},${210 + b * 40 | 0},${255},${0.35 + b * 0.45})`;
    ctx.fillRect(x, y, s, s);
  }

  // Galactic plane: band across sky. Center of band ~ mid height with slight tilt via sampling.
  // Bulge (galactic center) denser — placed ~25% along longitude so it sits away from the moon azimuth.
  const bulgeX = w * 0.28;
  const planeY = h * 0.48;

  // Soft galactic glow along the plane
  for (let x = 0; x < w; x += 2) {
    const lon = (x / w) * Math.PI * 2;
    // Distance from galactic center along the plane (approx)
    const dLon = Math.min(Math.abs(x - bulgeX), w - Math.abs(x - bulgeX)) / w;
    const arm = 0.55 + 0.45 * Math.cos(lon * 2.0); // mild arm modulation
    const thickness = (0.07 + 0.12 * Math.exp(-dLon * dLon * 18) * arm) * h;
    const bright = (0.15 + 0.85 * Math.exp(-dLon * dLon * 10)) * arm;
    for (let k = 0; k < 18; k++) {
      const yy = planeY + (hash2(x, k) - 0.5) * thickness * 2.2;
      const rr = thickness * (0.4 + hash2(k, x) * 0.8);
      const g = ctx.createRadialGradient(x, yy, 0, x, yy, rr);
      const a = bright * (0.04 + hash2(k * 3, x) * 0.06);
      // warm-white core near bulge, cooler arms (approx stellar population)
      const near = Math.exp(-dLon * dLon * 14);
      const r = 180 + near * 60 | 0;
      const gg = 170 + near * 40 | 0;
      const bb = 200 + (1 - near) * 40 | 0;
      g.addColorStop(0, `rgba(${r},${gg},${bb},${a})`);
      g.addColorStop(1, `rgba(${r},${gg},${bb},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, yy, rr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Great Rift — dark dust lane through the plane (real MW feature)
  ctx.globalCompositeOperation = "multiply";
  for (let i = 0; i < 40; i++) {
    const x = bulgeX + (i / 40 - 0.2) * w * 0.55;
    const y = planeY + Math.sin(i * 0.4) * h * 0.03;
    const g = ctx.createRadialGradient(x, y, 0, x, y, h * 0.06);
    g.addColorStop(0, "rgba(8,6,12,0.85)");
    g.addColorStop(1, "rgba(8,6,12,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, w * 0.04, h * 0.045, i * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";

  // Bright bulge core
  {
    const g = ctx.createRadialGradient(bulgeX, planeY, 0, bulgeX, planeY, h * 0.18);
    g.addColorStop(0, "rgba(255,236,210,0.55)");
    g.addColorStop(0.35, "rgba(255,200,160,0.25)");
    g.addColorStop(1, "rgba(120,100,180,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bulgeX, planeY, h * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }

  // Dense star field along the plane
  for (let i = 0; i < 9000; i++) {
    const x = hash2(i * 1.7, 4) * w;
    const dLon = Math.min(Math.abs(x - bulgeX), w - Math.abs(x - bulgeX)) / w;
    const y = planeY + (hash2(5, i) - 0.5) * h * (0.05 + 0.12 * (1 - Math.exp(-dLon * 8)));
    const near = Math.exp(-dLon * dLon * 12);
    if (hash2(i, 11) > 0.35 + near * 0.4) continue;
    const b = 0.4 + hash2(i, 13) * 0.6;
    const s = hash2(i, 17) > 0.97 ? 2.2 : hash2(i, 19) > 0.85 ? 1.4 : 0.8;
    ctx.fillStyle = `rgba(255,${230 + near * 20 | 0},${200 + b * 40 | 0},${0.5 + b * 0.5})`;
    ctx.fillRect(x, y, s, s);
  }

  // A few brighter "star" flares
  for (let i = 0; i < 80; i++) {
    const x = hash2(i, 30) * w;
    const y = hash2(31, i) * h;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 3 + hash2(i, 32) * 4);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.4, "rgba(200,220,255,0.35)");
    g.addColorStop(1, "rgba(150,180,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

const SKY = {
  day: { color: "#8fc4ee", orb: "#fffef5", r: 90 },
  evening: { color: "#d96c32", orb: "#fff0ad", r: 90 },
  night: { color: "#000000", orb: "#e8eeff", r: 36 },
};

function SkyDome({ tod }: { tod: "day" | "evening" | "night" }) {
  const sky = SKY[tod];
  // Textures built once per mode
  const map = useMemo(() => {
    if (tod === "night") return makeMilkyWayTexture();
    return makeCloudTexture(tod);
  }, [tod]);

  // Galaxy rotation: tilt the plane and swing the bulge away from the moon at (-475,650,-1830)
  const nightRot: [number, number, number] = [-0.35, 2.35, 0.4];

  return (
    <group>
      {/* Solid color sphere — high segment count, no second mesh (that caused the octagon artifact) */}
      <mesh>
        <sphereGeometry args={[2800, 64, 48]} />
        <meshBasicMaterial color={sky.color} side={THREE.BackSide} fog={false} depthWrite={false} />
      </mesh>
      {/* Detail layer: clouds (day/evening) or Milky Way (night) */}
      <mesh rotation={tod === "night" ? nightRot : [0, 0.15, 0]}>
        <sphereGeometry args={[2785, 64, 48]} />
        <meshBasicMaterial
          map={map}
          transparent
          opacity={tod === "night" ? 1 : 0.92}
          side={THREE.BackSide}
          fog={false}
          depthWrite={false}
        />
      </mesh>
      {/* Sun / moon — smooth sphere, not a faceted blob */}
      <mesh position={[-475, 650, -1830]}>
        <sphereGeometry args={[sky.r, 48, 32]} />
        <meshBasicMaterial color={sky.orb} fog={false} />
      </mesh>
      {tod !== "night" && (
        // Soft glow halo around the sun (no geometry silhouette)
        <mesh position={[-475, 650, -1830]}>
          <sphereGeometry args={[sky.r * 2.4, 32, 24]} />
          <meshBasicMaterial color={sky.orb} transparent opacity={0.18} fog={false} depthWrite={false} />
        </mesh>
      )}
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