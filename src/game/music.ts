import { G } from "./state";
import { NET } from "./net";
import { SETTINGS, currentTod } from "./settings";

/**
 * Soundtrack. One looping track at a time (crossfaded), chosen from the game state, plus short stings
 * for events. Files live in /public/audio. Browsers block audio until the first click/key press, so
 * nothing plays before then. Volume comes from the "Music volume" setting (0 = off).
 */

type TrackId =
  | "home_morning" | "home_evening" | "home_night" | "tutorial" | "campaign" | "boss" | "training"
  | "lobby" | "pick" | "round" | "party" | "freecam";
type StingId = "victory" | "defeat" | "round_win" | "round_lose" | "match_over" | "join" | "revive" | "tutorial";

const TRACK_GAIN: Record<TrackId, number> = {
  home_morning: 0.45, home_evening: 0.45, home_night: 0.42, tutorial: 0.85, campaign: 0.7, boss: 0.7, training: 0.75,
  lobby: 0.7, pick: 0.75, round: 0.7, party: 0.7, freecam: 0.9,
};

// Overall loudness trims (the SFX will sit above the music, so keep the music well under them)
const MUSIC_MASTER = 0.5;
const STING_GAIN: Record<StingId, number> = {
  victory: 0.55, defeat: 0.55, round_win: 0.5, round_lose: 0.5, match_over: 0.55, join: 0.3, revive: 0.3,
  tutorial: 0.22, // bell-heavy and piercing, so much lower
};

const FADE_MS = 1200;
const TICK_MS = 100;

type Voice = { id: TrackId; el: HTMLAudioElement; level: number; target: number };

let voices: Voice[] = [];
let want: TrackId | null = null;
let started = false;
let unlocked = false;
let stingUntil = 0;

// previous values for event detection
let prevPhase = G.phase;
let prevStage = NET.stage;
let prevMyScore = 0;
let prevOppScore = 0;
let prevPeers = 0;
let prevTutStep = 0;

function src(name: string) {
  return `/audio/${name}.mp3`;
}

function trackFor(): TrackId | null {
  if (G.phase === "won" || G.phase === "lost") return null; // the victory / defeat sting plays instead
  // Online 1v1: pick phase and rounds have their own tracks; silence between rounds so stings are heard
  if (NET.online && NET.kind === "pvp") {
    if (NET.stage === "pick") return "pick";
    if (NET.stage === "playing") return G.phase === "playing" ? (G.freecam ? "freecam" : "round") : null;
    if (NET.stage === "roundEnd" || NET.stage === "over") return null;
  }
  if (G.phase === "home") return tod();
  if (G.freecam) return "freecam";
  if (NET.online && NET.kind === "lobby") return "lobby";
  if (G.mode === "tutorial") return "tutorial";
  if (G.mode === "training") return "training";
  if (G.mode === "game") {
    if (NET.online && NET.kind === "coop") return "party";
    return G.stage === "boss" || G.stage === "incoming" ? "boss" : "campaign";
  }
  return tod();
}

function tod(): TrackId {
  const t = currentTod();
  return t === "day" ? "home_morning" : t === "night" ? "home_night" : "home_evening";
}

function playSting(id: StingId) {
  if (!unlocked) return;
  const vol = SETTINGS.musicVolume ?? 50;
  if (vol <= 0) return;
  try {
    const el = new Audio(src(`sting_${id}`));
    el.volume = Math.min(1, (vol / 100) * STING_GAIN[id]);
    stingUntil = performance.now() + 3500; // music ducks while a sting plays
    el.addEventListener("loadedmetadata", () => { stingUntil = performance.now() + (el.duration || 3) * 1000 + 300; });
    void el.play().catch(() => { /* blocked */ });
  } catch { /* ignore */ }
}

function detectEvents() {
  // campaign victory / defeat
  if (G.phase !== prevPhase) {
    if (G.phase === "won") playSting("victory");
    else if (G.phase === "lost") playSting("defeat");
    prevPhase = G.phase;
  }
  // 1v1 round + match results
  if (NET.online && NET.kind === "pvp") {
    const me = NET.scores[NET.myId] ?? 0;
    const opp = Object.entries(NET.scores).filter(([k]) => k !== NET.myId).reduce((a, [, v]) => Math.max(a, v), 0);
    if (NET.stage === "over" && prevStage !== "over") playSting("match_over");
    else if (me > prevMyScore) playSting("round_win");
    else if (opp > prevOppScore) playSting("round_lose");
    prevMyScore = me; prevOppScore = opp;
  } else { prevMyScore = 0; prevOppScore = 0; }
  prevStage = NET.stage;
  // someone joins the lobby
  const peers = NET.online && NET.kind === "lobby" ? NET.peers.size : 0;
  if (peers > prevPeers) playSting("join");
  prevPeers = peers;
  // tutorial step completed
  if (G.phase === "playing" && G.mode === "tutorial") {
    if (G.tutStep > prevTutStep) playSting("tutorial");
    prevTutStep = G.tutStep;
  } else prevTutStep = 0;
}

function tick() {
  if (!unlocked) return;
  detectEvents();
  const vol = (SETTINGS.musicVolume ?? 50) / 100;
  const next = vol > 0 ? trackFor() : null;
  if (next !== want) {
    want = next;
    for (const v of voices) if (v.id !== next) v.target = 0;
    if (next && !voices.some((v) => v.id === next && v.target > 0)) {
      try {
        const el = new Audio(src(next));
        el.loop = true;
        el.volume = 0;
        void el.play().catch(() => { /* blocked until a user gesture */ });
        voices.push({ id: next, el, level: 0, target: 1 });
      } catch { /* ignore */ }
    }
  }
  // ducking: quieter while paused / in menus over the game, and while a sting plays
  const paused = G.phase === "playing" && (G.userPaused || G.trainMenu);
  const duck = (paused ? 0.4 : 1) * (performance.now() < stingUntil ? 0.3 : 1);
  const step = TICK_MS / FADE_MS;
  for (const v of voices) {
    v.level += Math.sign(v.target - v.level) * Math.min(step, Math.abs(v.target - v.level));
    v.el.volume = Math.max(0, Math.min(1, v.level * TRACK_GAIN[v.id] * MUSIC_MASTER * vol * duck));
  }
  voices = voices.filter((v) => {
    if (v.target === 0 && v.level <= 0.001) { v.el.pause(); v.el.src = ""; return false; }
    return true;
  });
}

/** Call once from the client (the Game component). Safe to call again. */
export function startMusic() {
  if (started || typeof window === "undefined") return;
  started = true;
  const unlock = () => {
    if (unlocked) return;
    unlocked = true;
    prevPhase = G.phase; prevStage = NET.stage; // don't fire stings for state that already existed
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
  setInterval(tick, TICK_MS);
}
