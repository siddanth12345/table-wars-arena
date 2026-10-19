import { useFrame, useThree } from "@react-three/fiber";
import { NET, NET_HOOKS, PVP_DMG, PVP_HITBOX, PVP_CENTER_Y, hitPeer, reportDeath, sendPose, sharesEnemies, isFollower, sendNet, enemyHitPeer, myId, type EntSnap } from "./net";
import { RemotePlayers } from "./RemotePlayers";
import { playSfx, playSfxShared, setLoop, setSfxSink, REMOTE_SFX } from "./sfx";
import { PointerLockControls } from "@react-three/drei";
import { SETTINGS, useSettings, lampIntensity } from "./settings";
import { useEffect, useMemo, useRef, type ElementRef } from "react";
import * as THREE from "three";
import {
  G, MAG, FIRE_INTERVAL, DMG, PARRY_WINDOW, PARRY_CD, PARRY_CD_HIT, PARRY_CD_MISS, BUFF_TIME, DASH_CD, AIR_JUMPS, AIR_DASHES,
  BOMB_CD, BOMB_CD_BUFF, TABLE_HP, TABLE_CAP, BOSS_HITS, BOSS_WARN, setLocker,
  MAP, PARRY_LOCK_AT, TUT_STEPS, ONLINE_TUT_STEPS, finishTutorial, MAX_HP, PARRY_DMG, cfg, TRAIN, TRAIN_Q, TRAIN_CMD, isMobilePlay, pauseGame, setCursorLocked, registerDamage, tryComboBurst, onParrySuccess, STORM_START, type TrainSpawn,
  SHARD_NEED, SHARD_INTERVAL, SHARD_LIFE, SHARD_SPAWN_N, LOBBY_RESPAWN, FREECAM_SPEEDS,
} from "./state";
import { SKIN, useSkin } from "./skins";
import { getAbility, getLastUnlockedAbility, setAbility } from "./abilities";
import { hasAchievement, masteryOn, onCampaignWin, onPlayerDeath } from "./mastery";
import { createTableBot, skinKey } from "./tableBotFactory";
import { Room, ROOM, SOLIDS } from "./Room";
import { tableWood } from "./textures";
import { HomeShowcase } from "./HomeShowcase";

// --- feel constants ---
const SPEED = 44;
const DASH_SPEED = 90;
const MAX_HSPEED = 400;
const AIR_ACCEL = 60;
const GRAVITY = 60;
const JUMP_V = 28;
const EYE = 3.2;
const BODY_H = 3.6;
const PLAYER_R = 0.8;
const STEP = 0.6;
const WALL_EPS = 0.5;
const BULLET_SPEED = 90 * 50;
const BOT_BULLET_SPEED = 45 * 10;
const BOT_BULLET_HALF = 0.35;
const TABLE_S = 1.5;
const TABLE_W = 6 * TABLE_S;
const BOMB_R = TABLE_W * 12;
const BOMB_SIZE = 0.7; // bomb (blast + projectile) is 0.7× its original size
const AOE_R = TABLE_W * 6;
const BOMB_DMG = 20;
const GRAPPLE_MAX = ROOM.r / 4;
const TABLE_POOL = 60; // room for training-mode spawns beyond the game cap
const GRAPPLE_K = 45;
const BOSS_S = 12;
const BOSS_ZONE = 60;
const BLUE_N = 48;
const BLUE_SPEED = 90;
const BLUE_DASH = 240;
const BLUE_CLEAR_N = 20;
const BLUE_HP = 10;
const BOSS_BULLET_DMG = 20;
const BIG_DMG = 50;
const AOE_DMG = 30;
const SWORD_R = 15;
const STUN_TIME = 1;
const BOMB_BIG_TIME = 5;
const SUMMON_HP = 2.5;
const WAVE_H = 0.5 * 3.45 * TABLE_S; // half a table tall
const WAVE_SPEED = 140;
const WAVE_DMG = 20;
const TELEPORT_CD = 2.5;
const HEALTH_AMOUNT = 10;
const HEALTH_INTERVAL = 5;
const HEALTH_LIFE = 10;
const HEALTH_R = (TABLE_W * 1.5) / 2; // ring diameter = 1.5 table lengths
const SHARD_R = HEALTH_R * 3; // player shards are 3× health rings
const BULLET_AOE_R = TABLE_W / 2; // splinter blast diameter = one brown table
const BOSS_H = 3.45 * BOSS_S; // boss table height
const SLAM_SPEED = BOT_BULLET_SPEED * 2;
const BOUNCE_WIN = 0.8;
const WALLRUN_TIME = 3;
const WALLRUN_RECHARGE = 1;
const WORLD_UNITS_PER_METER = 10;
// ground pound tiers by drop height (diameters; max = 1.5 boss-table lengths)
const SLAM_RADIUS_MULT = 3; // every slam radius is 3× bigger
const SLAM_TIERS = [
  { maxH: BOSS_H / 2, d: TABLE_W * 1.5 * SLAM_RADIUS_MULT, dmg: 5, cd: 1 },
  { maxH: BOSS_H, d: TABLE_W * 3 * SLAM_RADIUS_MULT, dmg: 5, cd: 2 },
  { maxH: BOSS_H * 2, d: TABLE_W * 4 * SLAM_RADIUS_MULT, dmg: 10, cd: 5 },
  { maxH: Infinity, d: 6 * BOSS_S * 1.5 * SLAM_RADIUS_MULT, dmg: 25, cd: 10 },
];
const R = ROOM.r;
// 1v1 storm: starts 60s into a round, closes in from the arena edge at 30 u/s, 5 dmg every 0.6s while inside
const STORM_SPEED = 30, STORM_DMG = 5, STORM_TICK = 0.6;
const UP = new THREE.Vector3(0, 1, 0);

type Bullet = { pos: THREE.Vector3; prev: THREE.Vector3; vel: THREE.Vector3; life: number; alive: boolean; dmg: number };
type Table = {
  alive: boolean; pos: THREE.Vector3; vy: number; hp: number; maxHp: number; target: THREE.Vector3; shootT: number;
  jumpT: number; jumpsLeft: number; dashT: number; dash: THREE.Vector3; bob: number; s: number; yaw: number; summoned: boolean; passive: boolean;
};
type Splinter = { pos: THREE.Vector3; vel: THREE.Vector3; rot: THREE.Euler; spin: THREE.Vector3; life: number; size: number };
type Hazard = { active: boolean; kind: "quarter" | "sword" | "stomp" | "aoe"; t: number; total: number; fx: number; x: number; z: number; a0: number; dmg?: number; owner?: "player" | "boss" };

const FX_LIGHTS = 5;
const BOT_LIGHTS = 6;
const _glowBoss = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();

const bulletPool = (n: number): Bullet[] =>
  Array.from({ length: n }, () => ({ pos: new THREE.Vector3(), prev: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0, alive: false, dmg: DMG }));

function spawnBullet(pool: Bullet[], pos: THREE.Vector3, vel: THREE.Vector3, dmg: number, life: number) {
  const b = pool.find((x) => !x.alive);
  if (!b) return;
  b.pos.copy(pos);
  b.prev.copy(pos);
  b.vel.copy(vel);
  b.life = life;
  b.dmg = dmg;
  b.alive = true;
}

// ---------- geometry helpers ----------
function segAABB(a: THREE.Vector3, b: THREE.Vector3, min: THREE.Vector3, max: THREE.Vector3) {
  let t0 = 0, t1 = 1;
  for (const ax of ["x", "y", "z"] as const) {
    const d = b[ax] - a[ax];
    if (Math.abs(d) < 1e-9) {
      if (a[ax] < min[ax] || a[ax] > max[ax]) return Infinity;
    } else {
      let ta = (min[ax] - a[ax]) / d, tb = (max[ax] - a[ax]) / d;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta);
      t1 = Math.min(t1, tb);
      if (t0 > t1) return Infinity;
    }
  }
  return t0;
}
const _ab = new THREE.Vector3(), _cp = new THREE.Vector3();
function segSphere(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, r: number) {
  _ab.subVectors(b, a);
  const l2 = _ab.lengthSq();
  const t = l2 > 0 ? THREE.MathUtils.clamp(_cp.subVectors(c, a).dot(_ab) / l2, 0, 1) : 0;
  _cp.copy(a).addScaledVector(_ab, t);
  return _cp.distanceTo(c) < r ? t : Infinity;
}
const _mn = new THREE.Vector3(), _mx = new THREE.Vector3();
function segSolids(a: THREE.Vector3, b: THREE.Vector3) {
  let best = Infinity;
  for (const s of SOLIDS) {
    if (s.yaw) {
      _la.set(a.x - s.x, a.y, a.z - s.z).applyAxisAngle(UP, -s.yaw);
      _lb.set(b.x - s.x, b.y, b.z - s.z).applyAxisAngle(UP, -s.yaw);
      _mn.set(-s.hw, s.y0, -s.hd);
      _mx.set(s.hw, s.y1, s.hd);
      best = Math.min(best, segAABB(_la, _lb, _mn, _mx));
      continue;
    }
    _mn.set(s.x - s.hw, s.y0, s.z - s.hd);
    _mx.set(s.x + s.hw, s.y1, s.z + s.hd);
    best = Math.min(best, segAABB(a, b, _mn, _mx));
  }
  return best;
}
const _bq = new THREE.Vector3(), _la = new THREE.Vector3(), _lb = new THREE.Vector3(), _bmin = new THREE.Vector3(), _bmax = new THREE.Vector3();
// segment vs a (yaw-rotated) table body box; s = table scale, y = feet height
function segTable(a: THREE.Vector3, b: THREE.Vector3, at: THREE.Vector3, y: number, yaw: number, s: number) {
  _la.subVectors(a, at).setY(a.y - y).applyAxisAngle(UP, -yaw);
  _lb.subVectors(b, at).setY(b.y - y).applyAxisAngle(UP, -yaw);
  _bmin.set(-3.1 * s, 0, -2.1 * s);
  _bmax.set(3.1 * s, 3.6 * s, 2.1 * s);
  return segAABB(_la, _lb, _bmin, _bmax);
}
const overlapXZ = (p: THREE.Vector3, s: (typeof SOLIDS)[number], r: number) => {
  _la.set(p.x - s.x, 0, p.z - s.z);
  if (s.yaw) _la.applyAxisAngle(UP, -s.yaw);
  return Math.abs(_la.x) < s.hw + r && Math.abs(_la.z) < s.hd + r;
};

function clampCircle(p: THREE.Vector3, r: number) {
  const d = Math.hypot(p.x, p.z), m = R - r;
  if (d > m) {
    p.x *= m / d;
    p.z *= m / d;
  }
}

/** Oriented ability box: local axes after yaw then pitch (ramp/ceiling support). */
function orientLocal(out: THREE.Vector3, dx: number, dy: number, dz: number, yaw: number, pitch: number) {
  // inverse: -pitch then -yaw
  const cp = Math.cos(-pitch), sp = Math.sin(-pitch);
  const cy = Math.cos(-yaw), sy = Math.sin(-yaw);
  let x = dx, y = dy, z = dz;
  // -pitch about X
  const y1 = y * cp - z * sp, z1 = y * sp + z * cp;
  y = y1; z = z1;
  // -yaw about Y
  const x2 = x * cy + z * sy, z2 = -x * sy + z * cy;
  out.set(x2, y, z2);
}
function orientWorld(out: THREE.Vector3, lx: number, ly: number, lz: number, yaw: number, pitch: number) {
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  // pitch about X then yaw about Y
  let x = lx, y = ly * cp - lz * sp, z = ly * sp + lz * cp;
  const x2 = x * cy + z * sy, z2 = -x * sy + z * cy;
  out.set(x2, y, z2);
}
function pushOutOriented(
  p: THREE.Vector3,
  cx: number, cy: number, cz: number, yaw: number, pitch: number,
  hw: number, hh: number, hd: number, r: number,
) {
  orientLocal(_la, p.x - cx, p.y - cy, p.z - cz, yaw, pitch);
  const dx = _la.x, dy = _la.y, dz = _la.z;
  const ox = hw + r - Math.abs(dx), oy = hh + r - Math.abs(dy), oz = hd + r - Math.abs(dz);
  if (ox > 0 && oy > 0 && oz > 0) {
    // push along smallest penetration axis
    _lb.set(0, 0, 0);
    if (ox <= oy && ox <= oz) _lb.x = (Math.sign(dx) || 1) * ox;
    else if (oy <= ox && oy <= oz) _lb.y = (Math.sign(dy) || 1) * oy;
    else _lb.z = (Math.sign(dz) || 1) * oz;
    orientWorld(_la, _lb.x, _lb.y, _lb.z, yaw, pitch);
    p.add(_la);
    return true;
  }
  return false;
}

function pushOut(p: THREE.Vector3, s: (typeof SOLIDS)[number], r: number) {
  _la.set(p.x - s.x, 0, p.z - s.z);
  if (s.yaw) _la.applyAxisAngle(UP, -s.yaw);
  const dx = _la.x, dz = _la.z;
  const ox = s.hw + r - Math.abs(dx), oz = s.hd + r - Math.abs(dz);
  if (ox > 0 && oz > 0) {
    _lb.set(0, 0, 0);
    if (ox < oz) _lb.x = (Math.sign(dx) || 1) * ox;
    else _lb.z = (Math.sign(dz) || 1) * oz;
    if (s.yaw) _lb.applyAxisAngle(UP, s.yaw);
    p.add(_lb);
  }
}
function wallNormal(p: THREE.Vector3): THREE.Vector3 | null {
  const d = Math.hypot(p.x, p.z);
  if (d >= R - PLAYER_R - WALL_EPS) return new THREE.Vector3(-p.x / d, 0, -p.z / d);
  for (const s of SOLIDS) {
    if (p.y >= s.y1 - STEP || p.y + BODY_H <= s.y0) continue;
    _la.set(p.x - s.x, 0, p.z - s.z);
    if (s.yaw) _la.applyAxisAngle(UP, -s.yaw);
    const dx = _la.x, dz = _la.z;
    const ox = s.hw + PLAYER_R + WALL_EPS - Math.abs(dx), oz = s.hd + PLAYER_R + WALL_EPS - Math.abs(dz);
    if (ox > 0 && oz > 0) {
      const normal = ox < oz ? new THREE.Vector3(Math.sign(dx) || 1, 0, 0) : new THREE.Vector3(0, 0, Math.sign(dz) || 1);
      return s.yaw ? normal.applyAxisAngle(UP, s.yaw) : normal;
    }
  }
  return null;
}
function inSolid(p: THREE.Vector3) {
  return SOLIDS.some((s) => p.y > s.y0 && p.y < s.y1 && Math.abs(p.x - s.x) < s.hw && Math.abs(p.z - s.z) < s.hd);
}
function randomFloor(avoid: THREE.Vector3) {
  const v = new THREE.Vector3();
  for (let i = 0; i < 40; i++) {
    const rr = Math.sqrt(Math.random()) * (R - 40), a = Math.random() * Math.PI * 2;
    v.set(Math.cos(a) * rr, 0, Math.sin(a) * rr);
    if (v.distanceTo(avoid) < 70) continue;
    if (SOLIDS.some((s) => s.y0 < 5 && overlapXZ(v, s, 10))) continue;
    return v;
  }
  return v;
}
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

// table part local matrices (unit table scale)
const mk = (p: [number, number, number], s: [number, number, number]) =>
  new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion(), new THREE.Vector3(...s));
const TOP_M = mk([0, 3.2, 0], [1, 1, 1]);
const LEG_M = ([[-2.4, -1.5], [2.4, -1.5], [-2.4, 1.5], [2.4, 1.5]] as const).map(([x, z]) => mk([x, 1.5, z], [1, 1, 1]));
const EYE_M = [-1, 1].map((x) => mk([x, 3.2, 2.02], [1, 1, 1]));

const tmpM = new THREE.Matrix4(), tmpM2 = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpV = new THREE.Vector3();
const ONE = new THREE.Vector3(1, 1, 1);
const zAxis = new THREE.Vector3(0, 0, 1);
const START = new THREE.Vector3(0, 0, 120);
const BOT_START = new THREE.Vector3(0, 0, -100);
const _pvpAt = new THREE.Vector3(), _peerC = new THREE.Vector3();
const HIDE = new THREE.Matrix4().makeScale(0, 0, 0);

function newTable(): Table {
  return {
    alive: false, pos: new THREE.Vector3(), vy: 0, hp: TABLE_HP, maxHp: TABLE_HP, target: new THREE.Vector3(), shootT: 1,
    jumpT: 2, jumpsLeft: 0, dashT: 3, dash: new THREE.Vector3(), bob: 0, s: TABLE_S, yaw: 0, summoned: false, passive: false,
  };
}

// Local player body pose for freecam third-person view
const localBody = { x: 0, y: 0, z: 0, yaw: 0, show: false, playerYaw: 0 };

