import { useSyncExternalStore } from "react";
import { getAbility, setAbilityUnlockCheck, type AbilityId } from "./abilities";
import { G } from "./state";

/**
 * Achievements + ability masteries.
 * Mastery achievements unlock toggleable combat masteries.
 * Other achievements are meta / cosmetic unlocks.
 * Signed-in: saved with profile settings (+ localStorage backup).
 * Guests: session only.
 */

export type AchievementId =
  | "wasting_your_time"
  | "bricked_master" | "cant_catch_me_now" | "hot_stuff" | "now_you_see_me"
  | "great_potential" | "down_you_go" | "down_you_go_friends"
  | "speedrunner" | "faster_than_light" | "hacker"
  | "champ" | "king" | "tble" | "hardcore"
  | "get_back_up" | "mastery_king";

export type Achievement = {
  id: AchievementId;
  name: string;
  icon: string;
  summary: string;
  how: string;
  /** Ability mastery achievements only */
  ability?: AbilityId;
  masteryName?: string;
  /** Hidden until earned (Hacker) */
  secret?: boolean;
  /** No Details button */
  noDetails?: boolean;
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
  {
    id: "great_potential", name: "Great Potential", icon: "🌱",
    summary: "Potential table.",
    how: "Beat the tutorial.",
  },
  {
    id: "hardcore", name: "Hardcore", icon: "🛡️",
    summary: "I overcame all odds.",
    how: "Beat the offline campaign boss without taking damage during the boss fight. You start each boss attempt fully healed. Taking damage or using Combo Burst to heal during the fight disqualifies that attempt. Dying and returning to the boss checkpoint resets the attempt, so you can try again.",
  },
  {
    id: "down_you_go", name: "Down You Go", icon: "⬇️",
    summary: "And stay down.",
    how: "Beat the boss in offline campaign (not training or tutorial).",
  },
  {
    id: "down_you_go_friends", name: "Down You Go + Friends", icon: "👥",
    summary: "And stay down + friends.",
    how: "Beat the boss in party campaign.",
  },
  {
    id: "speedrunner", name: "Speedrunner", icon: "⏱️",
    summary: "Too fast?",
    how: "Beat offline campaign with a victory time under 5:00 (same timer as the victory screen).",
  },
  {
    id: "faster_than_light", name: "Faster Than Light?", icon: "⚡",
    summary: "Theory of relativity means nothing to me.",
    how: "Beat offline campaign with a victory time under 2:30.",
  },
  {
    id: "hacker", name: "Close the Game, Hacker", icon: "🖤",
    summary: "",
    how: "Beat offline campaign in under 1:00.",
    secret: true,
    noDetails: true,
  },
  {
    id: "champ", name: "Champ", icon: "🏆",
    summary: "I am #1.",
    how: "Win 5 full 1v1 matches (career). Opponent leaving only counts if you already have 1+ points.",
  },
  {
    id: "king", name: "King", icon: "👑",
    summary: "I am the honored one.",
    how: "Win 15 full 1v1 matches (career).",
  },
  {
    id: "tble", name: "TBLE", icon: "🟩",
    summary: "2 tables :D.",
    how: "Earn all ability masteries, Champ, King, Great Potential, both Down You Go achievements, Speedrunner, and Faster Than Light? (Hacker not required).",
  },
  {
    id: "get_back_up", name: "Get Back Up", icon: "💪",
    summary: "Get up, I SAID GET UP.",
    how: "Die for the first time in campaign, 1v1, tutorial, or party modes (not lobby or training).",
  },
  {
    id: "mastery_king", name: "Mastery King", icon: "🪑",
    summary: "The collector.",
    how: "Earn all four ability masteries (Wall, Trampoline, Fire, Teleport).",
  },
  {
    id: "wasting_your_time", name: "Your Wasting Your Time", icon: "🪑",
    summary: "just play the game.",
    how: "???",
    secret: true,
  },
];

