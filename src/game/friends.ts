import { useSyncExternalStore } from "react";
import { getAccount, displayName } from "./account";

export type Friend = { name: string; addedAt: number };
export type FriendRequest = { id: string; from: string; to: string; t: number; splintered?: boolean };

export const MAX_TBLES = 75;
const LS_FRIENDS = "tble-friends-guest";
const LS_OUT = "tble-friend-out-guest";
const LS_IN = "tble-friend-in-guest";

let friends: Friend[] = [];
let outgoing: FriendRequest[] = [];
let incoming: FriendRequest[] = [];
let version = 0;
let friendsSnap: Friend[] = friends;
let reqSnap = { incoming, outgoing };
const subs = new Set<() => void>();
function bump() {
  version++;
  friendsSnap = friends;
  reqSnap = { incoming, outgoing };
  subs.forEach((f) => f());
}

function accKey() {
  const a = getAccount();
  if (a.status === "user" && a.userId) return a.userId;
  return "guest";
}
function friendsKey() {
  return accKey() === "guest" ? LS_FRIENDS : `tble-friends-${accKey()}`;
}
function outKey() {
  return accKey() === "guest" ? LS_OUT : `tble-friend-out-${accKey()}`;
}
function inKey() {
  return accKey() === "guest" ? LS_IN : `tble-friend-in-${accKey()}`;
}

function readList<T>(key: string, map: (x: unknown) => T | null): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.map(map).filter((x): x is T => x != null);
  } catch {
    return [];
  }
}
function write(key: string, data: unknown) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* ignore */ }
}

function mapFriend(x: unknown): Friend | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (typeof o.name !== "string" || o.name.trim().length < 3) return null;
  return { name: o.name.trim(), addedAt: typeof o.addedAt === "number" ? o.addedAt : Date.now() };
}
function mapReq(x: unknown): FriendRequest | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.from !== "string" || typeof o.to !== "string") return null;
  return {
    id: o.id, from: o.from, to: o.to,
    t: typeof o.t === "number" ? o.t : Date.now(),
    splintered: !!o.splintered,
  };
}

export function isGuestName(name: string) {
  return /^guest\d{6}$/i.test(name.trim());
}

/** Guest requests older than 2 minutes are treated as splintered (account likely gone). */
export function markSplinteredRequests() {
  const now = Date.now();
  let changed = false;
  incoming = incoming.map((r) => {
    if (!r.splintered && isGuestName(r.from) && now - r.t > 20_000) {
      changed = true;
      return { ...r, splintered: true };
    }
    return r;
  });
  if (changed) {
    write(inKey(), incoming);
    bump();
  }
}

export function loadFriends() {
  friends = readList(friendsKey(), mapFriend);
  outgoing = readList(outKey(), mapReq);
  incoming = readList(inKey(), mapReq);
  markSplinteredRequests();
  bump();
}

function persistAll() {
  write(friendsKey(), friends);
  write(outKey(), outgoing);
  write(inKey(), incoming);
  try {
    const acc = require("./account") as { persistFriendsToProfile?: (f: Friend[]) => void };
    acc.persistFriendsToProfile?.(friends);
  } catch { /* ignore */ }
}

export function getFriends() { return friends; }
export function getOutgoingRequests() { return outgoing; }
export function getIncomingRequests() { return incoming; }
export function friendCount() { return friends.length; }

export function useFriends() {
  return useSyncExternalStore(
    (cb) => { subs.add(cb); return () => subs.delete(cb); },
    () => friendsSnap,
    () => friendsSnap,
  );
}
export function useFriendRequests() {
  return useSyncExternalStore(
    (cb) => { subs.add(cb); return () => subs.delete(cb); },
    () => reqSnap,
    () => reqSnap,
  );
}

export function serializeFriends() {
  return friends.map((f) => ({ name: f.name, addedAt: f.addedAt }));
}

export function hydrateFriends(raw: unknown, merge = false) {
  const incomingF = Array.isArray(raw)
    ? raw.map(mapFriend).filter((x): x is Friend => x != null)
    : [];
  if (merge) {
    const map = new Map(friends.map((f) => [f.name.toLowerCase(), f]));
    for (const f of incomingF) {
      if (!map.has(f.name.toLowerCase())) map.set(f.name.toLowerCase(), f);
    }
    friends = [...map.values()].slice(0, MAX_TBLES);
  } else {
    friends = incomingF.slice(0, MAX_TBLES);
  }
  persistAll();
  bump();
}

export function clearFriends() {
  friends = [];
  outgoing = [];
  incoming = [];
  try {
    localStorage.removeItem(friendsKey());
    localStorage.removeItem(outKey());
    localStorage.removeItem(inKey());
  } catch { /* ignore */ }
  bump();
}

function selfNames(): string[] {
  const a = getAccount();
  const names = [displayName().toLowerCase()];
  if (a.username) names.push(a.username.toLowerCase());
  return [...new Set(names.filter(Boolean))];
}

export function isSelfName(name: string) {
  return selfNames().includes(name.trim().toLowerCase());
}

export function isFriend(name: string) {
  return friends.some((f) => f.name.toLowerCase() === name.trim().toLowerCase());
}

export function addFriendDirect(name: string): { ok: boolean; msg: string } {
  const n = name.trim();
  if (n.length < 3 || isSelfName(n)) return { ok: false, msg: "Can't add that tble." };
  if (isFriend(n)) return { ok: true, msg: "Already tbles." };
  if (friends.length >= MAX_TBLES) return { ok: false, msg: "Too many tbles." };
  friends = [...friends, { name: n, addedAt: Date.now() }];
  outgoing = outgoing.filter((r) => r.to.toLowerCase() !== n.toLowerCase());
  incoming = incoming.filter((r) => r.from.toLowerCase() !== n.toLowerCase());
  persistAll();
  bump();
  return { ok: true, msg: `Added ${n}.` };
}

export function removeFriend(name: string) {
  friends = friends.filter((f) => f.name.toLowerCase() !== name.toLowerCase());
  persistAll();
  bump();
}

export function noteOutgoingRequest(req: FriendRequest) {
  if (outgoing.some((r) => r.id === req.id)) return;
  outgoing = [...outgoing.filter((r) => r.to.toLowerCase() !== req.to.toLowerCase()), req];
  persistAll();
  bump();
}

export function noteIncomingRequest(req: FriendRequest) {
  if (isSelfName(req.from) || isFriend(req.from)) return;
  if (incoming.some((r) => r.id === req.id || r.from.toLowerCase() === req.from.toLowerCase())) return;
  const splintered = isGuestName(req.from) && Date.now() - req.t > 20_000;
  incoming = [...incoming, { ...req, splintered }];
  persistAll();
  bump();
}

export function removeIncoming(id: string) {
  incoming = incoming.filter((r) => r.id !== id);
  persistAll();
  bump();
}

export function removeOutgoing(id: string) {
  outgoing = outgoing.filter((r) => r.id !== id);
  persistAll();
  bump();
}

export function dismissSplintered(id: string) {
  removeIncoming(id);
}

/** Mark all incoming requests from this username as splintered (sender left). */
export function markSplinteredFrom(fromName: string) {
  const key = fromName.trim().toLowerCase();
  if (!key) return;
  let changed = false;
  incoming = incoming.map((r) => {
    if (r.from.toLowerCase() === key && !r.splintered) {
      changed = true;
      return { ...r, splintered: true };
    }
    return r;
  });
  if (changed) {
    write(inKey(), incoming);
    bump();
  }
}

try { loadFriends(); } catch { /* ignore */ }