function LocalFreecamBody() {
  const g = useRef<THREE.Group>(null);
  const skin = useSkin();
  const key = skinKey(skin) + "|" + ((NET.kind === "pvp" || NET.kind === "lobby") ? 3 : 1);
  const bot = useMemo(() => createTableBot({
    skin,
    scale: 0.6 * ((NET.kind === "pvp" || NET.kind === "lobby") ? 3 : 1),
    emitLight: true,
    lightIntensity: 1.3,
  }), [key]);

  useEffect(() => {
    const host = g.current;
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

  useFrame(() => {
    const m = g.current;
    if (!m) return;
    m.visible = localBody.show;
    if (!localBody.show) return;
    m.position.set(localBody.x, localBody.y, localBody.z);
    m.rotation.y = localBody.yaw + Math.PI;
  });
  return <group ref={g} visible={false} />;
}

export function World() {
  const { camera, gl } = useThree();
  const settings = useSettings();
  const ctrl = useRef<ElementRef<typeof PointerLockControls>>(null);
  const staticRef = useRef<THREE.Group>(null);
  const keys = useRef<Record<string, boolean>>({});
  const softLookRef = useRef({ x: 0, y: 0 });
  const lastClientRef = useRef<{ x: number; y: number; on: boolean }>({ x: 0, y: 0, on: false });
  const pos = useRef(START.clone());
  const hv = useRef(new THREE.Vector3());
  const vy = useRef(0);
  const grounded = useRef(true);
  const wallrunTime = useRef(WALLRUN_TIME);
  const wallrunRecharge = useRef(WALLRUN_RECHARGE);
  const fireT = useRef(0);
  const lastYaw = useRef(0);
  const pendingYaw = useRef(0);
  const anchor = useRef(new THREE.Vector3());
  const ropeLen = useRef(0);
  const lastReset = useRef(-1);
  const recentPos = useRef<{ t: number; p: THREE.Vector3 }[]>([]);

  const playerPool = useMemo(() => bulletPool(128), []);
  const botPool = useMemo(() => bulletPool(320), []);
  const tables = useMemo(() => Array.from({ length: TABLE_POOL }, newTable), []);
  const splinters = useMemo<Splinter[]>(() => [], []);
  const bomb = useRef({ alive: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), tele: null as THREE.Vector3 | null, netId: "" });
  const booms = useMemo(() => Array.from({ length: 24 }, () => ({ t: 0, pos: new THREE.Vector3(), r: BOMB_R, col: "#ffb347", dur: 0.5, hold: false, ring: false, ringCol: "#ffffff", rx: 0, ry: 0, rz: 0 })), []);
  const hazards = useMemo<Hazard[]>(() => Array.from({ length: 8 }, () => ({ active: false, kind: "aoe", t: 0, total: 1, fx: 0, x: 0, z: 0, a0: 0 })), []);
  const blues = useMemo(() => Array.from({ length: BLUE_N }, () => ({ alive: false, pos: new THREE.Vector3(), dash: new THREE.Vector3(), hp: BLUE_HP, hitCd: 0, dashT: 8, yaw: 0 })), []);
  const blueT = useRef(6);
  const summonT = useRef(10);
  const healthT = useRef(HEALTH_INTERVAL);
  const health = useMemo(() => Array.from({ length: 24 }, () => ({ active: false, pos: new THREE.Vector3(), t: 0, isShard: false })), []);
  // Ability props: walls (solid), trampolines (bounce pads), fire lines
  const abilityWalls = useMemo(() => Array.from({ length: 16 }, () => ({
    active: false, cx: 0, cy: 0, cz: 0, yaw: 0, pitch: 0, hw: 0.5, hh: 0.5, hd: 0.5, t: 0, netId: "" as string,
    m: false, ret: false, rt: 0, hit: new Map<string, number>(), grow: 1,
  })), []);
  const abilityPads = useMemo(() => Array.from({ length: 12 }, () => ({
    active: false, cx: 0, cy: 0, cz: 0, yaw: 0, pitch: 0, hw: 0.5, hh: 0.5, hd: 0.5,
    nx: 0, ny: 1, nz: 0, t: 0, cd: 0, netId: "" as string, m: false, squish: 0,
  })), []);
  const abilityFires = useMemo(() => Array.from({ length: 8 }, () => ({
    active: false, ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0, t: 0,
    stung: new Set<string>(), tickAcc: new Map<string, number>(), netId: "" as string, m: false,
  })), []);
  // Air fireballs (fire ability while airborne) + remote visual bullets
  const bossSword = useRef({ active: false, returning: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), hitCooldown: 0, hitTargets: new Set<string>(), solidHits: 0, solidObjects: new Set<string>() });
  const bossSwordMesh = useRef<THREE.Group | null>(null);
  const lastAbilityMode = useRef(G.mode);
  const fireballs = useMemo(() => Array.from({ length: 12 }, () => ({
    active: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), t: 0, traveled: 0, netId: "" as string, m: false, b: 0, idle: 0,
  })), []);
  const remoteBullets = useMemo(() => Array.from({ length: 64 }, () => ({
    active: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), t: 0,
  })), []);
  const remoteBulletMeshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const remoteBombs = useMemo(() => Array.from({ length: 8 }, () => ({
    active: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), t: 0, tele: false, netId: "" as string,
  })), []);
  const remoteBombMeshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const remoteBombRingRefs = useRef<(THREE.Mesh | null)[]>([]);
  const lastTpVfx = useRef(0);
  // Burn DoT on peers/bots from fireball
  const burns = useRef(new Map<string, { t: number; lx: number; ly: number; lz: number; acc: number }>());
  const wallMeshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const padMeshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const coilMeshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const fireGroupRefs = useRef<(THREE.Group | null)[]>([]);
  const FIRE_VFX_VER = 7; // sharper wider mastered zigzags
  const FIRE_SEGS = 22;
  const fireballMeshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const fireParticleRefs = useRef<(THREE.Points | null)[]>([]);
  const slam = useRef({ on: false, fromY: 0, h: 0 });
  const bunnyHop = useRef(0); // time window to auto-jump on land after dash
  const doDashRef = useRef<(dirs: () => { f: THREE.Vector3; r: THREE.Vector3 }) => void>(() => {});
  const bounce = useRef({ t: 0, y: 0 });
  const demoAng = useRef(0);
  const healthRefs = useRef<(THREE.Group | null)[]>([]);
  const blueTop = useRef<THREE.InstancedMesh>(null);
  const blueLeg = useRef<THREE.InstancedMesh>(null);
  const boss = useRef({ landed: false, y: ROOM.h, vy: 0, pos: new THREE.Vector3(), bulletT: 1, specialT: 2, next: "sword" as "sword" | "stomp", quarterT: 3, aoeT: 5, yaw: 0, lockT: 0 });
  const waves = useMemo(() => Array.from({ length: 6 }, () => ({ active: false, r: 0, x: 0, z: 0, hit: false, stunOnly: false, hitPeers: new Set<string>() })), []);
  const waveRefs = useRef<(THREE.Mesh | null)[]>([]);
  const lastRespawn = useRef(0);
  const tutSetup = useRef(-1);
  const tutDist = useRef(0);
  const tutKills = useRef(0);
  const tutBlueSpawn = useRef(0);
  const abilityReq = useRef(false);
  const stormMesh = useRef<THREE.Mesh>(null);
  const stormAcc = useRef(0);
  const stormGrey = useRef(false);
  const sfxPrev = useRef({ reload: 0, stun: 0, dead: false, count: 0, parryWin: 0, parries: 0, grounded: true, airT: 0, peerDead: new Map<string, boolean>() });
  useEffect(() => () => { gl.domElement.style.filter = ""; setLoop("wallrun", false); setLoop("storm_loop", false); setSfxSink(null); }, [gl]); // never leave the grey storm filter on the canvas
  const freecamWas = useRef(false);
  const teleportRef = useRef({
    active: false,
    phase: "fly" as "fly" | "expand",
    chargeT: 0,
    chargeMax: 0.7,
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    target: new THREE.Vector3(),
    origin: new THREE.Vector3(),
    canRewind: false,
    rewindUsed: false,
    pendingStun: new Set<string>(),
    stunIds: new Set<string>(),
    stunUntil: 0,
    m: false,
  });
  /** targets moved by my teleport bomb (so the ability key can rewind them) */
  const tbMoved = useRef<{ id: string; x: number; y: number; z: number }[]>([]);
  const tpRefresh = useRef(0);
  const slamStun = useRef({ dur: 0, exp: 0 });
  /** ability-applied stun timers (seconds left) for bots — real freeze */
  const abilityStun = useRef(new Map<string, number>());
  const teleportMeshRef = useRef<THREE.Mesh | null>(null);
  const grappleOnPad = useRef(-1); // pad index if grappling a trampoline, else -1
  const grappleOnWall = useRef(-1);
  const snapRef = useRef<EntSnap | null>(null);
  const lastSnap = useRef(0);

  const topI = useRef<THREE.InstancedMesh>(null);
  const legI = useRef<THREE.InstancedMesh>(null);
  const eyeI = useRef<THREE.InstancedMesh>(null);
  const pInst = useRef<THREE.InstancedMesh>(null);
  const bInst = useRef<THREE.InstancedMesh>(null);
  const splI = useRef<THREE.InstancedMesh>(null);
  const bombMesh = useRef<THREE.Mesh>(null);
  const bombGroupRef = useRef<THREE.Group | null>(null);
  const boomRefs = useRef<(THREE.Mesh | null)[]>([]);
  const boomRingRefs = useRef<(THREE.Mesh | null)[]>([]);
  const bombRingRef = useRef<THREE.Mesh | null>(null);
  const teleportRingRefs = useRef<(THREE.Mesh | null)[]>([]);
  const slamCracks = useMemo(() => Array.from({ length: 10 }, () => ({ active: false, x: 0, y: 0, z: 0, t: 0, yaw: 0, dark: false })), []);
  const crackGroupRefs = useRef<(THREE.Group | null)[]>([]);
  const hazRefs = useRef<({ disc: THREE.Mesh | null; sector: THREE.Mesh | null; sword: THREE.Group | null })[]>(
    Array.from({ length: 8 }, () => ({ disc: null, sector: null, sword: null })),
  );
  const bossRef = useRef<THREE.Group>(null);
  const zoneRef = useRef<THREE.Mesh>(null);
  const ropeRef = useRef<THREE.Group>(null);
  const ropeBraid = useMemo(() => [0, 1, 2].map((strand) => {
    const points = Array.from({ length: 161 }, (_, i) => {
      const t = i / 160;
      const a = t * Math.PI * 2 * 24 + strand * Math.PI * 2 / 3;
      return new THREE.Vector3(Math.cos(a) * 0.056, t - 0.5, Math.sin(a) * 0.056);
    });
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 160, 0.012, 4, false);
  }), []);
  const parryMesh = useRef<THREE.Mesh>(null);
  const wood = useMemo(tableWood, []);

  const aliveCount = () => tables.reduce((n, t) => n + (t.alive ? 1 : 0), 0);
  const spawnTable = (at?: THREE.Vector3, summoned = false) => {
    const t = tables.find((x) => !x.alive);
    if (!t) return null;
    Object.assign(t, newTable());
    t.alive = true;
    t.summoned = summoned;
    if (summoned) { t.hp = SUMMON_HP; t.maxHp = SUMMON_HP; }
    else if (G.mode === "training") { t.hp = TRAIN.brownHp; t.maxHp = TRAIN.brownHp; } // training: adjustable brown health
    t.pos.copy(at ?? randomFloor(pos.current));
    t.target.copy(randomFloor(t.pos));
    t.shootT = 1 + Math.random();
    return t;
  };
  const spawnBlue = (at: THREE.Vector3) => {
    const u = blues.find((x) => !x.alive);
    if (!u) return;
    Object.assign(u, { alive: true, hp: G.mode === "training" ? TRAIN.blueHp : BLUE_HP, hitCd: 0, dashT: 6 + Math.random() * 8 });
    u.pos.copy(at).setY(0);
    clampCircle(u.pos, 3 * TABLE_S);
    u.dash.set(0, 0, 0);
  };
  const addWave = (x: number, z: number, stunOnly = false) => {
    const w = waves.find((q) => !q.active) ?? waves[0]!;
    w.hitPeers.clear();
    Object.assign(w, { active: true, r: stunOnly ? 0 : BOSS_S * 3, x, z, hit: false, stunOnly });
  };
  const damagePlayer = (d: number, force = false, quiet = false) => {
    if (G.campaignDead) return;
    if (!force && G.buff > 0) return;
    if (slam.current.on) { slam.current.on = false; G.slamming = false; vy.current = 0; } // hit mid-air cancels the slam
    if (G.mode === "pvp" && (G.pvpDead || G.frozen)) return;
    if (NET.kind === "lobby" && G.pvpDead) return;
    if (G.mode === "game" && d > 0) G.campaignHardcoreEligible = false;
    G.playerHp = Math.max(0, G.playerHp - d);
    G.hurtFlash = 0.25;
    if (!quiet && d > 0) playSfx("player_hurt");
    if (G.playerHp <= 0 && G.mode === "pvp") {
      G.pvpDead = true;
      G.freecam = false;
      G.freecamSpeedIdx = 0;
      onPlayerDeath(G.mode, NET.kind);
      reportDeath();
      return;
    }
    if (G.playerHp <= 0 && sharesEnemies() && G.mode === "game") {
      // party campaign: stay dead until teammates collect SHARD_NEED shards (FIFO revive)
      G.campaignDead = true;
      G.playerHp = 0;
      G.respawnMsg = 2.5;
      G.freecam = true; // spectate until revived — cannot return to body until shards
      G.freecamSpeedIdx = 0;
      const id = myId();
      if (!G.reviveQueue.includes(id)) G.reviveQueue.push(id);
      const name = NET.names[id] ?? "player";
      if (!G.diedThisRun.includes(name)) G.diedThisRun.push(name);
      onPlayerDeath(G.mode, NET.kind);
      reportDeath();
      return;
    }
    if (G.playerHp <= 0) {
      // Lobby PvP: 5-second respawn delay
      if (NET.kind === "lobby") {
        G.pvpDead = true;
        G.freecam = true; // freecam while waiting to respawn
        G.freecamSpeedIdx = 0;
        G.lobbyRespawnT = LOBBY_RESPAWN;
        G.respawnMsg = LOBBY_RESPAWN;
        return;
      }
      if (G.mode === "training") {
        // training death: back to the usual spawn point, refill, open the (pausing) training menu
        G.playerHp = cfg.maxHp();
        pos.current.copy(START);
        hv.current.set(0, 0, 0);
        vy.current = 0;
        grounded.current = true;
        G.trainMenu = true;
        document.exitPointerLock?.();
        return;
      }
      if (G.mode === "tutorial") {
        onPlayerDeath(G.mode, NET.kind);
        G.playerHp = cfg.maxHp();
        return;
      }
      if (G.stage !== "tables") {
        // checkpoint: back to the boss warning, parry stays compromised
        onPlayerDeath(G.mode, NET.kind);
        Object.assign(G, { playerHp: MAX_HP, stage: "incoming", bossWarn: BOSS_WARN, bossHits: 0, bossTime: 0, respawnMsg: 2.5, stun: 0 });
        G.respawnToken++;
        return;
      }
      onPlayerDeath(G.mode, NET.kind);
      G.phase = "lost";
      document.exitPointerLock?.();
    }
  };
  const burst = (at: THREE.Vector3, s: number, n: number) => {
    for (let i = 0; i < n; i++) {
      if (splinters.length > 200) splinters.shift();
      const a = Math.random() * Math.PI * 2;
      splinters.push({
        pos: at.clone(),
        vel: new THREE.Vector3(Math.cos(a) * (10 + Math.random() * 25), 15 + Math.random() * 30, Math.sin(a) * (10 + Math.random() * 25)),
        rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        spin: new THREE.Vector3(Math.random() * 10 - 5, Math.random() * 10 - 5, Math.random() * 10 - 5),
        life: 3,
        size: s,
      });
    }
  };
  const _proj = new THREE.Vector3();
  const toScreen = (wx: number, wy: number, wz: number) => {
    _proj.set(wx, wy, wz).project(camera);
    return { x: (_proj.x + 1) / 2, y: (1 - _proj.y) / 2 };
  };
  const noteDmg = (amount: number, targetId: string, wx: number, wy: number, wz: number) => {
    if (!(amount > 0)) return;
    const s = toScreen(wx, wy, wz);
    registerDamage(amount, targetId, s.x, s.y);
  };

  const hitTable = (t: Table, dmg: number) => {
    if (!t.alive) return;
    if (G.burnBuff > 0) dmg += 2;
    const applied = Math.min(dmg, Math.max(0, t.hp));
    noteDmg(applied, `t${tables.indexOf(t)}`, t.pos.x, t.pos.y + 2.5 * t.s, t.pos.z);
    if (isFollower()) { G.hitFlash = 0.15; sendNet("ehit", { k: "t", i: tables.indexOf(t), dmg }); return; }
    t.hp -= dmg;
    G.hitFlash = 0.15;
    if (t.hp > 0) return;
    t.alive = false;
    playSfx("kill");
    G.kills++;
    burst(tmpV.copy(t.pos).setY(t.pos.y + 3 * t.s), t.s, 7);
    if (G.mode === "game" && !G.capReached && G.stage === "tables") {
      for (let i = 0; i < 2; i++) if (aliveCount() < TABLE_CAP) spawnTable();
      if (aliveCount() >= TABLE_CAP) {
        G.capReached = true;
        for (let i = 0; i < BLUE_CLEAR_N; i++) spawnBlue(randomFloor(pos.current));
      }
    }
  };
  const hitBoss = (n: number) => {
    if (G.burnBuff > 0) n += Math.max(1, Math.round(2 / DMG));
    if (G.stage !== "boss" || !boss.current.landed) return;
    const hits = Math.max(0, Math.min(n, G.bossMax - G.bossHits));
    noteDmg(hits * DMG, "boss", boss.current.pos.x, boss.current.pos.y + 4, boss.current.pos.z);
    if (isFollower()) { G.hitFlash = 0.15; sendNet("ehit", { k: "boss", i: 0, dmg: n }); return; }
    G.bossHits = Math.min(G.bossMax, G.bossHits + n);
    G.hitFlash = 0.15;
    if (G.bossHits >= G.bossMax) {
      playSfx("kill");
      burst(tmpV.copy(boss.current.pos).setY(15), BOSS_S / 2, 30);
      if (G.mode === "training") { despawnBoss(); return; }
      G.phase = "won";
      onCampaignWin(NET.kind === "coop" || !!(NET.party && NET.party.members.length > 0));
      sendNet("won", {});
      document.exitPointerLock?.();
    }
  };
  const hitBlue = (u: (typeof blues)[number], dmg: number) => {
    if (!u.alive) return;
    if (G.burnBuff > 0) dmg += 2;
    const applied = Math.min(dmg, Math.max(0, u.hp));
    noteDmg(applied, `b${blues.indexOf(u)}`, u.pos.x, u.pos.y + 2, u.pos.z);
    if (isFollower()) { G.hitFlash = 0.15; sendNet("ehit", { k: "b", i: blues.indexOf(u), dmg }); return; }
    u.hp -= dmg;
    if (u.hp <= 0) { u.alive = false; playSfx("kill"); burst(tmpV.copy(u.pos).setY(4), TABLE_S, 5); }
  };
  // closest player (you or a teammate) to an enemy — used by host-run shared enemies
  const _aim = new THREE.Vector3();
  const nearest = (from: THREE.Vector3): { at: THREE.Vector3; id: string | null } => {
    let best = Infinity;
    let id: string | null = null;
    // Prefer living local player (not freecam cam, not a dead body)
    if (!G.campaignDead && !G.pvpDead) {
      _aim.set(pos.current.x, pos.current.y + EYE, pos.current.z);
      best = from.distanceTo(_aim);
      id = null;
    }
    if (sharesEnemies() || NET.kind === "lobby") {
      for (const pr of NET.peers.values()) {
        if (pr.dead || pr.id === myId()) continue;
        const d = Math.hypot(pr.x - from.x, pr.y + EYE - from.y, pr.z - from.z);
        if (d < best) { best = d; id = pr.id; _aim.set(pr.x, pr.y + EYE, pr.z); }
      }
    }
    // Fallback so enemies still have a target if everyone is down
    if (best === Infinity) {
      _aim.set(pos.current.x, pos.current.y + EYE, pos.current.z);
    }
    return { at: _aim, id };
  };
  const shotQ: number[] = [];
  const enemyShot = (from: THREE.Vector3, vel: THREE.Vector3, dmg: number, life: number) => {
    spawnBullet(botPool, from, vel, dmg, life);
    if (sharesEnemies() && NET.isHost) shotQ.push(from.x, from.y, from.z, vel.x, vel.y, vel.z, dmg, life);
  };
  const bossBox = (min: THREE.Vector3, max: THREE.Vector3) => {
    const b = boss.current;
    min.set(b.pos.x - 3 * BOSS_S, b.y, b.pos.z - 3 * BOSS_S);
    max.set(b.pos.x + 3 * BOSS_S, b.y + 3.5 * BOSS_S, b.pos.z + 3 * BOSS_S);
  };
  const bossLive = () => G.stage === "boss";
  function despawnBoss() {
    Object.assign(boss.current, { landed: false, y: ROOM.h, vy: 0 });
    hazards.forEach((h) => (h.active = false));
    bossSword.current.active = false;
    bossSword.current.returning = false;
    bossSword.current.hitTargets.clear();
    bossSword.current.solidObjects.clear();
    waves.forEach((w) => (w.active = false));
    health.forEach((h) => (h.active = false));
    abilityWalls.forEach((w) => { w.active = false; });
    abilityPads.forEach((pad) => { pad.active = false; });
    abilityFires.forEach((f) => { f.active = false; f.stung.clear(); f.tickAcc.clear(); });
    Object.assign(G, { stage: "tables", bossHits: 0, bossTime: 0, parryLocked: false, compromisedT: 0, abilityLocked: false });
  }
  const despawnAll = () => {
    tables.forEach((t) => (t.alive = false));
    blues.forEach((u) => (u.alive = false));
    botPool.forEach((x) => (x.alive = false));
    despawnBoss();
    TRAIN_Q.length = 0;
  };
  const trainSpawn = (q: TrainSpawn) => {
    if (q.kind === "brown") for (let i = 0; i < q.n; i++) spawnTable();
    else if (q.kind === "blue") for (let i = 0; i < q.n; i++) spawnBlue(randomFloor(pos.current));
    else if (G.stage !== "boss") {
      const b = boss.current;
      Object.assign(G, { stage: "boss", bossMax: TRAIN.bossHp, bossHits: 0, bossTime: 0, parryLocked: false });
      Object.assign(b, { landed: false, y: ROOM.h - 30, vy: -350, bulletT: 1, specialT: 2, next: "sword", quarterT: 3, aoeT: 5, lockT: 0 });
      b.pos.set(0, 0, 0);
      healthT.current = cfg.ringInterval(HEALTH_INTERVAL);
    }
  };
  const explode = (at: THREE.Vector3, tele?: THREE.Vector3) => {
    const buffed = G.buff > 0;
    const br = BOMB_R * BOMB_SIZE * (G.bombBig > 0 ? 1.5 : 1);
    G.tut.bombed = true;
    for (const t of tables) if (t.alive && t.pos.distanceTo(at) < br) hitTable(t, BOMB_DMG * (buffed ? 2 : 1));
    for (const u of blues) if (u.alive && u.pos.distanceTo(at) < br) hitBlue(u, 9999);
    if (bossLive() && tmpV.set(boss.current.pos.x, boss.current.y + 10, boss.current.pos.z).distanceTo(at) < br + 30)
      hitBoss((BOMB_DMG / DMG) * (buffed ? 2 : 1));
    pvpBlast(at, br, PVP_DMG.bomb);
    ringsIn(at, br);
    if (tele) teleBlast(at, br, tele);
    boomFx(at, br, 0.5, true, "bomb", tele ? "#ffffff" : "#ff6a1a", false, tele ? "#e5e7eb" : "#ff2020");
    G.shake = 0.6;
  };
  const boomFx = (at: THREE.Vector3, r: number, dur = 0.5, sync = true, kind: "bomb" | "fire" | "none" = "bomb", col = "", hold = false, ringCol?: string) => {
    const bm = booms.find((x) => x.t <= 0) ?? booms[0]!;
    bm.t = dur;
    bm.dur = dur;
    bm.hold = hold;
    bm.col = col || "#ffb347";
    bm.pos.copy(at);
    bm.r = r;
    bm.ring = !!ringCol;
    bm.ringCol = ringCol || "#ffffff";
    bm.rx = Math.random() * Math.PI;
    bm.ry = Math.random() * Math.PI;
    bm.rz = Math.random() * Math.PI;
    if (kind !== "none") playSfx(kind === "fire" ? "fire_explode" : "bomb_explode", Math.max(0.15, 1 - at.distanceTo(camera.position) / 350));
    if (sync && NET.online) sendNet("vfx", { k: "boom", x: at.x, y: at.y, z: at.z, r, t: dur, ...(col ? { c: col } : {}), ...(hold ? { h: 1 } : {}), ...(ringCol ? { rc: ringCol } : {}) });
  };
  const spawnSlamCrack = (x: number, y: number, z: number, dark = false) => {
    const c = slamCracks.find((q) => !q.active) ?? slamCracks[0]!;
    c.active = true;
    c.x = x; c.y = y + 0.04; c.z = z;
    c.t = 4;
    c.yaw = Math.random() * Math.PI * 2;
    c.dark = dark;
  };
  // 1v1: damage every opponent whose (enlarged) hitbox is inside the blast
  const pvpBlast = (at: THREE.Vector3, r: number, dmg: number, stun = false) => {
    if (G.mode !== "pvp" && NET.kind !== "lobby") return;
    for (const pr of NET.peers.values()) {
      if (pr.dead || pr.id === myId()) continue;
      if (tmpV.set(pr.x, pr.y + PVP_CENTER_Y, pr.z).distanceTo(at) < r + PVP_HITBOX) {
        noteDmg(dmg, pr.id, pr.x, pr.y + 2.2, pr.z);
        hitPeer(pr.id, dmg, stun);
      }
    }
  };
  // ---- ability mastery helpers ----
  const ownerOf = (nid: string) => nid.replace(/-(w|p|f|fb)-\d+$/, "");
  const inObb = (w: { cx: number; cy: number; cz: number; yaw: number; pitch: number; hw: number; hh: number; hd: number }, x: number, y: number, z: number, mg: number) => {
    orientLocal(_la, x - w.cx, y - w.cy, z - w.cz, w.yaw, w.pitch);
    return Math.abs(_la.x) <= w.hw + mg && Math.abs(_la.y) <= w.hh + mg && Math.abs(_la.z) <= w.hd + mg;
  };
  type Shove = { pull?: number[] | undefined; tp?: number[] | undefined; slam?: number | undefined };
  const applyShove = (e: Shove, o: { pos: THREE.Vector3; vy?: number }, id: string) => {
    const at = o.pos;
    if (e.tp) { at.x = e.tp[0]!; at.z = e.tp[2]!; }
    else if (e.pull) { at.x += (e.pull[0]! - at.x) * 0.6; at.z += (e.pull[2]! - at.z) * 0.6; }
    if (e.slam) {
      // straight down, all other motion cancelled, frozen for `slam` seconds once it is on the ground
      if ("vy" in o) o.vy = -250;
      abilityStun.current.set(id, e.slam + Math.max(0, at.y) / 250 + 0.1);
    }
  };
  /** move a bot: pulled toward a point or teleported. Followers ask the host to do it. */
  const shove = (kind: "t" | "b", i: number, e: Shove) => {
    if (isFollower()) { sendNet("ehit", { k: kind, i, dmg: 0, ...e }); return; }
    const o = kind === "t" ? tables[i] : blues[i];
    if (o && o.alive) applyShove(e, o, `${kind}${i}`);
  };
  const meHurtable = () => G.mode === "pvp" || NET.kind === "pvp" || NET.kind === "lobby";
  /** Teleport bomb: everything in the blast (never me) is sent to the crosshair spot and stunned 2s. */
  /** White teleport bomb: swap with whoever is in the blast.
   *  - 1 target: you take their spot, they take yours
   *  - many targets: they all go to your spot; you go to the average of theirs
   */
  const teleBlast = (at: THREE.Vector3, r: number, _dest?: THREE.Vector3) => {
    const my = pos.current;
    const myFrom = { x: my.x, y: my.y, z: my.z };
    type Hit = { id: string; x: number; y: number; z: number; kind: "t" | "b" | "p"; i?: number };
    const hits: Hit[] = [];
    for (let i = 0; i < tables.length; i++) {
      const tb = tables[i]!;
      if (!tb.alive || tb.pos.distanceTo(at) >= r) continue;
      hits.push({ id: `t${i}`, x: tb.pos.x, y: tb.pos.y, z: tb.pos.z, kind: "t", i });
    }
    for (let i = 0; i < blues.length; i++) {
      const u = blues[i]!;
      if (!u.alive || u.pos.distanceTo(at) >= r) continue;
      hits.push({ id: `b${i}`, x: u.pos.x, y: u.pos.y, z: u.pos.z, kind: "b", i });
    }
    if (meHurtable()) {
      for (const pr of NET.peers.values()) {
        if (pr.dead || pr.id === myId()) continue;
        if (tmpV.set(pr.x, pr.y + PVP_CENTER_Y, pr.z).distanceTo(at) >= r + PVP_HITBOX) continue;
        hits.push({ id: pr.id, x: pr.x, y: pr.y, z: pr.z, kind: "p" });
      }
    }
    if (!hits.length) {
      tbMoved.current = [];
      return;
    }
    // Average / middle of everyone caught (single target ⇒ that position)
    let sx = 0, sy = 0, sz = 0;
    for (const h of hits) { sx += h.x; sy += h.y; sz += h.z; }
    const n = hits.length;
    const mid = [sx / n, Math.max(0, sy / n), sz / n] as [number, number, number];
    // Everyone caught → your old position
    const myTo = [myFrom.x, Math.max(0, myFrom.y), myFrom.z] as [number, number, number];
    const moved: { id: string; x: number; y: number; z: number }[] = [];
    for (const h of hits) {
      moved.push({ id: h.id, x: h.x, y: h.y, z: h.z });
      if (h.kind === "t" && h.i != null) {
        shove("t", h.i, { tp: myTo });
        abilityStun.current.set(h.id, 2);
      } else if (h.kind === "b" && h.i != null) {
        shove("b", h.i, { tp: myTo });
        abilityStun.current.set(h.id, 2);
      } else if (h.kind === "p") {
        hitPeer(h.id, 0, true, 2, { tp: myTo });
      }
    }
    // You → middle of caught targets (or the one target's spot)
    moved.push({ id: "me", x: myFrom.x, y: myFrom.y, z: myFrom.z });
    my.set(mid[0], mid[1], mid[2]);
    // Soft clamp to arena
    const rr = Math.hypot(my.x, my.z);
    if (rr > R - 3) { my.x *= (R - 3) / rr; my.z *= (R - 3) / rr; }
    my.y = Math.max(0, my.y);
    grounded.current = false;
    tbMoved.current = moved;
    playSfxShared("teleport_success");
    G.shake = Math.max(G.shake, 0.25);
  };
  /** Trampoline mastery: a pad bursts when reset — 5 damage, survivors are slammed to the ground and stunned 2s. Never hurts me. */
  const springBlast = (pad: { cx: number; cy: number; cz: number }) => {
    const at = new THREE.Vector3(pad.cx, pad.cy, pad.cz);
    const r = TABLE_W * 14; // 4× bigger blast
    for (let i = 0; i < tables.length; i++) {
      const tb = tables[i]!;
      if (!tb.alive || at.distanceTo(tmpV.set(tb.pos.x, tb.pos.y + 2 * tb.s, tb.pos.z)) >= r + 3 * tb.s) continue;
      hitTable(tb, 5);
      if (tb.alive) shove("t", i, { slam: 2 });
    }
    for (let i = 0; i < blues.length; i++) {
      const u = blues[i]!;
      if (!u.alive || at.distanceTo(tmpV.set(u.pos.x, 2, u.pos.z)) >= r + 4) continue;
      hitBlue(u, 5);
      if (u.alive) shove("b", i, { slam: 2 });
    }
    if (bossLive() && boss.current.landed && distToBossBox(at) < r) hitBoss(Math.max(1, Math.round(5 / DMG)));
    if (meHurtable()) {
      for (const pr of NET.peers.values()) {
        if (pr.dead || pr.id === myId()) continue;
        if (at.distanceTo(tmpV.set(pr.x, pr.y + 2, pr.z)) >= r + 4) continue;
        hitPeer(pr.id, 5, false, undefined, { slam: 2 });
        noteDmg(5, pr.id, pr.x, pr.y + 2, pr.z);
      }
    }
    boomFx(at, r, 0.5, true, "bomb", "#ff2a2a", false, "#22c55e"); // green ring, random orient
    G.shake = Math.max(G.shake, 0.35);
  };
  // Fire mastery: the air fireball bounces off whatever it hits (up to 3 times)
  const bounceFb = (fb: { pos: THREE.Vector3; vel: THREE.Vector3; t: number; traveled: number; b: number }, stepV: THREE.Vector3, hitN?: THREE.Vector3 | null, place?: THREE.Vector3 | null) => {
    const q = fb.pos;
    const n = new THREE.Vector3();
    if (hitN) n.copy(hitN);
    else if (q.y <= 0.3) n.set(0, 1, 0);
    else if (q.y >= ROOM.h - 0.8) n.set(0, -1, 0); // ceiling shell
    else if (Math.hypot(q.x, q.z) >= R - 2.5) n.set(-q.x, 0, -q.z).normalize(); // thick cylindrical wall
    else {
      // inside a solid: the axis that frees us when undone is the face we hit; otherwise (bots, boss) go straight back
      const t2 = new THREE.Vector3();
      const axes = (["x", "y", "z"] as const).slice().sort((a, b2) => Math.abs(stepV[b2]) - Math.abs(stepV[a]));
      let found = false;
      if (inSolid(q)) {
        for (const ax of axes) {
          t2.copy(q); t2[ax] -= stepV[ax];
          if (!inSolid(t2)) { n.set(0, 0, 0); n[ax] = stepV[ax] > 0 ? -1 : 1; found = true; break; }
        }
      }
      if (!found) n.copy(fb.vel).normalize().negate();
    }
    const spd0 = fb.vel.length();
    const d = fb.vel.dot(n);
    if (d < 0) fb.vel.addScaledVector(n, -2 * d);
    else fb.vel.addScaledVector(n, 0.5 * fb.vel.length());
    fb.vel.setLength(spd0);
    // move out of whatever was hit so the next step can't hit it again (that used to burn all bounces at once)
    if (place) q.copy(place);
    else { q.sub(stepV); q.addScaledVector(n, 0.4); }
    fb.b++;
    fb.traveled = 0;
    fb.t = Math.max(fb.t, 3);
    const sl = stepV.length();
    stepV.copy(fb.vel).setLength(sl); // keep the per-step distance (it used to jump a whole second of travel)
  };
  // healing ring / party shard: heal, or (when full) reset the bomb cooldown. Returns true if consumed.
  const revivePlayer = (id: string) => {
    if (id === myId()) {
      G.campaignDead = false;
      G.freecam = false;
      G.freecamSpeedIdx = 0;
      G.playerHp = MAX_HP;
      pos.current.copy(START);
      hv.current.set(0, 0, 0);
      vy.current = 0;
      G.respawnMsg = 2.5;
      G.respawnToken++;
    }
    const pr = NET.peers.get(id);
    if (pr) pr.dead = false;
    sendNet("revive", { id });
  };
  const collectRing = (h: (typeof health)[number]) => {
    if (!h.active) return false;
    // Party campaign shards: only when someone is waiting; FIFO revive at SHARD_NEED
    if (h.isShard && sharesEnemies() && G.mode === "game") {
      h.active = false;
      if (G.reviveQueue.length === 0) return true;
      playSfx("shard_pickup");
      G.shardProgress = Math.min(SHARD_NEED, G.shardProgress + 1);
      sendNet("shards", { n: G.shardProgress });
      if (G.shardProgress >= SHARD_NEED) {
        G.shardProgress = 0;
        sendNet("shards", { n: 0 });
        const next = G.reviveQueue.shift();
        if (next) revivePlayer(next);
      }
      return true;
    }
    if (h.isShard) return false;
    if (G.stage !== "boss") return false;
    if (G.playerHp < cfg.maxHp()) G.playerHp = Math.min(cfg.maxHp(), G.playerHp + HEALTH_AMOUNT);
    else if (G.bombCd > 0) G.bombCd = 0;
    else return false;
    h.active = false;
    playSfx("health_pickup");
    return true;
  };
  const ringsIn = (at: THREE.Vector3, r: number) => {
    for (const h of health) {
      if (!h.active) continue;
      const hr = h.isShard ? SHARD_R : HEALTH_R;
      if (Math.hypot(h.pos.x - at.x, h.pos.z - at.z) < r + hr && at.y < r + 4) collectRing(h);
    }
  };
  const distToBossBox = (at: THREE.Vector3) => {
    bossBox(_mn, _mx);
    return _bq.copy(at).clamp(_mn, _mx).distanceTo(at);
  };
  // splinter blast: equal damage to everything inside (never the shooter)
  const bulletExplode = (at: THREE.Vector3, dmg: number, direct: Table | null, directBlue: (typeof blues)[number] | null, directBoss: boolean) => {
    let any = false;
    for (const t of tables) {
      if (!t.alive) continue;
      if (t === direct || Math.hypot(t.pos.x - at.x, t.pos.z - at.z) < BULLET_AOE_R + 3 * t.s && Math.abs(at.y - (t.pos.y + 1.7 * t.s)) < BULLET_AOE_R + 2 * t.s) {
        hitTable(t, dmg);
        any = true;
      }
    }
    for (const u of blues) {
      if (!u.alive) continue;
      if (u === directBlue || (Math.hypot(u.pos.x - at.x, u.pos.z - at.z) < BULLET_AOE_R + 3 * TABLE_S && at.y < BULLET_AOE_R + 4 * TABLE_S)) {
        hitBlue(u, dmg);
        any = true;
        G.hitFlash = 0.15;
      }
    }
    if (bossLive() && boss.current.landed && (directBoss || distToBossBox(at) < BULLET_AOE_R)) {
      hitBoss(dmg > DMG ? 2 : 1);
      any = true;
    }
    ringsIn(at, BULLET_AOE_R);
    if (any) G.hits++;
    boomFx(at, BULLET_AOE_R, 0.25, true, "none");
  };
  const addHazard = (kind: Hazard["kind"], x: number, z: number, t: number, a0?: number, dmg?: number, owner: "player" | "boss" = "boss") => {
    const h = hazards.find((q) => !q.active);
    if (!h) return;
    Object.assign(h, { active: true, kind, t, total: t, fx: 0, x, z, a0: a0 ?? Math.floor(Math.random() * 4) * (Math.PI / 2), dmg, owner });
  };

  useEffect(() => {
    setLocker(() => {
      try {
        const canvas = document.querySelector("canvas") as HTMLElement | null;
        if (canvas && "requestPointerLock" in canvas) {
          try { (canvas as HTMLElement & { requestPointerLock: (o?: object) => void }).requestPointerLock({ unadjustedMovement: true }); }
          catch { canvas.requestPointerLock(); }
          return;
        }
      } catch { /* ignore */ }
      ctrl.current?.lock();
    });
    const onLock = () => {
      const hard = !!document.pointerLockElement;
      if (hard) {
        // Accept hard lock whenever we're in a match (Resume must always stick)
        if (G.phase === "playing") {
          G.locked = true;
          G.userPaused = false;
          G.mobilePaused = false;
          setCursorLocked(true);
        } else {
          G.locked = false;
          setCursorLocked(false);
          try { document.exitPointerLock?.(); } catch { /* ignore */ }
        }
        return;
      }
      const mobile = isMobilePlay();
      if (mobile) {
        // Soft-lock: only invisible cursor while playing and not paused
        if (G.userPaused || G.phase !== "playing") {
          G.locked = false;
          G.firing = false;
          G.scoped = false;
          keys.current = {};
          setCursorLocked(false);
        } else {
          G.locked = true;
          setCursorLocked(true);
        }
        return;
      }
      // PC: leaving pointer lock — always show cursor
      setCursorLocked(false);
      G.locked = false;
      G.firing = false;
      G.scoped = false;
      keys.current = {};
      // Chat mouse-free: NEVER treat as pause menu
      if (G.chatOpen) {
        G.userPaused = false;
        return;
      }
      if (G.phase === "playing") {
        G.userPaused = true;
        if (G.freecam && !G.campaignDead && !(NET.kind === "lobby" && G.pvpDead && G.lobbyRespawnT > 0)) {
          G.freecam = false;
          G.freecamSpeedIdx = 0;
        }
      }
    };
    document.addEventListener("pointerlockchange", onLock);
    const camDirs = () => {
      const f = new THREE.Vector3();
      camera.getWorldDirection(f);
      f.y = 0;
      f.normalize();
      return { f, r: new THREE.Vector3(-f.z, 0, f.x) };
    };
    
    const doDash = (dirs: () => { f: THREE.Vector3; r: THREE.Vector3 }) => {
      if (G.wallrun) return;
      // Grounded dash: auto-jump first (does NOT consume air jumps), then dash; arm bunny-hop window
      if (grounded.current && G.dashCd <= 0) {
        if (SETTINGS.autoBunnyHop !== false) {
          vy.current = JUMP_V;
          grounded.current = false;
          bunnyHop.current = 0.65; // press dash again within window before landing to hop
        }
        const { f, r } = dirs();
        const d = new THREE.Vector3();
        if (keys.current[SETTINGS.keys.forward]) d.add(f);
        if (keys.current[SETTINGS.keys.back]) d.sub(f);
        if (keys.current[SETTINGS.keys.right]) d.add(r);
        if (keys.current[SETTINGS.keys.left]) d.sub(r);
        if (d.lengthSq() === 0) d.copy(f);
        hv.current.addScaledVector(d.normalize(), DASH_SPEED);
        G.tut.dashed = true;
        if (hv.current.length() > MAX_HSPEED) hv.current.setLength(MAX_HSPEED);
        G.dashCd = cfg.dashCd();
        playSfxShared("dash");
        return;
      }
      if (!grounded.current && G.airDashes > 0) {
        const { f, r } = dirs();
        const d = new THREE.Vector3();
        if (keys.current[SETTINGS.keys.forward]) d.add(f);
        if (keys.current[SETTINGS.keys.back]) d.sub(f);
        if (keys.current[SETTINGS.keys.right]) d.add(r);
        if (keys.current[SETTINGS.keys.left]) d.sub(r);
        if (d.lengthSq() === 0) d.copy(f);
        hv.current.addScaledVector(d.normalize(), DASH_SPEED);
        G.tut.dashed = true;
        if (hv.current.length() > MAX_HSPEED) hv.current.setLength(MAX_HSPEED);
        G.airDashes--;
        playSfxShared("dash");
        if (vy.current < 0) vy.current = 0;
        bunnyHop.current = 0.55;
      }
    };

const kd = (e: KeyboardEvent) => {
      const tg = e.target as HTMLElement | null;
      if (tg && (tg.tagName === "INPUT" || tg.tagName === "TEXTAREA")) return; // typing in a box
      if (G.chatOpen) return; // chatting — no game keys / no pause from slash flow
      if (e.code === SETTINGS.keys.jump) e.preventDefault();
      const wasDown = keys.current[e.code];
      keys.current[e.code] = true;
      // Esc → pause in one shot (PC pointer-lock exit is handled in onLock the same way)
      if (e.code === "Escape" && !wasDown && G.phase === "playing") {
        pauseGame();
        return;
      }
      // Freecam toggle (lobby & training only)
      if (e.code === "KeyX" && !wasDown && !e.repeat && G.phase === "playing" && (G.mode === "training" || NET.kind === "lobby" || NET.kind === "pvp" || G.mode === "pvp" || G.campaignDead)) {
        // While waiting for shard revive, freecam stays on — cannot return to body
        if (G.campaignDead) {
          G.freecam = true;
          return;
        }
        // Lobby death wait: freecam stays on until respawn timer finishes
        if (NET.kind === "lobby" && G.pvpDead && G.lobbyRespawnT > 0) {
          G.freecam = true;
          return;
        }
        G.freecam = !G.freecam;
        if (!G.freecam) G.freecamSpeedIdx = 0;
        return;
      }
      if (G.phase !== "playing" || !G.locked || wasDown || e.repeat) return;
      if (G.freecam) return; // movement handled in useFrame
      if (e.code === "Enter") G.tut.enter = true;
      // Combo burst (default Enter, rebindable) — before training menu
      if (e.code === SETTINGS.keys.comboBurst && tryComboBurst()) {
        e.preventDefault();
        return;
      }
      if (e.code === "Enter" && G.mode === "training") {
        G.trainMenu = true;
        document.exitPointerLock?.();
        return;
      }
      if (e.code === "Backspace" && G.mode === "tutorial") {
        e.preventDefault();
        G.tut.enter = false;
        G.tutStep = Math.max(0, G.tutStep - 1);
        return;
      }
      if (G.countdown > 0.6 || G.stun > 0) return;
      if (e.code === SETTINGS.keys.parry && G.parryCd <= 0 && !G.parryLocked) {
        G.parryWin = PARRY_WINDOW;
        playSfxShared("parry_raise");
        G.parryCd = PARRY_CD_MISS; // assume miss until a successful parry
      }
      if (e.code === SETTINGS.keys.jump && !grounded.current && !G.wallrun && !wallNormal(pos.current) && G.airJumps > 0) {
        G.airJumps--;
        vy.current = JUMP_V;
        playSfxShared("air_jump");
      }
      if (e.code === SETTINGS.keys.dash && !G.wallrun) {
        doDash(camDirs);
      }
      if (e.code === SETTINGS.keys.ability) {
        abilityReq.current = true;
      }
      if (e.code === SETTINGS.keys.bomb && G.bombCd <= 0 && !bomb.current.alive) {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        bomb.current.alive = true;
        bomb.current.pos.copy(camera.position).addScaledVector(dir, 1.5);
        bomb.current.vel.copy(dir).multiplyScalar(BULLET_SPEED);
        bomb.current.tele = null;
        bomb.current.netId = `${myId()}-bomb-${Date.now()}`;
        // Teleport mastery: with the ability ready the bomb is a white teleport bomb
        const tpr = teleportRef.current;
        if (masteryOn("teleport") && getAbility() === "teleport" && G.abilityCd <= 0 && !tpr.active && !G.abilityLocked && !G.parryLocked) {
          // Crosshair spot, but never farther than 2 table lengths from you and never inside something solid
          const reach = TABLE_W * 2;
          const back = PLAYER_R * 2;
          let dist = reach;
          if (staticRef.current) {
            const rc = new THREE.Raycaster(camera.position.clone(), dir, 0.5, reach + back);
            const hh = rc.intersectObject(staticRef.current, true)[0];
            if (hh) dist = Math.min(dist, hh.distance - back);
          }
          if (dir.y < -0.05) {
            const tHit = -camera.position.y / dir.y;
            if (tHit > 0 && tHit - back < dist) dist = tHit - back;
          }
          for (let s = 1; s <= dist; s += 0.5) {
            const sx = camera.position.x + dir.x * s, sy = camera.position.y + dir.y * s, sz = camera.position.z + dir.z * s;
            if (abilityWalls.some((aw) => aw.active && !aw.ret && inObb(aw, sx, sy, sz, back))) { dist = Math.max(0.5, s - 0.5); break; }
          }
          dist = Math.max(0.5, dist);
          const hitPt = camera.position.clone().addScaledVector(dir, dist);
          const rr = Math.hypot(hitPt.x, hitPt.z);
          if (rr > R - 3) { hitPt.x *= (R - 3) / rr; hitPt.z *= (R - 3) / rr; }
          hitPt.y = Math.max(0, hitPt.y - EYE); // feet position
          bomb.current.tele = hitPt;
          G.abilityCd = 3;
          G.abilityCharges = 0;
          tpr.canRewind = false;
          tbMoved.current = [];
        }
        G.bombCd = cfg.bombCd(G.buff > 0);
        playSfxShared("bomb_throw");
        if (NET.online) {
          const b = bomb.current;
          sendNet("vfx", {
            k: "bomb", id: b.netId, tele: b.tele ? 1 : 0,
            x: b.pos.x, y: b.pos.y, z: b.pos.z,
            vx: b.vel.x, vy: b.vel.y, vz: b.vel.z, life: 4,
          });
        }
      }
      if (e.code === SETTINGS.keys.grapple) {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        const maxG = cfg.grapple(GRAPPLE_MAX);
        let bestDist = maxG;
        let bestPt: THREE.Vector3 | null = null;
        let bestPad = -1;
        let bestWall = -1;
        if (staticRef.current) {
          const rc = new THREE.Raycaster(camera.position.clone(), dir, 0.5, maxG);
          const hit = rc.intersectObject(staticRef.current, true)[0];
          if (hit && hit.distance < bestDist) {
            bestDist = hit.distance;
            bestPt = hit.point.clone();
          }
        }
        // Ray vs ability walls / trampolines (oriented boxes)
        const origin = camera.position;
        for (let i = 0; i < abilityWalls.length; i++) {
          const w = abilityWalls[i]!;
          if (!w.active || w.ret) continue;
          // Sample along ray for OBB hit
          for (let s = 0.5; s <= maxG; s += 1.5) {
            const pt = origin.clone().addScaledVector(dir, s);
            orientLocal(_la, pt.x - w.cx, pt.y - w.cy, pt.z - w.cz, w.yaw, w.pitch);
            if (Math.abs(_la.x) <= w.hw && Math.abs(_la.y) <= w.hh && Math.abs(_la.z) <= w.hd) {
              if (s < bestDist) {
                bestDist = s;
                bestPt = pt;
                bestPad = -1;
                bestWall = i;
              }
              break;
            }
          }
        }
        for (let i = 0; i < abilityPads.length; i++) {
          const pad = abilityPads[i]!;
          if (!pad.active) continue;
          for (let s = 0.5; s <= maxG; s += 1.2) {
            const pt = origin.clone().addScaledVector(dir, s);
            orientLocal(_la, pt.x - pad.cx, pt.y - pad.cy, pt.z - pad.cz, pad.yaw, pad.pitch);
            if (Math.abs(_la.x) <= pad.hw + 1 && Math.abs(_la.y) <= pad.hh + 1 && Math.abs(_la.z) <= pad.hd + 1) {
              if (s < bestDist) {
                bestDist = s;
                bestPt = pt;
                bestPad = i;
                bestWall = -1;
              }
              break;
            }
          }
        }
        // If nothing on the crosshair ray, auto-grab nearest trampoline within 2× grapple range
        if (!bestPt) {
          const autoMax = maxG * 2;
          let nearD = autoMax;
          let nearI = -1;
          for (let i = 0; i < abilityPads.length; i++) {
            const pad = abilityPads[i]!;
            if (!pad.active) continue;
            const d = origin.distanceTo(tmpV.set(pad.cx, pad.cy, pad.cz));
            if (d < nearD) {
              nearD = d;
              nearI = i;
            }
          }
          if (nearI >= 0) {
            const pad = abilityPads[nearI]!;
            bestPt = new THREE.Vector3(pad.cx, pad.cy, pad.cz);
            bestDist = nearD;
            bestPad = nearI;
            bestWall = -1;
          }
        }
        if (bestPt) {
          anchor.current.copy(bestPt);
          ropeLen.current = bestDist * 0.9;
          G.grappling = true;
          playSfxShared("grapple_fire");
          setTimeout(() => playSfx("grapple_attach"), 90);
          grappleOnPad.current = bestPad;
          grappleOnWall.current = bestWall;
        }
      }
      if (e.code === SETTINGS.keys.reload) {
        const p = pos.current;
        if (bounce.current.t > 0 && !slam.current.on) {
          // double-tap R after a slam: bounce back up to the pre-slam height
          const rise = Math.max(0, bounce.current.y - p.y);
          vy.current = Math.sqrt(2 * GRAVITY * rise);
          playSfxShared("slam_bounce");
          grounded.current = false;
          bounce.current.t = 0;
          G.bounceWin = 0;
        } else if (!grounded.current && slam.current.on) {
          // Cancel slam mid-air → kill all velocity, half normal slam cooldown
          const tier = SLAM_TIERS.findIndex((q) => slam.current.h < q.maxH);
          const q = SLAM_TIERS[tier >= 0 ? tier : SLAM_TIERS.length - 1]!;
          slam.current.on = false;
          G.slamming = false;
          hv.current.set(0, 0, 0);
          vy.current = 0;
          G.slamCd = cfg.slamCd(q.cd) * 0.5;
          playSfxShared("slam_cancel");
        } else if (!grounded.current && !slam.current.on && G.slamCd <= 0) {
          let ground = 0;
          for (const s of SOLIDS) if (s.y1 <= p.y + 0.01 && overlapXZ(p, s, PLAYER_R * 0.5)) ground = Math.max(ground, s.y1);
          Object.assign(slam.current, { on: true, fromY: p.y, h: p.y - ground });
          G.slamming = true;
          playSfxShared("slam_start");
          G.grappling = false;
          G.wallrun = false;
        } else if (grounded.current && G.buff <= 0 && G.ammo < MAG && G.reloading <= 0) G.reloading = 1.5;
      }
    };
    const ku = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
      if (e.code === SETTINGS.keys.grapple) { if (G.grappling) playSfx("grapple_release"); G.grappling = false; grappleOnPad.current = -1; grappleOnWall.current = -1; }
      if (e.code === SETTINGS.keys.jump) G.wallrun = false;
    };
    // --- Look ---
    // PC: real pointer lock + movementX (unchanged).
    // iPadOS Safari: Pointer Lock API is NOT supported (Apple WebKit limitation).
    // Best-effort: prefer movementX, else client deltas, setPointerCapture while dragging.
    const applyLookDelta = (mx: number, my: number) => {
      if (!mx && !my) return;
      softLookRef.current.x += mx;
      softLookRef.current.y += my;
    };
    const captureTarget = () =>
      document.getElementById("ipad-look-layer") ||
      (document.querySelector("canvas") as HTMLElement | null);

    // Desktop only when hard-locked or non-mobile
    const onSoftMove = (e: MouseEvent) => {
      if (!G.locked || G.phase !== "playing") return;
      if (isMobilePlay() && !document.pointerLockElement) return;
      applyLookDelta(e.movementX || 0, e.movementY || 0);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!G.locked || G.phase !== "playing") return;
      if (document.pointerLockElement) {
        applyLookDelta(e.movementX || 0, e.movementY || 0);
        return;
      }
      if (!isMobilePlay()) return;
      // Finger-only: skip (mouse / trackpad / pen)
      if (e.pointerType === "touch") return;

      // Prefer movementX/Y when the browser provides them (often works without lock)
      const mx = e.movementX || 0;
      const my = e.movementY || 0;
      if (mx !== 0 || my !== 0) {
        applyLookDelta(mx, my);
      } else if (lastClientRef.current.on) {
        applyLookDelta(e.clientX - lastClientRef.current.x, e.clientY - lastClientRef.current.y);
      }
      lastClientRef.current = { x: e.clientX, y: e.clientY, on: true };
    };

    const md = (e: MouseEvent) => {
      if (!G.locked) return;
      if (!isMobilePlay()) {
        try { ctrl.current?.lock(); } catch { /* ignore */ }
      }
      if (G.freecam) {
        if (e.button === 0) G.freecamSpeedIdx = (G.freecamSpeedIdx + 1) % FREECAM_SPEEDS.length;
        return;
      }
      if (e.button === 0) G.firing = SETTINGS.fireMode === "toggle" ? !G.firing : true;
      if (e.button === 2) G.scoped = true;
    };
    const mu = (e: MouseEvent) => {
      if (e.button === 0 && SETTINGS.fireMode === "hold") G.firing = false;
      if (e.button === 2) G.scoped = false;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!G.locked || G.phase !== "playing") return;
      const target = e.target as HTMLElement | null;
      if (target?.closest?.("button, input, a, [data-no-lock]")) return;
      if (!isMobilePlay() || document.pointerLockElement) return;
      if (e.pointerType === "touch") return;

      lastClientRef.current = { x: e.clientX, y: e.clientY, on: true };
      const el = captureTarget() || target;
      try { el?.setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
      try {
        setCursorLocked(true);
      } catch { /* ignore */ }
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!isMobilePlay()) return;
      const el = captureTarget();
      try { el?.releasePointerCapture?.(e.pointerId); } catch { /* ignore */ }
      // Keep last xy so free trackpad moves still have an anchor after a click
      lastClientRef.current.on = true;
    };
    const cm = (e: Event) => e.preventDefault();
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    window.addEventListener("mousedown", md);
    window.addEventListener("mouseup", mu);
    window.addEventListener("contextmenu", cm);
    window.addEventListener("mousemove", onSoftMove);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerUp, { passive: true });

    const wh = (e: WheelEvent) => {
      if (!G.locked) return;
      if (G.freecam) {
        e.preventDefault();
        const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
        const c = camera as THREE.PerspectiveCamera;
        c.fov = THREE.MathUtils.clamp(c.fov * Math.exp(dy * 0.0015), 12, 110);
        c.updateProjectionMatrix();
        return;
      }
      if (!G.scoped) return;
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      G.zoomFov = THREE.MathUtils.clamp(G.zoomFov * Math.exp(dy * 0.0015), 6, 60);
      G.tut.zoomed = true;
    };
    window.addEventListener("wheel", wh, { passive: false });
    return () => {
      setLocker(null);
      document.removeEventListener("pointerlockchange", onLock);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      window.removeEventListener("mousedown", md);
      window.removeEventListener("mouseup", mu);
      window.removeEventListener("contextmenu", cm);
      window.removeEventListener("mousemove", onSoftMove);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("wheel", wh);
    };
  }, [camera]);

  NET_HOOKS.onEnts = (snap) => { snapRef.current = snap; };
  NET_HOOKS.onEhit = (h) => {
    const mv = h.pull || h.tp || h.slam ? { pull: h.pull, tp: h.tp, slam: h.slam } : null;
    if (h.dmg > 0 || !mv) {
      if (h.k === "t") { const t = tables[h.i]; if (t) hitTable(t, h.dmg); }
      else if (h.k === "b") { const u = blues[h.i]; if (u) hitBlue(u, h.dmg); }
      else hitBoss(h.dmg);
    }
    if (mv && (h.k === "t" || h.k === "b")) {
      const o = h.k === "t" ? tables[h.i] : blues[h.i];
      if (o?.alive) applyShove(mv, o, `${h.k}${h.i}`);
    }
  };
  NET_HOOKS.onEspawn = (q) => {
    if (q.kind === "despawn") despawnAll();
    else trainSpawn({ kind: q.kind as TrainSpawn["kind"], n: q.n, t: 0 });
  };
  NET_HOOKS.onWon = () => { G.phase = "won"; onCampaignWin(NET.kind === "coop" || !!(NET.party && NET.party.members.length > 0)); document.exitPointerLock?.(); };
  NET_HOOKS.onHit = (d, stun, stunT, extra) => {
    if (d > 0) damagePlayer(d);
    if (extra?.tp && !G.pvpDead && !G.campaignDead) pos.current.set(extra.tp[0]!, extra.tp[1]!, extra.tp[2]!);
    if (extra?.push && !G.pvpDead && !G.campaignDead) { hv.current.set(extra.push[0]!, 0, extra.push[2]!); grounded.current = false; }
    if (extra?.slam && !G.pvpDead && !G.campaignDead && G.playerHp > 0) {
      // slammed straight down: cancel every other velocity; the stun starts once I touch the ground
      hv.current.set(0, 0, 0);
      vy.current = -250;
      grounded.current = false;
      slamStun.current = { dur: extra.slam, exp: 8 };
    }
    if (extra?.pull && !G.pvpDead && !G.campaignDead && G.playerHp > 0) {
      const dx = extra.pull[0]! - pos.current.x, dy = extra.pull[1]! - pos.current.y, dz = extra.pull[2]! - pos.current.z;
      const l = Math.hypot(dx, dy, dz) || 1;
      const sp = Math.min(90, 25 + l * 3);
      hv.current.set((dx / l) * sp, 0, (dz / l) * sp);
      vy.current = Math.max(10, (dy / l) * sp);
      grounded.current = false;
    }
    if (stun && !G.pvpDead) G.stun = Math.max(G.stun, stunT ?? STUN_TIME);
  };
  // Gain for a sound that happened at (x,y,z): full volume up close, fading with distance
  const nearGain = (x: number, y: number, z: number) =>
    Math.max(0.12, 1 - Math.hypot(x - camera.position.x, y - camera.position.y, z - camera.position.z) / 450);
  // Share my movement/combat sounds with the other players in one small batched message
  setSfxSink((ids) => {
    if (!NET.online) return;
    const q = pos.current;
    sendNet("vfx", { k: "sfx", s: ids.join(","), x: Math.round(q.x), y: Math.round(q.y), z: Math.round(q.z) });
  });
  NET_HOOKS.onVfx = (payload) => {
    const k = String(payload.k ?? "");
    if (k === "sfx") {
      const x = Number(payload.x), y = Number(payload.y), z = Number(payload.z);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;
      const g = nearGain(x, y, z) * 0.85;
      for (const id of String(payload.s ?? "").split(",").slice(0, 8)) if (REMOTE_SFX.has(id)) playSfx(id as Parameters<typeof playSfx>[0], g);
      return;
    }
    const nid = String(payload.id ?? "");
    if (k === "boom") {
      const rc = payload.rc != null && payload.rc !== "" ? String(payload.rc) : undefined;
      boomFx(tmpV.set(Number(payload.x), Number(payload.y), Number(payload.z)), Number(payload.r) || 8, Number(payload.t) || 0.4, false, "bomb", String(payload.c ?? ""), !!payload.h, rc);
      return;
    }
    if (k === "crack") {
      spawnSlamCrack(Number(payload.x), Number(payload.y), Number(payload.z), !!payload.dark);
      return;
    }
    if (k === "padsquish") {
      const id = String(payload.id ?? "");
      const pad = abilityPads.find((q) => q.active && q.netId === id);
      if (pad) pad.squish = 1;
      return;
    }
    if (k === "bomb") {
      // remote bomb projectile + saturn ring
      const slot = remoteBombs.find((b) => b.netId === String(payload.id ?? "")) ?? remoteBombs.find((b) => !b.active);
      if (slot) {
        slot.active = true;
        slot.netId = String(payload.id ?? `rb-${Date.now()}`);
        slot.pos.set(Number(payload.x), Number(payload.y), Number(payload.z));
        slot.vel.set(Number(payload.vx) || 0, Number(payload.vy) || 0, Number(payload.vz) || 0);
        slot.tele = !!payload.tele;
        slot.t = Number(payload.life) || 3;
      }
      return;
    }
    if (k === "bombend") {
      const id = String(payload.id ?? "");
      for (const b of remoteBombs) if (!id || b.netId === id) b.active = false;
      return;
    }
    if (k === "wall") {
      const slot = abilityWalls.find((w) => w.netId === nid) ?? abilityWalls.find((w) => !w.active);
      if (!slot) return;
      slot.active = true;
      slot.netId = nid;
      slot.grow = 0; // grow-in for remote viewers too
      slot.cx = Number(payload.cx); slot.cy = Number(payload.cy); slot.cz = Number(payload.cz);
      slot.yaw = Number(payload.yaw); slot.pitch = Number(payload.pitch);
      slot.hw = Number(payload.hw); slot.hh = Number(payload.hh); slot.hd = Number(payload.hd);
      slot.t = Number(payload.life) || 2;
      slot.m = !!payload.m; slot.ret = false; slot.rt = 0; slot.hit.clear();
      playSfx("wall_place", nearGain(slot.cx, slot.cy, slot.cz));
      return;
    }
    if (k === "pad") {
      const slot = abilityPads.find((w) => w.netId === nid) ?? abilityPads.find((w) => !w.active);
      if (!slot) return;
      slot.active = true;
      slot.netId = nid;
      slot.cx = Number(payload.cx); slot.cy = Number(payload.cy); slot.cz = Number(payload.cz);
      slot.yaw = Number(payload.yaw); slot.pitch = Number(payload.pitch);
      slot.hw = Number(payload.hw); slot.hh = Number(payload.hh); slot.hd = Number(payload.hd);
      slot.nx = Number(payload.nx); slot.ny = Number(payload.ny); slot.nz = Number(payload.nz);
      slot.t = Number(payload.life) || 9999;
      slot.cd = 0;
      slot.m = !!payload.m;
      playSfx("spring_place", nearGain(slot.cx, slot.cy, slot.cz));
      return;
    }
    if (k === "padclear") {
      for (const pad of abilityPads) {
        if (!payload.owner || pad.netId.startsWith(String(payload.owner))) pad.active = false;
      }
      playSfx("spring_reset", 0.5);
      return;
    }
    if (k === "fire") {
      const slot = abilityFires.find((w) => w.netId === nid) ?? abilityFires.find((w) => !w.active);
      if (!slot) return;
      slot.active = true;
      slot.netId = nid;
      slot.ax = Number(payload.ax); slot.ay = Number(payload.ay); slot.az = Number(payload.az);
      slot.bx = Number(payload.bx); slot.by = Number(payload.by); slot.bz = Number(payload.bz);
      slot.t = Number(payload.life) || 3;
      slot.m = !!payload.m;
      slot.stung.clear(); slot.tickAcc.clear();
      playSfx("fire_ground", nearGain((slot.ax + slot.bx) / 2, (slot.ay + slot.by) / 2, (slot.az + slot.bz) / 2));
      return;
    }
    if (k === "fball") {
      const slot = fireballs.find((w) => w.netId === nid) ?? fireballs.find((w) => !w.active);
      if (!slot) return;
      slot.active = true;
      slot.netId = nid;
      slot.pos.set(Number(payload.x), Number(payload.y), Number(payload.z));
      slot.vel.set(Number(payload.vx), Number(payload.vy), Number(payload.vz));
      slot.t = Number(payload.life) || 5;
      slot.traveled = 0;
      slot.m = !!payload.m;
      slot.b = 0;
      playSfx("fire_air", nearGain(slot.pos.x, slot.pos.y, slot.pos.z));
      return;
    }
    if (k === "tp") {
      const tp = teleportRef.current;
      const rx = Number(payload.x), ry = Number(payload.y), rz = Number(payload.z);
      if (payload.phase === "expand" && (!tp.active || tp.phase === "fly")) playSfx("teleport_expand", nearGain(rx, ry, rz));
      if (payload.phase === "done") playSfx("teleport_success", nearGain(rx, ry, rz));
      // visual only for remote: use teleport mesh if local not using
      if (!tp.active) {
        tp.active = true;
        tp.phase = payload.phase === "expand" ? "expand" : "fly";
        tp.pos.set(Number(payload.x), Number(payload.y), Number(payload.z));
        tp.target.copy(tp.pos);
        tp.chargeT = Number(payload.ct) || 0;
        tp.chargeMax = Number(payload.cm) || 0.7;
        // mark as remote visual so we don't teleport local player
        (tp as { remote?: boolean }).remote = true;
        tp.m = !!payload.m;
      } else if ((tp as { remote?: boolean }).remote) {
        tp.m = !!payload.m;
        tp.phase = payload.phase === "expand" ? "expand" : "fly";
        tp.pos.set(Number(payload.x), Number(payload.y), Number(payload.z));
        tp.target.copy(tp.pos);
        tp.chargeT = Number(payload.ct) || 0;
        if (payload.phase === "done") {
          tp.active = false;
          (tp as { remote?: boolean }).remote = false;
        }
      }
      return;
    }
    if (k === "bullet") {
      const slot = remoteBullets.find((b) => !b.active);
      if (!slot) return;
      slot.active = true;
      slot.pos.set(Number(payload.x), Number(payload.y), Number(payload.z));
      slot.vel.set(Number(payload.vx), Number(payload.vy), Number(payload.vz));
      slot.t = Number(payload.life) || 1.2;
      playSfx("shoot", nearGain(slot.pos.x, slot.pos.y, slot.pos.z) * 0.8);
      return;
    }
  };
  NET_HOOKS.onRevive = (id) => {
    G.reviveQueue = G.reviveQueue.filter((x) => x !== id);
    if (id === myId() && G.campaignDead) {
      G.campaignDead = false;
      G.freecam = false;
      G.freecamSpeedIdx = 0;
      G.playerHp = MAX_HP;
      pos.current.copy(START);
      hv.current.set(0, 0, 0);
      vy.current = 0;
      G.respawnMsg = 2.5;
      G.respawnToken++;
    }
    const pr = NET.peers.get(id);
    if (pr) pr.dead = false;
  };

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const cam = camera as THREE.PerspectiveCamera;
    const p = pos.current;
    const b = boss.current;
    if (lastAbilityMode.current !== G.mode) {
      const leavingTraining = lastAbilityMode.current === "training" && G.mode !== "training";
      lastAbilityMode.current = G.mode;
      if (leavingTraining && getAbility() === "boss" && !hasAchievement("hardcore")) setAbility(getLastUnlockedAbility());
    }

    const clearArena = () => {
      p.copy(START);
      hv.current.set(0, 0, 0);
      vy.current = 0;
      grounded.current = true;
      wallrunTime.current = WALLRUN_TIME;
      wallrunRecharge.current = WALLRUN_RECHARGE;
      G.wallrun = false;
      G.wallrunTime = WALLRUN_TIME;
      G.wallrunRecharge = WALLRUN_RECHARGE;
      G.wallrunReady = true;
      G.grounded = true;
      G.grappling = false;
      if (G.mode === "pvp") p.set(0, 0, NET.colors[NET.myId] === "blue" ? -150 : 150);
      cam.position.set(p.x, EYE, p.z);
      cam.lookAt(0, EYE, G.mode === "pvp" && p.z < 0 ? 100 : -100);
      lastYaw.current = new THREE.Euler().setFromQuaternion(cam.quaternion, "YXZ").y;
      pendingYaw.current = 0;
      playerPool.forEach((x) => (x.alive = false));
      botPool.forEach((x) => (x.alive = false));
      tables.forEach((t) => (t.alive = false));
      blues.forEach((u) => (u.alive = false));
      blueT.current = 6;
      summonT.current = 10;
      healthT.current = HEALTH_INTERVAL;
      health.forEach((h) => (h.active = false));
      abilityWalls.forEach((w) => { w.active = false; });
      abilityPads.forEach((pad) => { pad.active = false; });
      abilityFires.forEach((f) => { f.active = false; f.stung.clear(); f.tickAcc.clear(); });
      G.abilityCd = 0;
      G.abilityCharges = getAbility() === "wall" ? 6 : getAbility() === "trampoline" ? 3 : 1;
      G.abilitySlow = 0;
      MAP.health = [];
      hazards.forEach((h) => (h.active = false));
      bossSword.current.active = false;
      bossSword.current.returning = false;
      bossSword.current.hitTargets.clear();
      bossSword.current.solidObjects.clear();
      waves.forEach((w) => (w.active = false));
      bomb.current.alive = false;
      slam.current.on = false;
      bounce.current.t = 0;
      Object.assign(b, { landed: false, y: ROOM.h, vy: 0, bulletT: 1, specialT: 2, next: "sword", quarterT: 3, aoeT: 5, lockT: 0 });
      b.pos.set(0, 0, 0);
    };
    if (lastReset.current !== G.resetToken) {
      lastReset.current = G.resetToken;
      lastRespawn.current = G.respawnToken;
      tutSetup.current = -1;
      clearArena();
      splinters.length = 0;
      if (G.mode === "game" && !isFollower()) spawnTable(BOT_START.clone());
    }
    if (lastRespawn.current !== G.respawnToken) {
      lastRespawn.current = G.respawnToken;
      clearArena();
    }

    if (TRAIN_CMD.despawn) {
      TRAIN_CMD.despawn = false;
      if (isFollower()) sendNet("espawn", { kind: "despawn", n: 0 });
      despawnAll();
    }
    const follower = isFollower();

    const home = G.phase === "home";
    const targetFov = G.scoped ? G.zoomFov : SETTINGS.fov;
    cam.fov = home ? 92 : THREE.MathUtils.lerp(cam.fov, targetFov, 1 - Math.exp(-14 * dt));
    cam.updateProjectionMatrix();

    // --- home screen showcase: wide orbit inside the walls, invincible brown tables shooting each other ---
    if (home) {
      demoAng.current += dt * 0.12;
      const a = demoAng.current;
      cam.position.set(Math.cos(a) * (R - 27), 245, Math.sin(a) * (R - 27));
      cam.lookAt(0, 17, 0);
      if (aliveCount() < 12) {
        const t = spawnTable(randomFloor(new THREE.Vector3(9999, 0, 9999)));
        if (t) t.passive = true;
      }
      const list = tables.filter((t) => t.alive);
      for (const t of list) {
        const bp = t.pos;
        const toT = tmpV.copy(t.target).sub(bp).setY(0);
        if (toT.length() < 4) t.target.copy(randomFloor(bp));
        else bp.addScaledVector(toT.normalize(), 30 * dt);
        t.jumpT -= dt;
        if (t.jumpT <= 0 && bp.y <= 0) { t.vy = JUMP_V; t.jumpT = 2 + Math.random() * 3; }
        t.vy -= GRAVITY * dt;
        bp.y = Math.max(0, bp.y + t.vy * dt);
        if (bp.y <= 0 && t.vy < 0) t.vy = 0;
        for (const s of SOLIDS) if (s.y0 < 5 && bp.y < s.y1) pushOut(bp, s, 3 * t.s);
        clampCircle(bp, 3 * t.s);
        t.bob += dt * 6;
        const foe = list[(list.indexOf(t) + 1 + Math.floor(t.bob / 20)) % list.length]!;
        if (foe !== t) t.yaw = Math.atan2(foe.pos.x - bp.x, foe.pos.z - bp.z);
        t.shootT -= dt;
        if (t.shootT <= 0 && foe !== t) {
          t.shootT = 0.5 + Math.random() * 0.6;
          const aim = foe.pos.clone().setY(foe.pos.y + 2 * foe.s).sub(bp).setY(foe.pos.y + 2 * foe.s - (bp.y + 3.2 * t.s)).normalize();
          const from = bp.clone().setY(bp.y + 3.2 * t.s).addScaledVector(aim, 5 * t.s);
          spawnBullet(botPool, from, aim.multiplyScalar(BOT_BULLET_SPEED * 0.4), 0, 2);
        }
      }
    }

    // --- 1v1 win screen: both cameras zoom into the winner ---
    if (NET.kind === "pvp" && NET.stage === "over" && NET.winner) {
      const winId = NET.winner;
      let tx = 0, ty = EYE, tz = 0;
      if (winId === NET.myId) {
        tx = pos.current.x; ty = pos.current.y + EYE; tz = pos.current.z;
      } else {
        const pr = NET.peers.get(winId);
        if (pr) { tx = pr.x; ty = pr.y + EYE; tz = pr.z; }
      }
      cam.position.lerp(new THREE.Vector3(tx + 4, ty + 3, tz + 6), 1 - Math.exp(-2 * dt));
      cam.lookAt(tx, ty, tz);
      cam.fov = THREE.MathUtils.lerp(cam.fov, 28, 1 - Math.exp(-2 * dt));
      cam.updateProjectionMatrix();
      return;
    }

    // --- freecam movement runs after sim so physics keep going; camera is overridden below ---
    // freecam while dead in campaign / lobby respawn wait, or normal training/lobby/pvp freecam
    // Unified mouse look (pointer-locked PC + soft-lock iPad)
    if (G.locked && G.phase === "playing") {
      const dx = softLookRef.current.x;
      const dy = softLookRef.current.y;
      if (dx || dy) {
        softLookRef.current.x = 0;
        softLookRef.current.y = 0;
        const drift = SETTINGS.cameraDrift ?? 50;
        // 0 = sharp (2×), 50 = default (1×), 100 = very slow (0.25×)
        const driftMul = drift <= 50 ? 2 - drift / 50 : 1 - ((drift - 50) / 50) * 0.75;
        const sens = SETTINGS.sensitivity * driftMul * (G.scoped ? 0.45 : 1);
        const euler = new THREE.Euler(0, 0, 0, "YXZ");
        euler.setFromQuaternion(cam.quaternion);
        euler.y -= dx * 0.0022 * sens;
        euler.x -= dy * 0.0022 * sens;
        euler.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, euler.x));
        cam.quaternion.setFromEuler(euler);
      }
    }

    const freecamOn = G.freecam && G.phase === "playing" && (
      G.mode === "training" || NET.kind === "lobby" || NET.kind === "pvp" || G.campaignDead
    );

    // Freecam owns the keyboard/mouse: on entering AND leaving it, drop every held input so nothing
    // (jump, WASD, shoot, scope, ability, grapple) keeps running from before the switch.
    if (freecamOn !== freecamWas.current) {
      freecamWas.current = freecamOn;
      keys.current = {};
      G.firing = false;
      G.scoped = false;
      G.grappling = false;
      abilityReq.current = false;
      grappleOnPad.current = -1;
      grappleOnWall.current = -1;
    }
    // While in freecam, no gameplay action may fire (shooting would otherwise come out of the free camera like a ghost).
    if (freecamOn) {
      G.firing = false;
      G.scoped = false;
      abilityReq.current = false;
    }

    // Mobile soft-lock: keep locked while playing unless user paused
    if (isMobilePlay() && G.phase === "playing" && !G.userPaused) {
      G.locked = true;
      setCursorLocked(true);
    } else if (G.phase !== "playing" || G.userPaused) {
      // Never keep an invisible cursor on home / pause / menus
      if (!document.pointerLockElement) setCursorLocked(false);
    }
    // Online matches always run sim (mobile may not hard-lock); local control still needs locked
    const engaged = G.locked || NET.online || G.freecam;
    if (G.phase === "playing" && engaged && !G.frozen && G.countdown > 0) G.countdown = Math.max(0, G.countdown - dt);
    if (G.comboTimer > 0) {
      G.comboTimer = Math.max(0, G.comboTimer - dt);
      if (G.comboTimer <= 0) G.combo = 0;
    }

    if (G.dmgFloat.t > 0) {
      G.dmgFloat.t = Math.max(0, G.dmgFloat.t - dt);
      G.dmgFloat.pop = Math.max(0, G.dmgFloat.pop - dt * 2.2);
    }
    // --- abilities ---
    // Offline pause freezes ability CDs (and later fire/boss damage). Online never freezes.
    const offlinePaused = G.userPaused && !NET.online;
    if (G.abilityCd > 0 && !offlinePaused) {
      G.abilityCd = Math.max(0, G.abilityCd - dt);
      if (G.abilityCd <= 0) {
        playSfx("ability_ready");
        const ab = getAbility();
        G.abilityCharges = ab === "wall" ? 6 : ab === "trampoline" ? 3 : 1;
      }
    }
    if (slamStun.current.dur > 0) {
      slamStun.current.exp -= dt;
      if (grounded.current) { G.stun = Math.max(G.stun, slamStun.current.dur); slamStun.current.dur = 0; }
      else if (slamStun.current.exp <= 0) slamStun.current.dur = 0;
    }
    if (G.abilitySlow > 0) G.abilitySlow = Math.max(0, G.abilitySlow - dt);
    // Boss sword: horizontal spin, spherical 26-unit hitbox, and solid-object bounces.
    {
      const sword = bossSword.current;
      if (sword.active) {
        const radius = 13;
        const travelVec = sword.vel.clone().multiplyScalar(dt);
        const travel = travelVec.length();
        const dir = travel > 1e-6 ? travelVec.clone().normalize() : new THREE.Vector3(1, 0, 0);
        if (sword.returning) {
          const to = cam.position.clone().sub(sword.pos);
          if (to.length() < 5) sword.active = false;
          else { sword.vel.copy(to.normalize()).multiplyScalar(300); sword.pos.addScaledVector(sword.vel, dt); }
        } else if (travel > 0) {
          const solids: THREE.Object3D[] = [];
          if (staticRef.current) solids.push(staticRef.current);
          for (const m of wallMeshRefs.current) if (m && m.visible) solids.push(m);
          const ray = new THREE.Raycaster(sword.pos.clone(), dir, 0, travel + radius);
          const hit = ray.intersectObjects(solids, true).find((h) => h.object.visible && h.distance > 0.02);
          if (hit) {
            const normal = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize() : dir.clone().negate();
            if (normal.dot(sword.vel) > 0) normal.negate();
            sword.pos.addScaledVector(dir, Math.max(0, hit.distance - radius - 0.05));
            sword.pos.addScaledVector(normal, radius + 0.2);
            sword.vel.addScaledVector(normal, -2 * sword.vel.dot(normal)).normalize().multiplyScalar(300);
            sword.solidHits++;
            if (sword.solidHits >= 3) sword.returning = true;
          } else {
            sword.pos.add(travelVec);
          }
        }
        const hitRadius = radius;
        for (let ti = 0; ti < tables.length; ti++) {
          const t = tables[ti]!; const id = `t${ti}`;
          if (t.alive && !sword.hitTargets.has(id) && sword.pos.distanceTo(tmpV.copy(t.pos).setY(t.pos.y + 2 * t.s)) <= hitRadius + 2 * t.s) {
            sword.hitTargets.add(id); hitTable(t, 10);
            const away = tmpV.copy(t.pos).sub(sword.pos).setY(0); if (away.lengthSq() < 0.01) away.set(Math.random() - 0.5, 0, Math.random() - 0.5); away.normalize();
            t.dash.copy(away).multiplyScalar(300); t.dashT = Math.max(t.dashT, 0.25);
          }
        }
        for (let bi = 0; bi < blues.length; bi++) {
          const u = blues[bi]!; const id = `b${bi}`;
          if (u.alive && !sword.hitTargets.has(id) && sword.pos.distanceTo(tmpV.copy(u.pos).setY(u.pos.y + 2)) <= hitRadius + 2) {
            sword.hitTargets.add(id); hitBlue(u, 10);
            const away = tmpV.copy(u.pos).sub(sword.pos).setY(0); if (away.lengthSq() < 0.01) away.set(Math.random() - 0.5, 0, Math.random() - 0.5); away.normalize();
            u.dash.copy(away).multiplyScalar(300); u.dashT = Math.max(u.dashT, 0.25);
          }
        }
        if (NET.online && (NET.kind === "pvp" || NET.kind === "lobby")) {
          for (const peer of NET.peers.values()) {
            if (peer.dead || sword.hitTargets.has(peer.id) || Math.hypot(peer.x - sword.pos.x, peer.y - sword.pos.y, peer.z - sword.pos.z) > hitRadius + 1.5) continue;
            sword.hitTargets.add(peer.id);
            let dx = peer.x - sword.pos.x, dz = peer.z - sword.pos.z; const len = Math.hypot(dx, dz);
            if (len < 0.01) { const a = Math.random() * Math.PI * 2; dx = Math.cos(a); dz = Math.sin(a); } else { dx /= len; dz /= len; }
            hitPeer(peer.id, 10, false, undefined, { push: [dx * 300, 0, dz * 300] });
          }
        }
        if (sword.pos.length() > R * 2.5) sword.returning = true;
      }
      const mesh = bossSwordMesh.current;
      if (mesh) {
        mesh.visible = sword.active;
        if (sword.active) {
          mesh.position.copy(sword.pos);
          mesh.rotation.set(0, performance.now() / 80, 0);
        }
      }
    }
    if (abilityReq.current && G.phase === "playing" && G.locked && !G.freecam && G.countdown <= 0.6 && G.stun <= 0 && !G.pvpDead && !G.campaignDead) {
      abilityReq.current = false;
      const ab = getAbility();
      const tp = teleportRef.current;
      if (ab === "boss") {
        if ((hasAchievement("hardcore") || G.mode === "training") && G.abilityCd <= 0 && !G.pvpDead && !G.campaignDead) {
          if (!grounded.current) {
            const look = new THREE.Vector3();
            cam.getWorldDirection(look);
            const sword = bossSword.current;
            if (!sword.active) {
              sword.active = true; sword.returning = false; sword.solidHits = 0; sword.hitCooldown = 0; sword.solidObjects.clear(); sword.hitTargets.clear();
              sword.pos.copy(cam.position).addScaledVector(look, 2);
              sword.vel.copy(look).normalize().multiplyScalar(300);
              G.abilityCd = 3; G.abilityCharges = 0; playSfx("fire_ground");
            }
          } else {
          const look = new THREE.Vector3();
          cam.getWorldDirection(look);
          // The quarter's origin stays at the room center; its middle follows the crosshair direction.
          const aimAngle = Math.atan2(-look.z, look.x);
          addHazard("quarter", 0, 0, 1, aimAngle - Math.PI / 4, 25, "player");
          G.abilityCd = 4;
          G.abilityCharges = 0;
          playSfx("stun");
          G.shake = Math.max(G.shake, 0.2);
          }
        }
      } else if (ab === "teleport" && !G.abilityLocked && !G.parryLocked) {
        if (tp.active) {
          // Cancel free during fly/expand — no cooldown
          tp.active = false;
          tp.pendingStun.clear();
        } else if (G.abilityCd > 0 && tp.canRewind && !tp.rewindUsed) {
          p.copy(tp.origin);
          playSfxShared("teleport_success"); // rewind uses the same sound as a successful teleport (opponents hear it too)
          // keep velocity on rewind too
          tp.rewindUsed = true;
          tp.canRewind = false;
        } else if (G.abilityCd > 0 && tbMoved.current.length) {
          // Teleport mastery: send everything my teleport bomb moved back to where it was
          for (const mv of tbMoved.current) {
            const to = [mv.x, mv.y, mv.z];
            if (mv.id === "me") {
              pos.current.set(mv.x, mv.y, mv.z);
              grounded.current = false;
            } else if (mv.id.startsWith("t")) shove("t", +mv.id.slice(1), { tp: to });
            else if (mv.id.startsWith("b") && mv.id !== "boss") shove("b", +mv.id.slice(1), { tp: to });
            else if (meHurtable()) hitPeer(mv.id, 0, false, undefined, { tp: to });
          }
          tbMoved.current = [];
          playSfxShared("teleport_success");
        } else if (G.abilityCd <= 0 && !tp.active) {
          const look = new THREE.Vector3();
          cam.getWorldDirection(look);
          const maxR = cfg.grapple(GRAPPLE_MAX) * 3.5;
          let hitPt: THREE.Vector3 | null = null;
          if (staticRef.current) {
            const rc = new THREE.Raycaster(cam.position.clone(), look, 0.5, maxR);
            const hit = rc.intersectObject(staticRef.current, true)[0];
            if (hit) hitPt = hit.point.clone();
          }
          if (!hitPt) {
            hitPt = cam.position.clone().addScaledVector(look, maxR);
            if (look.y < -0.05) {
              const tHit = -cam.position.y / look.y;
              if (tHit > 0.5 && tHit < maxR) hitPt = cam.position.clone().addScaledVector(look, tHit);
            }
          }
          if (hitPt) {
            hitPt.addScaledVector(look, -PLAYER_R * 2);
            tp.active = true;
            tp.phase = "fly";
            tp.chargeT = 0;
            tp.pos.copy(cam.position).addScaledVector(look, 1.5);
            tp.vel.copy(look).multiplyScalar(BULLET_SPEED); // launch like a bullet
            tp.target.copy(hitPt);
            tp.origin.copy(p);
            tp.pendingStun.clear();
            tp.canRewind = false;
            tp.rewindUsed = false;
            tp.m = masteryOn("teleport");
            tbMoved.current = [];
          }
        }
      } else if (ab === "trampoline" && !G.abilityLocked && !G.parryLocked && G.abilityCd <= 0 && G.abilityCharges <= 0) {
        // Reset trampolines: start cooldown and delete all placed pads
        const sm = masteryOn("trampoline");
        if (sm) for (const pad of abilityPads) if (pad.active && pad.m && pad.netId.startsWith(`${myId()}-`)) springBlast(pad);
        for (const pad of abilityPads) pad.active = false;
        playSfx("spring_reset");
        G.abilityCd = sm ? 3.5 : 5;
        G.abilityCharges = 0;
        if (NET.online) sendNet("vfx", { k: "padclear", owner: myId() });
      } else {
      const can = G.abilityCd <= 0 && G.abilityCharges > 0 && !G.abilityLocked && !G.parryLocked;
      if (can) {
        const yaw = new THREE.Euler().setFromQuaternion(cam.quaternion, "YXZ").y;
        const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
        if (ab === "wall" || ab === "trampoline") {
          const euler = new THREE.Euler().setFromQuaternion(cam.quaternion, "YXZ");
          const yaw = euler.y;
          const pitch = euler.x; // look down = negative in YXZ? three.js YXZ: pitch is x
          const look = new THREE.Vector3();
          cam.getWorldDirection(look);
          const wallM = ab === "wall" && masteryOn("wall");
          const ws = wallM ? 1.5 : 1; // Wall mastery: 1.5× bigger in every dimension
          const thick = TABLE_W * 0.5 * ws;
          const halfW = BOSS_H * 0.5 * ws;
          const halfH = BOSS_H * 0.5 * 1.6 * ws; // 1.6× taller walls
          const dist = (PLAYER_R + thick + 2) * 5;
          const place = cam.position.clone().addScaledVector(look, dist);
          if (ab === "wall") {
            const slot = abilityWalls.find((w) => !w.active);
            if (slot) {
              slot.grow = 0;
              slot.active = true;
              slot.netId = `${myId()}-w-${Date.now()}`;
              playSfx("wall_place");
              slot.cx = place.x; slot.cy = place.y; slot.cz = place.z;
              slot.yaw = yaw; slot.pitch = pitch;
              slot.hw = halfW; slot.hh = halfH; slot.hd = thick;
              slot.t = wallM ? 3 : 2; // Wall mastery lasts 1s longer
              slot.m = wallM; slot.ret = false; slot.rt = 0; slot.hit.clear();
              G.abilityCharges--;
              if (G.abilityCharges <= 0) G.abilityCd = 3;
              if (NET.online) sendNet("vfx", { k: "wall", m: wallM ? 1 : 0, id: slot.netId, cx: slot.cx, cy: slot.cy, cz: slot.cz, yaw: slot.yaw, pitch: slot.pitch, hw: slot.hw, hh: slot.hh, hd: slot.hd, life: slot.t });
            }
          } else {
            const slot = abilityPads.find((pad) => !pad.active);
            if (slot) {
              // Placement follows velocity; pad face / launch follows camera look
              const spd = Math.hypot(hv.current.x, vy.current, hv.current.z);
              let placeDir = look.clone();
              if (spd > 12) placeDir.set(hv.current.x, vy.current, hv.current.z).normalize();
              const placePad = cam.position.clone().addScaledVector(placeDir, dist);
              // Orientation from camera so a quick turn changes launch direction
              const pYaw = Math.atan2(-look.x, -look.z);
              const pPitch = Math.asin(Math.max(-1, Math.min(1, look.y)));
              slot.active = true;
              slot.cx = placePad.x; slot.cy = placePad.y; slot.cz = placePad.z;
              slot.yaw = pYaw; slot.pitch = pPitch;
              slot.hw = halfW * 0.5; slot.hh = halfH * 0.5; slot.hd = thick * 0.5;
              slot.nx = look.x; slot.ny = look.y; slot.nz = look.z;
              slot.t = 9999;
              slot.cd = 0;
              slot.m = masteryOn("trampoline");
              slot.netId = `${myId()}-p-${Date.now()}`;
              playSfx("spring_place");
              G.abilityCharges--;
              if (NET.online) sendNet("vfx", { k: "pad", m: slot.m ? 1 : 0, id: slot.netId, cx: slot.cx, cy: slot.cy, cz: slot.cz, yaw: slot.yaw, pitch: slot.pitch, hw: slot.hw, hh: slot.hh, hd: slot.hd, nx: slot.nx, ny: slot.ny, nz: slot.nz, life: 9999 });
              // After all 3 placed: wait for player to Reset Trampolines (ability key again)
            }
          }
        } else if (ab === "fire") {
          const look = new THREE.Vector3();
          cam.getWorldDirection(look);
          if (!grounded.current) {
            // Air: fireball — bomb speed/range/damage + burn
            const slot = fireballs.find((f) => !f.active);
            if (slot) {
              slot.active = true;
              slot.pos.copy(cam.position).addScaledVector(look, 1.5);
              slot.m = masteryOn("fire");
              slot.vel.copy(look).multiplyScalar(BULLET_SPEED * (slot.m ? 0.5 : 1)); // Fire mastery: 2× slower fireball
              slot.t = 999; // infinite range — despawn by hits / idle explode only
              slot.traveled = 0;
              slot.b = 0;
              slot.idle = 0;
              slot.netId = `${myId()}-fb-${Date.now()}`;
              playSfx("fire_air");
              G.abilityCharges = 0;
              G.abilityCd = 4; // air fireball CD
              if (NET.online) sendNet("vfx", { k: "fball", m: slot.m ? 1 : 0, id: slot.netId, x: slot.pos.x, y: slot.pos.y, z: slot.pos.z, vx: slot.vel.x, vy: slot.vel.y, vz: slot.vel.z, life: 999 });
            }
          } else {
            const slot = abilityFires.find((f) => !f.active);
            if (slot) {
              const fm = masteryOn("fire");
              const dist = cfg.grapple(GRAPPLE_MAX) * 2 * (fm ? 2 : 1); // Fire mastery: 2× longer
              // always parallel to the ground, whatever the pitch of the camera
              const flat = new THREE.Vector3(look.x, 0, look.z);
              if (flat.lengthSq() < 1e-6) flat.set(0, 0, -1);
              flat.normalize();
              const start = p.clone().addScaledVector(flat, 2);
              const end = p.clone().addScaledVector(flat, dist);
              start.y = end.y = Math.max(0.2, p.y);
              slot.active = true;
              slot.ax = start.x; slot.ay = Math.max(0.2, start.y); slot.az = start.z;
              slot.bx = end.x; slot.by = Math.max(0.2, end.y); slot.bz = end.z;
              slot.t = 3;
              slot.stung.clear();
              slot.tickAcc.clear();
              slot.m = masteryOn("fire");
              slot.netId = `${myId()}-f-${Date.now()}`;
              playSfx("fire_ground");
              G.shake = Math.max(G.shake, 0.45);
              G.abilityCharges = 0;
              G.abilityCd = 5;
              if (NET.online) sendNet("vfx", { k: "fire", m: slot.m ? 1 : 0, id: slot.netId, ax: slot.ax, ay: slot.ay, az: slot.az, bx: slot.bx, by: slot.by, bz: slot.bz, life: 3 });
            }
          }
        }
      } // end if (can)
      } // end non-teleport
    } else {
      abilityReq.current = false;
    }
    // lifetime + oriented wall collision + pad bounce + fire line + fireballs + burns
    // Players only hurt each other in 1v1s and lobbies — never in party campaign / party training
    const canHurtPeers = G.mode === "pvp" || NET.kind === "pvp" || NET.kind === "lobby";
    for (const w of abilityWalls) {
      if (!w.active) continue;
      const wMine = w.netId.startsWith(`${myId()}-`);
      if (!w.ret) {
        w.t -= dt;
        if (w.t <= 0) {
          if (w.m) { w.ret = true; w.rt = 9; w.hit.clear(); } // Wall mastery: it flies back to its owner instead of vanishing
          else { w.active = false; continue; }
        }
      }
      if (w.ret) {
        w.rt -= dt;
        let tx = 0, ty = 0, tz = 0, have = false;
        if (wMine) { tx = p.x; ty = p.y + EYE * 0.5; tz = p.z; have = true; }
        else {
          const ow = NET.peers.get(ownerOf(w.netId));
          if (ow && !ow.dead) { tx = ow.x; ty = ow.y + EYE * 0.5; tz = ow.z; have = true; }
        }
        if (!have || w.rt <= 0 || inObb(w, tx, ty, tz, PLAYER_R + 1)) { w.active = false; continue; }
        const dx = tx - w.cx, dy = ty - w.cy, dz = tz - w.cz;
        const dl = Math.hypot(dx, dy, dz) || 1;
        const st = Math.min(dl, 450 * dt);
        // face the biggest side (local Z) toward the target while flying
        w.yaw = Math.atan2(dx, dz);
        w.pitch = -Math.asin(Math.max(-1, Math.min(1, dy / dl)));
        w.cx += (dx / dl) * st; w.cy += (dy / dl) * st; w.cz += (dz / dl) * st;
      }
      // Wall mastery: 10 damage every 0.7s to enemies touching it. Only the owner applies it, and never to the owner.
      if (w.m && wMine) {
        for (const [k, v] of [...w.hit.entries()]) { if (v - dt <= 0) w.hit.delete(k); else w.hit.set(k, v - dt); }
        const touch = (id: string, x: number, y: number, z: number, mg: number) => {
          if (w.hit.has(id) || !inObb(w, x, y, z, mg)) return false;
          w.hit.set(id, 0.7);
          return true;
        };
        for (let i = 0; i < tables.length; i++) {
          const tb = tables[i]!;
          if (tb.alive && touch(`t${i}`, tb.pos.x, tb.pos.y + 2 * tb.s, tb.pos.z, 3 * tb.s)) hitTable(tb, 10);
        }
        for (let i = 0; i < blues.length; i++) {
          const u = blues[i]!;
          if (u.alive && touch(`b${i}`, u.pos.x, 2, u.pos.z, 4)) hitBlue(u, 10);
        }
        if (bossLive() && b.landed) {
          bossBox(_mn, _mx);
          const cx2 = Math.max(_mn.x, Math.min(_mx.x, w.cx)), cy2 = Math.max(_mn.y, Math.min(_mx.y, w.cy)), cz2 = Math.max(_mn.z, Math.min(_mx.z, w.cz));
          if (touch("boss", cx2, cy2, cz2, 1)) hitBoss(Math.max(1, Math.round(10 / DMG)));
        }
        if (canHurtPeers) {
          for (const pr of NET.peers.values()) {
            if (pr.dead || pr.id === myId()) continue;
            if (touch(pr.id, pr.x, pr.y + 2, pr.z, 4)) { hitPeer(pr.id, 10, false); noteDmg(10, pr.id, pr.x, pr.y + 2, pr.z); }
          }
        }
      }
      if (!w.ret) pushOutOriented(p, w.cx, w.cy, w.cz, w.yaw, w.pitch, w.hw, w.hh, w.hd, PLAYER_R);
    }
    for (const pad of abilityPads) {
      if (!pad.active) continue;
      // Lifetime is unlimited until trampoline ability cooldown starts
      pad.cd = Math.max(0, pad.cd - dt);
      // proximity in oriented local space
      orientLocal(_la, p.x - pad.cx, p.y - pad.cy, p.z - pad.cz, pad.yaw, pad.pitch);
      // Generous volume so it feels snappy
      const onPad = Math.abs(_la.x) < pad.hw + 5 && Math.abs(_la.y) < pad.hh + 6 && Math.abs(_la.z) < pad.hd + 5;
      if (!onPad || pad.cd > 0) continue;
      const n = tmpV.set(pad.nx, pad.ny, pad.nz).normalize();
      const speed3 = Math.hypot(hv.current.x, vy.current, hv.current.z);
      // Default 200; if already faster, keep that speed
      const launch = Math.max(200, speed3);
      hv.current.set(n.x * launch, 0, n.z * launch);
      vy.current = n.y * launch;
      if (Math.abs(n.y) < 0.25 && Math.abs(vy.current) < 35) vy.current = Math.max(vy.current, 45);
      grounded.current = false;
      pad.cd = 0.18;
      pad.squish = 1; // visual bounce
      playSfx("bounce_pad");
      if (NET.online && pad.netId) sendNet("vfx", { k: "padsquish", id: pad.netId });
    }
    // Fire lines — 5× wider/taller, no self-dmg, can hit boss if under it
    const FIRE_W = 20; // was ~4, then 8; now 5× original
    const FIRE_H = 8; // 5× taller zone
    for (const fire of abilityFires) {
      if (!fire.active) continue;
      if (offlinePaused) continue; // offline menu freezes fire line timer + damage
      fire.t -= dt;
      if (fire.t <= 0) { fire.active = false; fire.stung.clear(); fire.tickAcc.clear(); continue; }
      // Copies of another player's fire are visual only — the caster's own client applies the damage,
      // so you never get burned by your own fire (and nobody is hit twice).
      if (!fire.netId.startsWith(`${myId()}-`)) continue;
      const fw = fire.m ? FIRE_W * 2 : FIRE_W; // Fire mastery: 2× bigger line
      const segLen = Math.hypot(fire.bx - fire.ax, fire.by - fire.ay, fire.bz - fire.az) || 1;
      const nearSeg3 = (x: number, y: number, z: number) => {
        const dx = fire.bx - fire.ax, dy = fire.by - fire.ay, dz = fire.bz - fire.az;
        let tt = ((x - fire.ax) * dx + (y - fire.ay) * dy + (z - fire.az) * dz) / (segLen * segLen);
        tt = Math.max(0, Math.min(1, tt));
        const px = fire.ax + dx * tt, py = fire.ay + dy * tt, pz = fire.az + dz * tt;
        return Math.hypot(x - px, y - py, z - pz);
      };
      for (let i = 0; i < tables.length; i++) {
        const tb = tables[i]!;
        if (!tb.alive || nearSeg3(tb.pos.x, tb.pos.y + 2, tb.pos.z) >= fw + 3 * tb.s) continue;
        const id = `t${i}`;
        if (!fire.stung.has(id)) { fire.stung.add(id); hitTable(tb, 10); }
        const acc = (fire.tickAcc.get(id) ?? 0) + dt;
        if (acc >= 0.1) { fire.tickAcc.set(id, acc - 0.1); hitTable(tb, 2); }
        else fire.tickAcc.set(id, acc);
      }
      for (let i = 0; i < blues.length; i++) {
        const u = blues[i]!;
        if (!u.alive || nearSeg3(u.pos.x, 2, u.pos.z) >= fw) continue;
        const id = `b${i}`;
        if (!fire.stung.has(id)) { fire.stung.add(id); hitBlue(u, 10); }
        const acc = (fire.tickAcc.get(id) ?? 0) + dt;
        if (acc >= 0.1) { fire.tickAcc.set(id, acc - 0.1); hitBlue(u, 2); }
        else fire.tickAcc.set(id, acc);
      }
      // Boss: if fire is under / through boss volume
      if (bossLive() && b.landed) {
        const bx = b.pos.x, by = b.y + 20, bz = b.pos.z;
        if (nearSeg3(bx, by, bz) < fw + 3 * BOSS_S || nearSeg3(bx, 5, bz) < fw + 3 * BOSS_S) {
          const id = "boss";
          if (!fire.stung.has(id)) { fire.stung.add(id); hitBoss(2); }
          const acc = (fire.tickAcc.get(id) ?? 0) + dt;
          if (acc >= 0.1) { fire.tickAcc.set(id, acc - 0.1); hitBoss(1); }
          else fire.tickAcc.set(id, acc);
        }
      }
      for (const pr of NET.peers.values()) {
        if (!canHurtPeers || pr.dead || pr.id === myId()) continue;
        if (nearSeg3(pr.x, pr.y + 2, pr.z) >= fw) continue;
        if (!fire.stung.has(pr.id)) {
          fire.stung.add(pr.id);
          hitPeer(pr.id, 10, true);
          noteDmg(10, pr.id, pr.x, pr.y + 2, pr.z);
        }
        const acc = (fire.tickAcc.get(pr.id) ?? 0) + dt;
        if (acc >= 0.1) { fire.tickAcc.set(pr.id, acc - 0.1); hitPeer(pr.id, 2, false); }
        else fire.tickAcc.set(pr.id, acc);
      }
    }
    // Fireballs (air fire) — infinite range; 15 dmg + burn; normal = 1 hit, mastery = 3 hits; 5s idle → explode
    // Offline pause freezes these completely
    if (!offlinePaused) for (const fb of fireballs) {
      if (!fb.active) continue;
      fb.idle = (fb.idle ?? 0) + dt;
      // Remote copies of someone else's fireball are visual only (the caster applies damage + syncs the boom)
      const mine = fb.netId.startsWith(`${myId()}-`);
      const travel = fb.vel.length() * dt;
      const steps = Math.max(1, Math.ceil(travel / (fb.m ? 0.75 : 1.2)));
      const stepV = fb.vel.clone().multiplyScalar(dt / steps);
      const blastR = BOMB_R * 0.5; // fireball blast keeps its own size (not scaled by BOMB_SIZE)
      const FB_DMG = 15;
      const maxHits = fb.m ? 3 : 1;
      // 5s with no hit → auto explode in place
      if (fb.idle >= 5) {
        const at = fb.pos.clone();
        if (mine) {
          for (let i = 0; i < tables.length; i++) {
            const tb = tables[i]!;
            if (!tb.alive || tb.pos.distanceTo(at) >= blastR) continue;
            hitTable(tb, FB_DMG);
            burns.current.set(`t${i}`, { t: 4, lx: tb.pos.x, ly: tb.pos.y, lz: tb.pos.z, acc: 0 });
            G.burnBuff = 4;
          }
          for (let i = 0; i < blues.length; i++) {
            const u = blues[i]!;
            if (!u.alive || u.pos.distanceTo(at) >= blastR) continue;
            hitBlue(u, FB_DMG);
            burns.current.set(`b${i}`, { t: 4, lx: u.pos.x, ly: 0, lz: u.pos.z, acc: 0 });
            G.burnBuff = 4;
          }
          if (bossLive() && b.landed && distToBossBox(at) < blastR) {
            hitBoss(Math.max(1, Math.round(FB_DMG / DMG)));
            burns.current.set("boss", { t: 4, lx: b.pos.x, ly: b.y, lz: b.pos.z, acc: 0 });
            G.burnBuff = 4;
          }
          for (const pr of NET.peers.values()) {
            if (!canHurtPeers || pr.dead || pr.id === myId()) continue;
            if (tmpV.set(pr.x, pr.y, pr.z).distanceTo(at) >= blastR) continue;
            hitPeer(pr.id, FB_DMG, true);
            noteDmg(FB_DMG, pr.id, pr.x, pr.y + 2, pr.z);
            burns.current.set(pr.id, { t: 4, lx: pr.x, ly: pr.y, lz: pr.z, acc: 0 });
            G.burnBuff = 4;
          }
          boomFx(at, blastR, fb.m ? 3 : 0.45, true, "fire", fb.m ? "#ff4444" : "#ff6a1a", !!fb.m, fb.m ? "#ef4444" : "#3b82f6");
          G.shake = Math.max(G.shake, 0.5);
        }
        fb.active = false;
        continue;
      }
      for (let si = 0; si < steps && fb.active; si++) {
        fb.pos.add(stepV);
        fb.traveled += stepV.length();
        const q = fb.pos;
        // Thick cylindrical room wall + ceiling + floor so the ball cannot tunnel
        const WALL_SHELL = 2.5;
        const CEIL_SHELL = 0.8;
        let hit = q.y <= 0.3 || q.y >= ROOM.h - CEIL_SHELL || Math.hypot(q.x, q.z) >= R - WALL_SHELL || inSolid(q);
        let wallN: THREE.Vector3 | null = null;
        if (q.y >= ROOM.h - CEIL_SHELL) wallN = new THREE.Vector3(0, -1, 0);
        else if (q.y <= 0.3) wallN = new THREE.Vector3(0, 1, 0);
        else if (Math.hypot(q.x, q.z) >= R - WALL_SHELL) wallN = new THREE.Vector3(-q.x, 0, -q.z).normalize();
        if (!hit) {
          for (const aw of abilityWalls) {
            if (!aw.active || aw.ret || !inObb(aw, q.x, q.y, q.z, 0.4)) continue;
            hit = true;
            const cp = Math.cos(aw.pitch);
            const zAx = new THREE.Vector3(cp * Math.sin(aw.yaw), -Math.sin(aw.pitch), cp * Math.cos(aw.yaw));
            wallN = zAx.multiplyScalar(zAx.dot(stepV) > 0 ? -1 : 1);
            break;
          }
        }
        let bn: THREE.Vector3 | null = wallN, bp: THREE.Vector3 | null = null;
        const near = (cx: number, cy: number, cz: number, rad: number) => {
          const dx = q.x - cx, dy = q.y - cy, dz = q.z - cz;
          if (dx * dx + dy * dy + dz * dz >= rad * rad) return false;
          bn = new THREE.Vector3(dx, dy, dz);
          if (bn.lengthSq() < 1e-6) bn.copy(stepV).negate();
          bn.normalize();
          bp = new THREE.Vector3(cx, cy, cz).addScaledVector(bn, rad + 1.5);
          return true;
        };
        if (!hit) for (const tb of tables) if (tb.alive && near(tb.pos.x, tb.pos.y + 2.6 * tb.s, tb.pos.z, 3.4 * tb.s)) { hit = true; break; }
        if (!hit) for (const u of blues) if (u.alive && near(u.pos.x, 2.2, u.pos.z, 4.5)) { hit = true; break; }
        if (!hit && bossLive()) {
          bossBox(_mn, _mx);
          if (q.x > _mn.x && q.x < _mx.x && q.y > _mn.y && q.y < _mx.y && q.z > _mn.z && q.z < _mx.z) {
            hit = true;
            const cx = (_mn.x + _mx.x) * 0.5, cy = (_mn.y + _mx.y) * 0.5, cz = (_mn.z + _mx.z) * 0.5;
            near(cx, cy, cz, Math.max(_mx.x - _mn.x, _mx.y - _mn.y, _mx.z - _mn.z) * 0.5);
          }
        }
        if (!hit) {
          const ownerPid = ownerOf(fb.netId); // ids contain a dash, so never split on "-"
          for (const pr of NET.peers.values()) {
            if (pr.dead || pr.id === myId() || pr.id === ownerPid) continue;
            if (near(pr.x, pr.y + 2, pr.z, 4)) { hit = true; break; }
          }
          if (!hit && !mine && !G.pvpDead && !G.campaignDead && near(p.x, p.y + 2, p.z, 4)) hit = true;
        }
        if (hit && !mine) {
          if (fb.m && fb.b < maxHits) { bounceFb(fb, stepV, bn, bp); fb.idle = 0; }
          else fb.active = false;
        } else if (hit) {
          const at = q.clone();
          fb.idle = 0;
          for (let i = 0; i < tables.length; i++) {
            const tb = tables[i]!;
            if (!tb.alive || tb.pos.distanceTo(at) >= blastR) continue;
            hitTable(tb, FB_DMG);
            burns.current.set(`t${i}`, { t: 4, lx: tb.pos.x, ly: tb.pos.y, lz: tb.pos.z, acc: 0 });
            G.burnBuff = 4;
          }
          for (let i = 0; i < blues.length; i++) {
            const u = blues[i]!;
            if (!u.alive || u.pos.distanceTo(at) >= blastR) continue;
            hitBlue(u, FB_DMG);
            burns.current.set(`b${i}`, { t: 4, lx: u.pos.x, ly: 0, lz: u.pos.z, acc: 0 });
            G.burnBuff = 4;
          }
          if (bossLive() && b.landed && distToBossBox(at) < blastR) {
            hitBoss(Math.max(1, Math.round(FB_DMG / DMG)));
            burns.current.set("boss", { t: 4, lx: b.pos.x, ly: b.y, lz: b.pos.z, acc: 0 });
            G.burnBuff = 4;
          }
          for (const pr of NET.peers.values()) {
            if (!canHurtPeers || pr.dead || pr.id === myId()) continue;
            if (tmpV.set(pr.x, pr.y, pr.z).distanceTo(at) >= blastR) continue;
            hitPeer(pr.id, FB_DMG, true);
            noteDmg(FB_DMG, pr.id, pr.x, pr.y + 2, pr.z);
            burns.current.set(pr.id, { t: 4, lx: pr.x, ly: pr.y, lz: pr.z, acc: 0 });
            G.burnBuff = 4;
          }
          boomFx(at, blastR, fb.m ? 3 : 0.45, true, "fire", fb.m ? "#ff4444" : "#ff6a1a", !!fb.m, fb.m ? "#ef4444" : "#3b82f6");
          G.shake = Math.max(G.shake, 0.5);
          if (fb.m && fb.b + 1 < maxHits) bounceFb(fb, stepV, bn, bp);
          else fb.active = false;
        }
      }
    }

    // Teleport: bullet flight → expand (2× table→4×) → blink (keep velocity) + 2s bot stun
    {
      const tp = teleportRef.current;
      const tpRemote = !!(tp as { remote?: boolean }).remote;
      // tick ability stun timers
      for (const [id, left] of [...abilityStun.current.entries()]) {
        const n = left - dt;
        if (n <= 0) abilityStun.current.delete(id);
        else abilityStun.current.set(id, n);
      }
      if (G.abilityCd <= 0) tbMoved.current = []; // the teleport-bomb rewind window ends with the 3s cooldown
      // Teleport mastery: anything the ball touched stays frozen until 3s after the teleport lands
      if (tp.m && tp.active && !tpRemote && tp.pendingStun.size) {
        tpRefresh.current -= dt;
        const doPeers = tpRefresh.current <= 0;
        if (doPeers) tpRefresh.current = 0.3;
        for (const id of tp.pendingStun) {
          if (id === "boss") b.lockT = Math.max(b.lockT, 0.4);
          else if (id.startsWith("t") || id.startsWith("b")) abilityStun.current.set(id, Math.max(abilityStun.current.get(id) ?? 0, 0.4));
          else if (doPeers) hitPeer(id, 0, true, 0.6);
        }
      }
      const markStun = (id: string) => {
        tp.pendingStun.add(id);
        // Stun immediately on contact (refresh while ball lives)
        if (id.startsWith("t") || (id.startsWith("b") && id !== "boss")) {
          abilityStun.current.set(id, Math.max(abilityStun.current.get(id) ?? 0, 0.35));
        } else if (id === "boss") {
          b.lockT = Math.max(b.lockT, 0.35);
        } else {
          // peer — stun on contact, will extend to 2s after successful teleport
          hitPeer(id, 0, true, 0.4);
        }
      };
      const ballHitCheck = (center: THREE.Vector3, radius: number) => {
        for (let i = 0; i < tables.length; i++) {
          const tb = tables[i]!;
          if (tb.alive && center.distanceTo(tmpV.copy(tb.pos).setY(tb.pos.y + 2 * tb.s)) < radius + 3 * tb.s) markStun(`t${i}`);
        }
        for (let i = 0; i < blues.length; i++) {
          const u = blues[i]!;
          if (u.alive && center.distanceTo(tmpV.copy(u.pos).setY(2)) < radius + 4) markStun(`b${i}`);
        }
        if (bossLive() && b.landed && distToBossBox(center) < radius + 2) markStun("boss");
        if (canHurtPeers) for (const pr of NET.peers.values()) {
          if (!pr.dead && pr.id !== myId() && center.distanceTo(tmpV.set(pr.x, pr.y + 2, pr.z)) < radius + 4) markStun(pr.id);
        }
      };
      if (tp.active && !tpRemote && tp.phase === "fly") {
        const maxR = cfg.grapple(GRAPPLE_MAX) * 3.5;
        const travel = tp.vel.length() * dt;
        const steps = Math.max(1, Math.ceil(travel / 1.5));
        const stepV = tp.vel.clone().multiplyScalar(dt / steps);
        let arrived = false;
        for (let si = 0; si < steps && tp.active && tp.phase === "fly"; si++) {
          tp.pos.add(stepV);
          // small projectile radius for contact stun during flight
          ballHitCheck(tp.pos, TABLE_W * 0.55);
          const toT = tmpV.copy(tp.target).sub(tp.pos);
          if (toT.length() < 4 || tp.pos.distanceTo(tp.origin) >= maxR) {
            arrived = true;
            break;
          }
          // solid impact → stop and expand here
          if (tp.pos.y <= 0.3 || inSolid(tp.pos) || Math.hypot(tp.pos.x, tp.pos.z) >= R - 1) {
            arrived = true;
            break;
          }
        }
        if (arrived) {
          tp.phase = "expand";
          playSfx("teleport_expand");
          tp.chargeT = 0;
          // snap target to current pos for expand center
          tp.target.copy(tp.pos);
        }
      } else if (tp.active && !tpRemote && tp.phase === "expand") {
        tp.chargeT += dt;
        // 2× bigger than before: start 2× table, end 4× table
        const scale = TABLE_W * 2 * (1 + Math.min(1, tp.chargeT / tp.chargeMax));
        ballHitCheck(tp.target, scale * 0.55);
        if (tp.chargeT >= tp.chargeMax) {
          if (tpRemote) {
            tp.active = false;
            (tp as { remote?: boolean }).remote = false;
          } else {
            // Teleport — KEEP velocity
            p.copy(tp.target);
            playSfx("teleport_success");
            tp.active = false;
            G.abilityCd = TELEPORT_CD; // 2.5s
            G.abilityCharges = 0;
            tp.canRewind = true;
            tp.rewindUsed = false;
            // 2s stun after successful teleport for everyone marked (3s with Teleport mastery)
            const stT = tp.m ? 3 : 2;
            for (const id of tp.pendingStun) {
              abilityStun.current.set(id, stT);
              if (id === "boss") b.lockT = Math.max(b.lockT, stT);
              else if (!id.startsWith("t") && !id.startsWith("b")) hitPeer(id, 0, true, stT);
            }
            tp.stunIds = new Set(tp.pendingStun);
            tp.stunUntil = stT;
            tp.pendingStun.clear();
            G.shake = Math.max(G.shake, 0.3);
            if (NET.online) sendNet("vfx", { k: "tp", phase: "done", m: tp.m ? 1 : 0, x: p.x, y: p.y, z: p.z, ct: 0, cm: 0.7 });
          }
        }
      }
      if (tp.active && !tpRemote && NET.online && performance.now() - lastTpVfx.current > 80) {
        lastTpVfx.current = performance.now();
        const src = tp.phase === "fly" ? tp.pos : tp.target;
        sendNet("vfx", { k: "tp", phase: tp.phase, m: tp.m ? 1 : 0, x: src.x, y: src.y, z: src.z, ct: tp.chargeT, cm: tp.chargeMax });
      }
    }

    // Burn DoT: 3 dmg / 0.1s when target moves; bots burn too; +2 hit buff while any burn active
    if (G.burnBuff > 0 && !offlinePaused) {
      G.burnBuff = Math.max(0, G.burnBuff - dt);
    }
    for (const [id, br] of [...burns.current.entries()]) {
      if (offlinePaused) continue;
      br.t -= dt;
      if (br.t <= 0) { burns.current.delete(id); continue; }
      if (id.startsWith("t")) {
        const ti = +id.slice(1);
        const tb = tables[ti];
        if (!tb?.alive) { burns.current.delete(id); continue; }
        const moved = Math.hypot(tb.pos.x - br.lx, tb.pos.y - br.ly, tb.pos.z - br.lz) > 0.2;
        br.lx = tb.pos.x; br.ly = tb.pos.y; br.lz = tb.pos.z;
        if (moved) {
          br.acc += dt;
          if (br.acc >= 0.1) { br.acc -= 0.1; hitTable(tb, 3); }
        }
        continue;
      }
      if (id.startsWith("b") && id !== "boss") {
        const bi = +id.slice(1);
        const u = blues[bi];
        if (!u?.alive) { burns.current.delete(id); continue; }
        const moved = Math.hypot(u.pos.x - br.lx, u.pos.z - br.lz) > 0.2;
        br.lx = u.pos.x; br.lz = u.pos.z;
        if (moved) {
          br.acc += dt;
          if (br.acc >= 0.1) { br.acc -= 0.1; hitBlue(u, 3); }
        }
        continue;
      }
      if (id === "boss") {
        if (!bossLive()) { burns.current.delete(id); continue; }
        const moved = Math.hypot(b.pos.x - br.lx, b.pos.z - br.lz) > 0.3;
        br.lx = b.pos.x; br.lz = b.pos.z;
        if (moved) {
          br.acc += dt;
          if (br.acc >= 0.1) { br.acc -= 0.1; hitBoss(1); }
        }
        continue;
      }
      const pr = NET.peers.get(id);
      if (!pr || pr.dead) { burns.current.delete(id); continue; }
      const moved = Math.hypot(pr.x - br.lx, pr.y - br.ly, pr.z - br.lz) > 0.15;
      br.lx = pr.x; br.ly = pr.y; br.lz = pr.z;
      if (moved) {
        br.acc += dt;
        if (br.acc >= 0.1) {
          br.acc -= 0.1;
          hitPeer(id, 3, false);
          noteDmg(3, id, pr.x, pr.y + 2, pr.z);
        }
      }
    }


    // World/enemy sim keeps running even when local player is dead (host must keep boss moving)
    const active = G.phase === "playing" && engaged && !G.frozen && G.countdown <= 0.6;
    const canControl = active && !G.pvpDead && !G.campaignDead && !freecamOn;

    // --- 1v1 storm: 60s into a round a wall closes in from the arena edge at 30 u/s ---
    {
      const stormLive = G.mode === "pvp" && NET.stage === "playing" && G.time >= STORM_START && !G.pvpDead;
      G.stormR = stormLive ? Math.max(0, R - STORM_SPEED * (G.time - STORM_START)) : 0;
      const inside = stormLive && Math.hypot(p.x, p.z) > G.stormR;
      G.inStorm = inside;
      if (active && inside && !G.frozen) {
        stormAcc.current += dt;
        while (stormAcc.current >= STORM_TICK) {
          stormAcc.current -= STORM_TICK;
          damagePlayer(STORM_DMG, true, true);
          playSfx("storm_tick");
        }
      } else stormAcc.current = 0;
      // grey-and-white world while standing in the storm
      if (stormGrey.current !== inside) {
        stormGrey.current = inside;
        gl.domElement.style.filter = inside ? "grayscale(1) brightness(1.25) contrast(0.8)" : "";
        gl.domElement.style.transition = "filter 0.4s";
      }
      const sm = stormMesh.current;
      if (sm) {
        sm.visible = stormLive && G.stormR > 0.5;
        if (sm.visible) sm.scale.set(G.stormR, 1, G.stormR);
      }
    }

    // --- sound effects that are easiest to detect as state changes ---
    {
      const sp = sfxPrev.current;
      const live = G.phase === "playing" && !G.userPaused;
      if (live) {
        if (G.reloading > 0 && sp.reload <= 0) playSfx("reload");
        if (G.stun > 0 && sp.stun <= 0) playSfx("stun");
        const dead = G.pvpDead || G.campaignDead;
        if (dead && !sp.dead) playSfx("death");
        if (!dead && sp.dead) playSfx("respawn");
        sp.dead = dead;
        // countdown 3 · 2 · 1 · GO
        if (G.countdown > 0.6) {
          const n = Math.ceil(G.countdown - 0.6);
          if (n !== sp.count && n >= 1) playSfx("countdown_tick");
          sp.count = n;
        } else if (sp.count > 0) { playSfx("countdown_go"); sp.count = 0; }
        // a parry window that ran out without catching anything
        if (sp.parryWin > 0 && G.parryWin <= 0 && G.buff <= 0 && G.parries === sp.parries) playSfxShared("parry_fail");
        // landing after a real fall (slam landings have their own sound)
        const gr = grounded.current;
        if (gr && !sp.grounded && sp.airT > 0.35 && bounce.current.t <= 0) playSfxShared("land");
        sp.airT = gr ? 0 : sp.airT + dt;
        sp.grounded = gr;
      }
      for (const pr of NET.peers.values()) {
        const was = sp.peerDead.get(pr.id) ?? false;
        if (pr.dead && !was && live && (G.mode === "pvp" || NET.kind === "lobby")) playSfx("kill", nearGain(pr.x, pr.y, pr.z));
        sp.peerDead.set(pr.id, !!pr.dead);
      }
      sp.reload = G.reloading; sp.stun = G.stun; sp.parryWin = G.parryWin; sp.parries = G.parries;
      setLoop("wallrun", live && G.wallrun && !G.freecam);
      setLoop("storm_loop", live && G.inStorm);
    }
    G.hitFlash = Math.max(0, G.hitFlash - dt);
    G.hurtFlash = Math.max(0, G.hurtFlash - dt);
    G.parryFlash = Math.max(0, G.parryFlash - dt);
    G.redFlash = Math.max(0, G.redFlash - dt);

    if (active) {
      if (G.mode !== "tutorial") G.time += dt;


      G.parryWin = Math.max(0, G.parryWin - dt);
      G.parryCd = Math.max(0, G.parryCd - dt);
      G.buff = Math.max(0, G.buff - dt);
      G.dashCd = Math.max(0, G.dashCd - dt);
      G.bombCd = Math.max(0, G.bombCd - dt);
      G.stun = Math.max(0, G.stun - dt);
      G.bombBig = Math.max(0, G.bombBig - dt);
      G.compromisedT = Math.max(0, G.compromisedT - dt);
      G.respawnMsg = Math.max(0, G.respawnMsg - dt);
      if (G.lobbyRespawnT > 0) {
        G.lobbyRespawnT = Math.max(0, G.lobbyRespawnT - dt);
        G.respawnMsg = G.lobbyRespawnT;
        if (G.lobbyRespawnT <= 0 && G.pvpDead && NET.kind === "lobby") {
          G.pvpDead = false;
          G.freecam = false;
          G.freecamSpeedIdx = 0;
          G.playerHp = cfg.maxHp();
          pos.current.copy(START);
          hv.current.set(0, 0, 0);
          vy.current = 0;
          grounded.current = true;
          G.respawnToken++;
        }
      }
      G.slamCd = Math.max(0, G.slamCd - dt);
      bunnyHop.current = Math.max(0, bunnyHop.current - dt);
      bounce.current.t = Math.max(0, bounce.current.t - dt);
      G.bounceWin = bounce.current.t;
      if (G.parryLocked) G.parryWin = 0;
      const stunned = G.stun > 0;
      const buffed = G.buff > 0;

      // --- camera-locked velocity (adaptive lag: slow = instant, fast = slight lag) ---
      const yaw = new THREE.Euler().setFromQuaternion(cam.quaternion, "YXZ").y;
      const v = hv.current;
      pendingYaw.current += wrap(yaw - lastYaw.current);
      lastYaw.current = yaw;
      if (G.grappling) pendingYaw.current = 0;
      else {
        const rate = THREE.MathUtils.clamp(700 / (v.length() + 5), 3, 40);
        const apply = pendingYaw.current * (1 - Math.exp(-rate * dt));
        v.applyAxisAngle(UP, apply);
        pendingYaw.current -= apply;
      }

      const f = new THREE.Vector3();
      cam.getWorldDirection(f);
      f.y = 0;
      f.normalize();
      const rgt = new THREE.Vector3(-f.z, 0, f.x);
      const wish = new THREE.Vector3();
      const k = keys.current;
      if (k[SETTINGS.keys.forward]) wish.add(f);
      if (k[SETTINGS.keys.back]) wish.sub(f);
      if (k[SETTINGS.keys.right]) wish.add(rgt);
      if (k[SETTINGS.keys.left]) wish.sub(rgt);
      if (stunned || freecamOn) wish.set(0, 0, 0);
      if (wish.lengthSq()) wish.normalize();
      const space = !!k[SETTINGS.keys.jump];

      if (G.wallrun) {
        const n = space ? wallNormal(p) : null;
        wallrunTime.current = Math.max(0, wallrunTime.current - dt);
        G.wallrunTime = wallrunTime.current;
        if (!n || wallrunTime.current <= 0) {
          G.wallrun = false;
          if (wallrunTime.current <= 0) G.wallrunReady = false;
        }
        else {
          const spd = v.length();
          v.addScaledVector(n, -v.dot(n));
          if (v.lengthSq() > 1e-4) v.setLength(spd);
          vy.current = 0;
        }
      }
      if (!G.wallrun) {
        if (grounded.current && !G.grappling) {
          if (space && !stunned) {
            vy.current = JUMP_V;
            playSfxShared("jump");
            grounded.current = false;
          } else {
            const spd = (G.scoped ? SPEED * 0.55 : SPEED) * (G.abilitySlow > 0 ? 0.5 : 1);
            v.lerp(wish.clone().multiplyScalar(spd), 1 - Math.exp(-10 * dt));
          }
        } else {
          const prev = v.length();
          v.addScaledVector(wish, AIR_ACCEL * dt);
          const cap = Math.max(prev, SPEED);
          if (v.length() > cap) v.setLength(cap);
          vy.current -= GRAVITY * dt;
          if (space && !grounded.current && G.wallrunReady && wallrunTime.current > 0 && wallNormal(p)) {
            G.wallrun = true;
            vy.current = 0;
          }
        }
      }

      // --- grapple spring swing ---
      if (G.grappling) {
        // If anchored wall/pad despawned, release like letting go
        if (grappleOnWall.current >= 0 && (!abilityWalls[grappleOnWall.current]?.active || abilityWalls[grappleOnWall.current]!.ret)) {
          G.grappling = false; grappleOnWall.current = -1; grappleOnPad.current = -1;
        } else if (grappleOnPad.current >= 0 && !abilityPads[grappleOnPad.current]?.active) {
          G.grappling = false; grappleOnWall.current = -1; grappleOnPad.current = -1;
        } else if (grappleOnPad.current >= 0) {
          // Pull straight to trampoline, ignore other velocity; launch on touch
          const pad = abilityPads[grappleOnPad.current]!;
          const target = tmpV.set(pad.cx, pad.cy, pad.cz);
          const c = p.clone().setY(p.y + EYE * 0.6);
          const to = target.clone().sub(c);
          const dist = to.length();
          if (dist < 5.5) {
            // Touch → rope gone, trampoline launches
            G.grappling = false;
            grappleOnPad.current = -1;
            grappleOnWall.current = -1;
            const n = tmpV.set(pad.nx, pad.ny, pad.nz).normalize();
            const speed3 = Math.hypot(hv.current.x, vy.current, hv.current.z);
            const launch = Math.max(200, speed3);
            hv.current.set(n.x * launch, 0, n.z * launch);
            vy.current = n.y * launch;
            if (Math.abs(n.y) < 0.2) vy.current = Math.max(vy.current, 40);
            grounded.current = false;
            pad.cd = 0.4;
          } else {
            const n = to.normalize();
            const pull = Math.min(280, 80 + dist * 4);
            hv.current.set(n.x * pull, 0, n.z * pull);
            vy.current = n.y * pull;
            grounded.current = false;
            anchor.current.copy(target);
          }
        } else {
          const c = p.clone().setY(p.y + EYE * 0.6);
          const d = anchor.current.clone().sub(c);
          const dist = d.length();
          ropeLen.current = Math.max(6, ropeLen.current - 8 * dt);
          if (dist > ropeLen.current && dist > 1e-3) {
            const n = d.divideScalar(dist);
            const v3 = new THREE.Vector3(v.x, vy.current, v.z);
            const vr = v3.dot(n);
            if (vr < 0) v3.addScaledVector(n, -vr * (1 - Math.exp(-12 * dt)));
            v3.addScaledVector(n, GRAPPLE_K * (dist - ropeLen.current) * dt);
            v3.multiplyScalar(Math.exp(-0.15 * dt));
            v.set(v3.x, 0, v3.z);
            vy.current = v3.y;
            if (vy.current > 0) grounded.current = false;
          }
        }
      }
      if (v.length() > MAX_HSPEED) v.setLength(MAX_HSPEED);
      if (slam.current.on) {
        // ground pound: straight down at 2x bot-bullet speed
        v.set(0, 0, 0);
        vy.current = -SLAM_SPEED;
        G.wallrun = false;
        G.grappling = false;
      }

      // --- integrate + collide (substep when fast so we don't clip walls/solids) ---
      const speed3 = Math.hypot(v.x, vy.current, v.z);
      const subN = speed3 > 80 ? Math.min(24, Math.max(3, Math.ceil(speed3 * dt / 3))) : 1;
      const sdt = dt / subN;
      for (let si = 0; si < subN; si++) {
        const prevY = p.y;
        p.addScaledVector(v, sdt);
        p.y += vy.current * sdt;
        for (const s of SOLIDS) {
          if (vy.current > 0 && prevY + BODY_H <= s.y0 + 0.01 && p.y + BODY_H > s.y0 && overlapXZ(p, s, PLAYER_R * 0.7)) {
            p.y = s.y0 - BODY_H;
            vy.current = 0;
          }
        }
        for (const s of SOLIDS) if (p.y < s.y1 - STEP && p.y + BODY_H > s.y0) pushOut(p, s, PLAYER_R);
        for (const w of abilityWalls) {
          if (!w.active || w.ret) continue;
          const before = p.clone();
          if (pushOutOriented(p, w.cx, w.cy, w.cz, w.yaw, w.pitch, w.hw, w.hh, w.hd, PLAYER_R * 1.15)) {
            // Kill velocity into the wall so high-speed substeps can't tunnel
            const push = tmpV.subVectors(p, before);
            if (push.lengthSq() > 1e-8) {
              push.normalize();
              // remove only the velocity heading INTO the wall (all three axes together). The old per-axis version
              // doubled the upward speed when you hit the underside of a wall — that was the big bounce.
              const into = hv.current.x * push.x + vy.current * push.y + hv.current.z * push.z;
              if (into < 0) {
                hv.current.x -= into * push.x;
                hv.current.z -= into * push.z;
                vy.current -= into * push.y;
              }
            }
          }
        }
        // Trampoline pads are intentionally NOT solid: you pass into them and get launched by the bounce trigger below.
      }
      // support surfaces after substeps
      const prevY = p.y;
      let sup = 0;
      for (const s of SOLIDS) if (s.y1 <= Math.max(prevY, p.y) + STEP && overlapXZ(p, s, PLAYER_R * 0.5)) sup = Math.max(sup, s.y1);
      if (vy.current <= 0 && p.y <= sup + 0.001) {
        p.y = sup;
        if (vy.current < 0) vy.current = 0;
        if (slam.current.on) {
          slam.current.on = false;
          G.slamming = false;
          playSfxShared("slam_land");
          const tier = SLAM_TIERS.findIndex((q) => slam.current.h < q.maxH);
          const q = SLAM_TIERS[tier]!;
          const r = q.d / 2;
          for (const t of tables) if (t.alive && Math.hypot(t.pos.x - p.x, t.pos.z - p.z) < r + 3 * t.s && t.pos.y < p.y + r) hitTable(t, q.dmg);
          for (const u of blues) {
            if (!u.alive || Math.hypot(u.pos.x - p.x, u.pos.z - p.z) >= r + 3 * TABLE_S) continue;
            hitBlue(u, q.dmg);
          }
          if (bossLive() && b.landed && distToBossBox(tmpV.copy(p).setY(p.y + 1)) < r) {
            hitBoss(Math.round(q.dmg / DMG));
            if (tier === SLAM_TIERS.length - 1) b.lockT = 2; // next boss attack waits 2s
          }
          pvpBlast(_pvpAt.copy(p).setY(p.y + 0.5), r, PVP_DMG.slam, true);
          if (tier === SLAM_TIERS.length - 1) addWave(p.x, p.z, true);
          ringsIn(p, r);
          boomFx(tmpV.copy(p).setY(p.y + 0.5), r, 0.4, true, "none");
          // Surface under feet: couch → bounce, no crack; raised solid → dark crack; floor → normal crack
          {
            let couch = false;
            let solidY = 0;
            let onSolid = false;
            for (const s of SOLIDS) {
              if (p.y > s.y1 + 0.35 || p.y < s.y1 - 1.2) continue;
              if (!overlapXZ(p, s, PLAYER_R * 0.7)) continue;
              if (s.couch) { couch = true; break; }
              if (s.y1 > 0.5) { onSolid = true; solidY = s.y1; }
            }
            if (couch) {
              // Soft furniture: bounce up, no crack
              vy.current = Math.max(vy.current, JUMP_V * 1.15);
              grounded.current = false;
            } else {
              const cy = onSolid ? solidY : 0;
              spawnSlamCrack(p.x, cy, p.z, onSolid);
              if (NET.online) sendNet("vfx", { k: "crack", x: p.x, y: cy, z: p.z, dark: onSolid ? 1 : 0 });
            }
          }
          G.slamCd = cfg.slamCd(q.cd);
          G.shake = Math.max(G.shake, 0.3 + tier * 0.2);
          bounce.current.t = BOUNCE_WIN;
          bounce.current.y = slam.current.fromY;
        }
        if (!grounded.current) {
          grounded.current = true;
          G.wallrun = false;
          G.airJumps = cfg.airJumps();
          G.airDashes = cfg.airDashes();
          // Auto bunny-hop from dash window (does not spend air jumps)
          if (bunnyHop.current > 0 && SETTINGS.autoBunnyHop !== false) {
            vy.current = JUMP_V;
            grounded.current = false;
            bunnyHop.current = 0;
          }
        }
      } else if (grounded.current && p.y > sup + 0.05) grounded.current = false;
      if (grounded.current) {
        if (!G.wallrunReady) {
          wallrunRecharge.current = Math.max(0, wallrunRecharge.current - dt);
          if (wallrunRecharge.current <= 0) {
            wallrunTime.current = WALLRUN_TIME;
            wallrunRecharge.current = cfg.wallrunCd(WALLRUN_RECHARGE);
            G.wallrunReady = true;
          }
        }
      } else if (!G.wallrunReady) wallrunRecharge.current = Math.max(wallrunRecharge.current, cfg.wallrunCd(WALLRUN_RECHARGE));
      G.wallrunTime = wallrunTime.current;
      G.wallrunRecharge = wallrunRecharge.current;
      G.grounded = grounded.current;
      for (const s of SOLIDS) if (p.y < s.y1 - STEP && p.y + BODY_H > s.y0) pushOut(p, s, PLAYER_R);
      clampCircle(p, PLAYER_R);
      if (p.y > ROOM.h - BODY_H - 1) {
        p.y = ROOM.h - BODY_H - 1;
        if (vy.current > 0) vy.current = 0;
      }
      G.speed = v.length();
      G.altitude = Math.max(0, p.y) / WORLD_UNITS_PER_METER;
      const slamTier = SLAM_TIERS.find((tier) => p.y - sup < tier.maxH) ?? SLAM_TIERS[SLAM_TIERS.length - 1]!;
      G.slamAoe = slamTier.d / WORLD_UNITS_PER_METER;
      G.shake = Math.max(0, G.shake - dt * 1.5);
      if (!freecamOn) {
        cam.position.set(p.x, p.y + EYE, p.z);
        if (G.shake > 0 && SETTINGS.screenShake) cam.position.add(tmpV.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(G.shake * 2));
      }

      recentPos.current.push({ t: G.time, p: p.clone() });
      while (recentPos.current.length > 1 && recentPos.current[0]!.t < G.time - 0.4) recentPos.current.shift();

      // --- reload / fire ---
      if (G.reloading > 0) {
        G.reloading -= dt;
        if (G.reloading <= 0) {
          G.reloading = 0;
          G.ammo = MAG;
        }
      }
      fireT.current -= dt;
      if (G.firing && !stunned && (buffed || (G.ammo > 0 && G.reloading <= 0)) && fireT.current <= 0) {
        fireT.current = buffed ? FIRE_INTERVAL / 3 : FIRE_INTERVAL;
        if (!buffed) G.ammo--;
        G.shots++;
        playSfx("shoot");
        const dir = new THREE.Vector3();
        cam.getWorldDirection(dir);
        const spread = G.scoped ? 0.004 : 0.025;
        dir.x += (Math.random() - 0.5) * spread;
        dir.y += (Math.random() - 0.5) * spread;
        dir.z += (Math.random() - 0.5) * spread;
        dir.normalize();
        const start = cam.position.clone().addScaledVector(dir, 1).add(new THREE.Vector3(0, -0.3, 0));
        const bvel = dir.multiplyScalar(BULLET_SPEED);
        spawnBullet(playerPool, start, bvel, buffed ? DMG * 2 : DMG, 0.4);
        if (NET.online) sendNet("vfx", { k: "bullet", x: start.x, y: start.y, z: start.z, vx: bvel.x, vy: bvel.y, vz: bvel.z, life: 0.4 });
        if (!buffed && G.ammo === 0) G.reloading = 1.5;
      }

      // --- tables AI (followers mirror the host's tables instead) ---
      for (let ti = 0; ti < tables.length; ti++) {
        const t = tables[ti]!;
        if (!t.alive || follower) continue;
        if ((abilityStun.current.get(`t${ti}`) ?? 0) > 0) continue; // teleport/ability stun
        const bp = t.pos;
        const speed = (5 + (1 - t.hp / t.maxHp) * 9) * 4;
        const toT = tmpV.copy(t.target).sub(bp).setY(0);
        if (toT.length() < 4) t.target.copy(randomFloor(bp));
        else bp.addScaledVector(toT.normalize(), speed * dt);
        t.dashT -= dt;
        if (t.dashT <= 0) {
          t.dashT = 2.5 + Math.random() * 3;
          const a = Math.random() * Math.PI * 2;
          t.dash.set(Math.cos(a), 0, Math.sin(a)).multiplyScalar(90);
        }
        bp.addScaledVector(t.dash, dt);
        t.dash.multiplyScalar(Math.exp(-3 * dt));
        t.jumpT -= dt;
        if (t.jumpT <= 0 && bp.y <= 0) {
          t.jumpsLeft = 1 + Math.floor(Math.random() * 3);
          t.jumpT = 3 + Math.random() * 3;
        }
        if (t.jumpsLeft > 0 && (bp.y <= 0 || t.vy < 0)) {
          t.vy = JUMP_V;
          t.jumpsLeft--;
        }
        t.vy -= GRAVITY * dt;
        bp.y = Math.max(0, bp.y + t.vy * dt);
        if (bp.y <= 0 && t.vy < 0) t.vy = 0;
        const target = TABLE_S * (0.55 + 0.45 * Math.min(1, t.hp / t.maxHp));
        t.s = THREE.MathUtils.lerp(t.s, target, 1 - Math.exp(-8 * dt));
        for (const s of SOLIDS) if (s.y0 < 5 && bp.y < s.y1) pushOut(bp, s, 3 * t.s);
        clampCircle(bp, 3 * t.s);
        t.bob += dt * speed * 0.35;
        const tgt = nearest(tmpV2.copy(bp).setY(bp.y + 3.2 * t.s)).at;
        t.yaw = Math.atan2(tgt.x - bp.x, tgt.z - bp.z);
        t.shootT -= dt;
        if (t.shootT <= 0 && !t.passive) {
          t.shootT = 0.45 + Math.random() * 0.4;
          const from = bp.clone().setY(bp.y + 3.2 * t.s);
          if (from.distanceTo(tgt) < 380) {
            const aim = tgt.clone().setY(tgt.y - 0.5).sub(from).normalize();
            aim.x += (Math.random() - 0.5) * 0.05;
            aim.y += (Math.random() - 0.5) * 0.03;
            enemyShot(from, aim.normalize().multiplyScalar(t.summoned ? BOT_BULLET_SPEED * 0.5 : BOT_BULLET_SPEED), DMG, t.summoned ? 4 : 2);
          }
        }
      }

      // --- boss ---
      if (follower) { /* host runs the boss */ } else if (G.stage === "incoming") {
        G.bossWarn -= dt;
        if (G.bossWarn <= 0) {
          G.stage = "boss";
          b.y = ROOM.h - 30;
          b.vy = -350;
          b.landed = false;
          b.pos.set(0, 0, 0);
        }
      } else if (G.stage === "boss") {
        G.bossTime += dt;
        // Offline campaign: no health rings (removed). Party campaign uses shards instead.
        for (const h of health) if (h.active && !h.isShard && (h.t -= dt) <= 0) h.active = false;
        if (G.bossTime >= PARRY_LOCK_AT && !G.parryLocked) {
          G.parryLocked = true;
          G.parryWin = 0;
          G.compromisedT = 3;
          // Campaign only (not training/lobby): strip abilities too
          if (G.mode === "game") {
            G.abilityLocked = true;
            abilityReq.current = false;
          }
        }
        if (!b.landed) {
          b.y += b.vy * dt;
          if (b.y <= 0) {
            b.y = 0;
            b.landed = true;
            G.shake = 1;
            addWave(b.pos.x, b.pos.z);
            if (Math.hypot(p.x, p.z) < BOSS_ZONE && p.y < 30) damagePlayer(9999, true);
          }
        } else {
          const chargingStomp = hazards.some((h) => h.active && h.kind === "stomp" && h.t > 0);
          const chase = nearest(b.pos).at;
          const toP = tmpV.set(chase.x - b.pos.x, 0, chase.z - b.pos.z);
          if (!chargingStomp && toP.length() > 40) b.pos.addScaledVector(toP.normalize(), 12 * dt);
          clampCircle(b.pos, 25);
          if (!chargingStomp) b.yaw = Math.atan2(chase.x - b.pos.x, chase.z - b.pos.z);
          b.bulletT -= dt;
          if (b.bulletT <= 0) {
            b.bulletT = 1 * cfg.bossCdK();
            const from = new THREE.Vector3(b.pos.x, 3.4 * BOSS_S, b.pos.z);
            const bt = nearest(from).at;
            const aim = bt.clone().setY(bt.y - 0.5).sub(from).normalize();
            enemyShot(from, aim.multiplyScalar(BOT_BULLET_SPEED), BOSS_BULLET_DMG, 3);
          }
          const bossAtk = b.lockT <= 0;
          b.lockT = Math.max(0, b.lockT - dt);
          if (bossAtk) b.specialT -= dt;
          if (b.specialT <= 0) {
            if (b.next === "sword") {
              const rp = recentPos.current[0]?.p ?? p;
              addHazard("sword", rp.x, rp.z, 0.5);
              b.specialT = 1.5 * cfg.bossCdK();
            } else {
              addHazard("stomp", b.pos.x, b.pos.z, 1);
              b.specialT = 2 * cfg.bossCdK();
            }
            b.next = b.next === "sword" ? "stomp" : "sword";
          }
          if (bossAtk) b.quarterT -= dt;
          if (b.quarterT <= 0) {
            b.quarterT = 4 * cfg.bossCdK();
            addHazard("quarter", 0, 0, 2.5);
          }
          blueT.current -= dt;
          if (blueT.current <= 0) {
            blueT.current = 6 * cfg.bossCdK();
            for (let k = 0; k < 2; k++) {
              const u = blues.find((x) => !x.alive);
              if (!u) break;
              Object.assign(u, { alive: true, hp: G.mode === "training" ? TRAIN.blueHp : BLUE_HP, hitCd: 0, dashT: 6 + Math.random() * 8 });
              const a = Math.random() * Math.PI * 2;
              u.pos.set(b.pos.x + Math.cos(a) * (BOSS_S * 4), 0, b.pos.z + Math.sin(a) * (BOSS_S * 4));
              clampCircle(u.pos, 3 * TABLE_S);
              u.dash.set(0, 0, 0);
            }
          }
          summonT.current -= dt;
          if (summonT.current <= 0) {
            summonT.current = 10 * cfg.bossCdK();
            for (let k = 0; k < 2; k++) {
              const a = Math.random() * Math.PI * 2;
              const at = new THREE.Vector3(b.pos.x + Math.cos(a) * (BOSS_S * 4.5), 0, b.pos.z + Math.sin(a) * (BOSS_S * 4.5));
              clampCircle(at, 3 * TABLE_S);
              spawnTable(at, true);
            }
          }
          if (bossAtk) b.aoeT -= dt;
          if (b.aoeT <= 0) {
            b.aoeT = 7 * cfg.bossCdK();
            addHazard("aoe", p.x, p.z, 3);
          }
        }
      }

      // Collect health rings in boss fight or 1v1; never exceed full health.
      if (G.stage === "boss" || (G.mode === "pvp" && NET.stage === "playing")) {
        for (const h of health) {
          if (!h.active || h.isShard || p.y >= 8) continue;
          const hr = HEALTH_R;
          if (Math.hypot(p.x - h.pos.x, p.z - h.pos.z) < hr) collectRing(h);
        }
      }
      // Party shards still collected via collectRing path when isShard
      if (sharesEnemies() && G.mode === "game") {
        for (const h of health) {
          if (!h.active || !h.isShard || p.y >= 8) continue;
          if (Math.hypot(p.x - h.pos.x, p.z - h.pos.z) < SHARD_R) collectRing(h);
        }
      }

      // --- blue chaser tables ---
      for (let bi = 0; bi < blues.length; bi++) {
        const u = blues[bi]!;
        if (!u.alive || follower) continue;
        if ((abilityStun.current.get(`b${bi}`) ?? 0) > 0) continue; // teleport stun freeze
        // chase the closest player
        let cx = p.x, cz = p.z, cid: string | null = null, cd = Math.hypot(p.x - u.pos.x, p.z - u.pos.z);
        if (sharesEnemies()) for (const pr of NET.peers.values()) {
          if (pr.id === myId() || pr.dead) continue;
          const dd = Math.hypot(pr.x - u.pos.x, pr.z - u.pos.z);
          if (dd < cd) { cd = dd; cx = pr.x; cz = pr.z; cid = pr.id; }
        }
        if (cid) {
          u.pos.addScaledVector(tmpV.set(cx - u.pos.x, 0, cz - u.pos.z).normalize(), BLUE_SPEED * dt);
          u.yaw = Math.atan2(cx - u.pos.x, cz - u.pos.z);
          clampCircle(u.pos, 3 * TABLE_S);
          if (cd < 3 * TABLE_S + PLAYER_R + 1) { enemyHitPeer(cid, 2); u.alive = false; burst(tmpV.copy(u.pos).setY(4), TABLE_S, 5); }
          continue;
        }
        const toP = tmpV.set(p.x - u.pos.x, 0, p.z - u.pos.z);
        const d = toP.length();
        if (d > 0.1) u.pos.addScaledVector(toP.normalize(), BLUE_SPEED * dt);
        u.yaw = Math.atan2(p.x - u.pos.x, p.z - u.pos.z);
        u.dashT -= dt;
        if (u.dashT <= 0) {
          u.dashT = 10 + Math.random() * 10;
          u.dash.set(p.x - u.pos.x, 0, p.z - u.pos.z).normalize().multiplyScalar(BLUE_DASH);
        }
        u.pos.addScaledVector(u.dash, dt);
        u.dash.multiplyScalar(Math.exp(-3 * dt));
        for (const s of SOLIDS) if (s.y0 < 5) pushOut(u.pos, s, 3 * TABLE_S);
        clampCircle(u.pos, 3 * TABLE_S);
        u.hitCd = Math.max(0, u.hitCd - dt);
        if (d < 3 * TABLE_S + PLAYER_R + 1 && p.y < 6 && u.hitCd <= 0) {
          u.hitCd = 0.5;
          damagePlayer(2);
          u.alive = false;
          burst(tmpV.copy(u.pos).setY(4), TABLE_S, 5);
        }
      }

      // --- hazards ---
      for (const h of hazards) {
        if (!h.active) continue;
        if (h.t > 0) {
          h.t -= dt;
          if (h.t <= 0) {
            h.fx = 0.5;
            if (h.kind === "quarter") {
              const inQuarter = (x: number, z: number) => {
                const ang = (Math.atan2(-z, x) - h.a0 + Math.PI * 4) % (Math.PI * 2);
                return Math.hypot(x, z) <= R && ang <= Math.PI / 2;
              };
              if (h.owner !== "player" && inQuarter(p.x, p.z)) damagePlayer(h.dmg ?? BIG_DMG);
              for (const t of tables) if (t.alive && inQuarter(t.pos.x, t.pos.z)) hitTable(t, h.dmg ?? BIG_DMG);
              for (const u of blues) if (u.alive && inQuarter(u.pos.x, u.pos.z)) hitBlue(u, h.dmg ?? BIG_DMG);
              if (NET.online && (NET.kind === "pvp" || NET.kind === "lobby")) {
                for (const peer of NET.peers.values()) if (!peer.dead && inQuarter(peer.x, peer.z)) hitPeer(peer.id, h.dmg ?? BIG_DMG);
              }
            } else if (h.kind === "sword") {
              if (Math.hypot(p.x - h.x, p.z - h.z) < SWORD_R && p.y < 40) {
                G.stun = STUN_TIME;
                G.hurtFlash = 0.25;
              }
              G.bombBig = BOMB_BIG_TIME;
              G.shake = Math.max(G.shake, 0.4);
            } else if (h.kind === "stomp") {
              addWave(b.pos.x, b.pos.z);
              G.shake = Math.max(G.shake, 0.8);
            } else {
              if (Math.hypot(p.x - h.x, p.z - h.z) < AOE_R) damagePlayer(AOE_DMG);
              const bm = booms.find((x) => x.t <= 0) ?? booms[0]!;
              bm.t = 0.5;
              bm.pos.set(h.x, 0, h.z);
              bm.r = AOE_R;
              G.shake = Math.max(G.shake, 0.6);
            }
          }
        } else {
          h.fx -= dt;
          if (h.fx <= 0) h.active = false;
        }
      }

      // --- bomb (sub-stepped continuous collision) ---
      const bm = bomb.current;
      if (bm.alive) {
        const travel = bm.vel.length() * dt;
        const n = Math.ceil(travel / 1.5);
        const stepV = bm.vel.clone().multiplyScalar(dt / n);
        for (let i = 0; i < n && bm.alive; i++) {
          bm.pos.add(stepV);
          const q = bm.pos;
          let hit = q.y <= 0.3 || q.y >= ROOM.h || Math.hypot(q.x, q.z) >= R - 0.5 || inSolid(q);
          if (!hit) hit = tables.some((t) => t.alive && q.distanceTo(tmpV.copy(t.pos).setY(t.pos.y + 2.6 * t.s)) < 3.4 * t.s);
          if (!hit && bossLive()) {
            bossBox(_mn, _mx);
            hit = q.x > _mn.x && q.x < _mx.x && q.y > _mn.y && q.y < _mx.y && q.z > _mn.z && q.z < _mx.z;
          }
          if (hit) {
            bm.alive = false;
            if (NET.online && bm.netId) sendNet("vfx", { k: "bombend", id: bm.netId });
            explode(q.clone(), bm.tele ?? undefined);
            bm.tele = null;
          }
        }
      }

      // --- boss landing shockwaves (jump over them) ---
      for (const w of waves) {
        if (!w.active) continue;
        const r0 = w.r;
        w.r += WAVE_SPEED * dt;
        if (w.r > R * 2) { w.active = false; continue; }
        const d = Math.hypot(p.x - w.x, p.z - w.z);
        if (!w.stunOnly && !w.hit && d >= r0 - PLAYER_R - 1 && d <= w.r + PLAYER_R + 1 && p.y < WAVE_H) {
          w.hit = true;
          damagePlayer(G.mode === "game" ? 40 : WAVE_DMG);
        }
        if (w.stunOnly) {
          // Freeze training bots as well as networked opponents when the ring crosses them.
          for (let ti = 0; ti < tables.length; ti++) {
            const t = tables[ti]!;
            const id = `t${ti}`;
            const td = Math.hypot(t.pos.x - w.x, t.pos.z - w.z);
            if (t.alive && !w.hitPeers.has(id) && td >= r0 - 2 && td <= w.r + 2 && t.pos.y < WAVE_H) {
              w.hitPeers.add(id);
              abilityStun.current.set(id, 3);
            }
          }
          for (let bi = 0; bi < blues.length; bi++) {
            const u = blues[bi]!;
            const id = `b${bi}`;
            const bd = Math.hypot(u.pos.x - w.x, u.pos.z - w.z);
            if (u.alive && !w.hitPeers.has(id) && bd >= r0 - 2 && bd <= w.r + 2 && u.pos.y < WAVE_H) {
              w.hitPeers.add(id);
              abilityStun.current.set(id, 3);
            }
          }
          if (NET.online && (NET.kind === "pvp" || NET.kind === "lobby")) {
            for (const peer of NET.peers.values()) {
              if (w.hitPeers.has(peer.id) || peer.dead) continue;
              const pd = Math.hypot(peer.x - w.x, peer.z - w.z);
              if (pd >= r0 - PLAYER_R - 1 && pd <= w.r + PLAYER_R + 1 && peer.y < WAVE_H) {
                w.hitPeers.add(peer.id);
                hitPeer(peer.id, 0, true, 3);
              }
            }
          }
        }
      }

      // --- stage clear check ---
      G.bluesAlive = blues.reduce((n, u) => n + (u.alive ? 1 : 0), 0);
      if (!follower && G.mode === "game" && G.stage === "tables" && G.capReached && aliveCount() === 0 && G.bluesAlive === 0) {
        G.stage = "incoming";
        G.bossWarn = BOSS_WARN;
        G.playerHp = MAX_HP;
      }

      // --- 1v1 health rings: every 10s, last 4s (offline campaign has none) ---
      if (active && G.mode === "pvp" && NET.stage === "playing" && !follower) {
        healthT.current -= dt;
        if (healthT.current <= 0) {
          healthT.current += 10;
          const h = health.find((item) => !item.active) ?? health[Math.floor(Math.random() * health.length)];
          if (h) {
            h.pos.copy(randomFloor(p));
            h.active = true;
            h.t = 4;
            h.isShard = false;
          }
        }
        for (const h of health) if (h.active && !h.isShard && (h.t -= dt) <= 0) h.active = false;
      }

      // --- training: timed spawns ---
      if (G.mode === "training") {
        for (let i = TRAIN_Q.length - 1; i >= 0; i--) {
          const q = TRAIN_Q[i]!;
          q.t -= dt;
          if (q.t <= 0) { TRAIN_Q.splice(i, 1); if (follower) sendNet("espawn", { kind: q.kind, n: q.n }); else trainSpawn(q); }
        }
      }

      // --- tutorial ---
      if (G.mode === "tutorial") {
        const s = G.tutStep;
        if (tutSetup.current !== s) {
          tutSetup.current = s;
          tutDist.current = 0;
          tutKills.current = G.kills;
          tutBlueSpawn.current = 0;
          tables.forEach((t) => (t.alive = false));
          blues.forEach((u) => (u.alive = false));
          botPool.forEach((x) => (x.alive = false));
          G.tut = { enter: false, dashed: false, zoomed: false, bombed: false, slammed: false };
          const ahead = p.clone().addScaledVector(f, 70).setY(0);
          clampCircle(ahead, 20);
          if (s === 7 || s === 8) {
            const t = spawnTable(ahead);
            if (t) t.passive = true;
          }
          if (s === 9) spawnTable(ahead);
          // 10 combo: blues stream (below). 11 abilities: enter only
          if (s === 12) spawnTable(ahead); // Parry — table that shoots
          if (s === 13) for (let i = 0; i < 3; i++) spawnBlue(randomFloor(p));
        }
        if (s === 1 && grounded.current) tutDist.current += v.length() * dt;
        if (s === 9 && aliveCount() === 0) spawnTable(randomFloor(p));
        // Combo step: spawn a blue every 0.5s while alive blues < 20
        if (s === 10) {
          tutBlueSpawn.current -= dt;
          if (tutBlueSpawn.current <= 0) {
            const blueAlive = blues.reduce((n, u) => n + (u.alive ? 1 : 0), 0);
            if (blueAlive < 20) {
              spawnBlue(randomFloor(p));
              tutBlueSpawn.current = 0.5;
            } else {
              tutBlueSpawn.current = 0.15; // re-check soon when one dies
            }
          }
        }
        const alive = blues.some((u) => u.alive);
        const steps = G.onlineTut ? ONLINE_TUT_STEPS : TUT_STEPS;
        // Enter always skips the current step; objectives still advance when completed
        const objectiveDone = G.onlineTut
          ? false
          : [
              false, // 0 intro
              tutDist.current > 40, // 1 move
              G.airJumps === 0, // 2 jump
              G.wallrun, // 3 wallrun
              G.tut.dashed, // 4 dash
              G.tut.slammed || G.slamming || bounce.current.t > 0, // 5 slam
              G.grappling, // 6 grapple
              G.tut.zoomed, // 7 scope
              G.kills > tutKills.current, // 8 brown
              G.tut.bombed, // 9 bombs
              false, // 10 combo
              false, // 11 abilities — Enter only
              G.parries > 0, // 12 parry
              !alive, // 13 blue tables
              false, // 14 boss
              false, // 15 party revives
              false, // 16 freecam
              false, // 17 online modes
            ][s];
        const done = G.tut.enter || !!objectiveDone;
        if (done) {
          G.tut.enter = false;
          if (s >= steps.length - 1) finishTutorial();
          else G.tutStep++;
        }
      }
    }

    // --- shared enemies: host streams, followers mirror ---
    if (sharesEnemies() && G.phase === "playing") {
      if (NET.isHost) {
        const now = performance.now();
        if (now - lastSnap.current > 200) {
          lastSnap.current = now;
          const t: number[] = [], bl: number[] = [];
          tables.forEach((x, i) => { if (x.alive) t.push(i, +x.pos.x.toFixed(1), +x.pos.y.toFixed(1), +x.pos.z.toFixed(1), +x.yaw.toFixed(2), +x.s.toFixed(2)); });
          blues.forEach((u, i) => { if (u.alive) bl.push(i, +u.pos.x.toFixed(1), +u.pos.z.toFixed(1), +u.yaw.toFixed(2)); });
          const bs = G.stage === "boss" ? [b.landed ? 1 : 0, b.y, b.pos.x, b.pos.z, b.yaw] : null;
          sendNet("ents", { t, b: bl, boss: bs, stage: G.stage, bh: G.bossHits, bm: G.bossMax, s: shotQ.splice(0) });
        }
      } else if (snapRef.current) {
        const sn = snapRef.current;
        const k = 1 - Math.exp(-12 * dt);
        const seenT = new Set<number>();
        for (let j = 0; j + 5 < sn.t.length; j += 6) {
          const i = sn.t[j]!, x = tables[i];
          if (!x) continue;
          seenT.add(i);
          if (!x.alive) { x.alive = true; x.passive = true; x.pos.set(sn.t[j + 1]!, sn.t[j + 2]!, sn.t[j + 3]!); }
          x.pos.lerp(tmpV.set(sn.t[j + 1]!, sn.t[j + 2]!, sn.t[j + 3]!), k);
          x.yaw = sn.t[j + 4]!;
          x.s = sn.t[j + 5]!;
          x.bob += dt * 6;
        }
        tables.forEach((x, i) => { if (x.alive && !seenT.has(i)) { x.alive = false; burst(tmpV.copy(x.pos).setY(x.pos.y + 3 * x.s), x.s, 7); } });
        const seenB = new Set<number>();
        for (let j = 0; j + 3 < sn.b.length; j += 4) {
          const i = sn.b[j]!, u = blues[i];
          if (!u) continue;
          seenB.add(i);
          if (!u.alive) { u.alive = true; u.pos.set(sn.b[j + 1]!, 0, sn.b[j + 2]!); }
          u.pos.lerp(tmpV.set(sn.b[j + 1]!, 0, sn.b[j + 2]!), k);
          u.yaw = sn.b[j + 3]!;
        }
        blues.forEach((u, i) => { if (u.alive && !seenB.has(i)) { u.alive = false; burst(tmpV.copy(u.pos).setY(4), TABLE_S, 5); } });
        G.stage = sn.stage as typeof G.stage;
        G.bossHits = sn.bh;
        G.bossMax = sn.bm;
        if (sn.boss) {
          b.landed = !!sn.boss[0];
          b.y = sn.boss[1]!;
          b.pos.lerp(tmpV.set(sn.boss[2]!, 0, sn.boss[3]!), k);
          b.yaw = sn.boss[4]!;
        }
        for (let j = 0; j + 7 < sn.s.length; j += 8) {
          spawnBullet(botPool, tmpV.set(sn.s[j]!, sn.s[j + 1]!, sn.s[j + 2]!), tmpV2.set(sn.s[j + 3]!, sn.s[j + 4]!, sn.s[j + 5]!), sn.s[j + 6]!, sn.s[j + 7]!);
        }
        sn.s = [];
      }
    }

    // --- bullets ---
    const stepPool = (pool: Bullet[], inst: THREE.InstancedMesh | null, isPlayer: boolean) => {
      let n = 0;
      for (const bl of pool) {
        if (!bl.alive) continue;
        if (active) {
          bl.prev.copy(bl.pos);
          bl.pos.addScaledVector(bl.vel, dt);
          bl.life -= dt;
          const tSolid = segSolids(bl.prev, bl.pos);
          // floor + outer wall are solid too
          let tWorld = tSolid;
          if (bl.pos.y <= 0 && bl.prev.y > 0) tWorld = Math.min(tWorld, bl.prev.y / (bl.prev.y - bl.pos.y));
          if (Math.hypot(bl.pos.x, bl.pos.z) >= R - 0.5) tWorld = Math.min(tWorld, 1);
          if (isPlayer) {
            let bestT = Infinity;
            let bestTable: Table | null = null;
            let blueHit: (typeof blues)[number] | null = null;
            for (const t of tables) {
              if (!t.alive) continue;
              const tt = segTable(bl.prev, bl.pos, t.pos, t.pos.y, t.yaw, t.s);
              if (tt < bestT) { bestT = tt; bestTable = t; }
            }
            for (const u of blues) {
              if (!u.alive) continue;
              const tt = segTable(bl.prev, bl.pos, u.pos, 0, u.yaw, TABLE_S);
              if (tt < bestT) { bestT = tt; bestTable = null; blueHit = u; }
            }
            let bossT = Infinity;
            if (bossLive() && b.landed) {
              bossBox(_mn, _mx);
              bossT = segAABB(bl.prev, bl.pos, _mn, _mx);
            }
            // healing rings block player bullets
            let ringT = Infinity;
            let ringHit: (typeof health)[number] | null = null;
            for (const h of health) {
              if (!h.active) continue;
              if (!h.isShard && G.stage !== "boss" && !(G.mode === "pvp" && NET.stage === "playing")) continue;
              const hr = h.isShard ? SHARD_R : HEALTH_R;
              _mn.set(h.pos.x - hr, 0, h.pos.z - hr);
              _mx.set(h.pos.x + hr, 2.5, h.pos.z + hr);
              const tt = segAABB(bl.prev, bl.pos, _mn, _mx);
              if (tt < ringT) { ringT = tt; ringHit = h; }
            }
            let peerT = Infinity;
            if (G.mode === "pvp" || NET.kind === "lobby") for (const pr of NET.peers.values()) {
              if (pr.dead || pr.id === myId()) continue;
              peerT = Math.min(peerT, segSphere(bl.prev, bl.pos, _peerC.set(pr.x, pr.y + PVP_CENTER_Y, pr.z), PVP_HITBOX));
            }
            const tHit = Math.min(bestT, bossT, ringT, tWorld, peerT);
            if (tHit < Infinity) {
              bl.alive = false;
              const at = bl.prev.clone().lerp(bl.pos, tHit);
              if (at.y < 0.2) at.y = 0.2;
              if (ringHit && ringT === tHit) collectRing(ringHit);
              pvpBlast(at, BULLET_AOE_R, PVP_DMG.bullet);
              bulletExplode(
                at, bl.dmg,
                bestT === tHit ? bestTable : null,
                bestT === tHit ? blueHit : null,
                bossT === tHit,
              );
            }
          } else {
            const body = tmpV.copy(cam.position).setY(cam.position.y - 1);
            const tp = segSphere(bl.prev, bl.pos, body, 1.6 + BOT_BULLET_HALF);
            if (tp < tWorld && G.phase === "playing") {
              bl.alive = false;
              if (G.parryWin > 0 && !G.parryLocked) {
                let tgt: THREE.Vector3 | null = null;
                if (bossLive() && b.landed) tgt = new THREE.Vector3(b.pos.x, b.y + 24, b.pos.z);
                else {
                  let best = Infinity;
                  for (const t of tables) {
                    if (!t.alive) continue;
                    const dd = t.pos.distanceTo(body);
                    if (dd < best) {
                      best = dd;
                      tgt = t.pos.clone().setY(t.pos.y + 2.6 * t.s);
                    }
                  }
                }
                const from = cam.position.clone();
                const dir = tgt ? tgt.sub(from).normalize() : bl.vel.clone().negate().normalize();
                spawnBullet(playerPool, from, dir.multiplyScalar(BULLET_SPEED), PARRY_DMG, 0.4);
                G.parryWin = 0;
                G.parryCd = PARRY_CD_HIT; // successful parry → shorter CD
                G.buff = BUFF_TIME;
                G.parryFlash = 0.3;
                G.parries++;
                onParrySuccess(); // resets all cooldowns + 50 combo
                playSfxShared("parry_success");
              } else damagePlayer(bl.dmg);
            } else if (tWorld < Infinity) bl.alive = false;
          }
          const q = bl.pos;
          if (bl.alive && (bl.life <= 0 || q.y < 0 || q.y > ROOM.h || Math.hypot(q.x, q.z) > R)) bl.alive = false;
        }
        else if (home && !isPlayer) {
          bl.prev.copy(bl.pos);
          bl.pos.addScaledVector(bl.vel, dt);
          bl.life -= dt;
          let hit = bl.life <= 0 || bl.pos.y <= 0 || Math.hypot(bl.pos.x, bl.pos.z) > R || segSolids(bl.prev, bl.pos) < Infinity;
          if (!hit) for (const t of tables) if (t.alive && segTable(bl.prev, bl.pos, t.pos, t.pos.y, t.yaw, t.s) < Infinity) { hit = true; break; }
          if (hit) {
            bl.alive = false;
            boomFx(bl.pos.clone().setY(Math.max(0.3, bl.pos.y)), BULLET_AOE_R * 0.6, 0.2, true, "none");
          }
        }
        if (bl.alive && inst) {
          tmpQ.setFromUnitVectors(zAxis, tmpV.copy(bl.vel).normalize());
          tmpM.compose(bl.pos, tmpQ, ONE);
          inst.setMatrixAt(n++, tmpM);
        }
      }
      if (inst) {
        inst.count = n;
        inst.instanceMatrix.needsUpdate = true;
      }
    };
    stepPool(playerPool, pInst.current, true);
    stepPool(botPool, bInst.current, false);

    // --- render tables (instanced) ---
    if (topI.current && legI.current && eyeI.current) {
      tables.forEach((t, i) => {
        if (!t.alive) {
          topI.current!.setMatrixAt(i, HIDE);
          eyeI.current!.setMatrixAt(i * 2, HIDE);
          eyeI.current!.setMatrixAt(i * 2 + 1, HIDE);
          for (let l = 0; l < 4; l++) legI.current!.setMatrixAt(i * 4 + l, HIDE);
          return;
        }
        const y = t.pos.y + (t.pos.y <= 0 ? Math.abs(Math.sin(t.bob)) * 0.4 * t.s : 0);
        tmpQ.setFromAxisAngle(UP, t.yaw);
        tmpM.compose(tmpV.set(t.pos.x, y, t.pos.z), tmpQ, new THREE.Vector3(t.s, t.s, t.s));
        topI.current!.setMatrixAt(i, tmpM2.multiplyMatrices(tmpM, TOP_M));
        LEG_M.forEach((m, l) => legI.current!.setMatrixAt(i * 4 + l, tmpM2.multiplyMatrices(tmpM, m)));
        EYE_M.forEach((m, l) => eyeI.current!.setMatrixAt(i * 2 + l, tmpM2.multiplyMatrices(tmpM, m)));
      });
      topI.current.instanceMatrix.needsUpdate = true;
      legI.current.instanceMatrix.needsUpdate = true;
      eyeI.current.instanceMatrix.needsUpdate = true;
    }
    G.alive = aliveCount();
    if (blueTop.current && blueLeg.current) {
      blues.forEach((u, i) => {
        if (!u.alive) {
          blueTop.current!.setMatrixAt(i, HIDE);
          for (let l = 0; l < 4; l++) blueLeg.current!.setMatrixAt(i * 4 + l, HIDE);
          return;
        }
        tmpQ.setFromAxisAngle(UP, u.yaw);
        tmpM.compose(tmpV.set(u.pos.x, 0, u.pos.z), tmpQ, new THREE.Vector3(TABLE_S, TABLE_S, TABLE_S));
        blueTop.current!.setMatrixAt(i, tmpM2.multiplyMatrices(tmpM, TOP_M));
        LEG_M.forEach((m, l) => blueLeg.current!.setMatrixAt(i * 4 + l, tmpM2.multiplyMatrices(tmpM, m)));
      });
      blueTop.current.instanceMatrix.needsUpdate = true;
      blueLeg.current.instanceMatrix.needsUpdate = true;
    }
    // --- party campaign player shards (only while someone is waiting for revive) ---
    if (active && sharesEnemies() && G.mode === "game") {
      // keep queue in sync with peer dead flags
      for (const pr of NET.peers.values()) {
        if (pr.dead && !G.reviveQueue.includes(pr.id)) G.reviveQueue.push(pr.id);
      }
      G.reviveQueue = G.reviveQueue.filter((id) => {
        if (id === myId()) return G.campaignDead;
        const pr = NET.peers.get(id);
        return pr ? pr.dead : false;
      });
      const waiting = G.reviveQueue.length > 0;
      if (!waiting) {
        for (const h of health) if (h.isShard) h.active = false;
        G.shardProgress = 0;
      } else {
        healthT.current -= dt;
        if (healthT.current <= 0) {
          healthT.current += SHARD_INTERVAL;
          for (let n = 0; n < SHARD_SPAWN_N; n++) {
            const h = health.find((item) => !item.active);
            if (!h) break;
            h.pos.copy(randomFloor(p));
            h.active = true;
            h.t = SHARD_LIFE;
            h.isShard = true;
          }
        }
        for (const h of health) if (h.active && h.isShard && (h.t -= dt) <= 0) h.active = false;
      }
    }

    MAP.px = pos.current.x;
    MAP.pz = pos.current.z;
    MAP.yaw = new THREE.Euler().setFromQuaternion(cam.quaternion, "YXZ").y;
    // Crosshair: enemy (blue tilt) / grapple (yellow)
    {
      const dir = new THREE.Vector3();
      cam.getWorldDirection(dir);
      const origin = cam.position.clone();
      let mode: "normal" | "enemy" | "grapple" = "normal";
      let canG = false;
      // grapple ray
      if (staticRef.current && !G.freecam) {
        const rc = new THREE.Raycaster(origin, dir, 0.5, cfg.grapple(GRAPPLE_MAX));
        const hits = rc.intersectObject(staticRef.current, true);
        if (hits.length > 0) { mode = "grapple"; canG = true; }
      }
      // enemy aim (tables, blues, boss, pvp peers when attackable)
      if (mode === "normal" && !G.freecam) {
        const aimDist = 400;
        const tip = origin.clone().addScaledVector(dir, aimDist);
        const check = (px: number, py: number, pz: number, r: number) => {
          const to = new THREE.Vector3(px, py, pz).sub(origin);
          const t = to.dot(dir);
          if (t < 1 || t > aimDist) return false;
          const closest = origin.clone().addScaledVector(dir, t);
          return closest.distanceTo(new THREE.Vector3(px, py, pz)) < r;
        };
        for (const tb of tables) if (tb.alive && check(tb.pos.x, tb.pos.y + 2 * tb.s, tb.pos.z, 4 * tb.s)) { mode = "enemy"; break; }
        if (mode === "normal") for (const u of blues) if (u.alive && check(u.pos.x, u.pos.y + 2, u.pos.z, 3.5)) { mode = "enemy"; break; }
        if (mode === "normal" && G.stage === "boss" && boss.current.landed) {
          if (check(boss.current.pos.x, boss.current.y + 15, boss.current.pos.z, 20)) mode = "enemy";
        }
        if (mode === "normal" && (G.mode === "pvp" || NET.kind === "lobby") && NET.stage === "playing") {
          for (const pr of NET.peers.values()) {
            if (pr.dead || pr.id === myId()) continue;
            if (check(pr.x, pr.y + EYE, pr.z, PVP_HITBOX)) { mode = "enemy"; break; }
          }
        }
      }
      G.crosshair = mode;
      G.canGrapple = canG;
    }

    MAP.boss = G.stage === "boss" && b.landed ? { x: b.pos.x, z: b.pos.z } : null;
    MAP.tables = tables.flatMap((t) => (t.alive ? [t.pos.x, t.pos.z] : []));
    MAP.blues = blues.flatMap((u) => (u.alive ? [u.pos.x, u.pos.z] : []));
    MAP.health = health.flatMap((h) => (h.active ? [h.pos.x, h.pos.z] : []));
    MAP.peers = [...NET.peers.values()].flatMap((q) => (q.dead || q.id === myId() ? [] : [q.x, q.z]));
    localBody.show = freecamOn && !G.pvpDead && !G.campaignDead;
    localBody.x = pos.current.x;
    localBody.y = pos.current.y;
    localBody.z = pos.current.z;
    if (!freecamOn) localBody.playerYaw = MAP.yaw;
    localBody.yaw = freecamOn ? localBody.playerYaw : MAP.yaw;

    // freecam camera: world sim already ran; only the view is detached
    if (freecamOn) {
      const spd = FREECAM_SPEEDS[G.freecamSpeedIdx] ?? 44;
      const forward = new THREE.Vector3();
      cam.getWorldDirection(forward);
      const right = new THREE.Vector3().crossVectors(forward, cam.up).normalize();
      const move = new THREE.Vector3();
      if (keys.current["KeyW"] || keys.current[SETTINGS.keys.forward]) move.add(forward);
      if (keys.current["KeyS"] || keys.current[SETTINGS.keys.back]) move.sub(forward);
      if (keys.current["KeyA"] || keys.current[SETTINGS.keys.left]) move.sub(right);
      if (keys.current["KeyD"] || keys.current[SETTINGS.keys.right]) move.add(right);
      if (move.lengthSq() > 0) {
        move.normalize().multiplyScalar(spd * dt);
        cam.position.add(move);
      }
      // Freecam can leave the room into the neighborhood (soft outer bound only)
      const flat = Math.hypot(cam.position.x, cam.position.z);
      const maxR = ROOM.r * 3.5;
      if (flat > maxR) {
        const k = maxR / flat;
        cam.position.x *= k;
        cam.position.z *= k;
      }
      cam.position.y = THREE.MathUtils.clamp(cam.position.y, 0.5, ROOM.h + 80);
    }

    if (NET.online && (G.phase === "playing" || G.phase === "won")) {
      sendPose(pos.current.x, pos.current.y, pos.current.z, freecamOn ? localBody.playerYaw : MAP.yaw, {
        grappling: G.grappling,
        gx: anchor.current.x, gy: anchor.current.y, gz: anchor.current.z,
      });
    }

    // --- splinter cones ---
    if (splI.current) {
      let n = 0;
      for (let i = splinters.length - 1; i >= 0; i--) {
        const s = splinters[i]!;
        if (active) {
          s.life -= dt;
          s.vel.y -= GRAVITY * dt;
          s.pos.addScaledVector(s.vel, dt);
          if (s.pos.y < 0.2) {
            s.pos.y = 0.2;
            s.vel.y *= -0.3;
            s.vel.x *= 0.7;
            s.vel.z *= 0.7;
            s.spin.multiplyScalar(0.7);
          }
          s.rot.x += s.spin.x * dt;
          s.rot.y += s.spin.y * dt;
          s.rot.z += s.spin.z * dt;
        }
        if (s.life <= 0) {
          splinters.splice(i, 1);
          continue;
        }
        const sc = s.size * Math.min(1, s.life);
        tmpQ.setFromEuler(s.rot);
        splI.current.setMatrixAt(n++, tmpM.compose(s.pos, tmpQ, tmpV.set(sc, sc, sc)));
      }
      splI.current.count = n;
      splI.current.instanceMatrix.needsUpdate = true;
    }

    // --- bomb / explosions / hazards / boss visuals ---
    {
      const alive = bomb.current.alive;
      const sc = (G.bombBig > 0 ? 1.6 : 1) * BOMB_SIZE;
      if (bombGroupRef.current) {
        bombGroupRef.current.visible = alive;
        if (alive) {
          bombGroupRef.current.position.copy(bomb.current.pos);
          bombGroupRef.current.scale.setScalar(sc);
        }
      }
      if (bombMesh.current) {
        bombMesh.current.visible = alive;
        const bmat = bombMesh.current.material as THREE.MeshStandardMaterial;
        bmat.color.set(bomb.current.tele ? "#ffffff" : "#1a1a1a");
        bmat.emissive.set(bomb.current.tele ? "#e5e7eb" : "#ff7a1a");
        bmat.emissiveIntensity = bomb.current.tele ? 1.5 : 1.8;
      }
      // No ring on the flying bomb — red explosion ring is on boomFx at impact (like trampoline)
      if (bombRingRef.current) bombRingRef.current.visible = false;
    }
    booms.forEach((bm, i) => {
      const m = boomRefs.current[i];
      if (active || home) bm.t = Math.max(0, bm.t - dt);
      if (!m) return;
      m.visible = bm.t > 0;
      m.position.copy(bm.pos);
      if (bm.hold) {
        m.scale.setScalar(bm.r * Math.min(1, 0.3 + ((bm.dur - bm.t) / 0.3) * 0.7));
        (m.material as THREE.MeshBasicMaterial).opacity = 0.5;
      } else {
        m.scale.setScalar(bm.r * (1 - bm.t / Math.max(0.2, bm.dur) * 0.7));
        (m.material as THREE.MeshBasicMaterial).opacity = Math.min(1, bm.t * 1.2);
      }
      (m.material as THREE.MeshBasicMaterial).color.set(bm.col);
      const ring = boomRingRefs.current[i];
      if (ring) {
        ring.visible = bm.t > 0 && bm.ring;
        if (ring.visible) {
          ring.position.copy(bm.pos);
          // Same expanding torus style as trampoline mastery blast
          ring.rotation.set(bm.rx, bm.ry + (bm.dur - bm.t) * 2.2, bm.rz);
          const life = 1 - bm.t / Math.max(0.2, bm.dur);
          const rs = bm.r * (0.35 + 0.65 * life); // grows out from center
          ring.scale.set(rs, rs, rs);
          const rm = ring.material as THREE.MeshBasicMaterial;
          rm.color.set(bm.ringCol);
          rm.opacity = Math.min(0.95, bm.t * 1.8);
        }
      }
    });
    slamCracks.forEach((c, i) => {
      if (c.active) c.t = Math.max(0, c.t - dt);
      if (c.t <= 0) c.active = false;
      const g = crackGroupRefs.current[i];
      if (!g) return;
      g.visible = c.active;
      if (!c.active) return;
      g.position.set(c.x, c.y, c.z);
      g.rotation.y = c.yaw;
      const diam = TABLE_W * 1.5;
      g.scale.setScalar(diam);
      const fade = Math.min(0.9, c.t / 4 * 0.85 + 0.2);
      g.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mat = mesh.material as THREE.MeshBasicMaterial;
        if (mat?.opacity != null) {
          mat.opacity = fade;
          mat.color.set(c.dark ? "#0a0a0a" : "#1a120c");
        }
      });
    });
    hazards.forEach((h, i) => {
      const r = hazRefs.current[i]!;
      const charge = h.t > 0 ? 1 - h.t / h.total : 1;
      const pulse = 0.25 + 0.2 * Math.sin(performance.now() / 60);
      if (r.disc) {
        r.disc.visible = h.active && h.kind === "aoe";
        r.disc.position.set(h.x, 0.3, h.z);
        r.disc.scale.setScalar(h.kind === "sword" ? SWORD_R : AOE_R * (h.t > 0 ? charge : 1));
        (r.disc.material as THREE.MeshBasicMaterial).opacity = h.t > 0 ? pulse : 0.7;
      }
      if (r.sector) {
        r.sector.visible = h.active && h.kind === "quarter";
        r.sector.rotation.z = h.a0;
        (r.sector.material as THREE.MeshBasicMaterial).opacity = h.t > 0 ? 0.3 + 0.25 * charge : 0.75;
      }
      if (r.sword) {
        r.sword.visible = h.active && h.kind === "sword";
        r.sword.position.set(h.x, h.t > 0 ? 60 : Math.max(0, 60 * (h.fx - 0.4) * 10), h.z);
      }
    });
    if (zoneRef.current) {
      zoneRef.current.visible = G.stage === "incoming" || (G.stage === "boss" && !b.landed);
      (zoneRef.current.material as THREE.MeshBasicMaterial).opacity = 0.3 + 0.2 * Math.sin(performance.now() / 120);
    }
    if (bossRef.current) {
      bossRef.current.visible = G.stage === "boss" && G.phase !== "won";
      bossRef.current.position.set(b.pos.x, b.y, b.pos.z);
      bossRef.current.rotation.y = b.yaw;
      const stomp = hazards.find((h) => h.active && h.kind === "stomp" && h.t > 0);
      bossRef.current.rotation.x = stomp ? -Math.sin((1 - stomp.t / stomp.total) * Math.PI * 0.5) * 0.35 : 0;
    }
    waves.forEach((w, i) => {
      const m = waveRefs.current[i];
      if (!m) return;
      m.visible = w.active;
      m.position.set(w.x, WAVE_H / 2, w.z);
      m.scale.set(w.r, WAVE_H, w.r);
      (m.material as THREE.MeshBasicMaterial).color.set(w.stunOnly ? "#a879ff" : "#ff2a2a");
    });
    health.forEach((h, i) => {
      const ring = healthRefs.current[i];
      if (!ring) return;
      const show = h.active && G.phase === "playing" && (h.isShard || G.stage === "boss" || (G.mode === "pvp" && !h.isShard));
      ring.visible = show;
      ring.position.set(h.pos.x, 0.45, h.pos.z);
      const scale = h.isShard ? 3 : 1;
      ring.scale.setScalar(scale);
      if (active) ring.rotation.y += dt * 0.6;
      // tint: green health + | blue shard square
      ring.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh || !mesh.material) return;
        const mat = mesh.material as THREE.MeshBasicMaterial;
        if (!mat.color) return;
        if (h.isShard) {
          mat.color.set("#3a9eff");
          // hide plus arms (userData.kind === "plus"), show square
          if (mesh.userData?.kind === "plus") mesh.visible = false;
          if (mesh.userData?.kind === "square") mesh.visible = true;
        } else {
          mat.color.set("#3cff70");
          if (mesh.userData?.kind === "plus") mesh.visible = true;
          if (mesh.userData?.kind === "square") mesh.visible = false;
        }
      });
    });

    abilityWalls.forEach((w, i) => {
      const m = wallMeshRefs.current[i];
      if (!m) return;
      m.visible = w.active;
      if (!w.active) return;
      if (w.grow < 1) w.grow = Math.min(1, w.grow + dt * 4); // grow from nothing
      const g = w.grow * w.grow; // ease-in
      m.position.set(w.cx, w.cy, w.cz);
      m.rotation.set(w.pitch, w.yaw, 0, "YXZ");
      m.scale.set(w.hw * 2 * g, w.hh * 2 * g, w.hd * 2 * g);
      const wm = m.material as THREE.MeshStandardMaterial;
      wm.color.set(w.m ? "#c0201a" : "#96653f");
      wm.emissive.set(w.m ? "#ff1a1a" : "#000000");
      wm.emissiveIntensity = w.m ? 1.4 : 0;
    });
    abilityPads.forEach((pad, i) => {
      const m = padMeshRefs.current[i];
      const coil = coilMeshRefs.current[i];
      if (!m) return;
      m.visible = pad.active;
      if (coil) coil.visible = pad.active;
      if (!pad.active) return;
      const n = tmpV.set(pad.nx, pad.ny, pad.nz).normalize();
      m.position.set(pad.cx, pad.cy, pad.cz);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      const rad = Math.max(pad.hw, pad.hd);
      if (pad.squish > 0) pad.squish = Math.max(0, pad.squish - dt * 4);
      const sq = pad.squish;
      // bounce: flatten then recover
      const sy = 1 - sq * 0.45;
      const sxz = 1 + sq * 0.35;
      m.scale.set(rad * 2 * sxz, sy, rad * 2 * sxz);
      const pm = m.material as THREE.MeshStandardMaterial;
      pm.color.set(pad.m ? "#ff2a2a" : "#3cff70");
      pm.emissive.set(pad.m ? "#a01010" : "#1a8a40");
      if (coil) {
        const cm = coil.material as THREE.MeshStandardMaterial;
        cm.color.set(pad.m ? "#ffc830" : "#c0c7d1");
        cm.emissive.set(pad.m ? "#a67c00" : "#8a929c");
      }
      // Silver coil on the BACK of the pad (opposite launch), length ~1.5× wall thickness
      if (coil) {
        const wallThick = TABLE_W; // full wall thickness
        const coilLen = wallThick * 1.5;
        coil.position.set(
          pad.cx - n.x * (coilLen * 0.5 + 0.4),
          pad.cy - n.y * (coilLen * 0.5 + 0.4),
          pad.cz - n.z * (coilLen * 0.5 + 0.4),
        );
        coil.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n.clone().negate());
        coil.scale.set(rad * 0.55, coilLen, rad * 0.55);
      }
    });
    abilityFires.forEach((f, i) => {
      const grp = fireGroupRefs.current[i];
      if (!grp) return;
      grp.visible = f.active;
      if (!f.active) return;
      grp.position.set(0, 0, 0);
      grp.rotation.set(0, 0, 0);
      const len = Math.hypot(f.bx - f.ax, f.by - f.ay, f.bz - f.az) || 1;
      const dx = (f.bx - f.ax) / len, dz = (f.bz - f.az) / len;
      const px = -dz, pz = dx;
      const shimmer = 0.9 + 0.1 * Math.sin(performance.now() / 280 + i);
      const glowCol = f.m ? "#3b82f6" : "#ff2a1a";
      const coreCol = f.m ? "#93c5fd" : "#ffcc33";
      // Sharp jagged offsets — mastered: much wider + harder corners
      const jagAmp = f.m ? 11.0 : 4.2;
      const bedW = f.m ? 2.6 : 1.8;
      const coreW = f.m ? 1.0 : 0.65;
      const rockH = bedW; // protrusion = thickness
      const segs = grp.userData.segs as {
        bed: THREE.Mesh; core: THREE.Mesh; light: THREE.PointLight;
        rockL: THREE.Mesh; rockR: THREE.Mesh;
        dnaBed?: THREE.Mesh; dnaCore?: THREE.Mesh;
      }[] | undefined;
      if (!segs) return;
      // Precompute jagged sample points along main path
      const pts: { x: number; z: number; j: number }[] = [];
      for (let si = 0; si <= segs.length; si++) {
        const tt = si / segs.length;
        // Sharp turns: hard stepped flips (mastered snaps harder / wider)
        const freq = f.m ? 9 : 7;
        const raw = Math.sin(tt * Math.PI * freq) + (f.m ? 0.55 : 0.35) * Math.sin(tt * Math.PI * (f.m ? 17 : 13));
        const snap = f.m ? 3.2 : 1.8;
        const stepped = Math.sign(raw) * Math.min(1, Math.abs(raw) * snap);
        const j = stepped * jagAmp * (si % 2 === 0 ? 1.35 : 0.9);
        pts.push({
          x: f.ax + dx * len * tt + px * j,
          z: f.az + dz * len * tt + pz * j,
          j,
        });
      }
      for (let si = 0; si < segs.length; si++) {
        const p0 = pts[si]!, p1 = pts[si + 1]!;
        const mx = (p0.x + p1.x) * 0.5, mz = (p0.z + p1.z) * 0.5;
        const sdx = p1.x - p0.x, sdz = p1.z - p0.z;
        const segLen = Math.hypot(sdx, sdz) || 1;
        const yaw = Math.atan2(sdx, sdz);
        const s = segs[si]!;
        s.bed.visible = true;
        s.core.visible = true;
        s.bed.position.set(mx, 0.04, mz);
        s.bed.rotation.set(0, yaw, 0);
        s.bed.scale.set(bedW, 0.1, segLen * 1.1);
        s.core.position.set(mx, 0.11, mz);
        s.core.rotation.set(0, yaw, 0);
        s.core.scale.set(coreW, 0.09, segLen * 1.05);
        const cm = s.core.material as THREE.MeshStandardMaterial;
        cm.color.set(coreCol);
        cm.emissive.set(glowCol);
        cm.emissiveIntensity = 6.5 * shimmer;
        // Rocks on both sides — same thickness as black bed, protrude upward by that thickness
        for (const [rock, side] of [[s.rockL, -1] as const, [s.rockR, 1] as const]) {
          rock.visible = true;
          rock.position.set(mx + px * side * (bedW * 0.55 + rockH * 0.35), rockH * 0.5, mz + pz * side * (bedW * 0.55 + rockH * 0.35));
          rock.rotation.set(0, yaw + side * 0.15, side * 0.08);
          rock.scale.set(rockH * (0.7 + (si % 3) * 0.15), rockH * (0.85 + (si % 2) * 0.2), segLen * (0.45 + (si % 4) * 0.08));
          const rm = rock.material as THREE.MeshStandardMaterial;
          if (f.m) {
            rm.color.set(si % 2 === 0 ? "#1e3a8a" : "#0f172a");
            rm.emissive.set("#3b82f6");
            rm.emissiveIntensity = 2.2 * shimmer;
          } else {
            rm.color.set(si % 2 === 0 ? "#3a3a3a" : "#1a1a1a");
            rm.emissive.set("#000000");
            rm.emissiveIntensity = 0;
          }
        }
        s.light.position.set(mx, 2.2, mz);
        s.light.color.set(glowCol);
        s.light.intensity = (f.m ? 3.0 : 2.4) * shimmer;
        s.light.distance = 50;
        s.light.visible = true;
        // Mastered DNA second jagged strand (phase-shifted sharp path)
        if (s.dnaBed && s.dnaCore) {
          if (f.m) {
            const tt0 = si / segs.length, tt1 = (si + 1) / segs.length;
            const raw0 = Math.sin(tt0 * Math.PI * 9 + 2.2) + 0.55 * Math.sin(tt0 * Math.PI * 17);
            const raw1 = Math.sin(tt1 * Math.PI * 9 + 2.2) + 0.55 * Math.sin(tt1 * Math.PI * 17);
            const j0 = Math.sign(raw0) * Math.min(1, Math.abs(raw0) * 3.0) * jagAmp * 0.9;
            const j1 = Math.sign(raw1) * Math.min(1, Math.abs(raw1) * 3.0) * jagAmp * 0.9;
            // Cross over the main strand for DNA look
            const cross = (si % 4 < 2 ? 1 : -1);
            const dx0 = f.ax + dx * len * tt0 + px * (j0 * cross);
            const dz0 = f.az + dz * len * tt0 + pz * (j0 * cross);
            const dx1 = f.ax + dx * len * tt1 + px * (j1 * cross);
            const dz1 = f.az + dz * len * tt1 + pz * (j1 * cross);
            const dmx = (dx0 + dx1) * 0.5, dmz = (dz0 + dz1) * 0.5;
            const dsdx = dx1 - dx0, dsdz = dz1 - dz0;
            const dLen = Math.hypot(dsdx, dsdz) || 1;
            const dyaw = Math.atan2(dsdx, dsdz);
            s.dnaBed.visible = true;
            s.dnaCore.visible = true;
            s.dnaBed.position.set(dmx, 0.05, dmz);
            s.dnaBed.rotation.set(0, dyaw, 0);
            s.dnaBed.scale.set(bedW * 0.75, 0.09, dLen * 1.1);
            s.dnaCore.position.set(dmx, 0.12, dmz);
            s.dnaCore.rotation.set(0, dyaw, 0);
            s.dnaCore.scale.set(coreW * 0.85, 0.08, dLen * 1.05);
            const dm = s.dnaCore.material as THREE.MeshStandardMaterial;
            dm.color.set("#60a5fa");
            dm.emissive.set("#2563eb");
            dm.emissiveIntensity = 7 * shimmer;
          } else {
            s.dnaBed.visible = false;
            s.dnaCore.visible = false;
          }
        }
      }
    });
    fireballs.forEach((fb, i) => {
      const m = fireballMeshRefs.current[i];
      if (!m) return;
      m.visible = fb.active;
      if (fb.active) {
        m.position.copy(fb.pos);
        const fmat = m.material as THREE.MeshStandardMaterial;
        fmat.color.set(fb.m ? "#2f7bff" : "#ff1a00");
        fmat.emissive.set(fb.m ? "#1d4ed8" : "#cc0000");
      }
    });
    // Remote bullets visual only
    for (const rb of remoteBullets) {
      if (!rb.active) continue;
      rb.t -= dt;
      if (rb.t <= 0) { rb.active = false; continue; }
      rb.pos.addScaledVector(rb.vel, dt);
    }
    for (const rb of remoteBombs) {
      if (!rb.active) continue;
      rb.t -= dt;
      if (rb.t <= 0) { rb.active = false; continue; }
      rb.pos.addScaledVector(rb.vel, dt);
      rb.vel.y -= 40 * dt; // light gravity so it arcs a bit like local bombs
    }
    remoteBombMeshRefs.current.forEach((m, i) => {
      const rb = remoteBombs[i];
      if (!m || !rb) return;
      m.visible = rb.active;
      if (!rb.active) return;
      m.position.copy(rb.pos);
      m.scale.setScalar(BOMB_SIZE);
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.color.set(rb.tele ? "#ffffff" : "#1a1a1a");
      mat.emissive.set(rb.tele ? "#e5e7eb" : "#ff7a1a");
      const ring = remoteBombRingRefs.current[i];
      if (ring) ring.visible = false; // explosion ring is the shared boom torus
    });
    remoteBulletMeshRefs.current.forEach((m, i) => {
      if (!m) return;
      const rb = remoteBullets[i];
      m.visible = !!rb?.active;
      if (rb?.active) m.position.copy(rb.pos);
    });
    if (teleportMeshRef.current) {
      const tp = teleportRef.current;
      teleportMeshRef.current.visible = !!tp.active;
      // Orbiting rings (1 white unmastered / 3 purple mastered) — visual only
      for (let ri = 0; ri < 3; ri++) {
        const ring = teleportRingRefs.current[ri];
        if (!ring) continue;
        const show = !!tp.active && (tp.m ? true : ri === 0);
        ring.visible = show;
        if (!show) continue;
        const src = tp.phase === "fly" ? tp.pos : tp.target;
        ring.position.copy(src);
        const base = tp.phase === "fly" ? TABLE_W * 0.55 : TABLE_W * 2 * (1 + Math.min(1, tp.chargeT / tp.chargeMax)) * 0.55;
        const sizes = tp.m ? [base * 1.15, base * 1.55, base * 1.95] : [base * 1.4];
        const s = sizes[ri] ?? base;
        ring.scale.set(s, s, s);
        // random-ish rotating axes
        const t0 = performance.now() / 1000;
        ring.rotation.set(
          t0 * (1.1 + ri * 0.4) + ri,
          t0 * (1.7 + ri * 0.25),
          t0 * (0.9 + ri * 0.55) + ri * 0.7,
        );
        const rm = ring.material as THREE.MeshBasicMaterial;
        rm.color.set(tp.m ? "#a855f7" : "#ffffff");
        rm.opacity = tp.m ? 0.75 : 0.85;
      }
      if (tp.active) {
        const tmat = teleportMeshRef.current.material as THREE.MeshStandardMaterial;
        tmat.color.set(tp.m ? "#ffffff" : "#a855f7");
        tmat.emissive.set(tp.m ? "#e5e7eb" : "#7c3aed");
        if (tp.phase === "fly") {
          teleportMeshRef.current.position.copy(tp.pos);
          teleportMeshRef.current.scale.setScalar(TABLE_W * 2 * 0.35); // visible projectile, 2× baseline
        } else {
          const s = TABLE_W * 2 * (1 + Math.min(1, tp.chargeT / tp.chargeMax));
          teleportMeshRef.current.position.copy(tp.target);
          teleportMeshRef.current.scale.setScalar(s);
        }
      }
    }

    if (ropeRef.current) {
      ropeRef.current.visible = G.grappling;
      if (G.grappling) {
        const from = tmpV.copy(cam.position).setY(cam.position.y - 0.6);
        const d = anchor.current.clone().sub(from);
        ropeRef.current.position.copy(from).addScaledVector(d, 0.5);
        ropeRef.current.quaternion.setFromUnitVectors(UP, d.clone().normalize());
        ropeRef.current.scale.set(1, d.length(), 1);
      }
    }
    if (parryMesh.current) {
      parryMesh.current.visible = G.parryWin > 0 || G.buff > 0;
      parryMesh.current.position.copy(cam.position);
    }
  });

  // --- glow lights: flashlight on the player, pooled lights for effects and bots ---
  const flashRef = useRef<THREE.PointLight>(null);
  const fxLights = useRef<(THREE.PointLight | null)[]>([]);
  const botLights = useRef<(THREE.PointLight | null)[]>([]);
  const abilityLightRefs = useRef<(THREE.PointLight | null)[]>([]);
  useFrame(() => {
    const L = lampIntensity(settings.timeOfDay);
    const playing = G.phase === "playing";
    if (flashRef.current) {
      flashRef.current.visible = playing && !G.campaignDead;
      flashRef.current.position.set(pos.current.x, pos.current.y + 4.5, pos.current.z);
      flashRef.current.color.set(SKIN.lightColor);
      flashRef.current.intensity = L * 0.55; // table light from skin
      flashRef.current.distance = 220;
    }
    // effects: explosions (shots, bombs, ground pounds), the flying bomb, then player bullets
    const fx: [THREE.Vector3, number][] = [];
    for (const bm of booms) if (bm.t > 0) fx.push([bm.pos, Math.min(1, bm.t * 2.5)]);
    if (bomb.current.alive) fx.push([bomb.current.pos, 1]);
    for (const pb of playerPool) { if (fx.length >= FX_LIGHTS) break; if (pb.alive) fx.push([pb.pos, 0.6]); }
    fxLights.current.forEach((l, i) => {
      if (!l) return;
      const f = fx[i];
      l.intensity = f ? L * 0.5 * f[1] : 0;
      if (f) l.position.copy(f[0]);
    });
    // bots: boss first, then the tables closest to the player
    const p = pos.current;
    const bots: THREE.Vector3[] = [];
    const b = boss.current;
    if (G.stage === "boss") bots.push(_glowBoss.set(b.pos.x, (b.landed ? 0 : b.y) + 40, b.pos.z));
    const cands: THREE.Vector3[] = [];
    for (const t of tables) if (t.alive) cands.push(t.pos);
    for (const u of blues) if (u.alive) cands.push(u.pos);
    cands.sort((a, c) => a.distanceToSquared(p) - c.distanceToSquared(p));
    bots.push(...cands.slice(0, BOT_LIGHTS - bots.length));
    botLights.current.forEach((l, i) => {
      if (!l) return;
      const v = bots[i];
      l.intensity = v && playing ? L * (settings.timeOfDay === "evening" ? 0.1 : 0.3) : 0;
      if (v) l.position.set(v.x, v.y + (i === 0 && G.stage === "boss" ? 0 : 6), v.z);
    });
    // Ability props emit table-strength light
    const aPts: { x: number; y: number; z: number; c: string }[] = [];
    for (const w of abilityWalls) if (w.active) aPts.push({ x: w.cx, y: w.cy, z: w.cz, c: w.m ? "#ff2a2a" : "#c4a574" });
    for (const pad of abilityPads) if (pad.active) aPts.push({ x: pad.cx, y: pad.cy, z: pad.cz, c: pad.m ? "#ff2a2a" : "#3cff70" });
    for (const f of abilityFires) if (f.active) aPts.push({ x: (f.ax + f.bx) / 2, y: ((f.ay + f.by) / 2) + 1, z: (f.az + f.bz) / 2, c: f.m ? "#3b82f6" : "#ff6a1a" });
    for (const fb of fireballs) if (fb.active) aPts.push({ x: fb.pos.x, y: fb.pos.y, z: fb.pos.z, c: fb.m ? "#3b82f6" : "#ff1a00" });
    {
      const tp = teleportRef.current;
      if (tp.active) {
        const src = tp.phase === "fly" ? tp.pos : tp.target;
        aPts.push({ x: src.x, y: src.y, z: src.z, c: tp.m ? "#ffffff" : "#a855f7" });
      }
    }
    abilityLightRefs.current.forEach((l, i) => {
      if (!l) return;
      const a = aPts[i];
      if (a && playing) {
        l.intensity = L * 0.55; // same as table light
        l.distance = 220;
        l.position.set(a.x, a.y, a.z);
        l.color.set(a.c);
        l.visible = true;
      } else {
        l.intensity = 0;
        l.visible = false;
      }
    });
  });

  return (
    <>
      <pointLight ref={flashRef} intensity={0} distance={260} color="#fff1d6" />
      {Array.from({ length: FX_LIGHTS }, (_, i) => (
        <pointLight key={`fx${i}`} ref={(l) => { fxLights.current[i] = l; }} intensity={0} distance={200} color="#ffb060" />
      ))}
      {Array.from({ length: BOT_LIGHTS }, (_, i) => (
        <pointLight key={`bot${i}`} ref={(l) => { botLights.current[i] = l; }} intensity={0} distance={180} color="#ffd9a8" />
      ))}
      {Array.from({ length: 12 }, (_, i) => (
        <pointLight key={`ab${i}`} ref={(l) => { abilityLightRefs.current[i] = l; }} intensity={0} distance={220} color="#ffffff" />
      ))}
      <PointerLockControls ref={ctrl} selector="#no-auto-lock" pointerSpeed={0} />
      <group ref={staticRef}>
        <Room />
      </group>
      {/* 1v1 storm wall (radius driven per frame) */}
      <mesh ref={stormMesh} visible={false} position={[0, ROOM.h / 2, 0]} renderOrder={5}>
        <cylinderGeometry args={[1, 1, ROOM.h, 72, 1, true]} />
        <meshBasicMaterial color="#e9eef2" transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false} fog={false} />
      </mesh>

      {abilityWalls.map((_, i) => (
        <mesh key={`aw${i}`} ref={(m) => { wallMeshRefs.current[i] = m; }} visible={false} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#96653f" roughness={0.85} />
        </mesh>
      ))}
      {abilityPads.map((_, i) => (
        <group key={`ap${i}`}>
          <mesh ref={(m) => { padMeshRefs.current[i] = m; }} visible={false}>
            <cylinderGeometry args={[0.5, 0.5, 0.12, 28]} />
            <meshStandardMaterial color="#3cff70" emissive="#1a8a40" emissiveIntensity={1.1} />
          </mesh>
          {/* Decorative silver coil on the back (non-pad side) */}
          <mesh ref={(m) => { coilMeshRefs.current[i] = m; }} visible={false}>
            <cylinderGeometry args={[0.22, 0.28, 1, 10, 1, true]} />
            <meshStandardMaterial color="#c0c7d1" metalness={0.95} roughness={0.25} emissive="#8a929c" emissiveIntensity={0.15} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      {abilityFires.map((_, i) => (
        <group
          key={`af${i}`}
          ref={(g) => {
            fireGroupRefs.current[i] = g;
            if (!g) return;
            if (g.userData.vfxVer === FIRE_VFX_VER) return;
            while (g.children.length) {
              const ch = g.children[0]!;
              g.remove(ch);
              const mesh = ch as THREE.Mesh;
              mesh.geometry?.dispose?.();
              const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
              if (Array.isArray(mat)) mat.forEach((x) => x.dispose?.());
              else mat?.dispose?.();
            }
            g.userData.vfxVer = FIRE_VFX_VER;
            const segs: {
              bed: THREE.Mesh; core: THREE.Mesh; light: THREE.PointLight;
              rockL: THREE.Mesh; rockR: THREE.Mesh;
              dnaBed: THREE.Mesh; dnaCore: THREE.Mesh;
            }[] = [];
            for (let s = 0; s < FIRE_SEGS; s++) {
              const bed = new THREE.Mesh(
                new THREE.BoxGeometry(1, 1, 1),
                new THREE.MeshBasicMaterial({ color: "#050505" }),
              );
              const core = new THREE.Mesh(
                new THREE.BoxGeometry(1, 1, 1),
                new THREE.MeshStandardMaterial({
                  color: "#ffcc33", emissive: "#ff2a1a", emissiveIntensity: 6.5,
                  roughness: 0.25, toneMapped: false,
                }),
              );
              const rockMat = () => new THREE.MeshStandardMaterial({ color: "#2a2a2a", roughness: 0.95, metalness: 0.05 });
              const rockL = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), rockMat());
              const rockR = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), rockMat());
              const dnaBed = new THREE.Mesh(
                new THREE.BoxGeometry(1, 1, 1),
                new THREE.MeshBasicMaterial({ color: "#050505" }),
              );
              const dnaCore = new THREE.Mesh(
                new THREE.BoxGeometry(1, 1, 1),
                new THREE.MeshStandardMaterial({
                  color: "#60a5fa", emissive: "#2563eb", emissiveIntensity: 7,
                  roughness: 0.25, toneMapped: false,
                }),
              );
              const light = new THREE.PointLight("#ff6a1a", 2.5, 50);
              bed.visible = core.visible = rockL.visible = rockR.visible = false;
              dnaBed.visible = dnaCore.visible = light.visible = false;
              g.add(bed); g.add(core); g.add(rockL); g.add(rockR);
              g.add(dnaBed); g.add(dnaCore); g.add(light);
              segs.push({ bed, core, light, rockL, rockR, dnaBed, dnaCore });
            }
            g.userData.segs = segs;
          }}
          visible={false}
        />
      ))}
      <group ref={(m) => { bossSwordMesh.current = m; }} visible={false}>
        <mesh castShadow>
          <boxGeometry args={[26, 2.2, 1.2]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} emissive="#64748b" emissiveIntensity={1.5} />
        </mesh>
        <mesh position={[-3, 0, 0]}>
          <boxGeometry args={[1.5, 9, 2]} />
          <meshStandardMaterial color="#7f1d1d" metalness={0.7} roughness={0.25} />
        </mesh>
        <mesh position={[-9, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[1.1, 1.1, 6, 8]} />
          <meshStandardMaterial color="#991b1b" metalness={0.8} roughness={0.2} />
        </mesh>
      </group>
      {fireballs.map((_, i) => (
        <mesh key={`fb${i}`} ref={(m) => { fireballMeshRefs.current[i] = m; }} visible={false}>
          <sphereGeometry args={[0.8, 12, 10]} />
          <meshStandardMaterial color="#ff1a00" emissive="#cc0000" emissiveIntensity={4} />
        </mesh>
      ))}
      {remoteBullets.map((_, i) => (
        <mesh key={`rb${i}`} ref={(m) => { remoteBulletMeshRefs.current[i] = m; }} visible={false}>
          <sphereGeometry args={[0.25, 6, 6]} />
          <meshBasicMaterial color="#ffe9a8" />
        </mesh>
      ))}
      {[0, 1, 2].map((i) => (
        <mesh key={`tpr${i}`} ref={(m) => { teleportRingRefs.current[i] = m; }} visible={false}>
          <torusGeometry args={[1, 0.045, 8, 40]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.8} depthWrite={false} />
        </mesh>
      ))}
      <mesh ref={(m) => { teleportMeshRef.current = m; }} visible={false}>
        <sphereGeometry args={[1, 20, 16]} />
        <meshStandardMaterial color="#a855f7" emissive="#7c3aed" emissiveIntensity={2.5} transparent opacity={0.75} />
      </mesh>

      <HomeShowcase />
      <RemotePlayers />
      {/* Own table body — visible in freecam so you can see your model + light */}
      <LocalFreecamBody />
      <instancedMesh ref={topI} args={[undefined, undefined, TABLE_POOL]} frustumCulled={false} castShadow>
        <boxGeometry args={[6, 0.5, 4]} />
        <meshStandardMaterial map={wood} roughness={0.3} metalness={0.08} envMapIntensity={2} />
      </instancedMesh>
      <instancedMesh ref={legI} args={[undefined, undefined, TABLE_POOL * 4]} frustumCulled={false} castShadow>
        <boxGeometry args={[0.45, 3, 0.45]} />
        <meshStandardMaterial map={wood} color="#d8b08a" roughness={0.5} envMapIntensity={2} />
      </instancedMesh>
      <instancedMesh ref={eyeI} args={[undefined, undefined, TABLE_POOL * 2]} frustumCulled={false}>
        <boxGeometry args={[0.7, 0.25, 0.05]} />
        <meshStandardMaterial color="#1a0d05" />
      </instancedMesh>
      <instancedMesh ref={splI} args={[undefined, undefined, 220]} frustumCulled={false}>
        <coneGeometry args={[0.25, 1.6, 5]} />
        <meshStandardMaterial map={wood} color="#e0b98a" />
      </instancedMesh>
      <instancedMesh ref={pInst} args={[undefined, undefined, 128]} frustumCulled={false}>
        <boxGeometry args={[0.08, 0.08, 6]} />
        <meshStandardMaterial color="#e2b27a" emissive="#b8752e" />
      </instancedMesh>
      <instancedMesh ref={bInst} args={[undefined, undefined, 320]} frustumCulled={false}>
        <boxGeometry args={[0.7, 0.7, 7]} />
        <meshStandardMaterial color="#5a2e0e" emissive="#c2410c" emissiveIntensity={0.8} />
      </instancedMesh>
      <instancedMesh ref={blueTop} args={[undefined, undefined, BLUE_N]} frustumCulled={false} castShadow>
        <boxGeometry args={[6, 0.5, 4]} />
        <meshStandardMaterial color="#2f6fd6" emissive="#0a2a66" roughness={0.25} metalness={0.08} envMapIntensity={2} />
      </instancedMesh>
      <instancedMesh ref={blueLeg} args={[undefined, undefined, BLUE_N * 4]} frustumCulled={false} castShadow>
        <boxGeometry args={[0.45, 3, 0.45]} />
        <meshStandardMaterial color="#1f4fa8" roughness={0.5} envMapIntensity={2} />
      </instancedMesh>
      <group ref={(g) => { bombGroupRef.current = g; }} visible={false}>
        <mesh ref={bombMesh}>
          <sphereGeometry args={[0.85, 18, 14]} />
          <meshStandardMaterial color="#1a1a1a" emissive="#ff7a1a" emissiveIntensity={1.8} />
        </mesh>
        {/* Large Saturn ring — clearly outside the bomb */}
        <mesh ref={(m) => { bombRingRef.current = m; }} rotation={[0.55, 0, 0.15]}>
          <torusGeometry args={[2.4, 0.22, 12, 48]} />
          <meshStandardMaterial color="#ff2020" emissive="#ff0000" emissiveIntensity={3.5} metalness={0.4} roughness={0.2} toneMapped={false} />
        </mesh>
        <mesh rotation={[0.55, 0, 0.15]}>
          <torusGeometry args={[3.1, 0.08, 8, 48]} />
          <meshStandardMaterial color="#ff4444" emissive="#ff2222" emissiveIntensity={2.2} transparent opacity={0.85} toneMapped={false} />
        </mesh>
      </group>
      {remoteBombs.map((_, i) => (
        <group key={`rbomb${i}`}>
          <mesh ref={(m) => { remoteBombMeshRefs.current[i] = m; }} visible={false}>
            <sphereGeometry args={[0.85, 18, 14]} />
            <meshStandardMaterial color="#1a1a1a" emissive="#ff7a1a" emissiveIntensity={1.8} />
          </mesh>
          <mesh ref={(m) => { remoteBombRingRefs.current[i] = m; }} visible={false}>
            <torusGeometry args={[2.4, 0.22, 12, 48]} />
            <meshStandardMaterial color="#ff2020" emissive="#ff0000" emissiveIntensity={3.5} metalness={0.4} roughness={0.2} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {booms.map((_, i) => (
        <group key={i}>
          <mesh ref={(m) => { boomRefs.current[i] = m; }} visible={false}>
            <sphereGeometry args={[1, 24, 16]} />
            <meshBasicMaterial color="#ffb347" transparent opacity={0.5} depthWrite={false} />
          </mesh>
          <mesh ref={(m) => { boomRingRefs.current[i] = m; }} visible={false}>
            <torusGeometry args={[1, 0.06, 8, 36]} />
            <meshBasicMaterial color="#22c55e" transparent opacity={0.8} depthWrite={false} />
          </mesh>
        </group>
      ))}
      {slamCracks.map((_, i) => (
        <group
          key={`ck${i}`}
          ref={(g) => {
            crackGroupRefs.current[i] = g;
            if (g && !g.userData.built) {
              g.userData.built = true;
              // spiderweb: radial spokes + short connectors
              const mat = () => new THREE.MeshBasicMaterial({ color: "#1a120c", transparent: true, opacity: 0.75, depthWrite: false });
              for (let s = 0; s < 14; s++) {
                const a = (s / 14) * Math.PI * 2;
                const len = 0.35 + (s % 3) * 0.12;
                const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.02, len), mat());
                spoke.position.set(Math.sin(a) * len * 0.5, 0.01, Math.cos(a) * len * 0.5);
                spoke.rotation.y = a;
                g.add(spoke);
              }
              for (let r = 0; r < 3; r++) {
                const rad = 0.18 + r * 0.14;
                for (let s = 0; s < 10; s++) {
                  const a0 = (s / 10) * Math.PI * 2;
                  const a1 = ((s + 1) / 10) * Math.PI * 2;
                  const mx = (Math.sin(a0) + Math.sin(a1)) * 0.5 * rad;
                  const mz = (Math.cos(a0) + Math.cos(a1)) * 0.5 * rad;
                  const seg = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.015, rad * 0.55), mat());
                  seg.position.set(mx, 0.012, mz);
                  seg.rotation.y = (a0 + a1) / 2;
                  g.add(seg);
                }
              }
              // center broken hole
              const hole = new THREE.Mesh(new THREE.CircleGeometry(0.08, 7), mat());
              hole.rotation.x = -Math.PI / 2;
              hole.position.y = 0.008;
              g.add(hole);
            }
          }}
          visible={false}
        />
      ))}
      {hazards.map((_, i) => (
        <group key={i}>
          <mesh ref={(m) => { hazRefs.current[i]!.disc = m; }} rotation-x={-Math.PI / 2} visible={false}>
            <circleGeometry args={[1, 48]} />
            <meshBasicMaterial color="#ff1a1a" transparent opacity={0.3} depthWrite={false} />
          </mesh>
          <mesh ref={(m) => { hazRefs.current[i]!.sector = m; }} rotation-x={-Math.PI / 2} position={[0, 0.25, 0]} visible={false}>
            <circleGeometry args={[R, 48, 0, Math.PI / 2]} />
            <meshBasicMaterial color="#ff1a1a" transparent opacity={0.3} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
          <group ref={(g) => { hazRefs.current[i]!.sword = g; }} visible={false}>
            <mesh position={[0, ROOM.h / 2, 0]}>
              <cylinderGeometry args={[2.5, 5, ROOM.h, 16]} />
              <meshBasicMaterial color="#fff4b8" transparent opacity={0.32} depthWrite={false} />
            </mesh>
            <mesh position={[0, 22, 0]}>
              <boxGeometry args={[1.2, 40, 6]} />
              <meshStandardMaterial color="#d8dde2" metalness={0.8} roughness={0.25} />
            </mesh>
            <mesh position={[0, 43, 0]}>
              <boxGeometry args={[2, 2, 16]} />
              <meshStandardMaterial color="#7a1010" />
            </mesh>
            <mesh position={[0, 48, 0]}>
              <boxGeometry args={[1.6, 8, 1.6]} />
              <meshStandardMaterial color="#3a2210" />
            </mesh>
          </group>
        </group>
      ))}
      <mesh ref={zoneRef} rotation-x={-Math.PI / 2} position={[0, 0.3, 0]} visible={false}>
        <circleGeometry args={[BOSS_ZONE, 64]} />
        <meshBasicMaterial color="#ff2020" transparent opacity={0.4} depthWrite={false} />
      </mesh>
      <group ref={bossRef} visible={false} scale={BOSS_S}>
        <mesh position={[0, 3.2, 0]} castShadow>
          <boxGeometry args={[6, 0.5, 4]} />
          <meshStandardMaterial color="#b3121b" roughness={0.25} emissive="#3a0000" envMapIntensity={2} />
        </mesh>
        {LEG_M.map((_, l) => {
          const x = l % 2 ? 2.4 : -2.4, z = l < 2 ? -1.5 : 1.5;
          return (
            <mesh key={l} position={[x, 1.5, z]} castShadow>
              <boxGeometry args={[0.45, 3, 0.45]} />
              <meshStandardMaterial color="#8a0d14" />
            </mesh>
          );
        })}
        {[-1, 1].map((x) => (
          <mesh key={x} position={[x, 3.25, 2.02]} rotation-z={x * -0.35}>
            <boxGeometry args={[0.9, 0.22, 0.05]} />
            <meshStandardMaterial color="#ffd000" emissive="#ffb000" emissiveIntensity={2} />
          </mesh>
        ))}
      </group>
      {waves.map((_, i) => (
        <mesh key={i} ref={(m) => { waveRefs.current[i] = m; }} visible={false}>
          <cylinderGeometry args={[1, 1, 1, 64, 1, true]} />
          <meshBasicMaterial color="#ff2a2a" transparent opacity={0.7} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
      {health.map((_, i) => (
        <group key={i} ref={(group) => { healthRefs.current[i] = group; }} visible={false}>
          <mesh rotation-x={-Math.PI / 2}>
            <torusGeometry args={[HEALTH_R * 0.75, 0.5, 10, 40]} />
            <meshBasicMaterial color="#3cff70" toneMapped={false} />
          </mesh>
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.08, 0]}>
            <ringGeometry args={[0, HEALTH_R * 0.75, 40]} />
            <meshBasicMaterial color="#3cff70" transparent opacity={0.2} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
          {/* plus (health) */}
          <mesh position={[0, 0.2, 0]} userData={{ kind: "plus" }}>
            <boxGeometry args={[4, 0.25, 1]} />
            <meshBasicMaterial color="#3cff70" toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.2, 0]} userData={{ kind: "plus" }}>
            <boxGeometry args={[1, 0.25, 4]} />
            <meshBasicMaterial color="#3cff70" toneMapped={false} />
          </mesh>
          {/* square (player shard) */}
          <mesh position={[0, 0.25, 0]} userData={{ kind: "square" }} visible={false}>
            <boxGeometry args={[2.8, 0.35, 2.8]} />
            <meshBasicMaterial color="#3a9eff" toneMapped={false} />
          </mesh>
        </group>
      ))}
      <group ref={ropeRef} visible={false}>
        <mesh>
          <cylinderGeometry args={[0.052, 0.052, 1, 9]} />
          <meshStandardMaterial color="#a17645" roughness={0.95} />
        </mesh>
        {ropeBraid.map((geometry, i) => (
          <mesh key={i} geometry={geometry}>
            <meshStandardMaterial color={i === 1 ? "#f4d9a0" : "#d8b779"} roughness={0.88} />
          </mesh>
        ))}
      </group>
      <mesh ref={parryMesh} visible={false}>
        <sphereGeometry args={[2, 24, 16]} />
        <meshBasicMaterial color="#6fc3ff" transparent opacity={0.15} side={THREE.BackSide} depthWrite={false} />
      </mesh>
    </>
  );
}
