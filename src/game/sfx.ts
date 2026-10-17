import { SETTINGS } from "./settings";

/**
 * Sound effects. Files live in /public/audio/sfx. Volume comes from the "Sound effects volume" setting
 * (0 = off). Effects are meant to sit under the gameplay, so every one gets a small per-sound trim, and
 * the ones that can repeat quickly have a minimum gap so they never turn into a buzz.
 */
export type Sfx =
  | "ui_hover" | "ui_click" | "ui_back"
  | "jump" | "air_jump" | "dash" | "land" | "wallrun"
  | "grapple_fire" | "grapple_attach" | "grapple_release" | "bounce_pad"
  | "shoot" | "reload" | "hit_marker" | "kill" | "player_hurt"
  | "bomb_throw" | "bomb_explode" | "fire_explode"
  | "slam_start" | "slam_land" | "slam_cancel" | "slam_bounce"
  | "parry_raise" | "parry_success" | "parry_fail"
  | "teleport_expand" | "teleport_success" | "fire_ground" | "fire_air"
  | "spring_place" | "spring_reset" | "wall_place" | "ability_ready"
  | "combo_burst" | "countdown_tick" | "countdown_go" | "health_pickup" | "shard_pickup"
  | "stun" | "death" | "respawn" | "storm_loop" | "storm_tick";

const TRIM: Record<Sfx, number> = {
  ui_hover: 1.0, ui_click: 1.0, ui_back: 1.0,
  jump: 0.6, air_jump: 0.65, dash: 0.7, land: 0.7, wallrun: 0.6,
  grapple_fire: 0.75, grapple_attach: 0.8, grapple_release: 0.6, bounce_pad: 0.85,
  shoot: 0.45, reload: 0.7, hit_marker: 0.6, kill: 0.9, player_hurt: 0.9,
  bomb_throw: 0.75, bomb_explode: 1.0, fire_explode: 0.95,
  slam_start: 0.8, slam_land: 1.0, slam_cancel: 0.7, slam_bounce: 0.85,
  parry_raise: 0.6, parry_success: 1.0, parry_fail: 0.6,
  teleport_expand: 0.8, teleport_success: 0.9, fire_ground: 0.8, fire_air: 0.85,
  spring_place: 0.8, spring_reset: 0.7, wall_place: 0.9, ability_ready: 0.55,
  combo_burst: 0.9, countdown_tick: 0.6, countdown_go: 0.8, health_pickup: 0.7, shard_pickup: 0.7,
  stun: 0.7, death: 0.9, respawn: 0.7, storm_loop: 0.55, storm_tick: 0.8,
};
/** Minimum milliseconds between two plays of the same sound. */
const MIN_GAP: Partial<Record<Sfx, number>> = {
  ui_hover: 50, hit_marker: 60, player_hurt: 150, land: 150, shoot: 40, bounce_pad: 120, kill: 80,
};

const cache = new Map<Sfx, HTMLAudioElement>();
const lastPlay = new Map<Sfx, number>();
const loops = new Map<Sfx, HTMLAudioElement>();

function volume() { return (SETTINGS.sfxVolume ?? 50) / 100; }
function base(id: Sfx) {
  let b = cache.get(id);
  if (!b) { b = new Audio(`/audio/sfx/${id}.mp3`); b.preload = "auto"; cache.set(id, b); }
  return b;
}

export function playSfx(id: Sfx, gain = 1) {
  if (typeof window === "undefined") return;
  const vol = volume();
  if (vol <= 0 || gain <= 0) return;
  const now = performance.now(), gap = MIN_GAP[id] ?? 0;
  if (gap && now - (lastPlay.get(id) ?? -1e9) < gap) return;
  lastPlay.set(id, now);
  try {
    const el = base(id).cloneNode() as HTMLAudioElement; // lets the same sound overlap itself
    el.volume = Math.max(0, Math.min(1, vol * TRIM[id] * gain));
    void el.play().catch(() => { /* blocked until a user gesture */ });
  } catch { /* ignore */ }
}

/** Start/stop a looping sound (wall-run swish, storm wind). Safe to call every frame. */
export function setLoop(id: Sfx, on: boolean, gain = 1) {
  if (typeof window === "undefined") return;
  let el = loops.get(id);
  if (!on || volume() <= 0) { if (el && !el.paused) el.pause(); return; }
  if (!el) { el = new Audio(`/audio/sfx/${id}.mp3`); el.loop = true; loops.set(id, el); }
  el.volume = Math.max(0, Math.min(1, volume() * TRIM[id] * gain));
  if (el.paused) void el.play().catch(() => { /* blocked until a user gesture */ });
}

/** Menu button hover / click / back sounds (plain DOM events, so every button gets them). */
let uiStarted = false;
export function startUiSfx() {
  if (uiStarted || typeof window === "undefined") return;
  uiStarted = true;
  let lastEl: Element | null = null;
  const btn = (t: EventTarget | null) => ((t as HTMLElement | null)?.closest?.(".gui button, .gui [role=button]") ?? null) as HTMLElement | null;
  document.addEventListener("pointerover", (e) => {
    if (e.pointerType === "touch") return;
    const b = btn(e.target);
    if (b && b !== lastEl && !(b as HTMLButtonElement).disabled) playSfx("ui_hover");
    lastEl = b;
  }, true);
  document.addEventListener("click", (e) => {
    const b = btn(e.target);
    if (!b || (b as HTMLButtonElement).disabled) return;
    playSfx(/^\s*(back|close|cancel|exit|leave|no\b|done)/i.test(b.textContent ?? "") ? "ui_back" : "ui_click");
  }, true);
}
