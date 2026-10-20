import { useSyncExternalStore } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { setTodOverride, type TimeOfDay } from "./settings";
import { displayName, getAccount, lookupUsername } from "./account";
import { G, goHome, resetGame, type Mode } from "./state";
import {
  noteIncomingRequest, noteOutgoingRequest, removeIncoming, removeOutgoing,
  addFriendDirect, isSelfName, isFriend, friendCount, MAX_TBLES, markSplinteredFrom, setOnlineNames,
  cacheProfile, type FriendRequest,
} from "./friends";
import { getAbility, setAbility } from "./abilities";
import { masteryOn, getProgress, recordPvpWin } from "./mastery";
import { SKIN, type Skin } from "./skins";
import { onRemoteChat, clearChat } from "./chat";

/**
 * Online play runs on realtime channels. Each player's browser simulates its own
 * table and streams its pose; the room host's browser runs the match itself
 * (map pick, colours, scoring, rounds) and everyone follows the host's calls.
 */

export type Peer = {
  id: string; name: string; x: number; y: number; z: number; yaw: number; hp: number; dead: boolean; t: number;
  skin?: Skin; grappling?: boolean; gx?: number; gy?: number; gz?: number;
  ability?: string; mastery?: boolean; achList?: string[];
};
export type Kind = "pvp" | "lobby" | "coop";
export type Invite = { id: string; kind: "party" | "lobby" | "friend" | "play_party" | "play_1v1"; from: string; target: string; t: number; expires?: number | undefined };
export type PartyMember = { id: string; name: string; leader: boolean };

export const PVP_WIN = 3;
export const PVP_DMG = { bullet: 5, bomb: 10, slam: 10 };
export const PVP_SCALE = 3; // players are 3x bigger in 1v1s and lobbies
export const PVP_HITBOX = 1.6 * PVP_SCALE * 1.3; // 1.3× larger hitbox; visual scale unchanged
export const PVP_CENTER_Y = 1.8 * PVP_SCALE;
export const LOBBY_MAX = 8;
export const PARTY_MAX = 5; // leader + 4 invited

const empty = () => ({
  online: false,
  kind: null as Kind | null,
  room: "",
  code: "",
  isHost: false,
  hostId: "",
  peers: new Map<string, Peer>(),
  names: {} as Record<string, string>,
  // 1v1
  stage: "idle" as "idle" | "queue" | "pick" | "ban" | "abilityPick" | "playing" | "roundEnd" | "over",
  pickEnds: 0,
  myPick: null as TimeOfDay | null,
  pickPhase: "tod" as "tod" | "ban" | "ability",
  myBan: null as null | "none" | "wall" | "trampoline" | "fire" | "teleport" | "boss",
  myAbilityChoice: null as null | string,
  myPhaseLocked: false,
  bans: {} as Record<string, "none" | "wall" | "trampoline" | "fire" | "teleport" | "boss">,
  abilityChoices: {} as Record<string, string>,
  phaseLocked: {} as Record<string, boolean>,
  pvpLoadout: null as null | { ability: "wall" | "trampoline" | "fire" | "teleport" | "boss"; mastery: boolean },
  tod: "evening" as TimeOfDay,
  colors: {} as Record<string, "red" | "blue">,
  accountKeys: {} as Record<string, string>,
  scores: {} as Record<string, number>,
  roundMsg: "",
  winner: "",
  opponentLeft: false,
  partyMatch: false,
  rematchIn: null as null | { from: string; name: string },
  rematchStatus: "",
  rematchSentAt: 0,
  rematchBlockedUntil: 0,
  lastRematchReply: 0,
});

export const NET = {
  ...empty(),
  myId: "",
  invites: [] as Invite[],
  party: null as null | { id: string; leaderId: string; members: PartyMember[] },
  partyNote: "",
  inviteSentAt: 0,
};

let version = 0;
const subs = new Set<() => void>();
export function bump() {
  version++;
  subs.forEach((f) => f());
}
export function useNet() {
  useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => version, () => 0);
  return NET;
}

export function myId() {
  if (!NET.myId) NET.myId = crypto.randomUUID().slice(0, 12);
  return NET.myId;
}

/** Set by World so network events can reach the simulation. */
export const NET_HOOKS = {
  onHit: (_dmg: number, _stun: boolean, _stunT?: number, _extra?: HitExtra) => {},
  onEnts: (_s: EntSnap) => {},
  onEhit: (_h: EHit) => {},
  onEshot: (_b: number[]) => {},
  onEspawn: (_q: { kind: string; n: number }) => {},
  onWon: () => {},
  onRevive: (_id: string) => {},
  onVfx: (_p: Record<string, unknown>) => {},
  /** Lobby / party: someone new joined — rebroadcast props & bots so they can see the room. */
  onPeerJoined: (_id: string) => {},
};
export type EntSnap = { t: number[]; b: number[]; boss: number[] | null; stage: string; bh: number; bm: number; s: number[] };
/** Ability-mastery extras on a hit: teleport the victim, or pull them toward a point. */
export type HitExtra = { tp?: number[] | undefined; pull?: number[] | undefined; push?: number[] | undefined; slam?: number | undefined; stick?: number[] | undefined; unstick?: boolean | undefined };
export type EHit = { k: "t" | "b" | "boss"; i: number; dmg: number; tp?: number[] | undefined; pull?: number[] | undefined; slam?: number | undefined };

/** Followers in shared-enemy rooms show the host's enemies instead of simulating their own. */
export const sharesEnemies = () => NET.online && (NET.kind === "coop" || NET.kind === "lobby");
export const isFollower = () => sharesEnemies() && !NET.isHost;
export function sendNet(event: string, payload: Record<string, unknown>) {
  if (NET.online) send(event, payload);
}

let room: RealtimeChannel | null = null;
let mm: RealtimeChannel | null = null;
let partyCh: RealtimeChannel | null = null;
let inbox: RealtimeChannel | null = null;
let picks: Record<string, TimeOfDay> = {};
type BanChoice = "none" | "wall" | "trampoline" | "fire" | "teleport" | "boss";
let bans: Record<string, BanChoice> = {};
let abilityChoices: Record<string, string> = {};
let phaseLocked: Record<string, boolean> = {};
let roundLocked = false;
let pickTimer: ReturnType<typeof setTimeout> | null = null;
let lastPose = 0;
const timers: ReturnType<typeof setTimeout>[] = [];
const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

const send = (event: string, payload: Record<string, unknown>) => {
  void room?.send({ type: "broadcast", event, payload });
};

// ---------------------------------------------------------------- rooms

type Meta = { name: string; host: boolean; id: string; accountKey?: string };

/** Same logged-in user or same guest tag across tabs. */
export function myAccountKey() {
  const a = getAccount();
  if (a.status === "user" && a.userId) return `u:${a.userId}`;
  return `g:${displayName()}`;
}

// Realtime payloads are client-controlled. Reject malformed values before they
// reach the simulation or mutate shared game state.
const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const isText = (v: unknown, max = 128): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= max;
const isFiniteIn = (v: unknown, min = -10000, max = 10000): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const isNumberArray = (v: unknown, maxLength = 3000): v is number[] =>
  Array.isArray(v) && v.length <= maxLength && v.every((n) => isFiniteIn(n));
const isTimeOfDay = (v: unknown): v is TimeOfDay =>
  v === "day" || v === "evening" || v === "night";
