import { useSyncExternalStore } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { setTodOverride, type TimeOfDay } from "./settings";
import { displayName, getAccount, lookupUsername } from "./account";
import { G, goHome, resetGame, type Mode } from "./state";

/**
 * Online play runs on realtime channels. Each player's browser simulates its own
 * table and streams its pose; the room host's browser runs the match itself
 * (map pick, colours, scoring, rounds) and everyone follows the host's calls.
 */

export type Peer = { id: string; name: string; x: number; y: number; z: number; yaw: number; hp: number; dead: boolean; t: number };
export type Kind = "pvp" | "lobby" | "coop";
export type Invite = { id: string; kind: "party" | "lobby"; from: string; target: string; t: number };
export type PartyMember = { id: string; name: string; leader: boolean };

export const PVP_WIN = 3;
export const PVP_DMG = { bullet: 5, bomb: 10, slam: 10 };
export const PVP_SCALE = 3; // players are 3x bigger in 1v1s and lobbies
export const PVP_HITBOX = 1.6 * PVP_SCALE;
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
  stage: "idle" as "idle" | "queue" | "pick" | "playing" | "roundEnd" | "over",
  pickEnds: 0,
  myPick: null as TimeOfDay | null,
  tod: "evening" as TimeOfDay,
  colors: {} as Record<string, "red" | "blue">,
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
  onHit: (_dmg: number, _stun: boolean) => {},
  /** shared enemies: host snapshot arrives at followers */
  onEnts: (_s: EntSnap) => {},
  /** shared enemies: a follower hit something (host applies it) */
  onEhit: (_h: EHit) => {},
  /** shared enemies: host fired an enemy bullet (followers spawn a copy) */
  onEshot: (_b: number[]) => {},
  /** lobby: a follower asked the host to spawn training enemies */
  onEspawn: (_q: { kind: string; n: number }) => {},
  onWon: () => {},
};
export type EntSnap = { t: number[]; b: number[]; boss: number[] | null; stage: string; bh: number; bm: number; s: number[] };
export type EHit = { k: "t" | "b" | "boss"; i: number; dmg: number };

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
let roundLocked = false;
let pickTimer: ReturnType<typeof setTimeout> | null = null;
let lastPose = 0;
const timers: ReturnType<typeof setTimeout>[] = [];
const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

const send = (event: string, payload: Record<string, unknown>) => {
  void room?.send({ type: "broadcast", event, payload });
};

// ---------------------------------------------------------------- rooms

type Meta = { name: string; host: boolean; id: string };

function joinRoom(name: string, kind: Kind, host: boolean, stage?: (typeof NET)["stage"]): Promise<RealtimeChannel> {
  leaveRoom(false);
  const id = myId();
  Object.assign(NET, empty(), { online: true, kind, room: name, isHost: host });
  if (stage) NET.stage = stage; // set before presence syncs so the host can start the pick
  NET.names[id] = displayName();
  const ch = supabase.channel(`tble:${name}`, { config: { broadcast: { self: false }, presence: { key: id } } });
  room = ch;
  ch.on("broadcast", { event: "pose" }, ({ payload }) => {
    const p = payload as Peer;
    const cur = NET.peers.get(p.id);
    NET.peers.set(p.id, { ...p, name: cur?.name ?? NET.names[p.id] ?? "player", t: performance.now() });
    if (!cur) bump();
  });
  ch.on("broadcast", { event: "hit" }, ({ payload }) => {
    if (payload.to !== id) return;
    if (NET.kind === "pvp" ? NET.stage === "playing" : true) NET_HOOKS.onHit(payload.dmg as number, !!payload.stun);
  });
  ch.on("broadcast", { event: "ents" }, ({ payload }) => { if (!NET.isHost) NET_HOOKS.onEnts(payload as EntSnap); });
  ch.on("broadcast", { event: "ehit" }, ({ payload }) => { if (NET.isHost) NET_HOOKS.onEhit(payload as EHit); });
  ch.on("broadcast", { event: "eshot" }, ({ payload }) => { if (!NET.isHost) NET_HOOKS.onEshot(payload.b as number[]); });
  ch.on("broadcast", { event: "espawn" }, ({ payload }) => { if (NET.isHost) NET_HOOKS.onEspawn(payload as { kind: string; n: number }); });
  ch.on("broadcast", { event: "won" }, () => { if (!NET.isHost) NET_HOOKS.onWon(); });
  ch.on("broadcast", { event: "death" }, ({ payload }) => onDeath(payload.id as string));
  ch.on("broadcast", { event: "pickstart" }, ({ payload }) => beginPick(payload.ms as number));
  ch.on("broadcast", { event: "pick" }, ({ payload }) => { picks[payload.id as string] = payload.tod as TimeOfDay; });
  ch.on("broadcast", { event: "start" }, ({ payload }) => onStart(payload as StartMsg));
  ch.on("broadcast", { event: "round" }, ({ payload }) => onRound(payload as RoundMsg));
  ch.on("broadcast", { event: "over" }, ({ payload }) => onOver(payload as OverMsg));
  ch.on("broadcast", { event: "rematch" }, ({ payload }) => onRematchReq(payload.from as string));
  ch.on("broadcast", { event: "rematch-no" }, () => {
    NET.rematchStatus = "Rematch declined";
    NET.rematchBlockedUntil = Date.now() + 5000;
    bump();
  });
  ch.on("broadcast", { event: "rematch-go" }, ({ payload }) => void startPvp(payload.room as string, payload.host as string === id, NET.partyMatch));
  ch.on("presence", { event: "sync" }, () => {
    const state = ch.presenceState<Meta>();
    const ids = new Set<string>();
    for (const [key, metas] of Object.entries(state)) {
      const m = metas[0];
      if (!m) continue;
      ids.add(key);
      NET.names[key] = m.name;
      if (m.host) NET.hostId = key;
      const p = NET.peers.get(key);
      if (p) p.name = m.name;
    }
    for (const k of [...NET.peers.keys()]) if (!ids.has(k)) NET.peers.delete(k);
    onPresence(ids);
    bump();
  });
  return new Promise((resolve) => {
    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ name: displayName(), host, id } satisfies Meta);
        resolve(ch);
      }
    });
  });
}

