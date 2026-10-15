import { useSyncExternalStore } from "react";

export type AbilityId = "wall" | "trampoline" | "fire";

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
    desc: "Place a wooden wall in front of you (boss-height, 1 table thick). 4 uses, then 3s cooldown. Walls last 2s and have no friction.",
  },
  {
    id: "trampoline",
    name: "Trampoline",
    icon: "🟢",
    desc: "Stick a bounce pad on a surface within grapple range (faces outward). 3 uses, then 4s cooldown. Pads last 3s.",
  },
  {
    id: "fire",
    name: "Fire",
    icon: "🔥",
    desc: "Launch a fire line up to 2× grapple range. Stuns + 10 damage, ticks while standing in it, then slows leavers. 4s cooldown, lasts 3s.",
  },
];

const STORE = "tw-ability";
let selected: AbilityId = "wall";
const subs = new Set<() => void>();

function load() {
  try {
    const v = localStorage.getItem(STORE);
    if (v === "wall" || v === "trampoline" || v === "fire") selected = v;
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
