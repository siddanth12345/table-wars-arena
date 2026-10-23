import * as THREE from "three";
import type { EyeDesign, LegDesign, TableDecoration, Skin } from "./skins";
import { DEFAULT_SKIN, DEFAULT_MAGMA_COLOR, skinHasMagma } from "./skins";

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
    return c;
  } catch {
    return new THREE.Color(hex);
  }
}

function mat(color: string | THREE.Color, opts: ConstructorParameters<typeof THREE.MeshStandardMaterial>[0] = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.35, ...opts });
}

/** Build a rock+magma crack canvas texture (seamless-ish). */
function makeMagmaCanvas(glowHex: string, phase = 0) {
  const S = 256;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d")!;
  // Magma base (non-rock) — tinted by glow color
  const col = new THREE.Color(glowHex);
  const deep = col.clone().multiplyScalar(0.35);
  const mid = col.clone().multiplyScalar(0.75);
  const hot = col.clone().lerp(new THREE.Color("#fff2a0"), 0.35);
  const g = ctx.createRadialGradient(S * 0.5, S * 0.5, 10, S * 0.5, S * 0.5, S * 0.7);
  g.addColorStop(0, `#${hot.getHexString()}`);
  g.addColorStop(0.45, `#${mid.getHexString()}`);
  g.addColorStop(1, `#${deep.getHexString()}`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);

  // Soft flowing bright veins (phase shifts for slow magma motion)
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 8; i++) {
    const a = phase * 0.4 + i * 1.7;
    const x0 = S * (0.15 + 0.7 * ((Math.sin(a + i) + 1) * 0.5));
    const y0 = S * (0.15 + 0.7 * ((Math.cos(a * 0.9 + i * 0.6) + 1) * 0.5));
    const x1 = S * (0.15 + 0.7 * ((Math.sin(a + 2 + i) + 1) * 0.5));
    const y1 = S * (0.15 + 0.7 * ((Math.cos(a * 1.1 + i) + 1) * 0.5));
    const lg = ctx.createLinearGradient(x0, y0, x1, y1);
    lg.addColorStop(0, "rgba(0,0,0,0)");
    lg.addColorStop(0.5, `rgba(255, 230, 120, ${0.25 + 0.2 * Math.sin(phase + i)})`);
    lg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.strokeStyle = lg;
    ctx.lineWidth = 10 + (i % 3) * 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2 + Math.sin(a) * 30, (y0 + y1) / 2, x1, y1);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";

  // Dark rock polygons (smooth irregular chunks like the reference)
  const rocks: { x: number; y: number; r: number; seed: number }[] = [];
  const rnd = (n: number) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  for (let i = 0; i < 28; i++) {
    rocks.push({
      x: rnd(i * 3.1) * S,
      y: rnd(i * 5.7 + 2) * S,
      r: 28 + rnd(i * 9.2) * 42,
      seed: i * 13.3,
    });
  }
  for (const rock of rocks) {
    const sides = 6 + Math.floor(rnd(rock.seed) * 4);
    ctx.beginPath();
    for (let s = 0; s < sides; s++) {
      const ang = (s / sides) * Math.PI * 2 + rnd(rock.seed + s) * 0.5;
      const rad = rock.r * (0.65 + rnd(rock.seed + s * 2) * 0.45);
      const px = rock.x + Math.cos(ang) * rad;
      const py = rock.y + Math.sin(ang) * rad;
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    const shade = 28 + Math.floor(rnd(rock.seed + 1) * 28);
    ctx.fillStyle = `rgb(${shade},${shade - 4},${shade - 8})`;
    ctx.fill();
    // subtle top highlight
    ctx.strokeStyle = `rgba(70,60,55,0.5)`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Thin bright crack edges between rocks
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = `rgba(255, 200, 80, ${0.35 + 0.2 * Math.sin(phase * 2)})`;
  ctx.lineWidth = 3;
  for (let i = 0; i < 18; i++) {
    const a = phase * 0.25 + i * 2.2;
    ctx.beginPath();
    const x0 = rnd(i + 40) * S;
    const y0 = rnd(i + 80) * S;
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(
      x0 + Math.sin(a) * 40,
      y0 + Math.cos(a) * 40,
      x0 + Math.cos(a * 0.7) * 60,
      y0 + Math.sin(a * 0.7) * 60,
    );
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";
  return c;
}

function magmaTableMat(glowHex: string, opts: ConstructorParameters<typeof THREE.MeshStandardMaterial>[0] = {}) {
  const canvas = makeMagmaCanvas(glowHex, 0);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(1.2, 1.2);
  const m = new THREE.MeshStandardMaterial({
    map,
    color: "#ffffff",
    emissive: glowHex,
    emissiveIntensity: 0.55,
    roughness: 0.55,
    metalness: 0.08,
    ...opts,
  });
  m.userData.magma = true;
  m.userData.magmaGlow = glowHex;
  m.userData.magmaCanvas = canvas;
  m.userData.magmaMap = map;
  m.userData.magmaPhase = 0;
  return m;
}

function magmaLegMat(glowHex: string, opts: ConstructorParameters<typeof THREE.MeshStandardMaterial>[0] = {}) {
  const m = new THREE.MeshStandardMaterial({
    color: "#1c1210",
    emissive: glowHex,
    emissiveIntensity: 0.9,
    roughness: 0.5,
    metalness: 0.12,
    ...opts,
  });
  m.userData.magmaLeg = true;
  m.userData.magmaGlow = glowHex;
  return m;
}

/** Animate magma cracks (slow flow) + leg pulse. Call each frame. */
export function animateLavaMaterials(root: THREE.Object3D, time = performance.now() * 0.001) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const mats = mesh.material
      ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material])
      : [];
    for (const mat of mats) {
      const m = mat as THREE.MeshStandardMaterial & {
        userData: {
          magma?: boolean;
          magmaLeg?: boolean;
          magmaGlow?: string;
          magmaCanvas?: HTMLCanvasElement;
          magmaMap?: THREE.CanvasTexture;
          magmaPhase?: number;
          lastMagmaDraw?: number;
        };
      };
      if (m?.userData?.magmaLeg) {
        const pulse = 0.55 + 0.45 * Math.sin(time * 2.8 + mesh.id * 0.3);
        try {
          const g = new THREE.Color(m.userData.magmaGlow || DEFAULT_MAGMA_COLOR);
          m.emissive.copy(g);
          m.emissiveIntensity = 0.55 + 1.1 * pulse;
        } catch { /* ignore */ }
        continue;
      }
      if (!m?.userData?.magma) continue;
      // Slow magma drift via UV + occasional texture refresh
      const map = m.userData.magmaMap;
      if (map) {
        map.offset.x = (time * 0.018) % 1;
        map.offset.y = (time * 0.012) % 1;
        map.needsUpdate = true;
      }
      const pulse = 0.5 + 0.5 * Math.sin(time * 2.2);
      m.emissiveIntensity = 0.35 + 0.55 * pulse;
      // Redraw cracks slowly so veins shift (every ~120ms)
      const last = m.userData.lastMagmaDraw ?? 0;
      if (time - last > 0.12 && m.userData.magmaCanvas && map) {
        m.userData.lastMagmaDraw = time;
        m.userData.magmaPhase = (m.userData.magmaPhase ?? 0) + 0.15;
        const ctx = m.userData.magmaCanvas.getContext("2d");
        if (ctx) {
          const fresh = makeMagmaCanvas(m.userData.magmaGlow || DEFAULT_MAGMA_COLOR, m.userData.magmaPhase);
          ctx.clearRect(0, 0, 256, 256);
          ctx.drawImage(fresh, 0, 0);
          map.needsUpdate = true;
        }
      }
    }
  });
}

