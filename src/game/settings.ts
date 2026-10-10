import { useSyncExternalStore } from "react";

export type TimeOfDay = "day" | "evening" | "night";
export type FireMode = "hold" | "toggle";
export type Action = "forward" | "back" | "left" | "right" | "jump" | "dash" | "parry" | "bomb" | "grapple" | "reload";

export const ACTIONS: { id: Action; label: string; desc: string }[] = [
  { id: "forward", label: "Move forward", desc: "Walk forward" },
  { id: "back", label: "Move back", desc: "Walk backward" },
  { id: "left", label: "Move left", desc: "Strafe left" },
  { id: "right", label: "Move right", desc: "Strafe right" },
  { id: "jump", label: "Jump", desc: "Jump (3 total) · hold at a wall to wallrun for 3s · land 1s to recharge" },
  { id: "dash", label: "Dash", desc: "Dash (4 in the air)" },
  { id: "parry", label: "Parry", desc: "Parry — reflect a bullet (10 dmg) + 2s power boost · 9s cooldown" },
  { id: "bomb", label: "Bomb", desc: "Throw a bomb" },
  { id: "grapple", label: "Grapple", desc: "Hold for grapple rope" },
  { id: "reload", label: "Reload / Slam", desc: "Reload (ground) · Ground pound (air) · again after landing to bounce" },
];

export type MobileBtnId = "fire" | "jump" | "dash" | "reload" | "parry" | "bomb" | "look" | "move";

export type MobileLayout = {
  /** Normalized 0–1 positions for each control (bottom-left origin for placement). */
  fire: { x: number; y: number };
  jump: { x: number; y: number };
  dash: { x: number; y: number };
  reload: { x: number; y: number };
  parry: { x: number; y: number };
  bomb: { x: number; y: number };
  move: { x: number; y: number };
  look: { x: number; y: number };
};

export type Settings = {
  sensitivity: number;
  fov: number;
  screenShake: boolean;
  shadows: boolean;
  fireMode: FireMode;
  timeOfDay: TimeOfDay;
  keys: Record<Action, string>;
  /** Mild aim assist strength 0–1 (mobile / optional). */
  aimAssist: number;
  /** Dash near-ground auto bunny hop (mobile). */
  autoBunnyHop: boolean;
  /** Mobile look sensitivity multiplier. */
  mobileSensitivity: number;
  mobileLayout: MobileLayout;
};

export const DEFAULT_MOBILE_LAYOUT: MobileLayout = {
  move: { x: 0.14, y: 0.28 },
  look: { x: 0.72, y: 0.35 },
  fire: { x: 0.88, y: 0.22 },
  jump: { x: 0.78, y: 0.18 },
  dash: { x: 0.68, y: 0.14 },
  reload: { x: 0.58, y: 0.12 },
  parry: { x: 0.88, y: 0.40 },
  bomb: { x: 0.78, y: 0.42 },
};

export const DEFAULT_SETTINGS: Settings = {
  sensitivity: 1,
  fov: 80,
  screenShake: true,
  shadows: true,
  fireMode: "hold",
  timeOfDay: "evening",
  keys: { forward: "KeyW", back: "KeyS", left: "KeyA", right: "KeyD", jump: "Space", dash: "KeyQ", parry: "KeyE", bomb: "KeyF", grapple: "KeyC", reload: "KeyR" },
  aimAssist: 0.22,
  autoBunnyHop: true,
  mobileSensitivity: 1.15,
  mobileLayout: { ...DEFAULT_MOBILE_LAYOUT },
};

const STORE_KEY = "tw-settings";

/** The applied settings. Only changed through applySettings (the Save & Apply button). */
export let SETTINGS: Settings = structuredClone(DEFAULT_SETTINGS);
const subs = new Set<() => void>();
let loaded = false;

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Settings>;
      SETTINGS = {
        ...DEFAULT_SETTINGS, ...p,
        keys: { ...DEFAULT_SETTINGS.keys, ...(p.keys ?? {}) },
        mobileLayout: { ...DEFAULT_MOBILE_LAYOUT, ...(p.mobileLayout ?? {}) },
      };
      VIEW = SETTINGS;
    }
  } catch { /* ignore */ }
}

/** Online matches force a time of day without touching the player's own saved setting. */
let TOD_OVERRIDE: TimeOfDay | null = null;
let VIEW: Settings = SETTINGS;
function rebuild() {
  VIEW = TOD_OVERRIDE ? { ...SETTINGS, timeOfDay: TOD_OVERRIDE } : SETTINGS;
  subs.forEach((f) => f());
}
export function setTodOverride(t: TimeOfDay | null) {
  TOD_OVERRIDE = t;
  rebuild();
}
export function currentTod(): TimeOfDay {
  return TOD_OVERRIDE ?? SETTINGS.timeOfDay;
}
/** Called after settings are saved, so a signed-in account can store them. */
let persist: ((s: Settings) => void) | null = null;
export function setSettingsPersister(fn: ((s: Settings) => void) | null) {
  persist = fn;
}

export function applySettings(next: Settings, fromAccount = false) {
  SETTINGS = {
    ...DEFAULT_SETTINGS, ...structuredClone(next),
    keys: { ...DEFAULT_SETTINGS.keys, ...(next.keys ?? {}) },
    mobileLayout: { ...DEFAULT_MOBILE_LAYOUT, ...(next.mobileLayout ?? {}) },
  };
  try { localStorage.setItem(STORE_KEY, JSON.stringify(SETTINGS)); } catch { /* ignore */ }
  if (!fromAccount) persist?.(SETTINGS);
  rebuild();
}

function subscribe(f: () => void) {
  load();
  subs.add(f);
  // Notify once after hydration so stored settings take effect.
  queueMicrotask(f);
  return () => subs.delete(f);
}

export function useSettings() {
  return useSyncExternalStore(subscribe, () => VIEW, () => DEFAULT_SETTINGS);
}

export function keyLabel(code: string) {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return "Num " + code.slice(6);
  const map: Record<string, string> = {
    Space: "Space", ShiftLeft: "L-Shift", ShiftRight: "R-Shift", ControlLeft: "L-Ctrl", ControlRight: "R-Ctrl",
    AltLeft: "L-Alt", AltRight: "R-Alt", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", Tab: "Tab", CapsLock: "Caps",
  };
  return map[code] ?? code;
}

/** Base lamp output for the current time of day; other glows are scaled from it. */
export function lampIntensity(tod: TimeOfDay) {
  return 6000 * (tod === "night" ? 3 : 1);
}
