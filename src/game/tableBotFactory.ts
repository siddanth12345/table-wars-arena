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
    return c;
  } catch {
    return new THREE.Color(hex);
  }
}

function mat(color: string | THREE.Color, opts: ConstructorParameters<typeof THREE.MeshStandardMaterial>[0] = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.35, ...opts });
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

function addLegs(g: THREE.Group, design: LegDesign, primary: string, ghost: boolean) {
  const legColor = darken(primary, 0.28);
  const opacity = ghost ? 0.35 : 1;
  const m = mat(legColor, { transparent: ghost, opacity, roughness: 0.4 });
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

function addDecoration(g: THREE.Group, kind: TableDecoration, color: string) {
  if (kind === "none") return;
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
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.35, 16), mat("#fff5e6", { roughness: 0.7 }));
  top.position.set(0, 3.95, 0);
  g.add(top);
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

  const top = new THREE.Mesh(
    new THREE.BoxGeometry(6, 0.5, 4),
    mat(skin.tablePrimary, {
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

  addLegs(root, skin.legDesign, skin.tablePrimary, ghost);
  addEyes(root, skin.eyeDesign, skin.eyeColor, ghost);
  addDecoration(root, skin.decoration, skin.decorationColor);

  if (emitLight) {
    const light = new THREE.PointLight(skin.lightColor, 40 * lightIntensity, 120, 2);
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
  return [s.eyeColor, s.tablePrimary, s.eyeDesign, s.decoration, s.decorationColor, s.lightColor, s.legDesign].join("|");
}