function addEyes(g: THREE.Group, design: EyeDesign, color: string, ghost: boolean) {
  const opacity = ghost ? 0.35 : 1;
  const m = mat(color, { emissive: color, emissiveIntensity: 1.4, transparent: ghost, opacity });
  if (design === "square") {
    for (const x of [-1, 1]) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.06), m.clone());
      mesh.position.set(x * 0.9, 3.28, 2.02);
      g.add(mesh);
    }
    return;
  }
  if (design === "triangle") {
    for (const x of [-1, 1]) {
      const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.7, 3), m.clone());
      mesh.position.set(x * 0.95, 3.28, 2.02);
      mesh.rotation.z = x * 0.15;
      g.add(mesh);
    }
    return;
  }
  // boss slanted bars
  for (const x of [-1, 1]) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.05), m.clone());
    mesh.position.set(x * 0.95, 3.25, 2.02);
    mesh.rotation.z = x * -0.35;
    g.add(mesh);
  }
}

function addLegs(g: THREE.Group, design: LegDesign, primary: string, ghost: boolean, magma = false, magmaColor = DEFAULT_MAGMA_COLOR) {
  if (design === "nolegs") return; // floating tabletop
  const opacity = ghost ? 0.35 : 1;
  const m = magma
    ? magmaLegMat(magmaColor, { transparent: ghost, opacity, roughness: 0.5 })
    : mat(darken(primary, 0.28), { transparent: ghost, opacity, roughness: 0.4 });
  if (design === "oneleg") {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 3, 12), m);
    mesh.position.set(0, 1.5, 0);
    mesh.castShadow = true;
    g.add(mesh);
    return;
  }
  if (design === "minimal") {
    for (const x of [-2.0, 2.0]) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3, 0.28), m.clone());
      mesh.position.set(x, 1.5, 0);
      mesh.castShadow = true;
      g.add(mesh);
    }
    return;
  }
  if (design === "triangle") {
    for (const [x, z] of LEG_POS) {
      const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.45, 3, 3), m.clone());
      mesh.position.set(x, 1.5, z);
      mesh.castShadow = true;
      g.add(mesh);
    }
    return;
  }
  for (const [x, z] of LEG_POS) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.35, 3, 8), m.clone());
    mesh.position.set(x, 1.5, z);
    mesh.castShadow = true;
    g.add(mesh);
  }
}

