import { useSyncExternalStore } from "react";
import { getAccount, displayName } from "./account";

export type Friend = { name: string; addedAt: number };
export type FriendRequest = { id: string; from: string; to: string; t: number };

const LS_FRIENDS = "tble-friends-guest";
const LS_OUT = "tble-friend-out-guest";
const LS_IN = "tble-friend-in-guest";

let friends: Friend[] = [];
let outgoing: FriendRequest[] = [];
let incoming: FriendRequest[] = [];
const subs = new Set<() => void>();
function bump() { subs.forEach((f) => f()); }

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
  return { id: o.id, from: o.from, to: o.to, t: typeof o.t === "number" ? o.t : Date.now() };
}

export function loadFriends() {
  friends = readList(friendsKey(), mapFriend);
  outgoing = readList(outKey(), mapReq);
  incoming = readList(inKey(), mapReq);
  bump();
}

function persistAll() {
  write(friendsKey(), friends);
  write(outKey(), outgoing);
  write(inKey(), incoming);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const acc = require("./account") as { persistFriendsToProfile?: (f: Friend[]) => void };
    acc.persistFriendsToProfile?.(friends);
  } catch { /* ignore */ }
}

export function getFriends() { return friends; }
export function getOutgoingRequests() { return outgoing; }
export function getIncomingRequests() { return incoming; }

export function useFriends() {
  return useSyncExternalStore(
    (cb) => { subs.add(cb); return () => subs.delete(cb); },
    () => friends,
    () => friends,
  );
}
export function useFriendRequests() {
  return useSyncExternalStore(
    (cb) => { subs.add(cb); return () => subs.delete(cb); },
    () => ({ incoming, outgoing }),
    () => ({ incoming, outgoing }),
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
    friends = [...map.values()];
  } else {
    friends = incomingF;
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

/** Local accept after network confirmation */
export function addFriendDirect(name: string) {
  const n = name.trim();
  if (n.length < 3 || isSelfName(n) || isFriend(n)) return;
  friends = [...friends, { name: n, addedAt: Date.now() }];
  outgoing = outgoing.filter((r) => r.to.toLowerCase() !== n.toLowerCase());
  incoming = incoming.filter((r) => r.from.toLowerCase() !== n.toLowerCase());
  persistAll();
  bump();
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
  incoming = [...incoming, req];
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

try { loadFriends(); } catch { /* ignore */ }