const isScores = (v: unknown): v is Record<string, number> =>
  isRecord(v) && Object.keys(v).length <= LOBBY_MAX &&
  Object.entries(v).every(([k, n]) => isText(k, 64) && isFiniteIn(n, 0, PVP_WIN) && Number.isInteger(n));
const isEntSnap = (v: unknown): v is EntSnap =>
  isRecord(v) && isNumberArray(v.t) && isNumberArray(v.b) &&
  (v.boss === null || isNumberArray(v.boss)) && isText(v.stage, 40) &&
  isFiniteIn(v.bh, 0, 100000) && isFiniteIn(v.bm, 0, 100000) && isNumberArray(v.s);
const isHitExtra = (v: Record<string, unknown>) =>
  (v.tp === undefined || isNumberArray(v.tp, 3)) &&
  (v.pull === undefined || isNumberArray(v.pull, 3)) &&
  (v.push === undefined || isNumberArray(v.push, 3)) &&
  (v.slam === undefined || isFiniteIn(v.slam, -100, 100)) &&
  (v.stick === undefined || isNumberArray(v.stick, 3)) &&
  (v.unstick === undefined || typeof v.unstick === "boolean");

function joinRoom(name: string, kind: Kind, host: boolean, stage?: (typeof NET)["stage"]): Promise<RealtimeChannel> {
  leaveRoom(false);
  const id = myId();
  Object.assign(NET, empty(), { online: true, kind, room: name, isHost: host });
  if (stage) NET.stage = stage; // set before presence syncs so the host can start the pick
  NET.names[id] = displayName();
  const ch = supabase.channel(`tble:${name}`, { config: { broadcast: { self: false }, presence: { key: id } } });
  room = ch;
  ch.on("broadcast", { event: "pose" }, ({ payload }) => {
    if (!isRecord(payload)) return;
    const p = payload as Peer & { skinVer?: number };
    if (!isText(p.id, 64) || p.id === id ||
      !isFiniteIn(p.x) || !isFiniteIn(p.y) || !isFiniteIn(p.z) ||
      !isFiniteIn(p.yaw, -100000, 100000) || !isFiniteIn(p.hp, 0, 1000) ||
      (p.name !== undefined && !isText(p.name, 32)) ||
      (p.gx !== undefined && !isFiniteIn(p.gx)) ||
      (p.gy !== undefined && !isFiniteIn(p.gy)) ||
      (p.gz !== undefined && !isFiniteIn(p.gz))) return;
    const cur = NET.peers.get(p.id);
    const skin = isRecord(p.skin) ? p.skin as unknown as Skin : cur?.skin;
    const skinChanged = !!p.skin && (!cur?.skin || p.skinVer !== (cur as { skinVer?: number } | undefined)?.skinVer);
    const ability = isText(p.ability, 20) ? p.ability : cur?.ability;
    const mastery = typeof p.mastery === "boolean" ? p.mastery : cur?.mastery;
    const achList = Array.isArray(p.achList) ? p.achList.filter((x): x is string => typeof x === "string").slice(0, 40) : cur?.achList;
    NET.peers.set(p.id, {
      id: p.id, name: cur?.name ?? NET.names[p.id] ?? p.name ?? "player",
      x: p.x, y: p.y, z: p.z, yaw: p.yaw, hp: p.hp, dead: p.dead === true,
      t: performance.now(), skin, grappling: p.grappling === true,
      gx: isFiniteIn(p.gx) ? p.gx : undefined,
      gy: isFiniteIn(p.gy) ? p.gy : undefined,
      gz: isFiniteIn(p.gz) ? p.gz : undefined,
      ability, mastery, achList,
      ...(p.skin && isRecord(p.skin) ? { skinVer: isFiniteIn(p.skinVer, 0, 1000000) ? p.skinVer : undefined } : cur ? { skinVer: (cur as { skinVer?: number }).skinVer } : {}),
    } as Peer);
    // Cache for home profile viewer (friends list outside a match)
    try {
      const nm = NET.peers.get(p.id)?.name ?? p.name;
      if (typeof nm === "string" && nm) {
        cacheProfile({
          name: nm,
          skin: isRecord(p.skin) ? p.skin as never : undefined,
          ability: ability as string | undefined,
          mastery: mastery as boolean | undefined,
          achList: achList as string[] | undefined,
        });
      }
    } catch { /* ignore */ }
    if (!cur || skinChanged) bump();
  });
  ch.on("broadcast", { event: "hit" }, ({ payload }) => {
    if (!isRecord(payload) || payload.to !== id || !isFiniteIn(payload.dmg, 0, 100) ||
      (payload.stunT !== undefined && !isFiniteIn(payload.stunT, 0, 10000)) || !isHitExtra(payload)) return;
    if (NET.kind === "pvp" ? NET.stage === "playing" : true) {
      NET_HOOKS.onHit(payload.dmg, payload.stun === true, payload.stunT as number | undefined, {
        tp: payload.tp as number[] | undefined, pull: payload.pull as number[] | undefined, push: payload.push as number[] | undefined, slam: payload.slam as number | undefined, stick: payload.stick as number[] | undefined, unstick: payload.unstick as boolean | undefined,
      });
    }
  });
  ch.on("broadcast", { event: "vfx" }, ({ payload }) => {
    if (isRecord(payload)) NET_HOOKS.onVfx(payload as Record<string, unknown>);
  });
  ch.on("broadcast", { event: "ents" }, ({ payload }) => {
    if (!NET.isHost && isEntSnap(payload)) NET_HOOKS.onEnts(payload);
  });
  ch.on("broadcast", { event: "ehit" }, ({ payload }) => {
    if (NET.isHost && isRecord(payload) &&
      (payload.k === "t" || payload.k === "b" || payload.k === "boss") &&
      isFiniteIn(payload.i, 0, 10000) && Number.isInteger(payload.i) &&
      isFiniteIn(payload.dmg, 0, 1000) && isHitExtra(payload)) NET_HOOKS.onEhit(payload as EHit);
  });
  ch.on("broadcast", { event: "eshot" }, ({ payload }) => {
    if (!NET.isHost && isRecord(payload) && isNumberArray(payload.b, 3000)) NET_HOOKS.onEshot(payload.b);
  });
  ch.on("broadcast", { event: "espawn" }, ({ payload }) => {
    if (NET.isHost && isRecord(payload) && isText(payload.kind, 40) &&
      isFiniteIn(payload.n, 0, 1000) && Number.isInteger(payload.n)) NET_HOOKS.onEspawn({ kind: payload.kind, n: payload.n });
  });
  ch.on("broadcast", { event: "won" }, () => { if (!NET.isHost) NET_HOOKS.onWon(); });
  ch.on("broadcast", { event: "death" }, ({ payload }) => {
    if (!isRecord(payload) || !isText(payload.id, 64)) return;
    const deadId = payload.id as string;
    if (NET.kind === "coop") {
      if (deadId !== id && !NET.peers.has(deadId)) return;
      if (!G.reviveQueue.includes(deadId)) G.reviveQueue.push(deadId);
      const pr = NET.peers.get(deadId);
      if (pr) pr.dead = true;
      bump();
      return;
    }
    if (NET.kind === "pvp" && NET.names[deadId]) onDeath(deadId);
  });
  ch.on("broadcast", { event: "revive" }, ({ payload }) => {
    if (!isRecord(payload) || !isText(payload.id, 64) || (payload.id !== id && !NET.peers.has(payload.id))) return;
    const revivedId = payload.id as string;
    G.reviveQueue = G.reviveQueue.filter((x) => x !== revivedId);
    NET_HOOKS.onRevive(revivedId);
    bump();
  });
  ch.on("broadcast", { event: "shards" }, ({ payload }) => {
    if (isRecord(payload) && isFiniteIn(payload.n, 0, 1000000) && Number.isInteger(payload.n)) G.shardProgress = payload.n;
  });
  ch.on("broadcast", { event: "chat" }, ({ payload }) => {
    if (isRecord(payload)) onRemoteChat(payload as Record<string, unknown>);
  });
  ch.on("broadcast", { event: "pickstart" }, ({ payload }) => {
    if (NET.kind !== "pvp" || NET.isHost || !isRecord(payload) || !isFiniteIn(payload.ms, 500, 30000)) return;
    const ph = payload.phase;
    if (isTimeOfDay(payload.tod)) NET.tod = payload.tod;
    beginPickPhase(ph === "ban" || ph === "ability" ? ph : "tod", payload.ms);
  });
  ch.on("broadcast", { event: "todpick" }, ({ payload }) => {
    if (NET.kind === "pvp" && !NET.isHost && isRecord(payload) && isTimeOfDay(payload.tod)) { NET.tod = payload.tod; bump(); }
  });
  ch.on("broadcast", { event: "ban" }, ({ payload }) => {
    if (!isRecord(payload) || !isText(payload.id, 64) || !NET.names[payload.id]) return;
    const b = payload.ban;
    if (b !== "none" && b !== "wall" && b !== "trampoline" && b !== "fire" && b !== "teleport" && b !== "boss") return;
    bans[payload.id] = b;
    NET.bans = { ...bans };
    bump();
  });
  ch.on("broadcast", { event: "abilitypick" }, ({ payload }) => {
    if (!isRecord(payload) || !isText(payload.id, 64) || !NET.names[payload.id] || !isText(payload.choice, 32)) return;
    abilityChoices[payload.id] = payload.choice;
    NET.abilityChoices = { ...abilityChoices };
    bump();
  });
  ch.on("broadcast", { event: "phaselock" }, ({ payload }) => {
    if (!isRecord(payload) || !isText(payload.id, 64) || !NET.names[payload.id]) return;
    const ph = payload.phase;
    if (ph !== "tod" && ph !== "ban" && ph !== "ability") return;
    phaseLocked[`${ph}:${payload.id}`] = true;
    NET.phaseLocked = { ...phaseLocked };
    bump();
    if (NET.isHost) tryResolvePhaseEarly(ph);
  });
  ch.on("broadcast", { event: "pick" }, ({ payload }) => {
    if (isRecord(payload) && isText(payload.id, 64) && isTimeOfDay(payload.tod) && NET.names[payload.id]) picks[payload.id] = payload.tod;
  });
  ch.on("broadcast", { event: "start" }, ({ payload }) => {
    if (!isRecord(payload) || !isTimeOfDay(payload.tod) || !isRecord(payload.colors) ||
      !Object.values(payload.colors).every((c) => c === "red" || c === "blue") || !isScores(payload.scores)) return;
    onStart(payload as StartMsg);
  });
  ch.on("broadcast", { event: "round" }, ({ payload }) => {
    if (!isRecord(payload) || !isScores(payload.scores) || !isText(payload.dead, 64) || !NET.names[payload.dead]) return;
    onRound(payload as RoundMsg);
  });
  ch.on("broadcast", { event: "over" }, ({ payload }) => {
    if (!isRecord(payload) || !isText(payload.winner, 64) || !NET.names[payload.winner] || !isScores(payload.scores)) return;
    onOver(payload as OverMsg);
  });
  ch.on("broadcast", { event: "rematch" }, ({ payload }) => {
    if (isRecord(payload) && isText(payload.from, 64) && NET.names[payload.from]) onRematchReq(payload.from);
  });
  ch.on("broadcast", { event: "rematch-no" }, () => {
    NET.rematchStatus = "Rematch declined";
    NET.rematchBlockedUntil = Date.now() + 5000;
    bump();
  });
  ch.on("broadcast", { event: "rematch-go" }, ({ payload }) => {
    if (isRecord(payload) && isText(payload.room, 100) && isText(payload.host, 64) &&
      NET.kind === "pvp" && NET.stage === "over") void startPvp(payload.room, payload.host === id, NET.partyMatch);
  });
  ch.on("presence", { event: "sync" }, () => {
    const state = ch.presenceState<Meta>();
    const ids = new Set<string>();
    const prev = new Set(NET.peers.keys());
    const nextKeys: Record<string, string> = { [id]: myAccountKey() };
    for (const [key, metas] of Object.entries(state)) {
      const m = metas[0];
      if (!m) continue;
      ids.add(key);
      NET.names[key] = m.name ?? key.slice(0, 6);
      if (m.accountKey) nextKeys[key] = m.accountKey;
      if (m.host) NET.hostId = key;
      if (key === id) continue;
      // Seed a peer as soon as presence sees them (before first pose) so mobile↔PC both show up
      const existing = NET.peers.get(key);
      if (existing) {
        existing.name = NET.names[key];
      } else {
        NET.peers.set(key, {
          id: key,
          name: NET.names[key],
          x: 0, y: 0, z: 12 + NET.peers.size * 4,
          yaw: 0, hp: 100, dead: false, t: performance.now(),
        });
      }
    }
    NET.accountKeys = nextKeys;
    for (const k of [...NET.peers.keys()]) if (!ids.has(k) || k === id) NET.peers.delete(k);
    NET.peers.delete(id);
    // Late joiners: ask everyone to re-broadcast props/bots
    if (NET.kind === "lobby" || NET.kind === "coop") {
      for (const jid of ids) {
        if (jid === id || prev.has(jid)) continue;
        try { NET_HOOKS.onPeerJoined?.(jid); } catch { /* ignore */ }
      }
    }
    onPresence(ids);
    bump();
  });
  return new Promise((resolve) => {
    let done = false;
    const finish = async () => {
      if (done) return;
      done = true;
      try {
        await ch.track({ name: displayName(), host, id, accountKey: myAccountKey() } satisfies Meta);
      } catch { /* ignore */ }
      bump();
      resolve(ch);
    };
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") void finish();
    });
    // Mobile networks sometimes miss SUBSCRIBED — don't hang forever
    setTimeout(() => void finish(), 4000);
  });
}


