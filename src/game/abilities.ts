import { useSyncExternalStore } from "react";

export type AbilityId = "wall" | "trampoline" | "fire" | "teleport";

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
];

const STORE = "tw-ability";
let selected: AbilityId = "wall";
const subs = new Set<() => void>();

function load() {
  try {
    const v = localStorage.getItem(STORE);
    if (v === "wall" || v === "trampoline" || v === "fire" || v === "teleport") selected = v;
  } catch { /* ignore */ }
}
load();

function bump() { subs.forEach((f) => f()); }

export function getAbility() { return selected; }
export function setAbility(id: AbilityId) {
  selected = id;
  try { localStorage.setItem(STORE, id); } catch { /* ignore */ }
  bump();
}
export function useAbility() {
  return useSyncExternalStore(
    (cb) => { subs.add(cb); return () => { subs.delete(cb); }; },
    () => selected,
    () => selected,
  );
}
