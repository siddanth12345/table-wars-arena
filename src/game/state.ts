export const MAG = 40;
import { playSfx } from "./sfx";
/** 1v1: seconds into a round before the storm starts closing in */
export const STORM_START = 60;
export const FIRE_INTERVAL = 5 / 24; // 24 splinters in 5s
export const DMG = 5;
export const PARRY_WINDOW = 1;
export const PARRY_CD = 7; // miss / activate cooldown
export const PARRY_CD_HIT = 4; // successful parry cooldown
export const PARRY_CD_MISS = 7;
export const BUFF_TIME = 2;
export const PARRY_DMG = 10; // damage of a parried (reflected) bullet
export const MAX_HP = 150;
export const DASH_CD = 2;
export const AIR_JUMPS = 2; // + 1 from the ground = 3
export const AIR_DASHES = 4;
export const BOMB_CD = 3;
export const BOMB_CD_BUFF = 2;
export const TABLE_HP = 5; // brown tables (halved)
export const TABLE_CAP = 30;
export const BOSS_HITS = 200;
export const BOSS_WARN = 10;
export const PARRY_LOCK_AT = 5; // seconds into the boss fight
export const SHARD_NEED = 7;
export const SHARD_INTERVAL = 3;
export const SHARD_LIFE = 2;
export const SHARD_SPAWN_N = 2; // how many spawn each interval
/** Shard pickup radius = 3× health-ring radius (set in World from HEALTH_R). */
export const LOBBY_RESPAWN = 5;
export const FREECAM_SPEEDS = [44, 100, 200, 300, 400] as const;

export type Phase = "home" | "playing" | "won" | "lost";
export type Stage = "tables" | "incoming" | "boss";
export type Mode = "game" | "tutorial" | "training" | "pvp";

export const TUT_STEPS: { title: string; text: string; enter?: boolean }[] = [
  { title: "You are the GREEN table", text: "Welcome to TBLE! You are the green table. Press ENTER to continue.", enter: true },
  { title: "Move", text: "Use W A S D to walk around and the mouse to look." },
  { title: "Jump", text: "Press SPACE to jump — then press SPACE twice more in the air (triple jump)." },
  { title: "Wallrun", text: "Jump next to a wall or furniture and HOLD SPACE to wallrun for up to 3 seconds. Land for 1 second to recharge it." },
  { title: "Dash", text: "Press Q to dash (works in the air too)." },
  { title: "Ground pound / slam", text: "In the air, press R to SLAM (ground pound). Right after you land, press R again quickly to bounce back up to the height you slammed from. The crosshair turns blue and tilts when aimed at an attackable enemy, and yellow when you can grapple." },
  { title: "Grapple", text: "Look at a wall or furniture and HOLD C to swing on a rope." },
  { title: "Scope", text: "HOLD RIGHT CLICK to scope in, then SCROLL the mouse wheel to change zoom." },
  { title: "Brown tables", text: "Brown tables are the normal enemies — they hop around and shoot splinters. LEFT CLICK to shoot this one: your splinters explode on impact and hurt everything nearby. R reloads (on the ground). In the air, R is a GROUND POUND." },
  { title: "Bombs", text: "Press F to throw a bomb. It explodes in a big area. Blow this table up!" },
  { title: "Combo meter", text: "Damage you deal builds a combo on the right of the screen. It resets after 2.5 seconds without hits. A successful parry resets all cooldowns and adds 50 combo. When the combo is high enough (100 offline / 50 in 1v1), press SHIFT (rebindable in Settings) to reset ALL cooldowns and heal (30 offline / 20 in 1v1). You cannot use this while dead." },
  { title: "Abilities", text: "Press V (default, rebindable) to use your selected ability. Choose Wall, Trampoline, or Fire from the Abilities menu on the home screen. Wall places wooden cover, Trampoline sticks a bounce pad to surfaces, Fire launches a burning line. Charges and cooldowns depend on the ability." },
  { title: "Parry", text: "This table shoots back! Press E right before a bullet hits you to PARRY it — the reflected shot deals 10 damage and you get a 2 second power boost (infinite ammo, 2x damage). Successful parry: 4s cooldown. Missed parry: 7s cooldown." },
  { title: "Blue tables", text: "Blue tables are fast chasers. They rush at you and explode on contact. Shoot them before they reach you!" },
  { title: "The Boss", text: "After you clear every table, the huge RED boss drops from the ceiling (stay out of the red circle!). He shoots, drops swords that stun you, stomps out expanding shockwaves you must JUMP over, and summons minions. 5 seconds in, your parry gets COMPROMISED. Press ENTER to continue.", enter: true },
  { title: "Party campaign revives", text: "In party campaign: when you die you stay dead. Teammates can revive you by collecting 7 player shards. Two shards spawn every 3 seconds and despawn 2 seconds later. First player to die is revived first. If the whole team dies, the run restarts — or restarts at the boss checkpoint if you had reached it." },
  { title: "Freecam (lobby & training)", text: "In Lobby and Training, press X to enter freecam (X again to exit). While in freecam: W flies toward where you're looking, S goes back, A/D strafe, scroll wheel zooms. Base speed is 44 (same as your table). Left-click cycles speed: 100 → 200 → 300 → 400 → back to 44. Freecam stops at the solid map edge — you can pass through walls and go outside into the neighborhood, but not past the map boundary." },
  { title: "Online modes", text: "From the home Play menu you can queue 1v1, create/join a Lobby with a 6-letter code, or party up with invites. In a party the leader starts Campaign, Training, 1v1, or Lobby for everyone. Party campaign shares enemies (host simulates). When you're partied, the Tutorial button becomes the Online tutorial covering 1v1, lobby, party campaign, invites, codes, and revives. Press ENTER to finish.", enter: true },
];

