import { displayName } from "./account";
import { sendNet, NET } from "./net";

export type ChatMsg = { id: string; name: string; text: string; t: number };

const MAX = 30;
let messages: ChatMsg[] = [];
const subs = new Set<() => void>();
let mildStrikes = 0;

function bump() { subs.forEach((f) => f()); }

export function getChatMessages() { return messages; }
export function subscribeChat(cb: () => void) {
  subs.add(cb);
  return () => { subs.delete(cb); };
}
export function pushChatLocal(msg: ChatMsg) {
  messages = [...messages, msg].slice(-MAX);
  bump();
}
export function clearChat() {
  messages = [];
  mildStrikes = 0;
  bump();
}

const HARD = [
  "nigger", "nigga", "nigg", "faggot", "faggots", "fag", "fags", "retard", "retarded", "retards",
  "kys", "kill yourself", "kill urself", "killyourself",
  "nazi", "hitler", "rape", "rapist", "raping", "molest", "pedo", "paedo", "pedophile",
  "cunt", "cunts", "whore", "whores", "slut", "sluts", "bitch", "bitches",
  "motherfucker", "motherfuck", "fuck you", "fuck u", "fuckoff", "fuck off",
  "shithead", "asshole", "dickhead", "cock", "pussy", "bastard",
];
const MILD = [
  "stupid", "idiot", "dumb", "moron", "loser", "trash", "noob", "suck", "shut up",
  "ugly", "fatass", "hate you", "nobody likes", "dumbass", "shutthefuck",
];

function normalize(s: string) {
  let n = s.toLowerCase();
  // strip zero-width / separators used to evade filters
  n = n.replace(/[\u200b-\u200f\u202a-\u202e]/g, "");
  n = n.replace(/[@ø0]/g, "o").replace(/[1!|]/g, "i").replace(/3/g, "e").replace(/4/g, "a")
    .replace(/5/g, "s").replace(/7/g, "t").replace(/\$/g, "s").replace(/@/g, "a");
  // collapse repeated letters: fuuuuck → fuuck → enough for includes
  n = n.replace(/(.)\1{2,}/g, "$1$1");
  // remove non-letters between letters: f.u.c.k / f u c k
  n = n.replace(/[^a-z]+/g, "");
  return n;
}

function normalizeSpaced(s: string) {
  return s.toLowerCase()
    .replace(/[@0]/g, "o").replace(/1/g, "i").replace(/3/g, "e")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function filterChat(raw: string): string {
  const text = raw.slice(0, 50);
  const compact = normalize(text);
  const spaced = normalizeSpaced(text);
  for (const w of HARD) {
    const cw = normalize(w);
    if (cw && compact.includes(cw)) return "*splinter*";
    if (spaced.includes(w)) return "*splinter*";
  }
  let mild = false;
  for (const w of MILD) {
    const cw = normalize(w);
    if ((cw && compact.includes(cw)) || spaced.includes(w)) { mild = true; break; }
  }
  if (mild) {
    mildStrikes++;
    if (mildStrikes >= 5) return "*splinter*";
  }
  return text;
}

export function sendChat(raw: string) {
  if (!NET.online) return;
  const cleaned = raw.trim();
  if (!cleaned) return;
  const text = filterChat(cleaned);
  const msg: ChatMsg = {
    id: crypto.randomUUID().slice(0, 8),
    name: displayName(),
    text,
    t: Date.now(),
  };
  pushChatLocal(msg);
  sendNet("chat", { id: msg.id, name: msg.name, text: msg.text, t: msg.t });
}

export function onRemoteChat(payload: Record<string, unknown>) {
  const msg: ChatMsg = {
    id: String(payload.id ?? crypto.randomUUID().slice(0, 8)),
    name: String(payload.name ?? "player"),
    text: String(payload.text ?? "").slice(0, 50),
    t: Number(payload.t) || Date.now(),
  };
  if (messages.some((m) => m.id === msg.id)) return;
  pushChatLocal(msg);
}
