export const MAG = 40;
export const FIRE_INTERVAL = 5 / 24; // 24 splinters in 5s
export const DMG = 5;
export const PARRY_WINDOW = 1;
export const PARRY_CD = 9; // starts on activation
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
  { title: "Grapple", text: "Look at a wall or furniture and HOLD C to swing on a rope." },
  { title: "Scope", text: "HOLD RIGHT CLICK to scope in, then SCROLL the mouse wheel to change zoom." },
  { title: "Brown tables", text: "Brown tables are the normal enemies — they hop around and shoot splinters. LEFT CLICK to shoot this one: your splinters explode on impact and hurt everything nearby. R reloads (on the ground). In the air, R is a GROUND POUND." },
  { title: "Bombs", text: "Press F to throw a bomb. It explodes in a big area. Blow this table up!" },
  { title: "Parry", text: "This table shoots back! Press E right before a bullet hits you to PARRY it — the reflected shot deals 10 damage and you get a 2 second power boost (infinite ammo, 2x damage). Parry has a 9s cooldown." },
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
  resetToken: 0,
  respawnToken: 0,
  respawnMsg: 0,
  tutStep: 0,
  trainMenu: false,
  pvpDead: false,
  frozen: false,
  bossMax: BOSS_HITS,
  tut: { enter: false, dashed: false, zoomed: false, bombed: false },
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
};

export function resetGame(mode: Mode = G.mode) {
  Object.assign(G, {
    mode, stage: "tables", playerHp: MAX_HP, slamCd: 0, slamming: false, bounceWin: 0, ammo: MAG, reloading: 0, parryWin: 0, parryCd: 0, buff: 0,
    dashCd: 0, bombCd: 0, airJumps: AIR_JUMPS, airDashes: AIR_DASHES, wallrun: false, wallrunTime: 3, wallrunRecharge: 1, wallrunReady: true, grounded: true, grappling: false,
    speed: 0, altitude: 0, slamAoe: 1.35, slamAoeMax: 10.8,
    hitFlash: 0, hurtFlash: 0, parryFlash: 0, redFlash: 0, shake: 0, alive: 1, bluesAlive: 0, kills: 0, capReached: false,
    bossWarn: 0, bossHits: 0, bossTime: 0, parryLocked: false, compromisedT: 0, stun: 0, bombBig: 0, countdown: 0,
    shots: 0, hits: 0, parries: 0, time: 0, firing: false, scoped: false, respawnMsg: 0, tutStep: 0,
    tut: { enter: false, dashed: false, zoomed: false, bombed: false },
    trainMenu: false, bossMax: BOSS_HITS, pvpDead: false, frozen: false,
    campaignDead: false, shardProgress: 0, reviveQueue: [], freecam: false, freecamSpeedIdx: 0, lobbyRespawnT: 0, onlineTut: false, diedThisRun: [],
  });
  TRAIN_Q.length = 0;
  if (mode === "training") Object.assign(G, { playerHp: TRAIN.maxHp, airJumps: TRAIN.airJumps, airDashes: TRAIN.airDashes });
  G.resetToken++;
  G.phase = "playing";
}

export function goHome() {
  resetGame("game");
  G.phase = "home";
  document.exitPointerLock?.();
}

export function finishTutorial() {
  try { localStorage.setItem("tw-tutorial-done", "1"); } catch { /* ignore */ }
  goHome();
}

// Pointer lock is requested directly from button clicks so Resume/Restart always work.
let lockFn: (() => void) | null = null;
export function setLocker(fn: (() => void) | null) {
  lockFn = fn;
}
export function lockPointer() {
  try {
    lockFn?.();
  } catch {
    /* browser may refuse right after Esc; user can click again */
  }
}

// Minimap snapshot, written by World each frame, read by the HUD.
export const MAP = { px: 0, pz: 0, yaw: 0, boss: null as null | { x: number; z: number }, tables: [] as number[], blues: [] as number[], health: [] as number[], peers: [] as number[] };

// --- Training mode sandbox ---
export type TrainSpawn = { kind: "brown" | "blue" | "boss"; n: number; t: number };
export const TRAIN_DEFAULTS = {
  ringsPer10: 2, bossHp: BOSS_HITS, bossCd: 1.5, maxHp: MAX_HP, parryCd: PARRY_CD, dashCd: DASH_CD, bombCd: BOMB_CD,
  wallrunCd: 1, airJumps: AIR_JUMPS, airDashes: AIR_DASHES, slamCd: 1, grappleM: 8.5,
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