/** Shown when the player is in a party — covers online-only mechanics. */
export const ONLINE_TUT_STEPS: { title: string; text: string; enter?: boolean }[] = [
  { title: "Online tutorial", text: "You're in a party — this guide covers every online mode. Press ENTER to continue.", enter: true },
  { title: "Parties & invites", text: "Open Play → Party to invite by username. Guests get names like guest482913 and can be invited. The party leader starts modes; members wait. Disband or leave from the same menu." },
  { title: "Lobby codes", text: "Create Lobby to get a 6-letter code, or type a code to join. Lobby is free-for-all PvP with a 5-second respawn delay after you die." },
  { title: "1v1", text: "Queue 1v1 (or start 1v1 from a party). Both players pick a map — same pick wins, different picks are random. First to 3 wins. On the win screen both cameras zoom into the winner." },
  { title: "Party campaign", text: "Campaign with party shares the host's enemies. When you die you stay dead until a teammate collects 7 player shards. Two spawn every 3s and last 2s. First dead player is revived first. Whole team wipe restarts the run (or boss checkpoint if reached)." },
  { title: "Revives & shards", text: "Shards replace the old health rings in party campaign. Collect 7 to revive the teammate who has been dead the longest (FIFO). No shards spawn if nobody is waiting. Your own death doesn't end the run — only a full team wipe does." },
  { title: "Freecam", text: "In Lobby and Training press X for freecam (X to exit). W toward look direction, S back, A/D strafe, scroll to zoom. Left-click cycles speed 44→100→200→300→400→44. Clamped to the solid map edge.", enter: true },
];

