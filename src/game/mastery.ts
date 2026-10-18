import { useSyncExternalStore } from "react";
import { getAbility, type AbilityId } from "./abilities";
import { G } from "./state";

/**
 * Achievements + ability masteries.
 *
 * Beating the campaign (offline or party) with an ability equipped earns that ability's achievement,
 * and the achievement unlocks the ability's mastery. A mastery can be switched on/off per ability.
 * Signed-in players keep their progress (it is saved with the rest of their profile settings);
 * guests keep it only until the tab is closed.
 */

export type AchievementId = "bricked_master" | "cant_catch_me_now" | "hot_stuff" | "now_you_see_me";

export type Achievement = {
  id: AchievementId;
  name: string;
  icon: string;
  ability: AbilityId;
  /** one-line summary shown in the list */
  summary: string;
  /** how to earn it (Details) */
  how: string;
  masteryName: string;
};

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "bricked_master", name: "Bricked Master", icon: "🧱", ability: "wall", masteryName: "Wall Mastery",
    summary: "Beat campaign mode using the Wall ability.",
    how: "Select the Wall ability, then beat campaign mode (defeat the boss) with Wall equipped. Party campaign counts for every teammate who had Wall equipped.",
  },
  {
    id: "cant_catch_me_now", name: "Can't Catch Me Now", icon: "🟢", ability: "trampoline", masteryName: "Spring Mastery",
    summary: "Beat campaign mode using the Trampoline ability.",
    how: "Select the Trampoline ability, then beat campaign mode (defeat the boss) with Trampoline equipped. Party campaign counts for every teammate who had Trampoline equipped.",
  },
  {
    id: "hot_stuff", name: "Hot Stuff", icon: "🔥", ability: "fire", masteryName: "Fire Mastery",
    summary: "Beat campaign mode using the Fire ability.",
    how: "Select the Fire ability, then beat campaign mode (defeat the boss) with Fire equipped. Party campaign counts for every teammate who had Fire equipped.",
  },
  {
    id: "now_you_see_me", name: "Now You See Me, Now You Don't", icon: "🟣", ability: "teleport", masteryName: "Teleport Mastery",
    summary: "Beat campaign mode using the Teleport ability.",
    how: "Select the Teleport ability, then beat campaign mode (defeat the boss) with Teleport equipped. Party campaign counts for every teammate who had Teleport equipped.",
  },
];

/** What each mastery changes — shown in the Abilities details panel and the Achievements details. */
export const MASTERY_LINES: Record<AbilityId, string[]> = {
  wall: [
    "Walls glow red and are 1.5× bigger in every dimension.",
    "Enemies touching a wall take 10 damage every 0.7s (bots, tables, and players in modes where players can hurt each other).",
    "When a wall runs out of time it is no longer solid: it flies to you and only disappears when it touches you. It still damages enemies on the way.",
    "Never hurts you or your teammates.",
  ],
  trampoline: [
    "Pads turn red with a gold coil.",
    "Resetting your trampolines makes every pad EXPLODE in a huge blast: 5 damage, and anything that survives is slammed straight down (all other motion cancelled) and stunned for 2s once it hits the ground.",
    "Trampoline cooldown is 1.5s shorter (3.5s).",
    "Never hurts you or your teammates.",
  ],
  fire: [
    "The ground fire line is 2× bigger.",
    "The air fireball bounces up to 3 times; every bounce explodes with full damage and burn.",
    "Fire line and fireball explosions are blue.",
    "Never hurts you or your teammates.",
  ],
  teleport: [
    "Teleport balls are white.",
    "Anything the ball touches stays stunned from the moment it touches the growing circle until 3 seconds after you teleport.",
    "TELEPORT BOMB: while Teleport is ready, your bomb is white and teleports everything in its blast to where your crosshair was pointing when you threw it, stunning them 2s. The ability then cools down for 3s (the bomb's own cooldown is normal).",
    "Press the ability key during that 3s to rewind whatever your teleport bomb moved. (A normal teleport still only rewinds you.)",
    "Bomb thrown while the ability is cooling down (or mid-teleport) is a normal bomb. Normal damage either way.",
  ],
};

