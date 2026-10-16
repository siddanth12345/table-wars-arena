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
  "nigger", "nigga", "faggot", "fag", "retard", "retarded", "kys", "kill yourself",
  "nazi", "hitler", "rape", "rapist", "molest", "pedo", "paedo",
];
const MILD = [
  "stupid", "idiot", "dumb", "moron", "loser", "trash", "noob", "suck", "shut up",
  "ugly", "fat", "hate you", "nobody likes",
];

function normalize(s: string) {
  return s.toLowerCase().replace(/[@0]/g, "o").replace(/1/g, "i").replace(/3/g, "e").replace(/\$/g, "s").replace(/[^a-z\s]/g, " ");
}

export function filterChat(raw: string): string {
  const text = raw.slice(0, 50);
  const n = normalize(text);
  for (const w of HARD) {
    if (n.includes(w)) return "*splinter*";
  }
  let mild = false;
  for (const w of MILD) {
    if (n.includes(w)) { mild = true; break; }
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
