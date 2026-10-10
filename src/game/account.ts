import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { applySettings, setSettingsPersister, SETTINGS, type Settings } from "./settings";
import { applySkin, setSkinPersister, SKIN, type Skin } from "./skins";
import { TRAIN, type TrainCfg } from "./state";

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
/** Guests get a random 6-digit tag (e.g. guest482913) so they can be invited to parties. */
export const displayName = () => {
  if (ACC.status === "user") return ACC.username;
  if (!guestTag) guestTag = String(Math.floor(100000 + Math.random() * 900000));
  return `guest${guestTag}`;
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

type StoredSettings = Settings & { _skin?: Skin };

async function loadProfile(userId: string) {
  const { data } = await supabase.from("profiles").select("username, email, settings, training").eq("id", userId).maybeSingle();
  if (!data) return;
  set({ status: "user", userId, username: data.username, email: data.email });
  if (data.settings) {
    const raw = data.settings as unknown as StoredSettings;
    const { _skin, ...rest } = raw;
    applySettings(rest as Settings, true);
    if (_skin) applySkin(_skin, true);
  }
  if (data.training) Object.assign(TRAIN, data.training as unknown as TrainCfg);
}

function persistProfileSettings(s: Settings) {
  if (ACC.status !== "user" || !ACC.userId) return;
  const payload: StoredSettings = { ...s, _skin: SKIN };
  void supabase.from("profiles").update({ settings: payload as never, updated_at: new Date().toISOString() }).eq("id", ACC.userId);
}

let started = false;
/** Restores a saved session. Resolves once the account state is known. */
export async function initAccount() {
  if (started) return;
  started = true;
  setSettingsPersister((s) => persistProfileSettings(s));
  setSkinPersister((skin) => {
    if (ACC.status !== "user" || !ACC.userId) return;
    const payload: StoredSettings = { ...SETTINGS, _skin: skin };
    void supabase.from("profiles").update({ settings: payload as never, updated_at: new Date().toISOString() }).eq("id", ACC.userId);
  });
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") set({ status: "signedOut", userId: null, username: "guest", email: null });
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
}

export async function lookupUsername(name: string) {
  const { data } = await supabase.rpc("username_exists", { _name: name });
  return !!data;
}