function addTrophy(g: THREE.Group, color: string, y0: number) {
  // Full table height trophy on top of surface y0
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, 1.6, 12), mat(color, { metalness: 0.7, roughness: 0.25 }));
  stem.position.set(0, y0 + 0.8, 0);
  g.add(stem);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.45, 0.9, 16), mat(color, { metalness: 0.65, roughness: 0.2 }));
  cup.position.set(0, y0 + 1.9, 0);
  g.add(cup);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.25, 16), mat(color, { metalness: 0.5, roughness: 0.35 }));
  base.position.set(0, y0 + 0.12, 0);
  g.add(base);
}
function addCrown(g: THREE.Group, color: string, y0: number) {
  // Half table height, glows with decoration color
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.85, 0.9, 0.45, 16),
    mat(color, { metalness: 0.8, roughness: 0.2, emissive: color, emissiveIntensity: 0.55 }),
  );
  band.position.set(0, y0 + 0.35, 0);
  g.add(band);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.55, 8),
      mat(color, { metalness: 0.75, roughness: 0.2, emissive: color, emissiveIntensity: 0.7 }),
    );
    tip.position.set(Math.cos(a) * 0.7, y0 + 0.85, Math.sin(a) * 0.7);
    g.add(tip);
  }
}
function addThrone(g: THREE.Group, color: string) {
  const y0 = 3.4;
  // Seat
  const seat = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.35, 2.0), mat(color, { metalness: 0.35, roughness: 0.4 }));
  seat.position.set(0, y0 + 0.55, 0.15);
  g.add(seat);
  // Backrest
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 0.28), mat(color, { metalness: 0.3, roughness: 0.45 }));
  back.position.set(0, y0 + 1.75, -0.85);
  g.add(back);
  // Arm rests
  for (const x of [-1.15, 1.15]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 1.6), mat(color, { metalness: 0.3, roughness: 0.4 }));
    arm.position.set(x, y0 + 0.95, 0.1);
    g.add(arm);
  }
  // Mastered WALL panels (red glowing slabs) flanking the backrest
  for (const x of [-1.35, 1.35]) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 2.4, 1.4),
      mat("#c41e1e", { metalness: 0.2, roughness: 0.35, emissive: "#ff2222", emissiveIntensity: 0.55 }),
    );
    wall.position.set(x, y0 + 1.5, -0.2);
    g.add(wall);
  }
  // TRAMPOLINE model on left arm (pad + silver coil)
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 0.12, 20),
    mat("#22c55e", { metalness: 0.15, roughness: 0.5, emissive: "#16a34a", emissiveIntensity: 0.35 }),
  );
  pad.position.set(-1.15, y0 + 1.15, 0.55);
  pad.rotation.x = -0.35;
  g.add(pad);
  const coil = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.06, 8, 16),
    mat("#c0c0c0", { metalness: 0.9, roughness: 0.2 }),
  );
  coil.position.set(-1.15, y0 + 0.95, 0.35);
  coil.rotation.x = Math.PI / 2;
  g.add(coil);
  // WHITE TELEPORT BOMB on right arm
  const bomb = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 16, 16),
    mat("#f5f5f5", { metalness: 0.55, roughness: 0.15, emissive: "#ffffff", emissiveIntensity: 0.45 }),
  );
  bomb.position.set(1.15, y0 + 1.25, 0.5);
  g.add(bomb);
  const bombRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.5, 0.04, 8, 24),
    mat("#a78bfa", { metalness: 0.6, roughness: 0.2, emissive: "#7c3aed", emissiveIntensity: 0.6 }),
  );
  bombRing.position.copy(bomb.position);
  bombRing.rotation.x = Math.PI / 2;
  g.add(bombRing);
  // Mastered FIREBALL (blue) hovering above the backrest
  const fireball = new THREE.Mesh(
    new THREE.SphereGeometry(0.38, 14, 14),
    mat("#3b82f6", { metalness: 0.2, roughness: 0.25, emissive: "#2563eb", emissiveIntensity: 0.85 }),
  );
  fireball.position.set(0, y0 + 3.15, -0.7);
  g.add(fireball);
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 0.55, 10),
    mat("#60a5fa", { emissive: "#3b82f6", emissiveIntensity: 1.0, transparent: true, opacity: 0.85 }),
  );
  flame.position.set(0, y0 + 3.55, -0.7);
  g.add(flame);
  // Small glow light for the throne
  const light = new THREE.PointLight(color, 1.2, 14);
  light.position.set(0, y0 + 2.2, 0);
  g.add(light);
}