export function leaveRoom(full = true) {
  timers.splice(0).forEach(clearTimeout);
  if (pickTimer) clearTimeout(pickTimer);
  if (room) void supabase.removeChannel(room);
  room = null;
  clearChat();
  lastSkinSent = "";
  lastSkinVer = 0;
  lastSkinAt = 0;
  lastPose = 0;
  leaveQueue();
  picks = {};
  bans = {};
  abilityChoices = {};
  phaseLocked = {};
  if (pickTimer) { clearTimeout(pickTimer); pickTimer = null; }
  roundLocked = false;
  Object.assign(NET, empty());
  setTodOverride(null);
  if (full) bump();
}

export function goHomeOnline() {
  leaveRoom();
  goHome();
}

/** Last skin version we broadcast (avoid shipping full skin every tick). */
let lastSkinSent = "";
let lastSkinVer = 0;
let lastSkinAt = 0;

/** Streams this player's pose (~12 per second, compact payload). */
export function sendPose(x: number, y: number, z: number, yaw: number, extra?: { grappling?: boolean; gx?: number; gy?: number; gz?: number }) {
  if (!room || !NET.online) return;
  const now = performance.now();
  if (now - lastPose < 100) return; // 10 Hz — less lag on mobile links
  lastPose = now;
  const r = (n: number) => Math.round(n * 10) / 10; // 1 decimal — smaller packets
  const payload: Record<string, unknown> = {
    id: myId(),
    name: displayName(),
    x: r(x), y: r(y), z: r(z), yaw: r(yaw),
    hp: G.playerHp | 0,
    dead: !!(G.pvpDead || G.campaignDead),
    grappling: !!(extra?.grappling ?? G.grappling),
    gx: r(extra?.gx ?? 0),
    gy: r(extra?.gy ?? 0),
    gz: r(extra?.gz ?? 0),
  };
  // Attach skin only when it changes or every 5s (late joiners)
  const key = [
    SKIN.eyeColor, SKIN.tablePrimary, SKIN.eyeDesign, SKIN.decoration,
    SKIN.decorationColor, SKIN.lightColor, SKIN.legDesign,
  ].join("|");
  if (key !== lastSkinSent || now - lastSkinAt > 5000) {
    lastSkinSent = key;
    lastSkinVer++;
    lastSkinAt = now;
    payload.skin = { ...SKIN };
    payload.skinVer = lastSkinVer;
  }
  // Profile snapshot for pause roster (every ~3s with skin or always light fields)
  try {
    payload.ability = getAbility();
    payload.mastery = (() => { try { return masteryOn(getAbility() as "wall" | "trampoline" | "fire" | "teleport" | "boss"); } catch { return false; } })();
    const earned = Object.keys(getProgress().earned || {});
    payload.achList = earned.slice(0, 24);
  } catch { /* ignore */ }
  send("pose", payload);
}