export function leaveRoom(full = true) {
  timers.splice(0).forEach(clearTimeout);
  if (pickTimer) clearTimeout(pickTimer);
  if (room) void supabase.removeChannel(room);
  room = null;
  leaveQueue();
  picks = {};
  roundLocked = false;
  Object.assign(NET, empty());
  setTodOverride(null);
  if (full) bump();
}

export function goHomeOnline() {
  leaveRoom();
  goHome();
}

/** Streams this player's pose (~10 per second). */
export function sendPose(x: number, y: number, z: number, yaw: number) {
  if (!room || !NET.online) return;
  const now = performance.now();
  if (now - lastPose < 100) return;
  lastPose = now;
  send("pose", { id: myId(), x, y, z, yaw, hp: G.playerHp, dead: G.pvpDead });
}

export function hitPeer(to: string, dmg: number, stun = false) {
  const ok = NET.kind === "pvp" ? NET.stage === "playing" : NET.kind === "lobby";
  if (!ok) return;
  send("hit", { to, dmg, stun });
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
      send("pickstart", { ms: 10000 });
      beginPick(10000);
    } else send("pickstart", { ms: Math.max(500, NET.pickEnds - Date.now()) }); // late joiner catch-up
    // re-send a couple of times in case the opponent wasn't listening yet
    for (const d of [800, 2000]) later(d, () => { if (NET.stage === "pick" && NET.pickEnds) send("pickstart", { ms: Math.max(500, NET.pickEnds - Date.now()) }); });
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
  const ch = supabase.channel("tble:mm1v1", { config: { presence: { key: id } } });
  mm = ch;
  const joinedAt = Date.now();
  ch.on("presence", { event: "sync" }, () => {
    if (mm !== ch) return;
    const list = Object.entries(ch.presenceState<{ t: number }>())
      .map(([k, v]) => ({ id: k, t: v[0]?.t ?? 0 }))
      .sort((a, b) => a.t - b.t || a.id.localeCompare(b.id));
    for (let i = 0; i + 1 < list.length; i += 2) {
      const a = list[i]!, b = list[i + 1]!;
      if (a.id !== id && b.id !== id) continue;
      void startPvp(`pvp-${a.id}-${b.id}`, a.id === id);
      return;
    }
  });
  ch.subscribe(async (s) => { if (s === "SUBSCRIBED") await ch.track({ t: joinedAt }); });
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

function beginPick(ms: number) {
  if (!NET.isHost && NET.pickEnds !== 0) return; // already counting down
  if (NET.stage !== "pick" && NET.stage !== "idle") return;
  NET.pickEnds = Date.now() + ms;
  NET.stage = "pick";
  bump();
  if (NET.isHost) {
    if (pickTimer) clearTimeout(pickTimer);
    pickTimer = setTimeout(resolvePick, ms + 300);
  }
}

