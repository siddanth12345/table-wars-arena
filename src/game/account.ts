import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { applySettings, setSettingsPersister, type Settings } from "./settings";
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
export const displayName = () => (ACC.status === "user" ? ACC.username : "guest");

const DOMAIN = "players.tble.app";
const toEmail = (u: string) => `${u.trim().toLowerCase()}@${DOMAIN}`;

export function validateUsername(u: string): string | null {
  if (u.length < 3 || u.length > 20) return "Username must be 3–20 characters.";
  if (!/^[A-Za-z0-9_]+$/.test(u)) return "Username can only use letters, numbers and _.";
  if (u.toLowerCase() === "guest") return "That username is reserved.";
  return null;
}
export function validatePassword(p: string): string | null {
  if (p.length < 3 || p.length > 20) return "Password must be 3–20 characters.";
  if (!/[A-Z]/.test(p)) return "Password needs at least 1 uppercase letter.";
  if (!/[a-z]/.test(p)) return "Password needs at least 1 lowercase letter.";
  if (!/[0-9]/.test(p)) return "Password needs at least 1 number.";
  return null;
}

async function loadProfile(userId: string) {
  const { data } = await supabase.from("profiles").select("username, email, settings, training").eq("id", userId).maybeSingle();
  if (!data) return;
  set({ status: "user", userId, username: data.username, email: data.email });
  if (data.settings) applySettings(data.settings as unknown as Settings, true);
  if (data.training) Object.assign(TRAIN, data.training as unknown as TrainCfg);
}

let started = false;
/** Restores a saved session. Resolves once the account state is known. */
export async function initAccount() {
  if (started) return;
  started = true;
  setSettingsPersister((s) => {
    if (ACC.status === "user" && ACC.userId) void supabase.from("profiles").update({ settings: s as never, updated_at: new Date().toISOString() }).eq("id", ACC.userId);
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
    password,
    options: { data: { username, contact_email: email || "" } },
  });
  if (error) return /registered/i.test(error.message) ? "That username is taken." : error.message;
  if (data.user) await loadProfile(data.user.id);
  return null;
}

export async function signIn(username: string, password: string) {
  if (!username || !password) return "Enter your username and password.";
  const { data, error } = await supabase.auth.signInWithPassword({ email: toEmail(username), password });
  if (error) return "Wrong username or password.";
  if (data.user) await loadProfile(data.user.id);
  return null;
}

export function playAsGuest() {
  set({ status: "guest", userId: null, username: "guest", email: null });
}

export async function signOut() {
  await supabase.auth.signOut();
  set({ status: "signedOut", userId: null, username: "guest", email: null });
}

export async function lookupUsername(name: string) {
  const { data } = await supabase.rpc("username_exists", { _name: name });
  return !!data;
}