export function hitPeer(to: string, dmg: number, stun = false, stunT?: number, extra?: HitExtra) {
  if (!to || to === myId()) return; // never damage yourself via a ghost peer
  // No friendly fire in party modes (kind "coop" = party campaign / party training); only 1v1 and lobbies let players hurt each other.
  const ok = NET.kind === "pvp" ? NET.stage === "playing" : NET.kind === "lobby";
  if (!ok) return;
  send("hit", { to, dmg, stun, ...(stunT != null ? { stunT } : {}), ...(extra?.tp ? { tp: extra.tp } : {}), ...(extra?.pull ? { pull: extra.pull } : {}), ...(extra?.push ? { push: extra.push } : {}), ...(extra?.slam ? { slam: extra.slam } : {}), ...(extra?.stick ? { stick: extra.stick } : {}), ...(extra?.unstick ? { unstick: true } : {}) });
}
/** Host enemies hurting another player in a shared-enemy room. */
export function enemyHitPeer(to: string, dmg: number) {
  if (sharesEnemies() && NET.isHost) send("hit", { to, dmg, stun: false });
}

export function opponentId() {
  return Object.keys(NET.names).find((k) => k !== myId()) ?? "";
}

function onPresence(ids: Set<string>) {
  if (NET.kind !== "pvp") return;
  const opp = [...ids].find((k) => k !== myId());
  if (NET.stage === "pick" && NET.isHost && opp) {
    if (NET.pickEnds === 0) {
      send("pickstart", { ms: 10000, phase: "tod" });
      beginPickPhase("tod", 10000);
    } else send("pickstart", { ms: Math.max(500, NET.pickEnds - Date.now()), phase: NET.pickPhase }); // late joiner catch-up
    // re-send a couple of times in case the opponent wasn't listening yet
    for (const d of [800, 2000]) later(d, () => { if ((NET.stage === "pick" || NET.stage === "ban" || NET.stage === "abilityPick") && NET.pickEnds) send("pickstart", { ms: Math.max(500, NET.pickEnds - Date.now()), phase: NET.pickPhase }); });
  }
  if (!opp && NET.stage !== "idle" && NET.stage !== "over" && NET.pickEnds !== 0) {
    // opponent left mid-match: you win
    NET.opponentLeft = true;
    onOver({ winner: myId(), scores: NET.scores });
  }
}

// ---------------------------------------------------------------- 1v1 matchmaking

export async function queue1v1() {
  leaveRoom(false);
  NET.stage = "queue";
  bump();
  const id = myId();
  const ch = supabase.channel("tble:mm1v1", { config: { presence: { key: id }, broadcast: { self: true } } });
  mm = ch;
  const joinedAt = Date.now();
  let matched = false;
  const tryMatch = () => {
    if (matched || mm !== ch || NET.stage !== "queue") return;
    const list = Object.entries(ch.presenceState<{ t: number }>())
      .map(([k, v]) => ({ id: k, t: v[0]?.t ?? joinedAt }))
      .sort((a, b) => a.t - b.t || a.id.localeCompare(b.id));
    for (let i = 0; i + 1 < list.length; i += 2) {
      const a = list[i]!, b = list[i + 1]!;
      if (a.id !== id && b.id !== id) continue;
      matched = true;
      const room = `pvp-${a.id}-${b.id}`;
      // Only the first player in the sorted pair announces the match.
      if (id === a.id) {
        void ch.send({ type: "broadcast", event: "matched", payload: { room, a: a.id, b: b.id } });
      }
      void startPvp(room, a.id === id);
      return;
    }
  };
  ch.on("presence", { event: "sync" }, tryMatch);
  ch.on("broadcast", { event: "matched" }, ({ payload }) => {
    if (matched || mm !== ch || NET.stage !== "queue") return;
    const a = payload.a as string, b = payload.b as string, room = payload.room as string;
    if (a !== id && b !== id) return;
    matched = true;
    void startPvp(room, a === id);
  });
  ch.subscribe(async (s) => {
    if (s === "SUBSCRIBED") {
      try { await ch.track({ t: joinedAt, id }); } catch { /* ignore */ }
      for (const d of [300, 800, 1500, 3000, 5000]) setTimeout(tryMatch, d);
    }
  });
  setTimeout(tryMatch, 6000);
}

export function leaveQueue() {
  if (mm) void supabase.removeChannel(mm);
  mm = null;
  if (NET.stage === "queue") { NET.stage = "idle"; bump(); }
}

export async function startPvp(name: string, host: boolean, partyMatch = false) {
  await joinRoom(name, "pvp", host, "pick");
  NET.partyMatch = partyMatch;
  if (NET.stage === "idle") NET.stage = "pick";
  resetGame("pvp");
  G.frozen = true;
  document.exitPointerLock?.();
  bump();
}

function stageForPhase(phase: "tod" | "ban" | "ability") {
  return phase === "tod" ? "pick" : phase === "ban" ? "ban" : "abilityPick";
}