export const MASTERY_LINES: Partial<Record<AbilityId, string[]>> = {
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
    "The ground fire line is 2× bigger and burns blue.",
    "The air fireball flies at half speed, explodes on up to 3 things (bots, players, walls, the room) and bounces off each one, with full damage and burn every time.",
    "If a fireball finds nothing to hit for 5 seconds it explodes where it is.",
    "Never hurts you or your teammates.",
  ],
  teleport: [
    "Teleport balls are white.",
    "Anything the ball touches stays stunned from the moment it touches the growing circle until 3 seconds after you teleport.",
    "TELEPORT BOMB: while Teleport is ready, your bomb is white. Anything in its blast swaps places with you (several targets: they all go to your old spot and you land in the middle of them) and is stunned for 2s. The ability then cools down for 3s (the bomb's own cooldown is normal).",
    "Press the ability key during that 3s to put everyone the teleport bomb moved — and you — back. (A normal teleport still only rewinds you.)",
    "A bomb thrown while the ability is cooling down (or mid-teleport) is a normal bomb. Normal damage either way.",
  ],
};

export function achievementFor(ability: AbilityId): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.ability === ability);
}

/** Display name: secret achievements stay ??? until owned. */
export function displayAchievementName(a: Achievement, owned: boolean) {
  if (a.secret && !owned) return "???";
  return a.name;
}
export function displayAchievementHow(a: Achievement, owned: boolean) {
  if (a.secret && !owned) return "???";
  return a.how;
}

// ---------------- state ----------------
type Progress = {
  earned: Partial<Record<AchievementId, true>>;
  off: Partial<Record<AbilityId, true>>;
  pvpWins: number;
};
let progress: Progress = { earned: {}, off: {}, pvpWins: 0 };
let justUnlocked: AchievementId[] = [];
let version = 0;
const subs = new Set<() => void>();
let persister: (() => void) | null = null;

function bump() {
  version++;
  subs.forEach((f) => f());
}
export function useProgress() {
  useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => version, () => version);
  return progress;
}
export function getProgress() { return progress; }
export function setProgressPersister(fn: (() => void) | null) { persister = fn; }

export const hasAchievement = (id: AchievementId) => !!progress.earned[id];

// Gate Boss ability on Hardcore without a circular runtime import from abilities → mastery
setAbilityUnlockCheck((id) => {
  if (id !== "boss") return true;
  return !!progress.earned.hardcore;
});
export const hasMastery = (ab: AbilityId) => { const a = achievementFor(ab); return !!a && !!progress.earned[a.id]; };
// training mastery overrides (existing)
const trainPick: Partial<Record<AbilityId, boolean>> = {};
export function setTrainMastery(ab: AbilityId, on: boolean) { trainPick[ab] = on; bump(); }

export const masteryOn = (ab: AbilityId) => {
  // 1v1 loadout from map-pick phases
  if (G.mode === "pvp" && G.pvpMasteryAbility) return ab === G.pvpMasteryAbility && !!G.pvpMastery;
  if (G.mode === "training" && ab in trainPick) return !!trainPick[ab];
  return hasMastery(ab) && !progress.off[ab];
};

export function setMasteryOn(ab: AbilityId, on: boolean) {
  if (!achievementFor(ab) || !hasMastery(ab)) return;
  if (on) delete progress.off[ab]; else progress.off[ab] = true;
  bump();
  persister?.();
}

const awardSubs = new Set<(a: Achievement) => void>();
export function onAchievement(fn: (a: Achievement) => void) { awardSubs.add(fn); return () => { awardSubs.delete(fn); }; }

function award(id: AchievementId) {
  if (progress.earned[id]) return false;
  progress.earned[id] = true;
  const ach = ACHIEVEMENTS.find((a) => a.id === id);
  if (ach) awardSubs.forEach((f) => f(ach));
  justUnlocked = [...justUnlocked, id];
  bump();
  persister?.();
  setTimeout(() => persister?.(), 250);
  setTimeout(() => persister?.(), 1000);
  // Mastery King when all four ability masteries are owned
  if (id === "bricked_master" || id === "cant_catch_me_now" || id === "hot_stuff" || id === "now_you_see_me") {
    tryAwardMasteryKing();
  }
  return true;
}

function tryAwardMasteryKing() {
  if (
    progress.earned.bricked_master &&
    progress.earned.cant_catch_me_now &&
    progress.earned.hot_stuff &&
    progress.earned.now_you_see_me
  ) {
    award("mastery_king");
  }
}

/** First death outside lobby/training. */
export function onPlayerDeath(mode: string, netKind: string | null | undefined) {
  if (mode === "training" || netKind === "lobby") return;
  award("get_back_up");
}

export function getPvpWins() { return progress.pvpWins | 0; }