function addDecoration(g: THREE.Group, kind: TableDecoration, color: string, topDeco: string = "none", tablePrimary = "#4da861", magma = false, magmaColor = DEFAULT_MAGMA_COLOR) {
  if (kind === "none") return;
  if (kind === "trophy") { addTrophy(g, color, 3.4); return; }
  if (kind === "crown") { addCrown(g, color, 3.4); return; }
  if (kind === "throne") { addThrone(g, color); return; }
  if (kind === "stack") {
    const topSurf = new THREE.Mesh(
      new THREE.BoxGeometry(6.4, 0.35, 6.4),
      magma ? magmaTableMat(magmaColor, { roughness: 0.55 }) : mat(tablePrimary, { roughness: 0.55 }),
    );
    topSurf.position.set(0, 3.4 + 3.2, 0);
    g.add(topSurf);
    for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]] as [number, number][]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 2.9, 8), mat(tablePrimary, { roughness: 0.6 }));
      leg.position.set(x, 3.4 + 1.45, z);
      g.add(leg);
    }
    if (topDeco === "trophy") addTrophy(g, color, 3.4 + 3.4);
    else if (topDeco === "crown") addCrown(g, color, 3.4 + 3.4);
    return;
  }
  if (kind === "plates") {
    for (const x of [-1.2, 1.2]) {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.55, 0.08, 20),
        mat(color, { roughness: 0.3, metalness: 0.2 }),
      );
      mesh.position.set(x, 3.5, 0);
      g.add(mesh);
    }
    return;
  }
  if (kind === "rug") {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 2.6),
      mat(color, { roughness: 0.9, side: THREE.DoubleSide }),
    );
    mesh.position.set(0, 3.48, 0);
    mesh.rotation.x = -Math.PI / 2;
    g.add(mesh);
    return;
  }
  if (kind === "office") {
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 1.1), mat(color, { roughness: 0.35, metalness: 0.3 }));
    base.position.set(0, 3.55, 0);
    g.add(base);
    const screen = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.9, 0.06),
      mat("#1a1a22", { emissive: "#223355", emissiveIntensity: 0.4 }),
    );
    screen.position.set(0, 3.9, -0.35);
    screen.rotation.x = 0.4;
    g.add(screen);
    return;
  }
  // birthday
  const cake = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 0.5, 16), mat(color, { roughness: 0.6 }));
  cake.position.set(0, 3.55, 0);
  g.add(cake);
  const cakeTop = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.35, 16), mat("#fff5e6", { roughness: 0.7 }));
  cakeTop.position.set(0, 3.95, 0);
  g.add(cakeTop);
  for (const x of [-0.25, 0, 0.25]) {
    const candle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.35, 8),
      mat("#ffee88", { emissive: "#ffaa00", emissiveIntensity: 1.2 }),
    );
    candle.position.set(x, 4.25, 0);
    g.add(candle);
  }
}