function beginPickPhase(phase: "tod" | "ban" | "ability", ms: number) {
  const st = stageForPhase(phase);
  // Followers accept phase changes; hosts may restart timer
  if (!NET.isHost && NET.pickPhase === phase && NET.pickEnds !== 0 && NET.stage === st) return;
  NET.pickPhase = phase;
  NET.pickEnds = Date.now() + ms;
  NET.stage = st;
  NET.myPhaseLocked = false;
  // clear locks for this phase only
  for (const k of Object.keys(phaseLocked)) {
    if (k.startsWith(phase + ":")) delete phaseLocked[k];
  }
  NET.phaseLocked = { ...phaseLocked };
  if (phase === "tod") {
    picks = {};
    NET.myPick = null;
  }
  if (phase === "ban") {
    bans = {};
    NET.bans = {};
    NET.myBan = null;
  }
  if (phase === "ability") {
    abilityChoices = {};
    NET.abilityChoices = {};
    NET.myAbilityChoice = null;
  }
  bump();
  if (NET.isHost) {
    if (pickTimer) clearTimeout(pickTimer);
    pickTimer = setTimeout(() => resolveCurrentPhase(phase), ms + 300);
  }
}

function bothLocked(phase: string) {
  const me = myId(), opp = opponentId();
  if (!opp) return false;
  return !!(phaseLocked[`${phase}:${me}`] && phaseLocked[`${phase}:${opp}`]);
}

function tryResolvePhaseEarly(phase: string) {
  if (!NET.isHost) return;
  if (!bothLocked(phase)) return;
  if (pickTimer) clearTimeout(pickTimer);
  pickTimer = null;
  resolveCurrentPhase(phase as "tod" | "ban" | "ability");
}

function resolveCurrentPhase(phase: "tod" | "ban" | "ability") {
  if (!NET.isHost) return;
  if (phase === "tod") {
    resolveTodThenBan();
  } else if (phase === "ban") {
    resolveBanThenAbility();
  } else {
    resolveAbilityAndStart();
  }
}

function resolveTodThenBan() {
  const me = myId(), opp = opponentId();
  const chosen = [picks[me], picks[opp]].filter(Boolean) as TimeOfDay[];
  const tod = chosen.length === 0 ? pickOne<TimeOfDay>(["day", "evening", "night"]) : chosen.length === 1 || chosen[0] === chosen[1] ? chosen[0]! : pickOne(chosen);
  NET.tod = tod;
  send("pickstart", { ms: 10000, phase: "ban", tod });
  beginPickPhase("ban", 10000);
  // also tell followers the resolved tod early
  send("todpick", { tod });
}

function resolveBanThenAbility() {
  send("pickstart", { ms: 10000, phase: "ability" });
  beginPickPhase("ability", 10000);
}

function bannedSet() {
  const s = new Set<string>();
  for (const v of Object.values(bans)) {
    if (v && v !== "none") s.add(v);
  }
  return s;
}

function resolveAbilityAndStart() {
  const me = myId(), opp = opponentId();
  const banned = bannedSet();
  const pool = (["wall", "trampoline", "fire", "teleport", "boss"] as const).filter((a) => !banned.has(a));
  const fallback = pool.length ? pool : (["wall", "trampoline", "fire", "teleport"] as const);
  const resolveChoice = (raw: string | undefined) => {
    let choice = raw || "random";
    let mastery = false;
    if (choice.endsWith(":m")) {
      mastery = true;
      choice = choice.slice(0, -2);
    }
    if (choice === "random" || banned.has(choice) || !(fallback as readonly string[]).includes(choice)) {
      choice = pickOne([...fallback]);
      mastery = false;
    }
    return { ability: choice as "wall" | "trampoline" | "fire" | "teleport" | "boss", mastery };
  };
  const loadouts: Record<string, { ability: "wall" | "trampoline" | "fire" | "teleport" | "boss"; mastery: boolean }> = {
    [me]: resolveChoice(abilityChoices[me]),
    [opp]: resolveChoice(abilityChoices[opp]),
  };
  const red = pickOne([me, opp].filter(Boolean));
  const colors = { [red]: "red", [red === me ? opp : me]: "blue" } as Record<string, "red" | "blue">;
  const msg: StartMsg = {
    tod: NET.tod,
    colors,
    scores: { [me]: 0, [opp]: 0 },
    loadouts,
    banned: [...banned],
  };
  send("start", msg);
  onStart(msg);
}

export function choosePick(tod: TimeOfDay) {
  if (NET.myPhaseLocked || NET.stage !== "pick") return;
  NET.myPick = tod;
  picks[myId()] = tod;
  send("pick", { id: myId(), tod });
  bump();
}

export function confirmTodPick() {
  if (NET.stage !== "pick" || !NET.myPick || NET.myPhaseLocked) return;
  NET.myPhaseLocked = true;
  phaseLocked[`tod:${myId()}`] = true;
  send("phaselock", { id: myId(), phase: "tod" });
  bump();
  if (NET.isHost) tryResolvePhaseEarly("tod");
}

export function chooseBan(ban: "none" | "wall" | "trampoline" | "fire" | "teleport" | "boss") {
  if (NET.myPhaseLocked || NET.stage !== "ban") return;
  NET.myBan = ban;
  bans[myId()] = ban;
  send("ban", { id: myId(), ban });
  bump();
}

export function confirmBan() {
  if (NET.stage !== "ban" || !NET.myBan || NET.myPhaseLocked) return;
  NET.myPhaseLocked = true;
  phaseLocked[`ban:${myId()}`] = true;
  send("phaselock", { id: myId(), phase: "ban" });
  bump();
  if (NET.isHost) tryResolvePhaseEarly("ban");
}

export function chooseAbilityPick(choice: string) {
  if (NET.myPhaseLocked || NET.stage !== "abilityPick") return;
  NET.myAbilityChoice = choice;
  abilityChoices[myId()] = choice;
  send("abilitypick", { id: myId(), choice });
  bump();
}

export function confirmAbilityPick() {
  if (NET.stage !== "abilityPick" || !NET.myAbilityChoice || NET.myPhaseLocked) return;
  NET.myPhaseLocked = true;
  phaseLocked[`ability:${myId()}`] = true;
  send("phaselock", { id: myId(), phase: "ability" });
  bump();
  if (NET.isHost) tryResolvePhaseEarly("ability");
}

type StartMsg = {
  tod: TimeOfDay;
  colors: Record<string, "red" | "blue">;
  scores: Record<string, number>;
  loadouts?: Record<string, { ability: "wall" | "trampoline" | "fire" | "teleport" | "boss"; mastery: boolean }>;
  banned?: string[];
};
type RoundMsg = { scores: Record<string, number>; dead: string };
type OverMsg = { winner: string; scores: Record<string, number> };

const pickOne = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]!;

function onStart(m: StartMsg) {
  NET.tod = m.tod;
  NET.colors = m.colors;
  NET.scores = m.scores;
  NET.stage = "playing";
  NET.roundMsg = "";
  NET.pvpLoadout = m.loadouts?.[myId()] ?? NET.pvpLoadout;
  roundLocked = false;
  setTodOverride(m.tod);
  resetGame("pvp");
  // Apply 1v1 loadout
  if (NET.pvpLoadout) {
    setAbility(NET.pvpLoadout.ability, "training"); // match pick may include Boss
    G.pvpMastery = !!NET.pvpLoadout.mastery;
    G.pvpMasteryAbility = NET.pvpLoadout.ability;
  } else {
    G.pvpMastery = false;
    G.pvpMasteryAbility = null;
  }
  G.countdown = 3.6;
  bump();
}

