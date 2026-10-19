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

// ---- procedural Milky Way (seamless noise, equirectangular; galactic plane = texture equator) ----
function vnoise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number, oct = 5) {
  let sum = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { sum += amp * vnoise(x * f, y * f); f *= 2.03; amp *= 0.5; }
  return sum;
}
/** Longitude of the galactic centre on the texture (0..1). */
const MW_BULGE_U = 0.3;
/** Seamless noise: depends on longitude only through cos/sin, so the texture wraps without a seam. */
function ringNoise(u: number, lat: number, ringR: number, latS: number, seed: number, oct = 5) {
  const th = u * Math.PI * 2;
  return fbm(Math.cos(th) * ringR + seed, Math.sin(th) * ringR + lat * latS + seed * 0.37, oct);
}

function makeMilkyWayTexture() {
  const W = 4096, H = 2048;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  // 1) soft glow, dust lanes and nebulae computed at low resolution, then smoothly scaled up
  const lw = 768, lh = 384;
  const low = document.createElement("canvas");
  low.width = lw; low.height = lh;
  const lctx = low.getContext("2d")!;
  const img = lctx.createImageData(lw, lh);
  const wrapDl = (u: number) => { let d = u - MW_BULGE_U; d -= Math.round(d); return d * Math.PI * 2; }; // radians from the core, -π..π
  for (let py = 0; py < lh; py++) {
    const lat = (0.5 - (py + 0.5) / lh) * Math.PI; // galactic latitude
    for (let px = 0; px < lw; px++) {
      const u = (px + 0.5) / lw;
      const dl = wrapDl(u);
      const core = Math.exp(-((dl / 0.62) ** 2));           // 1 at the galactic centre
      const sigma = 0.075 + 0.17 * core;                    // band is thicker toward the core
      const prof = Math.exp(-0.5 * (lat / sigma) ** 2);
      const halo = Math.exp(-0.5 * (lat / (sigma * 2.6)) ** 2) * 0.28;
      // clumpy star clouds + patchy structure
      const cloud = 0.45 + 1.15 * ringNoise(u, lat, 5.5, 9, 3.1, 5);
      const fine = 0.7 + 0.6 * ringNoise(u, lat, 18, 30, 8.7, 3);
      // dust: Great Rift down the middle + filaments across the band
      const rift = Math.exp(-0.5 * ((lat - 0.018 * Math.sin(dl * 2.4)) / (sigma * 0.16)) ** 2) * (0.35 + 0.65 * core) * Math.max(0, Math.min(1, (dl + 1.1) / 0.5)) * Math.max(0, Math.min(1, (2.3 - dl) / 0.6));
      const fil = Math.max(0, ringNoise(u, lat, 11, 26, 5.3, 5) - 0.5) * 3.2 * prof;
      const dust = Math.min(0.95, rift * 0.95 + fil * 0.7);
      let I = (prof * cloud * fine + halo * (0.6 + 0.6 * cloud)) * (0.45 + 0.75 * core + 0.2);
      I *= 1 - dust;
      // central bulge (warm, elliptical) + soft wide glow
      const bulge = Math.exp(-((dl / 0.42) ** 2 + (lat / 0.2) ** 2) * 1.0) * (1 - dust * 0.6);
      const bulgeWide = Math.exp(-((dl / 0.95) ** 2 + (lat / 0.34) ** 2)) * 0.35 * (1 - dust * 0.4);
      // emission nebulae (pink/violet) scattered along the plane
      const neb = Math.max(0, ringNoise(u, lat, 7, 16, 12.9, 4) - 0.56) * 4 * Math.exp(-0.5 * (lat / (sigma * 1.4)) ** 2);
      // colour: cool blue-white arms, violet edges, warm core
      const edge = Math.min(1, Math.abs(lat) / (sigma * 1.6));
      let r = 168 + 40 * edge, g = 178 - 8 * edge, bl = 225 + 10 * edge;
      const warm = Math.min(1, bulge * 1.4 + bulgeWide * 1.2 + core * 0.35);
      r = r * (1 - warm) + 255 * warm; g = g * (1 - warm) + 205 * warm; bl = bl * (1 - warm) + 140 * warm;
      const k = Math.min(1.25, I * 0.9 + bulge * 1.15 + bulgeWide);
      let R = r * k, G2 = g * k, B = bl * k;
      R += 255 * neb * 0.55; G2 += 90 * neb * 0.5; B += 190 * neb * 0.6;
      const o = (py * lw + px) * 4;
      img.data[o] = Math.max(0, Math.min(255, R));
      img.data[o + 1] = Math.max(0, Math.min(255, G2));
      img.data[o + 2] = Math.max(0, Math.min(255, B));
      img.data[o + 3] = 255;
    }
  }
  lctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.globalCompositeOperation = "lighter";
  ctx.drawImage(low, 0, 0, W, H);
  // fine grain so the haze is not a smooth blur when it is magnified
  for (let i = 0; i < 90000; i++) {
    const u = hash2(i, 91), lat = (hash2(92, i) - 0.5) * 0.9;
    const sg = 0.075 + 0.17 * Math.exp(-((wrapDl(u) / 0.62) ** 2));
    if (hash2(i, 93) > Math.exp(-0.5 * (lat / sg) ** 2) * (0.5 + ringNoise(u, lat, 18, 30, 8.7, 2))) continue;
    const x = u * W, y = (0.5 - lat / Math.PI) * H;
    ctx.fillStyle = `rgba(190,200,235,${0.05 + hash2(i, 94) * 0.1})`;
    ctx.fillRect(x, y, 1.6, 1.6);
  }
  ctx.globalCompositeOperation = "source-over";

  // 2) stars. Pole-compensated width so equirectangular stretching doesn't smear them near the poles.
  const star = (u: number, lat: number, size: number, col: string) => {
    const x = u * W, y = (0.5 - lat / Math.PI) * H;
    const wd = Math.min(8, size / Math.max(0.2, Math.cos(lat)));
    ctx.fillStyle = col;
    ctx.fillRect(x - wd / 2, y - size / 2, wd, size);
  };
  // field stars everywhere (uniform on the sphere, power-law brightness)
  for (let i = 0; i < 16000; i++) {
    const u = hash2(i, 1), lat = Math.asin(hash2(2, i) * 2 - 1);
    const m = Math.pow(hash2(i, 7), 3.2);
    const roll = hash2(i, 8);
    const a = 0.25 + m * 0.75;
    const col = roll > 0.93 ? `rgba(255,190,150,${a})` : roll > 0.8 ? `rgba(170,200,255,${a})` : `rgba(255,255,255,${a})`;
    star(u, lat, m > 0.55 ? 1.8 : m > 0.2 ? 1.2 : 0.8, col);
  }
  // dense stars concentrated in the band (clumped by the same noise as the glow)
  let placed = 0;
  for (let i = 0; placed < 90000 && i < 400000; i++) {
    const u = hash2(i * 1.7, 11);
    const dl = wrapDl(u);
    const core = Math.exp(-((dl / 0.62) ** 2));
    const sg = 0.075 + 0.17 * core;
    const lat = (hash2(12, i * 1.3) + hash2(13, i * 0.7) + hash2(14, i * 2.1) - 1.5) * 2 * sg * 1.6; // ~gaussian
    const dens = (0.35 + 1.2 * ringNoise(u, lat, 5.5, 9, 3.1, 3)) * (0.35 + 0.8 * core);
    if (hash2(i, 15) > Math.min(1, dens * 0.8)) continue;
    // skip where dust lane sits
    const rift = Math.exp(-0.5 * ((lat - 0.018 * Math.sin(dl * 2.4)) / (sg * 0.16)) ** 2);
    if (rift * (0.35 + 0.65 * core) > hash2(i, 16) * 0.95) continue;
    placed++;
    const m = Math.pow(hash2(i, 17), 2.6);
    const warm = hash2(i, 18) < 0.2 + core * 0.45;
    const a = 0.3 + m * 0.7;
    const col = warm ? `rgba(255,${210 + (m * 40) | 0},${150 + (m * 60) | 0},${a})` : `rgba(${200 + (m * 55) | 0},${215 + (m * 40) | 0},255,${a})`;
    star(u, lat, m > 0.7 ? 1.5 : m > 0.35 ? 1.0 : 0.7, col);
  }
  // bright stars with glow and a few diffraction spikes
  for (let i = 0; i < 160; i++) {
    const u = hash2(i, 70), lat = Math.asin(hash2(71, i) * 2 - 1);
    const x = u * W, y = (0.5 - lat / Math.PI) * H;
    const r = 3 + hash2(i, 72) * 5;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(225,235,255,0.55)");
    g.addColorStop(1, "rgba(150,170,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
    ctx.fill();
    if (hash2(i, 73) > 0.82) {
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fillRect(x - r * 3.2, y - 0.5, r * 6.4, 1);
      ctx.fillRect(x - 0.5, y - r * 3.2, 1, r * 6.4);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
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
  // Galaxy orientation: put the galactic centre ~33° above the horizon (away from the moon at (-475, 650, -1830))
  // and make the band arch up over the sky instead of lying along the horizon / under the ground.
  const quat = useMemo(() => {
    const th = Math.PI / 2, ph = MW_BULGE_U * Math.PI * 2;
    // direction of the texture's bulge texel on three's SphereGeometry
    const b0 = new THREE.Vector3(-Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th));
    const b1 = new THREE.Vector3(0.62, 0.55, -0.56).normalize();
    const q1 = new THREE.Quaternion().setFromUnitVectors(b0, b1);
    const up = new THREE.Vector3(0, 1, 0);
    const n = up.clone().applyQuaternion(q1);                           // current plane normal
    const nt = new THREE.Vector3().crossVectors(b1, up).normalize();    // wanted: horizontal normal → plane passes the zenith
    const ang = Math.atan2(new THREE.Vector3().crossVectors(n, nt).dot(b1), n.dot(nt));
    return new THREE.Quaternion().setFromAxisAngle(b1, ang).multiply(q1);
  }, []);

  return (
    <group>
      {/* ONE opaque sky sphere only — no transparent overlay (fixes polygon ghost) */}
      <mesh quaternion={tod === "night" ? quat : undefined}>
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