export const G = {
  phase: "home" as Phase,
  mode: "game" as Mode,
  stage: "tables" as Stage,
  locked: false,
  playerHp: MAX_HP,
  slamCd: 0,
  slamming: false,
  bounceWin: 0,
  ammo: MAG,
  reloading: 0,
  parryWin: 0,
  parryCd: 0,
  buff: 0,
  dashCd: 0,
  bombCd: 0,
  airJumps: AIR_JUMPS,
  airDashes: AIR_DASHES,
  wallrun: false,
  wallrunTime: 3,
  wallrunRecharge: 1,
  wallrunReady: true,
  grounded: true,
  grappling: false,
  speed: 0,
  altitude: 0,
  slamAoe: 1.35,
  slamAoeMax: 10.8,
  scoped: false,
  zoomFov: 28,
  firing: false,
  hitFlash: 0,
  hurtFlash: 0,
  parryFlash: 0,
  redFlash: 0,
  shake: 0,
  alive: 1,
  bluesAlive: 0,
  kills: 0,
  capReached: false,
  bossWarn: 0,
  bossHits: 0,
  bossTime: 0,
  parryLocked: false,
  compromisedT: 0,
  stun: 0,
  bombBig: 0,
  countdown: 0,
  shots: 0,
  hits: 0,
  parries: 0,
  time: 0,
  stormR: 0, // 1v1 storm radius (0 = no storm yet)
  inStorm: false,
  resetToken: 0,
  respawnToken: 0,
  respawnMsg: 0,
  tutStep: 0,
  trainMenu: false,
  userPaused: false,
  chatOpen: false,
  pvpDead: false,
  frozen: false,
  bossMax: BOSS_HITS,
  tut: { enter: false, dashed: false, zoomed: false, bombed: false, slammed: false },
  /** Crosshair feedback: normal | enemy (blue tilt) | grapple (yellow) */
  crosshair: "normal" as "normal" | "enemy" | "grapple",
  canGrapple: false,
  isMobile: false,
  mobileTut: false,
  mobileTutStep: 0,
  mobilePaused: false,
  /** Party campaign: local player is waiting for a revive. */
  campaignDead: false,
  /** Shard boxes collected toward next revive (0..SHARD_NEED). */
  shardProgress: 0,
  /** Player ids waiting for revive, oldest first (FIFO). */
  reviveQueue: [] as string[],
  freecam: false,
  freecamSpeedIdx: 0,
  lobbyRespawnT: 0,
  /** Online tutorial instead of normal tutorial. */
  onlineTut: false,
  /** Players who died during the current party campaign run (ids/names for win screen). */
  diedThisRun: [] as string[],
  combo: 0,
  comboTimer: 0,
  abilityCd: 0,
  abilityCharges: 4,
  abilitySlow: 0,
  abilityLocked: false,
  burnBuff: 0,

  dmgFloat: { amount: 0, targetId: "", x: 0.5, y: 0.4, t: 0, pop: 0 },
};

export function resetGame(mode: Mode = G.mode) {
  Object.assign(G, {
    mode, stage: "tables", playerHp: MAX_HP, slamCd: 0, slamming: false, bounceWin: 0, ammo: MAG, reloading: 0, parryWin: 0, parryCd: 0, buff: 0,
    dashCd: 0, bombCd: 0, airJumps: AIR_JUMPS, airDashes: AIR_DASHES, wallrun: false, wallrunTime: 3, wallrunRecharge: 1, wallrunReady: true, grounded: true, grappling: false,
    speed: 0, altitude: 0, slamAoe: 1.35, slamAoeMax: 10.8,
    hitFlash: 0, hurtFlash: 0, parryFlash: 0, redFlash: 0, shake: 0, alive: 1, bluesAlive: 0, kills: 0, capReached: false,
    bossWarn: 0, bossHits: 0, bossTime: 0, parryLocked: false, compromisedT: 0, stun: 0, bombBig: 0, countdown: 0,
    shots: 0, hits: 0, parries: 0, time: 0, stormR: 0, inStorm: false, firing: false, scoped: false, respawnMsg: 0, tutStep: 0,
    tut: { enter: false, dashed: false, zoomed: false, bombed: false, slammed: false },
    crosshair: "normal", canGrapple: false, mobileTut: false, mobileTutStep: 0, mobilePaused: false,
    trainMenu: false, userPaused: false, chatOpen: false, bossMax: BOSS_HITS, pvpDead: false, frozen: false,
    campaignDead: false, shardProgress: 0, reviveQueue: [], freecam: false, freecamSpeedIdx: 0, lobbyRespawnT: 0, onlineTut: false, diedThisRun: [],
    combo: 0, comboTimer: 0, abilityCd: 0, abilityCharges: 4, abilitySlow: 0, abilityLocked: false, burnBuff: 0,
    dmgFloat: { amount: 0, targetId: "", x: 0.5, y: 0.4, t: 0, pop: 0 },
  });
  TRAIN_Q.length = 0;
  if (mode === "training") Object.assign(G, { playerHp: TRAIN.maxHp, airJumps: TRAIN.airJumps, airDashes: TRAIN.airDashes });
  G.resetToken++;
  G.phase = "playing";
}