function onDeath(id: string) {
  if (!NET.isHost || roundLocked || NET.stage !== "playing") return;
  roundLocked = true;
  const winner = Object.keys(NET.scores).find((k) => k !== id) ?? opponentId();
  const scores = { ...NET.scores, [winner]: (NET.scores[winner] ?? 0) + 1 };
  if (scores[winner]! >= PVP_WIN) {
    const m: OverMsg = { winner, scores };
    send("over", m);
    onOver(m);
    return;
  }
  const m: RoundMsg = { scores, dead: id };
  send("round", m);
  onRound(m);
  later(2500, () => {
    const s: StartMsg = {
      tod: NET.tod,
      colors: NET.colors,
      scores,
      loadouts: {
        [myId()]: NET.pvpLoadout ?? { ability: "wall", mastery: false },
        [opponentId()]: NET.pvpLoadout ?? { ability: "wall", mastery: false },
      },
    };
    // Keep each player's chosen loadout from match start (stored on NET per client)
    send("start", s);
    onStart(s);
  });
}

export function reportDeath() {
  if (NET.kind === "pvp") {
    send("death", { id: myId() });
    onDeath(myId());
    return;
  }
  // Party campaign: broadcast death so peers queue us for FIFO shard revives
  if (NET.kind === "coop") {
    const id = myId();
    send("death", { id });
    if (!G.reviveQueue.includes(id)) G.reviveQueue.push(id);
  }
}

function onRound(m: RoundMsg) {
  NET.scores = m.scores;
  NET.stage = "roundEnd";
  const winner = Object.keys(m.scores).find((k) => k !== m.dead) ?? "";
  NET.roundMsg = `${NET.names[winner] ?? "player"} scores!`;
  G.frozen = true;
  bump();
}

function onOver(m: OverMsg) {
  NET.scores = m.scores;
  NET.winner = m.winner;
  NET.stage = "over";
  G.frozen = true;
  document.exitPointerLock?.();
  // Career 1v1 wins — leave only counts if you already have ≥1 point
  if (m.winner === myId()) {
    const myScore = m.scores[myId()] ?? 0;
    const opp = Object.keys(m.scores).find((k) => k !== myId()) ?? opponentId();
    const mine = myAccountKey();
    const theirs = NET.accountKeys[opp] ?? "";
    // Same account / same guest tag in another tab → practice match, no career win
    const selfMatch = !!(mine && theirs && mine === theirs);
    if (!selfMatch) recordPvpWin({ opponentLeft: NET.opponentLeft, myScore });
  }
  NET.opponentLeft = false;
  bump();
  if (NET.partyMatch) later(2000, () => goHomeOnline());
}

// ---------------------------------------------------------------- rematch

export function sendRematch() {
  const now = Date.now();
  if (now - NET.rematchSentAt < 3000 || now < NET.rematchBlockedUntil) return;
  NET.rematchSentAt = now;
  NET.rematchStatus = "Rematch invite sent";
  send("rematch", { from: myId() });
  bump();
}
function onRematchReq(from: string) {
  if (Date.now() - NET.lastRematchReply < 3000) return;
  NET.rematchIn = { from, name: NET.names[from] ?? "player" };
  bump();
}
export function answerRematch(yes: boolean) {
  NET.lastRematchReply = Date.now();
  const req = NET.rematchIn;
  NET.rematchIn = null;
  if (!req) return;
  if (!yes) { send("rematch-no", {}); bump(); return; }
  const name = `pvp-${req.from}-${myId()}-${Date.now().toString(36)}`;
  send("rematch-go", { room: name, host: req.from });
  void startPvp(name, false, NET.partyMatch);
}

export async function requeue() {
  leaveRoom(false);
  goHome();
  await queue1v1();
}

// ---------------------------------------------------------------- lobby

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
export async function createLobby(code?: string) {
  const c = (code ?? Array.from({ length: 6 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join("")).toUpperCase();
  await joinRoom(`lobby-${c}`, "lobby", true);
  NET.code = c;
  // Let presence propagate (mobile networks are slower)
  await new Promise((r) => setTimeout(r, 500));
  resetGame("training");
  bump();
  return c;
}

/** Looks for a live lobby with this code. Returns an error message or null on success. */
export async function joinLobby(raw: string): Promise<string | null> {
  const code = raw.trim().toUpperCase().replace(/[^A-Z]/g, "");
  if (code.length !== 6) return "Invalid code — need 6 letters";
  await joinRoom(`lobby-${code}`, "lobby", false);
  NET.code = code;
  const me = myId();
  const ok = await new Promise<boolean>((resolve) => {
    const start = Date.now();
    const tick = () => {
      if (!room || NET.room !== `lobby-${code}`) { resolve(false); return; }
      if (NET.hostId && NET.hostId !== me) { resolve(true); return; }
      if (Object.keys(NET.names).some((k) => k !== me)) { resolve(true); return; }
      if (Date.now() - start > 8000) { resolve(false); return; }
      setTimeout(tick, 200);
    };
    setTimeout(tick, 150);
  });
  if (!ok) {
    leaveRoom(true);
    return "Invalid code or lobby closed";
  }
  if (Object.keys(NET.names).length > LOBBY_MAX) {
    leaveRoom(true);
    return "Lobby is full";
  }
  // Drop any accidental self-peer
  NET.peers.delete(me);
  resetGame("training");
  bump();
  return null;
}

/** Party campaign/training: everyone shares a room and sees each other. */
async function joinCoop(name: string, mode: Mode, host: boolean) {
  await joinRoom(name, "coop", host);
  resetGame(mode);
  bump();
}

// ---------------------------------------------------------------- invites (personal inbox)

const INVITE_BUS = "tble:invite-bus";

export function startInbox() {
  const acc = getAccount();
  stopInbox();
  if (acc.status !== "user" && acc.status !== "guest") return;
  const uname = (acc.username && acc.username !== "guest" ? acc.username : displayName()).trim().toLowerCase();
  const ch = supabase.channel(INVITE_BUS, { config: { broadcast: { self: false }, presence: { key: myId() } } });
  inbox = ch;
  ch.on("broadcast", { event: "invite" }, ({ payload }) => {
    if (!isRecord(payload) || !isText(payload.from, 40) || !isText(payload.to, 40) || !isText(payload.target, 100)) return;
    const inv = payload as unknown as Invite & { to?: string };
    const to = (inv.to ?? "").trim().toLowerCase();
    if (!to || to !== uname) return;
    const kind = inv.kind as Invite["kind"];
    if (kind !== "party" && kind !== "lobby" && kind !== "friend" && kind !== "play_party" && kind !== "play_1v1") return;
    NET.invites = [
      ...NET.invites.filter((i) => i.from !== inv.from || i.kind !== kind),
      {
        id: crypto.randomUUID(), kind, from: inv.from, target: inv.target, t: Date.now(),
        // Use MY clock: the sender's timestamp breaks with clock skew (invite would be dead on arrival).
        expires: kind === "play_party" || kind === "play_1v1" ? Date.now() + 5000 : kind === "friend" ? Date.now() + 10000 : undefined,
      },
    ];
    bump();
  });
  ch.on("broadcast", { event: "friend_req" }, ({ payload }) => {
    if (!isRecord(payload) || !isText(payload.from, 40) || !isText(payload.to, 40) || !isText(payload.id, 80)) return;
    const to = String(payload.to).trim().toLowerCase();
    if (to !== uname) return;
    const req: FriendRequest = {
      id: String(payload.id),
      from: String(payload.from),
      to: String(payload.to),
      t: Date.now(),
    };
    noteIncomingRequest(req);
    NET.invites = [
      ...NET.invites.filter((i) => !(i.kind === "friend" && i.from === req.from)),
      { id: req.id, kind: "friend", from: req.from, target: "", t: Date.now(), expires: Date.now() + 10000 },
    ];
    bump();
  });
  ch.on("broadcast", { event: "profile_req" }, ({ payload }) => {
    if (!isRecord(payload) || !isText(payload.to, 40) || !isText(payload.from, 40)) return;
    if (String(payload.to).trim().toLowerCase() !== uname) return;
    // Reply with our current skin / ability / achievements
    const res = {
      to: String(payload.from).trim().toLowerCase(),
      from: displayName(),
      skin: { ...SKIN },
      ability: getAbility(),
      mastery: (() => { try { return masteryOn(getAbility() as "wall"); } catch { return false; } })(),
      achList: Object.keys(getProgress().earned || {}).slice(0, 40),
    };
    void ch.send({ type: "broadcast", event: "profile_res", payload: res });
  });
  ch.on("broadcast", { event: "profile_res" }, ({ payload }) => {
    if (!isRecord(payload) || !isText(payload.to, 40) || !isText(payload.from, 40)) return;
    if (String(payload.to).trim().toLowerCase() !== uname) return;
    cacheProfile({
      name: String(payload.from),
      skin: isRecord(payload.skin) ? payload.skin as never : undefined,
      ability: isText(payload.ability, 20) ? payload.ability : undefined,
      mastery: typeof payload.mastery === "boolean" ? payload.mastery : undefined,
      achList: Array.isArray(payload.achList) ? payload.achList.filter((x): x is string => typeof x === "string") : undefined,
    });
    bump();
  });
  ch.on("broadcast", { event: "friend_splinter" }, ({ payload }) => {
    if (!isRecord(payload) || !isText(payload.from, 40)) return;
    markSplinteredFrom(String(payload.from));
    bump();
  });
  ch.on("broadcast", { event: "friend_accept" }, ({ payload }) => {
    if (!isRecord(payload) || !isText(payload.from, 40) || !isText(payload.to, 40)) return;
    // payload.from accepted our request (we were the sender: payload.to is us)
    const to = String(payload.to).trim().toLowerCase();
    if (to !== uname) return;
    addFriendDirect(String(payload.from));
    bump();
  });
  ch.on("broadcast", { event: "party-left" }, () => bump());
  // Presence on the shared bus = "who is online" for the tble list (green dot)
  ch.on("presence", { event: "sync" }, () => {
    const st = ch.presenceState() as unknown as Record<string, { name?: unknown }[]>;
    const names = new Set<string>();
    for (const metas of Object.values(st)) for (const m of metas) if (typeof m?.name === "string") names.add(m.name.toLowerCase());
    setOnlineNames(names);
  });
  ch.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      bump();
      void ch.track({ name: uname }).catch(() => { /* ignore */ });
    }
  });
}
export function stopInbox() {
  if (inbox) void supabase.removeChannel(inbox);
  inbox = null;
  setOnlineNames(new Set());
}