export function achievementFor(ability: AbilityId): Achievement {
  return ACHIEVEMENTS.find((a) => a.ability === ability)!;
}

// ---------------- state ----------------
type Progress = { earned: Partial<Record<AchievementId, true>>; off: Partial<Record<AbilityId, true>> };
let progress: Progress = { earned: {}, off: {} };
let justUnlocked: AchievementId[] = [];
let version = 0;
const subs = new Set<() => void>();
let persister: (() => void) | null = null;

function bump() {
  version++;
  subs.forEach((f) => f());
}
export function useProgress() {
  useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => version, () => 0);
  return progress;
}
export function setProgressPersister(fn: (() => void) | null) { persister = fn; }

export const hasAchievement = (id: AchievementId) => !!progress.earned[id];
/** The mastery has been earned (whether or not it is switched on). */
export const hasMastery = (ab: AbilityId) => !!progress.earned[achievementFor(ab).id];
/** The mastery is earned AND switched on — gameplay code asks this. */
export const masteryOn = (ab: AbilityId) => {
  // Training sandbox: whatever was picked in the training menu wins (earned or not) and is never saved
  if (G.mode === "training" && trainPick[ab] !== undefined) return trainPick[ab]!;
  return hasMastery(ab) && !progress.off[ab];
};
const trainPick: Partial<Record<AbilityId, boolean>> = {};
/** Training menu only: use the mastered (or normal) version of an ability, even if it isn't earned. Not saved. */
export function setTrainMastery(ab: AbilityId, on: boolean) { trainPick[ab] = on; bump(); }

export function setMasteryOn(ab: AbilityId, on: boolean) {
  if (!hasMastery(ab)) return;
  if (on) delete progress.off[ab]; else progress.off[ab] = true;
  bump();
  persister?.();
}

const awardSubs = new Set<(a: Achievement) => void>();
/** Called the moment an achievement is earned (drives the pop-up). */
export function onAchievement(fn: (a: Achievement) => void) { awardSubs.add(fn); return () => { awardSubs.delete(fn); }; }

function award(id: AchievementId) {
  if (progress.earned[id]) return false;
  progress.earned[id] = true;
  const ach = ACHIEVEMENTS.find((a) => a.id === id);
  if (ach) awardSubs.forEach((f) => f(ach));
  justUnlocked = [...justUnlocked, id];
  bump();
  persister?.();
  return true;
}

/** Called when the campaign boss is beaten. Awards the achievement for the ability equipped right now. */
export function onCampaignWin() {
  if (G.mode !== "game") return; // campaign only (not training / tutorial / 1v1)
  award(achievementFor(getAbility()).id);
}

/** Achievements earned during the current win screen (cleared when you leave it). */
export function getJustUnlocked() { return justUnlocked; }
export function clearJustUnlocked() { if (justUnlocked.length) { justUnlocked = []; bump(); } }

// ---------------- saving ----------------
export function serializeProgress() {
  return { earned: Object.keys(progress.earned), off: Object.keys(progress.off) };
}
/** Merge saved progress into the current one (keeps anything a guest earned before signing in). */
export function hydrateProgress(raw: unknown) {
  const r = raw as { earned?: unknown; off?: unknown } | null | undefined;
  if (!r || typeof r !== "object") return;
  const ids = new Set<string>(ACHIEVEMENTS.map((a) => a.id));
  const abs = new Set<string>(ACHIEVEMENTS.map((a) => a.ability));
  const next: Progress = { earned: { ...progress.earned }, off: { ...progress.off } };
  if (Array.isArray(r.earned)) for (const k of r.earned) if (typeof k === "string" && ids.has(k)) next.earned[k as AchievementId] = true;
  if (Array.isArray(r.off)) for (const k of r.off) if (typeof k === "string" && abs.has(k)) next.off[k as AbilityId] = true;
  progress = next;
  bump();
}
/** Forget everything (used when signing out so the next person on this tab starts clean). */
export function resetProgress() {
  progress = { earned: {}, off: {} };
  justUnlocked = [];
  bump();
}