export type TableBotOptions = {
  skin?: Partial<Skin>;
  scale?: number;
  emitLight?: boolean;
  lightIntensity?: number;
  ghost?: boolean;
};

/** Pure Three.js table bot — avoids R3F JSX so Lovable's data-tsd-source injection cannot crash the canvas. */
export function createTableBot(opts: TableBotOptions = {}): THREE.Group {
  const skin: Skin = { ...DEFAULT_SKIN, ...(opts.skin ?? {}) };
  const scale = opts.scale ?? 1;
  const ghost = !!opts.ghost;
  const opacity = ghost ? 0.35 : 1;
  const emitLight = opts.emitLight !== false;
  const lightIntensity = opts.lightIntensity ?? 1;

  const root = new THREE.Group();
  root.scale.setScalar(scale);

  const magmaOn = skinHasMagma(skin);
  const magmaCol = skin.magmaColor || DEFAULT_MAGMA_COLOR;
  // Rock base color when magma is on (palette color still used for solid skins)
  const primary = magmaOn && (skin.tablePrimary === "lava" || !skin.tablePrimary)
    ? "#2a1810"
    : skin.tablePrimary;

  const top = new THREE.Mesh(
    new THREE.BoxGeometry(6, 0.5, 4),
    magmaOn
      ? magmaTableMat(magmaCol, { transparent: ghost, opacity, envMapIntensity: 2 })
      : mat(primary, {
          roughness: 0.28,
          metalness: 0.08,
          envMapIntensity: 2,
          transparent: ghost,
          opacity,
        }),
  );
  top.position.set(0, 3.2, 0);
  top.castShadow = true;
  top.receiveShadow = true;
  root.add(top);

  addLegs(root, skin.legDesign, primary, ghost, magmaOn, magmaCol);
  addEyes(root, skin.eyeDesign, skin.eyeColor, ghost);
  addDecoration(root, skin.decoration, skin.decorationColor, skin.topDecoration ?? "none", primary, magmaOn, magmaCol);

  if (emitLight) {
    const lc = magmaOn ? magmaCol : skin.lightColor;
    const light = new THREE.PointLight(lc, 40 * lightIntensity * (magmaOn ? 1.25 : 1), 120, 2);
    light.position.set(0, 4.5, 0);
    root.add(light);
  }

  return root;
}

export function createStageDisc(color = "#2a2430", lightColor = "#4da861"): THREE.Group {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(5.5, 64),
    mat(color, { roughness: 0.55, metalness: 0.15 }),
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.02;
  disc.receiveShadow = true;
  g.add(disc);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(5.2, 5.5, 64),
    mat(lightColor, { emissive: lightColor, emissiveIntensity: 0.6 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  g.add(ring);

  const light = new THREE.PointLight(lightColor, 25, 40);
  light.position.set(0, 8, 0);
  g.add(light);

  return g;
}

export function skinKey(skin: Partial<Skin> | undefined) {
  const s = { ...DEFAULT_SKIN, ...(skin ?? {}) };
  return [s.eyeColor, s.tablePrimary, s.eyeDesign, s.decoration, s.topDecoration ?? "none", s.decorationColor, s.lightColor, s.legDesign, s.magma ? "1" : "0", s.magmaColor || ""].join("|");
}
