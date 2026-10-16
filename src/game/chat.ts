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

/** Lower-case, strip accents / zero-width characters and undo common look-alike swaps (fuck, ph, leet). */
function base(s: string) {
  return s.toLowerCase()
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "") // accents: û → u
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060\ufeff\u00ad]/g, "") // zero-width / soft hyphen
    .replace(/[@ø0]/g, "o").replace(/[1!|]/g, "i").replace(/3/g, "e").replace(/4/g, "a")
    .replace(/5/g, "s").replace(/7/g, "t").replace(/\$/g, "s")
    .replace(/ph/g, "f");
}

function normalize(s: string) {
  let n = base(s);
  // remove everything that isn't a letter: f.u.c.k / f u c k / f-u-c-k
  n = n.replace(/[^a-z]+/g, "");
  // collapse repeated letters: fuuuuck → fuck, fuckkk → fuck (list words are collapsed the same way)
  n = n.replace(/(.)\1+/g, "$1");
  return n;
}

function normalizeSpaced(s: string) {
  return base(s)
    .replace(/[^a-z\s]/g, " ")
    .replace(/(.)\1+/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

// The f-word: the full spellings are matched anywhere in the squashed text; short/abbreviated forms
// (fuk, fck, f*ck…) only as their own word so things like "of UK" or "self check" don't trip it.
const FWORD_ANYWHERE = ["fuck", "fvck", "fuhk", "fuq", "fucc"];
const FWORD_WORD = /^(fu?c?k|fck|fuk|fuq|fvk|fvck)(er|ers|ed|ing|in|s|a|ah|y)?$/;

function hasFWord(text: string) {
  const compact = normalize(text);
  if (FWORD_ANYWHERE.some((w) => compact.includes(normalize(w)))) return true;
  // Word-level: drop masking symbols inside a word (f*ck, f**k, f#ck) and check abbreviated forms
  const tokens = base(text).split(/[\s,;:!?'"()[\]{}/\\]+/);
  return tokens.some((tok) => {
    const t = tok.replace(/[^a-z]/g, "").replace(/(.)\1+/g, "$1");
    return t.length > 1 && FWORD_WORD.test(t);
  });
}

/** True if the text hits the hard word list (also used for incoming messages from other players). */
function isHard(text: string) {
  if (hasFWord(text)) return true;
  const compact = normalize(text);
  const spaced = normalizeSpaced(text);
  for (const w of HARD) {
    const cw = normalize(w);
    if (cw && compact.includes(cw)) return true;
    if (spaced.includes(normalizeSpaced(w))) return true;
  }
  return false;
}

export function filterChat(raw: string): string {
  const text = raw.slice(0, 50);
  if (isHard(text)) return "*splinter*";
  const compact = normalize(text);
  const spaced = normalizeSpaced(text);
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
    text: (() => { const t = String(payload.text ?? "").slice(0, 50); return isHard(t) ? "*splinter*" : t; })(), // re-check: a modified client could skip the sender-side filter
    t: Number(payload.t) || Date.now(),
  };
  if (messages.some((m) => m.id === msg.id)) return;
  pushChatLocal(msg);
}