export function choosePick(tod: TimeOfDay) {
  NET.myPick = tod;
  picks[myId()] = tod;
  send("pick", { id: myId(), tod });
  bump();
}

type StartMsg = { tod: TimeOfDay; colors: Record<string, "red" | "blue">; scores: Record<string, number> };
type RoundMsg = { scores: Record<string, number>; dead: string };
type OverMsg = { winner: string; scores: Record<string, number> };

const pickOne = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]!;

function resolvePick() {
  const me = myId(), opp = opponentId();
  const chosen = [picks[me], picks[opp]].filter(Boolean) as TimeOfDay[];
  const tod = chosen.length === 0 ? pickOne<TimeOfDay>(["day", "evening", "night"]) : chosen.length === 1 || chosen[0] === chosen[1] ? chosen[0]! : pickOne(chosen);
  const red = pickOne([me, opp]);
  const colors = { [red]: "red", [red === me ? opp : me]: "blue" } as Record<string, "red" | "blue">;
  const msg: StartMsg = { tod, colors, scores: { [me]: 0, [opp]: 0 } };
  send("start", msg);
  onStart(msg);
}

function onStart(m: StartMsg) {
  NET.tod = m.tod;
  NET.colors = m.colors;
  NET.scores = m.scores;
  NET.stage = "playing";
  NET.roundMsg = "";
  roundLocked = false;
  setTodOverride(m.tod);
  resetGame("pvp");
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
    const s: StartMsg = { tod: NET.tod, colors: NET.colors, scores };
    send("start", s);
    onStart(s);
  });
}

export function reportDeath() {
  if (NET.kind !== "pvp") return;
  send("death", { id: myId() });
  onDeath(myId());
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
  const c = code ?? Array.from({ length: 6 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join("");
  await joinRoom(`lobby-${c}`, "lobby", true);
  NET.code = c;
  resetGame("training");
  bump();
  return c;
}

/** Looks for a live lobby with this code. Returns an error message or null on success. */
export async function joinLobby(raw: string): Promise<string | null> {
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z]{6}$/.test(code)) return "Invalid code";
  const probe = supabase.channel(`tble:lobby-${code}`, { config: { presence: { key: `probe-${myId()}` } } });
  const info = await new Promise<{ host: boolean; n: number }>((resolve) => {
    const done = setTimeout(() => resolve({ host: false, n: 0 }), 3000);
    probe.on("presence", { event: "sync" }, () => {
      const st = probe.presenceState<Meta>();
      const metas = Object.values(st).map((m) => m[0]).filter(Boolean) as Meta[];
      if (metas.some((m) => m.host)) { clearTimeout(done); resolve({ host: true, n: metas.length }); }
    });
    probe.subscribe();
  });
  void supabase.removeChannel(probe);
  if (!info.host) return "Invalid code";
  if (info.n >= LOBBY_MAX) return "Lobby is full";
  await joinRoom(`lobby-${code}`, "lobby", false);
  NET.code = code;
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

const inboxName = (u: string) => `tble:user:${u.trim().toLowerCase()}`;

export function startInbox() {
  const acc = getAccount();
  stopInbox();
  if (acc.status !== "user" && acc.status !== "guest") return;
  const ch = supabase.channel(inboxName(displayName()), { config: { broadcast: { self: false } } });
  inbox = ch;
  ch.on("broadcast", { event: "invite" }, ({ payload }) => {
    const inv = payload as Invite;
    NET.invites = [...NET.invites.filter((i) => i.from !== inv.from || i.kind !== inv.kind), { ...inv, id: crypto.randomUUID(), t: Date.now() }];
    bump();
  });
  ch.on("broadcast", { event: "party-left" }, () => bump());
  ch.subscribe();
}
export function stopInbox() {
  if (inbox) void supabase.removeChannel(inbox);
  inbox = null;
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
  const ch = supabase.channel(inboxName(name), { config: { broadcast: { self: false } } });
  await new Promise<void>((resolve) => {
    const t = setTimeout(resolve, 2500);
    ch.subscribe((s) => { if (s === "SUBSCRIBED") { clearTimeout(t); resolve(); } });
  });
  await ch.send({ type: "broadcast", event: "invite", payload: { kind, from: displayName(), target } });
  setTimeout(() => void supabase.removeChannel(ch), 1500);
  return { ok: true, msg: `Invite sent to ${name}.` };
}

export function dismissInvite(id: string) {
  NET.invites = NET.invites.filter((i) => i.id !== id);
  bump();
}
export async function acceptInvite(inv: Invite): Promise<string | null> {
  dismissInvite(inv.id);
  if (inv.kind === "lobby") return joinLobby(inv.target);
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