export function goHome() {
  resetGame("game");
  G.phase = "home";
  G.locked = false;
  G.userPaused = false;
  G.firing = false;
  G.scoped = false;
  setCursorLocked(false);
  try { document.exitPointerLock?.(); } catch { /* ignore */ }
}

export function finishTutorial() {
  try { localStorage.setItem("tw-tutorial-done", "1"); } catch { /* ignore */ }
  // dynamic import avoids circular dep (mastery imports G from state)
  void import("./mastery").then((m) => m.onTutorialComplete());
  goHome();
}

// Pointer lock is requested directly from button clicks so Resume/Restart always work.
let lockFn: (() => void) | null = null;
export function setLocker(fn: (() => void) | null) {
  lockFn = fn;
}

/** Phones/tablets (incl. iPad + mouse/keyboard). Real pointer-lock is unreliable here. */
export function isMobilePlay() {
  if (typeof window === "undefined") return false;
  try {
    // Multi-touch → soft-lock (iPad often reports fine pointer when a mouse is connected)
    if (typeof navigator.maxTouchPoints === "number" && navigator.maxTouchPoints > 1) return true;
    if (window.matchMedia("(pointer: coarse)").matches) return true;
    if (/Android|iPhone|iPod|iPad|Mobile/i.test(navigator.userAgent)) return true;
  } catch { /* ignore */ }
  return false;
}

export function setCursorLocked(on: boolean) {
  try {
    document.body.style.cursor = on ? "none" : "";
    document.documentElement.style.cursor = on ? "none" : "";
    // Clear any leftover canvas / capture-surface cursor
    document.querySelectorAll("canvas, [data-look-layer]").forEach((el) => {
      try { (el as HTMLElement).style.cursor = on ? "none" : ""; } catch { /* ignore */ }
    });
  } catch { /* ignore */ }
}

export function pauseGame() {
  if (G.chatOpen) return; // chat mouse-free mode is not a pause
  G.userPaused = true;
  G.locked = false;
  G.firing = false;
  G.scoped = false;
  setCursorLocked(false);
  try { document.exitPointerLock?.(); } catch { /* ignore */ }
}

function tryHardLock() {
  try { lockFn?.(); } catch { /* ignore */ }
  const targets: HTMLElement[] = [];
  try {
    const c = document.querySelector("canvas");
    if (c) targets.push(c as HTMLElement);
  } catch { /* ignore */ }
  targets.push(document.body);
  for (const el of targets) {
    try {
      const req = el.requestPointerLock as undefined | ((opts?: { unadjustedMovement?: boolean }) => void);
      if (!req) continue;
      try { req.call(el, { unadjustedMovement: true }); } catch { req.call(el); }
      if (document.pointerLockElement) return true;
    } catch { /* ignore */ }
  }
  return !!document.pointerLockElement;
}

/** Lock for play. Mobile = soft-lock (+ hard lock if browser allows). Pause unlocks. */
export function lockPointer() {
  G.userPaused = false;
  const mobile = isMobilePlay();
  tryHardLock();
  if (mobile) {
    G.locked = true;
    setCursorLocked(true);
    return;
  }
  G.locked = !!document.pointerLockElement;
  setCursorLocked(G.locked);
}


/** Record damage you dealt: floating number + combo meter. amount = actual HP/hit points applied. */
export function registerDamage(amount: number, targetId: string, screenX = 0.5, screenY = 0.42) {
  if (!(amount > 0) || G.phase !== "playing") return;
  playSfx("hit_marker");
  const a = Math.round(amount * 10) / 10;
  G.combo += a;
  G.comboTimer = G.mode === "pvp" ? 5 : 2.5;
  G.dmgFloat = {
    amount: a,
    targetId,
    x: Math.min(0.92, Math.max(0.08, screenX)),
    y: Math.min(0.85, Math.max(0.12, screenY)),
    t: 0.95,
    pop: 1,
  };
}