/** Full match win (career). Leave only counts if you already scored ≥1. */
export function recordPvpWin(opts?: { opponentLeft?: boolean; myScore?: number }) {
  if (opts?.opponentLeft && (opts.myScore ?? 0) < 1) return;
  progress.pvpWins = (progress.pvpWins | 0) + 1;
  if (progress.pvpWins >= 5) award("champ");
  if (progress.pvpWins >= 15) award("king");
  tryAwardTble();
  bump();
  persister?.();
  setTimeout(() => persister?.(), 250);
}

function tryAwardTble() {
  const need: AchievementId[] = [
    "bricked_master", "cant_catch_me_now", "hot_stuff", "now_you_see_me",
    "great_potential", "down_you_go", "down_you_go_friends",
    "speedrunner", "faster_than_light", "champ", "king",
  ];
  if (need.every((id) => progress.earned[id])) award("tble");
}

/** Tutorial finished. */
export function onTutorialComplete() {
  award("great_potential");
  tryAwardTble();
}

/**
 * Campaign boss beaten.
 * Victory time = G.time (same as victory screen).
 * Party = NET.kind === "coop" or shares party campaign.
 */
export function onCampaignWin(isParty = false) {
  if (G.mode !== "game") return;
  const ab = getAbility();
  const masteryAch = ACHIEVEMENTS.find((a) => a.ability === ab);
  if (masteryAch) award(masteryAch.id);

  const t = G.time;
  if (isParty) {
    award("down_you_go_friends");
  } else {
    award("down_you_go");
    // Timed achievements: offline only, victory-screen time (G.time)
    if (t < 300) award("speedrunner");
    if (t < 150) award("faster_than_light");
    if (t < 60) award("hacker");
  }
  if (!isParty && G.campaignHardcoreEligible) award("hardcore");
  tryAwardTble();
}

export function getJustUnlocked() { return justUnlocked; }
export function clearJustUnlocked() { if (justUnlocked.length) { justUnlocked = []; bump(); } }

export function serializeProgress() {
  return {
    earned: Object.keys(progress.earned),
    off: Object.keys(progress.off),
    pvpWins: progress.pvpWins | 0,
  };
}
export function hydrateProgress(raw: unknown) {
  const r = raw as { earned?: unknown; off?: unknown; pvpWins?: unknown } | null | undefined;
  if (!r || typeof r !== "object") return;
  const ids = new Set<string>(ACHIEVEMENTS.map((a) => a.id));
  const abs = new Set<string>(["wall", "trampoline", "fire", "teleport", "boss"]);
  const next: Progress = { earned: { ...progress.earned }, off: { ...progress.off }, pvpWins: progress.pvpWins | 0 };
  if (Array.isArray(r.earned)) for (const k of r.earned) if (typeof k === "string" && ids.has(k)) next.earned[k as AchievementId] = true;
  if (Array.isArray(r.off)) for (const k of r.off) if (typeof k === "string" && abs.has(k)) next.off[k as AbilityId] = true;
  if (typeof r.pvpWins === "number" && r.pvpWins >= 0) next.pvpWins = Math.max(next.pvpWins | 0, Math.floor(r.pvpWins));
  progress = next;
  bump();
  tryAwardMasteryKing();
}
export function resetProgress() {
  progress = { earned: {}, off: {}, pvpWins: 0 };
  justUnlocked = [];
  bump();
  // Drop locked abilities (e.g. Boss without Hardcore) after progress wipe
  try {
    void import("./abilities").then((a) => a.clampSelectedAbility());
  } catch { /* ignore */ }
}

/** Cosmetic unlock helpers for skins */
/** Home / loading green-table wall hits toward "Your Wasting Your Time". */
let homeBounces = 0;
export function noteHomeTableBounce() {
  if (progress.earned.wasting_your_time) return;
  homeBounces++;
  bump();
  if (homeBounces >= 150) award("wasting_your_time");
}

export function legUnlocked(id: string) {
  if (id === "nolegs") return !!progress.earned.wasting_your_time;
  return true;
}

export function decorationUnlocked(id: string) {
  if (id === "trophy") return hasAchievement("champ");
  if (id === "crown") return hasAchievement("king");
  if (id === "stack") return hasAchievement("tble");
  if (id === "throne") return hasAchievement("mastery_king");
  return true;
}