/** Send a friend request by exact username (or guest######). */
const profileReqAt: Record<string, number> = {};
export async function requestProfile(username: string) {
  const name = username.trim();
  if (!name || isSelfName(name)) return;
  // The profile viewer polls every second; every request is a broadcast to ALL clients on the shared bus.
  const key = name.toLowerCase();
  if (Date.now() - (profileReqAt[key] ?? 0) < 5000) return;
  profileReqAt[key] = Date.now();
  if (!inbox) startInbox();
  const payload = { from: displayName(), to: name.trim().toLowerCase() };
  for (let i = 0; i < 3; i++) {
    try { if (inbox) await inbox.send({ type: "broadcast", event: "profile_req", payload }); } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, 150));
  }
}

export async function announceFriendSplinter(name: string = displayName()) {
  if (!inbox) startInbox();
  for (let i = 0; i < 3; i++) {
    try { if (inbox) await inbox.send({ type: "broadcast", event: "friend_splinter", payload: { from: name } }); } catch { /* ignore */ }
  }
}

export async function sendFriendRequest(username: string): Promise<{ ok: boolean; msg: string }> {
  const name = username.trim();
  const acc = getAccount();
  if (acc.status !== "user" && acc.status !== "guest") return { ok: false, msg: "Log in or play as guest first." };
  if (!name) return { ok: false, msg: "Enter a username." };
  if (isSelfName(name)) return { ok: false, msg: "You can't add yourself as a tble." };
  if (isFriend(name)) return { ok: false, msg: "Already tbles." };
  if (friendCount() >= MAX_TBLES) return { ok: false, msg: "Too many tbles." };
  if (Date.now() - NET.inviteSentAt < 2000) return { ok: false, msg: "Wait a moment before sending another tble request." };
  const guestName = /^guest\d{6}$/i.test(name);
  if (!guestName && !(await lookupUsername(name))) return { ok: false, msg: "No player with that exact username." };
  NET.inviteSentAt = Date.now();
  if (!inbox) startInbox();
  const req: FriendRequest = {
    id: crypto.randomUUID(),
    from: displayName(),
    to: name,
    t: Date.now(),
  };
  noteOutgoingRequest(req);
  const payload = { id: req.id, from: req.from, to: name.trim().toLowerCase() };
  for (let i = 0; i < 5; i++) {
    try { if (inbox) await inbox.send({ type: "broadcast", event: "friend_req", payload }); } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  return { ok: true, msg: `Tble request sent to ${name}.` };
}

export async function acceptFriendRequest(req: FriendRequest): Promise<{ ok: boolean; msg: string }> {
  if (friendCount() >= MAX_TBLES) return { ok: false, msg: "Too many tbles." };
  const added = addFriendDirect(req.from);
  if (!added.ok) return added;
  removeIncoming(req.id);
  if (!inbox) startInbox();
  const payload = { from: displayName(), to: req.from.trim().toLowerCase(), id: req.id };
  for (let i = 0; i < 5; i++) {
    try { if (inbox) await inbox.send({ type: "broadcast", event: "friend_accept", payload }); } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  return { ok: true, msg: `You and ${req.from} are now tbles.` };
}

export function declineFriendRequest(req: FriendRequest) {
  removeIncoming(req.id);
  bump();
}

export function cancelFriendRequest(req: FriendRequest) {
  removeOutgoing(req.id);
  bump();
}


const playInviteCooldown: Record<string, number> = {};

/** Party campaign / 1v1 play invite to a tble (5s on their end, 7s resend cooldown). */
export async function sendPlayInvite(username: string, kind: "play_party" | "play_1v1"): Promise<{ ok: boolean; msg: string }> {
  const name = username.trim();
  const acc = getAccount();
  if (acc.status !== "user" && acc.status !== "guest") return { ok: false, msg: "Log in or play as guest first." };
  if (!name) return { ok: false, msg: "Pick a tble." };
  if (isSelfName(name)) return { ok: false, msg: "That's you!" };
  const cdKey = `${kind}:${name.toLowerCase()}`;
  if (Date.now() < (playInviteCooldown[cdKey] ?? 0)) return { ok: false, msg: "Wait before sending another invite." };
  if (kind === "play_1v1" && NET.party && NET.party.members.length > 1) {
    return { ok: false, msg: "1v1 is only you + one other player." };
  }
  if (!NET.party) await createParty();
  if (NET.party!.leaderId !== myId()) return { ok: false, msg: "Only the party leader can invite." };
  if (NET.party!.members.length >= PARTY_MAX) return { ok: false, msg: "Error, too many players." };
  if (kind === "play_1v1" && NET.party!.members.length >= 2) return { ok: false, msg: "1v1 is only you + one other player." };
  playInviteCooldown[cdKey] = Date.now() + 7000;
  if (!inbox) startInbox();
  const payload = {
    kind, from: displayName(), target: NET.party!.id, to: name.trim().toLowerCase(), expires: Date.now() + 5000,
  };
  for (let i = 0; i < 4; i++) {
    try { if (inbox) await inbox.send({ type: "broadcast", event: "invite", payload }); } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  return { ok: true, msg: `Invite sent to ${name}.` };
}

/** Sends a party or lobby invite to an exact username. Returns a status message. */
export async function sendInvite(username: string, kind: "party" | "lobby"): Promise<{ ok: boolean; msg: string }> {
  const name = username.trim();
  const acc = getAccount();
  if (acc.status !== "user" && acc.status !== "guest") return { ok: false, msg: "Log in or play as guest first." };
  if (!name) return { ok: false, msg: "Enter a username." };
  if (name.toLowerCase() === displayName().toLowerCase()) return { ok: false, msg: "That's you!" };
  if (Date.now() - NET.inviteSentAt < 3000) return { ok: false, msg: "Wait a moment before sending another invite." };
  const guestName = /^guest\d{6}$/i.test(name);
  if (!guestName && !(await lookupUsername(name))) return { ok: false, msg: "No player with that exact username." };
  let target = "";
  if (kind === "party") {
    if (!NET.party) await createParty();
    if (NET.party!.leaderId !== myId()) return { ok: false, msg: "Only the party leader can invite." };
    if (NET.party!.members.length >= PARTY_MAX) return { ok: false, msg: "Party is full." };
    target = NET.party!.id;
  } else {
    if (!NET.code) return { ok: false, msg: "You're not in a lobby." };
    target = NET.code;
  }
  NET.inviteSentAt = Date.now();
  if (!inbox) startInbox();
  const payload = { kind, from: displayName(), target, to: name.trim().toLowerCase() };
  // Shared invite bus — both players must be subscribed (home screen / logged in)
  for (let i = 0; i < 5; i++) {
    try { if (inbox) await inbox.send({ type: "broadcast", event: "invite", payload }); } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  return { ok: true, msg: `Invite sent to ${name}.` };
}

export function dismissInvite(id: string) {
  NET.invites = NET.invites.filter((i) => i.id !== id);
  bump();
}
export async function acceptInvite(inv: Invite): Promise<string | null> {
  dismissInvite(inv.id);
  if (inv.kind === "lobby") return joinLobby(inv.target);
  if (inv.kind === "friend") return null;
  // party, play_party, play_1v1
  return joinParty(inv.target);
}

// ---------------------------------------------------------------- party

type PartyMeta = { name: string; leader: boolean };
type GoMsg = { mode: "game" | "training" | "pvp" | "lobby"; room: string };

function openParty(id: string, leader: boolean): Promise<string | null> {
  leaveParty(false);
  const me = myId();
  const ch = supabase.channel(`tble:party:${id}`, { config: { broadcast: { self: false }, presence: { key: me } } });
  partyCh = ch;
  NET.party = { id, leaderId: leader ? me : "", members: [] };
  NET.partyNote = "";
  let first = true;
  return new Promise((resolve) => {
    ch.on("presence", { event: "sync" }, () => {
      if (!NET.party) return;
      const st = ch.presenceState<PartyMeta>();
      const members = Object.entries(st).map(([k, v]) => ({ id: k, name: v[0]?.name ?? "player", leader: !!v[0]?.leader }));
      const lead = members.find((m) => m.leader);
      if (!leader && first && lead) {
        first = false;
        if (members.length > PARTY_MAX) { leaveParty(); resolve("Party is full"); return; }
      }
      if (!leader && !first && !lead) { leaveParty(); NET.partyNote = "The party was disbanded."; bump(); return; }
      NET.party.members = members;
      if (lead) NET.party.leaderId = lead.id;
      bump();
    });
    ch.on("broadcast", { event: "kick" }, ({ payload }) => {
      if (payload.id === me) { leaveParty(); NET.partyNote = "You were removed from the party."; bump(); }
    });
    ch.on("broadcast", { event: "disband" }, () => { leaveParty(); NET.partyNote = "The party was disbanded."; bump(); });
    ch.on("broadcast", { event: "go" }, ({ payload }) => void followLeader(payload as GoMsg));
    ch.subscribe(async (s) => {
      if (s === "SUBSCRIBED") {
        await ch.track({ name: displayName(), leader } satisfies PartyMeta);
        resolve(null);
      }
    });
  });
}

export async function createParty() {
  await openParty(crypto.randomUUID().slice(0, 10), true);
}
export async function joinParty(id: string) {
  return openParty(id, false);
}
export function leaveParty(notify = true) {
  if (partyCh) {
    if (NET.party?.leaderId === myId()) void partyCh.send({ type: "broadcast", event: "disband", payload: {} });
    void supabase.removeChannel(partyCh);
  }
  partyCh = null;
  NET.party = null;
  if (notify) bump();
}
export function kickMember(id: string) {
  void partyCh?.send({ type: "broadcast", event: "kick", payload: { id } });
}
export const disbandParty = () => leaveParty();
export const isPartyLeader = () => !!NET.party && NET.party.leaderId === myId();
export const inParty = () => !!NET.party && NET.party.members.length > 1;

/** Leader starts a mode for the whole party. */
export async function partyGo(mode: GoMsg["mode"]): Promise<string | null> {
  if (!NET.party || !isPartyLeader()) return "Only the party leader can start.";
  const others = NET.party.members.filter((m) => m.id !== myId());
  if (mode === "pvp" && others.length !== 1) return "Party 1v1 needs exactly 2 players in the party.";
  let room = `${mode}-${NET.party.id}-${Date.now().toString(36)}`;
  if (mode === "lobby") room = await createLobby();
  void partyCh?.send({ type: "broadcast", event: "go", payload: { mode, room } satisfies GoMsg });
  if (mode === "pvp") await startPvp(room, true, true);
  else if (mode !== "lobby") await joinCoop(room, mode, true);
  return null;
}
async function followLeader(m: GoMsg) {
  if (m.mode === "lobby") { await joinLobby(m.room); return; }
  if (m.mode === "pvp") { await startPvp(m.room, false, true); return; }
  await joinCoop(m.room, m.mode, false);
}

/** Tab close / laptop sleep: leave rooms so peers don't keep a ghost. */
function installUnloadLeave() {
  if (typeof window === "undefined") return;
  const bail = () => {
    try {
      // Notify others so our pending tble requests show as splintered
      if (inbox && getAccount().status === "guest") {
        void inbox.send({ type: "broadcast", event: "friend_splinter", payload: { from: displayName() } });
      }
      leaveParty(false);
      leaveRoom(true);
      leaveQueue();
    } catch { /* ignore */ }
  };
  window.addEventListener("beforeunload", bail);
  window.addEventListener("pagehide", bail);
  document.addEventListener("visibilitychange", () => {
    // Soft: if hidden for a long time we rely on presence timeout; hard close uses beforeunload
  });
}
installUnloadLeave();

