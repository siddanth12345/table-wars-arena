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

export type Settings = {
  sensitivity: number;
  fov: number;
  screenShake: boolean;
  shadows: boolean;
  fireMode: FireMode;
  timeOfDay: TimeOfDay;
  keys: Record<Action, string>;
};

export const DEFAULT_SETTINGS: Settings = {
  sensitivity: 1,
  fov: 80,
  screenShake: true,
  shadows: true,
  fireMode: "hold",
  timeOfDay: "evening",
  keys: { forward: "KeyW", back: "KeyS", left: "KeyA", right: "KeyD", jump: "Space", dash: "KeyQ", parry: "KeyE", bomb: "KeyF", grapple: "KeyC", reload: "KeyR" },
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
      SETTINGS = { ...DEFAULT_SETTINGS, ...p, keys: { ...DEFAULT_SETTINGS.keys, ...(p.keys ?? {}) } };
    }
  } catch { /* ignore */ }
}

export function applySettings(next: Settings) {
  SETTINGS = structuredClone(next);
  try { localStorage.setItem(STORE_KEY, JSON.stringify(SETTINGS)); } catch { /* ignore */ }
  subs.forEach((f) => f());
}

function subscribe(f: () => void) {
  load();
  subs.add(f);
  // Notify once after hydration so stored settings take effect.
  queueMicrotask(f);
  return () => subs.delete(f);
}

export function useSettings() {
  return useSyncExternalStore(subscribe, () => SETTINGS, () => DEFAULT_SETTINGS);
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