/** Combo burst: offline >100 → heal 30; 1v1 >50 → heal 20. Always resets CDs. */
export function comboDecayTime() {
  return G.mode === "pvp" ? 5 : 2.5;
}
export function comboBurstThreshold() {
  return G.mode === "pvp" ? 50 : 100;
}
export function comboBurstHeal() {
  return G.mode === "pvp" ? 20 : 30;
}
/** Successful parry: reset every cooldown (ability included) and add 50 to the combo meter. */
export function onParrySuccess() {
  G.slamCd = 0;
  G.parryCd = 0;
  G.dashCd = 0;
  G.bombCd = 0;
  G.reloading = 0;
  // tiny positive value so World's ability tick finishes the cooldown and refills the charges itself
  if (G.abilityCd > 0) G.abilityCd = 0.0001;
  G.combo += 50;
  G.comboTimer = comboDecayTime();
}
export function tryComboBurst() {
  if (G.phase !== "playing" || G.combo < comboBurstThreshold()) return false;
  if (G.playerHp <= 0 || G.pvpDead || G.campaignDead) return false;
  const heal = comboBurstHeal();
  G.combo = 0;
  G.comboTimer = 0;
  G.slamCd = 0;
  G.parryCd = 0;
  G.dashCd = 0;
  G.bombCd = 0;
  G.reloading = 0;
  G.playerHp = Math.min(cfg.maxHp(), G.playerHp + heal);
  G.hitFlash = 0.25;
  G.parryFlash = 0.2;
  playSfx("combo_burst");
  return true;
}

// Minimap snapshot, written by World each frame, read by the HUD.
export const MAP = { px: 0, pz: 0, yaw: 0, boss: null as null | { x: number; z: number }, tables: [] as number[], blues: [] as number[], health: [] as number[], peers: [] as number[] };

// --- Training mode sandbox ---
export type TrainSpawn = { kind: "brown" | "blue" | "boss"; n: number; t: number };
export const TRAIN_DEFAULTS = {
  ringsPer10: 2, bossHp: BOSS_HITS, bossCd: 1.5, maxHp: MAX_HP, parryCd: PARRY_CD, dashCd: DASH_CD, bombCd: BOMB_CD,
  wallrunCd: 1, airJumps: AIR_JUMPS, airDashes: AIR_DASHES, slamCd: 1, grappleM: 8.5, brownHp: TABLE_HP, blueHp: 10,
};
export type TrainCfg = typeof TRAIN_DEFAULTS;
/** Applied training values (changed only when the training menu is closed with Close/Enter). */
export const TRAIN: TrainCfg = { ...TRAIN_DEFAULTS };
/** Spawns waiting on their timer. */
export const TRAIN_Q: TrainSpawn[] = [];
export const TRAIN_CMD = { despawn: false };

const training = () => G.mode === "training";
/** Gameplay values that training mode can override. */
export const cfg = {
  maxHp: () => (training() ? TRAIN.maxHp : MAX_HP),
  parryCd: () => (training() ? TRAIN.parryCd : PARRY_CD),
  dashCd: () => (training() ? TRAIN.dashCd : DASH_CD),
  bombCd: (buffed: boolean) => (training() ? TRAIN.bombCd * (buffed ? BOMB_CD_BUFF / BOMB_CD : 1) : buffed ? BOMB_CD_BUFF : BOMB_CD),
  wallrunCd: (base: number) => (training() ? TRAIN.wallrunCd : base),
  airJumps: () => (training() ? TRAIN.airJumps : AIR_JUMPS),
  airDashes: () => (training() ? TRAIN.airDashes : AIR_DASHES),
  slamCd: (base: number) => (training() ? TRAIN.slamCd : base),
  grapple: (base: number) => (training() ? TRAIN.grappleM * 10 : base),
  bossCdK: () => (training() ? TRAIN.bossCd / 1.5 : 1),
  ringInterval: (base: number) => (training() ? 10 / TRAIN.ringsPer10 : base),
};
