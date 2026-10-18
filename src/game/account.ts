import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { applySettings, setSettingsPersister, SETTINGS, type Settings } from "./settings";
import { applySkin, setSkinPersister, SKIN, type Skin } from "./skins";
import { TRAIN, type TrainCfg } from "./state";
import { hydrateProgress, resetProgress, serializeProgress, setProgressPersister } from "./mastery";

export type Account = { status: "loading" | "signedOut" | "guest" | "user"; userId: string | null; username: string; email: string | null };

let ACC: Account = { status: "loading", userId: null, username: "guest", email: null };
const subs = new Set<() => void>();
function set(next: Partial<Account>) {
  ACC = { ...ACC, ...next };
  subs.forEach((f) => f());
}
export function getAccount() {
  return ACC;
}
export function useAccount() {
  return useSyncExternalStore(
    (f) => { subs.add(f); return () => subs.delete(f); },
    () => ACC,
    () => ACC,
  );
}
/** Name shown to other players in online modes. */
let guestTag = "";
function loadGuestTag() {
  if (guestTag) return guestTag;
  try {
    const s = sessionStorage.getItem("tble-guest-tag");
    if (s && /^\d{6}$/.test(s)) { guestTag = s; return guestTag; }
  } catch { /* ignore */ }
  guestTag = String(Math.floor(100000 + Math.random() * 900000));
  try { sessionStorage.setItem("tble-guest-tag", guestTag); } catch { /* ignore */ }
  return guestTag;
}
/** Guests get a random 6-digit tag (e.g. guest482913) so they can be invited to parties. */
export const displayName = () => {
  if (ACC.status === "user") return ACC.username;
  return `guest${loadGuestTag()}`;
};
// The auth service needs 6+ character passwords; the game allows 3–20, so a fixed suffix is added.
const authPw = (p: string) => `${p}#tble`;

const DOMAIN = "players.tble.app";
const toEmail = (u: string) => `${u.trim().toLowerCase()}@${DOMAIN}`;

export function validateUsername(u: string): string | null {
  if (u.length < 3 || u.length > 20) return "Username must be 3–20 characters.";
  if (!/^[A-Za-z0-9_]+$/.test(u)) return "Username can only use letters, numbers and _.";
  if (u.toLowerCase().startsWith("guest")) return "Usernames can't start with \"guest\".";
  return null;
}
export function validatePassword(p: string): string | null {
  if (p.length < 3 || p.length > 20) return "Password must be 3–20 characters.";
  if (!/[A-Z]/.test(p)) return "Password needs at least 1 uppercase letter.";
  if (!/[a-z]/.test(p)) return "Password needs at least 1 lowercase letter.";
  if (!/[0-9]/.test(p)) return "Password needs at least 1 number.";
  return null;
}

type StoredSettings = Settings & { _skin?: Skin; _prog?: unknown };

/** Everything stored in the profile's settings column: settings + skin + achievement/mastery progress. */
function profilePayload(s: Settings = SETTINGS, skin: Skin = SKIN): StoredSettings {
  return { ...s, _skin: skin, _prog: serializeProgress() };
}

async function loadProfile(userId: string) {
  const { data } = await supabase.from("profiles").select("username, email, settings, training").eq("id", userId).maybeSingle();
  if (!data) return;
  set({ status: "user", userId, username: data.username, email: data.email });
  if (data.settings) {
    const raw = data.settings as unknown as StoredSettings;
    const { _skin, _prog, ...rest } = raw;
    applySettings(rest as Settings, true);
    if (_skin) applySkin(_skin, true);
    if (_prog) hydrateProgress(_prog);
  }
  // Fallback: localStorage progress if the profile row is missing _prog
  try {
    const rawLs = localStorage.getItem(`tble-prog-${userId}`);
    if (rawLs) hydrateProgress(JSON.parse(rawLs));
  } catch { /* ignore */ }
  // Save back right away if a guest earned something before signing in (their progress was merged above)
  persistProfileSettings(SETTINGS);
  if (data.training) Object.assign(TRAIN, data.training as unknown as TrainCfg);
}

function persistProfileSettings(s: Settings) {
  if (ACC.status !== "user" || !ACC.userId) return;
  const payload = profilePayload(s);
  // Local backup so achievements survive even if the profile update is slow/fails once
  try { localStorage.setItem(`tble-prog-${ACC.userId}`, JSON.stringify(payload._prog ?? serializeProgress())); } catch { /* ignore */ }
  void supabase
    .from("profiles")
    .update({ settings: payload as never, updated_at: new Date().toISOString() })
    .eq("id", ACC.userId)
    .then(({ error }) => {
      if (error) {
        // Retry once shortly after — race with concurrent settings writes
        setTimeout(() => {
          if (ACC.status !== "user" || !ACC.userId) return;
          void supabase.from("profiles").update({ settings: profilePayload() as never, updated_at: new Date().toISOString() }).eq("id", ACC.userId);
        }, 400);
      }
    });
}

let started = false;
/** Restores a saved session. Resolves once the account state is known. */
export async function initAccount() {
  if (started) return;
  started = true;
  setSettingsPersister((s) => persistProfileSettings(s));
  setProgressPersister(() => persistProfileSettings(SETTINGS));
  setSkinPersister((skin) => {
    if (ACC.status !== "user" || !ACC.userId) return;
    const payload = profilePayload(SETTINGS, skin);
    void supabase.from("profiles").update({ settings: payload as never, updated_at: new Date().toISOString() }).eq("id", ACC.userId);
  });
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") { set({ status: "signedOut", userId: null, username: "guest", email: null }); resetProgress(); }
    else if (event === "SIGNED_IN" && session?.user && ACC.userId !== session.user.id) setTimeout(() => void loadProfile(session.user.id), 0);
  });
  const { data } = await supabase.auth.getUser();
  if (data.user) await loadProfile(data.user.id);
  if (ACC.status === "loading") set({ status: "signedOut" });
}

export function saveTraining() {
  if (ACC.status === "user" && ACC.userId) void supabase.from("profiles").update({ training: { ...TRAIN } as never }).eq("id", ACC.userId);
}

export async function signUp(username: string, password: string, email: string) {
  const err = validateUsername(username) ?? validatePassword(password);
  if (err) return err;
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return "That email doesn't look right.";
  const { data: taken } = await supabase.rpc("username_exists", { _name: username });
  if (taken) return "That username is taken.";
  const { data, error } = await supabase.auth.signUp({
    email: toEmail(username),
    password: authPw(password),
    options: { data: { username, contact_email: email || "" } },
  });
  if (error) return /registered|exists/i.test(error.message) ? "That username is taken." : `Couldn't create the account: ${error.message}`;
  if (data.user) await loadProfile(data.user.id);
  return null;
}

export async function signIn(username: string, password: string) {
  if (!username || !password) return "Enter your username and password.";
  let { data, error } = await supabase.auth.signInWithPassword({ email: toEmail(username), password: authPw(password) });
  // accounts made before the suffix was added used the raw password
  if (error && password.length >= 6) ({ data, error } = await supabase.auth.signInWithPassword({ email: toEmail(username), password }));
  if (error) return "Wrong username or password.";
  if (data.user) await loadProfile(data.user.id);
  return null;
}

export function playAsGuest() {
  set({ status: "guest", userId: null, username: displayName(), email: null });
}

export async function signOut() {
  await supabase.auth.signOut();
  set({ status: "signedOut", userId: null, username: "guest", email: null });
  resetProgress(); // the next person on this tab starts clean
}

export async function lookupUsername(name: string) {
  const { data } = await supabase.rpc("username_exists", { _name: name });
  return !!data;
}
