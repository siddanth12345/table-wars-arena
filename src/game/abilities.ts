import { useSyncExternalStore } from "react";
import { G } from "./state";

export type AbilityId = "wall" | "trampoline" | "fire" | "teleport" | "boss";

export type AbilityDef = {
  id: AbilityId;
  name: string;
  icon: string;
  desc: string;
};

export const ABILITY_LIST: AbilityDef[] = [
  {
    id: "wall",
    name: "Wall",
    icon: "🧱",
    desc: "Omnidirectional wooden cover. 6 uses → 3s cooldown. Grappleable.",
  },
  {
    id: "trampoline",
    name: "Trampoline",
    icon: "🟢",
    desc: "Place up to 3 pads. After all 3, press V again to Reset Trampolines (5s CD, clears pads). Auto-grapple within 2× range.",
  },
  {
    id: "fire",
    name: "Fire",
    icon: "🔥",
    desc: "Ground: fire line 10 dmg (5s CD). Air: bomb-like fireball with burn (4s CD).",
  },
  {
    id: "teleport",
    name: "Teleport",
    icon: "🟣",
    desc: "Mark a point (3.5× grapple range). Purple ball grows, then you blink. Cancel free; rewind once during CD.",
  },
  {
    id: "boss",
    name: "Boss",
    icon: "🔴",
    desc: "Hardcore unlock. 3 charges, 5s cooldown once they run out. Ground: aimed quarter-room strike, 25 dmg (2 charges). Air: throw a bouncing spinning sword (1 charge). Max-area slams release a 3s stun ring. No mastery.",
  },
];

const STORE = "tw-ability";
const LAST_UNLOCKED_STORE = "tw-last-unlocked-ability";
let selected: AbilityId = "wall";
const subs = new Set<() => void>();

/** Injected from mastery to avoid circular imports. */
let unlockCheck: ((id: AbilityId, mode?: string) => boolean) | null = null;
export function setAbilityUnlockCheck(fn: (id: AbilityId, mode?: string) => boolean) {
  unlockCheck = fn;
}

function load() {
  try {
    const v = localStorage.getItem(STORE);
    if (v === "wall" || v === "trampoline" || v === "fire" || v === "teleport" || v === "boss") selected = v;
  } catch { /* ignore */ }
}
load();

function bump() { subs.forEach((f) => f()); }

/** Resolve play context so Boss stays allowed in training/lobby even if callers omit mode. */
export function abilityContext(mode?: string): string | undefined {
  if (mode === "training" || mode === "lobby") return mode;
  // Lobby sessions use training mode; offline training too
  if (G.mode === "training") return "training";
  return mode;
}

/** Boss needs Hardcore (except training / lobby). Other abilities are always free. */
export function canUseAbility(id: AbilityId, mode?: string): boolean {
  if (id !== "boss") return true;
  const m = abilityContext(mode);
  if (m === "training" || m === "lobby") return true;
  if (unlockCheck) return unlockCheck(id, m);
  return false;
}

/** If current selection isn't allowed, fall back to last unlocked (not boss) and persist. */
export function clampSelectedAbility(mode?: string) {
  const m = abilityContext(mode);
  if (canUseAbility(selected, m)) return selected;
  const fallback = getLastUnlockedAbility();
  selected = fallback;
  try { localStorage.setItem(STORE, fallback); } catch { /* ignore */ }
  bump();
  return selected;
}

export function getAbility(mode?: string) {
  return clampSelectedAbility(mode);
}
export function getLastUnlockedAbility(): AbilityId {
  try {
    const v = localStorage.getItem(LAST_UNLOCKED_STORE);
    if (v === "wall" || v === "trampoline" || v === "fire" || v === "teleport") return v;
  } catch { /* ignore */ }
  return "wall";
}
export function setAbility(id: AbilityId, mode?: string) {
  if (!canUseAbility(id, mode)) return;
  if (id !== "boss") {
    try { localStorage.setItem(LAST_UNLOCKED_STORE, id); } catch { /* ignore */ }
  }
  selected = id;
  try { localStorage.setItem(STORE, id); } catch { /* ignore */ }
  bump();
}
export function useAbility() {
  return useSyncExternalStore(
    (cb) => { subs.add(cb); return () => { subs.delete(cb); }; },
    () => clampSelectedAbility(abilityContext()),
    () => selected,
  );
}
