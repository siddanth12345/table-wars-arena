import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  NET, PVP_WIN, useNet, queue1v1, leaveQueue, choosePick, confirmTodPick, chooseBan, confirmBan,
  chooseAbilityPick, confirmAbilityPick, sendRematch, answerRematch, requeue, goHomeOnline,
  createLobby, joinLobby, sendInvite, acceptInvite, dismissInvite, partyGo, kickMember, disbandParty, leaveParty,
  isPartyLeader, inParty, myId, opponentId, startInbox, stopInbox,
  sendFriendRequest, acceptFriendRequest, declineFriendRequest, cancelFriendRequest, sendPlayInvite, requestProfile,
} from "./net";
import { useAccount, signIn, signUp, playAsGuest, signOut, logoutGuest, transferGuestProgress, isProgressTransferPending, clearProgressTransfer, displayName } from "./account";
import { G, resetGame, lockPointer } from "./state";
import { getPvpWins, useProgress, hasMastery, hasAchievement, ACHIEVEMENTS, getProgress } from "./mastery";
import {
  useFriends, useFriendRequests, removeFriend, dismissSplintered, markSplinteredRequests,
  isFriend, MAX_TBLES, friendCount, getCachedProfile, type FriendRequest,
} from "./friends";
import { DEFAULT_SKIN, SKIN, type Skin } from "./skins";
import { createTableBot } from "./tableBotFactory";
import { ABILITY_LIST, getAbility, type AbilityId } from "./abilities";
import type { TimeOfDay } from "./settings";

/* PREVIEW_REBUILD */
const btnMain = "pointer-events-auto rounded bg-crosshair px-6 py-3 text-base font-black uppercase text-hud-ink disabled:opacity-40";
const btnAlt = "pointer-events-auto rounded border-2 border-hud/40 px-6 py-3 text-base font-black uppercase disabled:opacity-40";
const input = "w-full rounded border-2 border-hud/40 bg-hud-track px-3 py-2 font-bold text-hud placeholder:text-hud/40";

function useTick(ms: number) {
  const [, t] = useState(0);
  useEffect(() => { const id = setInterval(() => t((n) => n + 1), ms); return () => clearInterval(id); }, [ms]);
}

/** Full-screen connecting overlay — CSS table spin (no extra WebGL; safer on mobile). */
export function ConnectingOverlay({ label, onCancel }: { label: string; onCancel?: () => void }) {
  return (
    <div className="pointer-events-auto fixed inset-0 z-[80] flex flex-col items-center justify-center bg-[#0a0c10]/92 font-mono text-hud backdrop-blur-sm">
      <div
        className="relative h-28 w-36"
        style={{ animation: "tble-spin 1.4s linear infinite", transformStyle: "preserve-3d" }}
      >
        <div className="absolute inset-x-2 top-8 h-5 rounded-sm bg-[#2fa84f] shadow-lg" />
        <div className="absolute bottom-2 left-3 h-10 w-2.5 rounded-sm bg-[#197a37]" />
        <div className="absolute bottom-2 right-3 h-10 w-2.5 rounded-sm bg-[#197a37]" />
        <div className="absolute bottom-2 left-1/3 h-10 w-2.5 -translate-x-1/2 rounded-sm bg-[#197a37]" />
        <div className="absolute bottom-2 right-1/3 h-10 w-2.5 translate-x-1/2 rounded-sm bg-[#197a37]" />
        <div className="absolute left-6 top-6 h-3 w-3 rounded-full bg-[#f5f2dc]" />
        <div className="absolute right-6 top-6 h-3 w-3 rounded-full bg-[#f5f2dc]" />
      </div>
      <style>{`@keyframes tble-spin { from { transform: rotateY(0deg); } to { transform: rotateY(360deg); } }`}</style>
      <div className="mt-4 text-center">
        <div className="text-xs font-bold uppercase tracking-[0.35em] text-crosshair">TBLE</div>
        <div className="mt-2 text-xl font-black uppercase tracking-widest">{label}</div>
        <div className="mt-2 animate-pulse text-[11px] font-bold uppercase tracking-widest opacity-50">Please wait · do not spam click</div>
      </div>
      {onCancel && (
        <button type="button" className={`${btnAlt} mt-8 min-h-12 touch-manipulation`} onClick={onCancel}>Cancel</button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- account

export function AuthPanel({ onClose }: { onClose?: () => void }) {
  const transferring = isProgressTransferPending();
  const [mode, setMode] = useState<"login" | "create">("login");
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = mode === "login" ? await signIn(u.trim(), p) : await signUp(u.trim(), p, email.trim());
    setBusy(false);
    if (r) setErr(r);
    else onClose?.();
  };
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-hud-scrim p-6 font-mono text-hud">
      <form onSubmit={submit} className="w-full max-w-sm rounded-lg border-2 border-hud/30 bg-hud-panel p-8">
        <h2 className="text-3xl font-black uppercase">{mode === "login" ? "Log in" : "Create account"}</h2>
        {transferring && (
          <p className="mt-2 rounded border border-crosshair/40 bg-crosshair/10 px-3 py-2 text-xs leading-relaxed text-crosshair">
            Transferring guest progress — achievements and unlocks from this guest session will be merged into the account (anything the account already has is kept).
          </p>
        )}
        <div className="mt-5 space-y-3">
          <input className={input} placeholder="Username (3–20)" value={u} maxLength={20} onChange={(e) => setU(e.target.value)} autoFocus />
          <input className={input} type="password" placeholder="Password" value={p} maxLength={20} onChange={(e) => setP(e.target.value)} />
          {mode === "create" && (
            <>
              <input className={input} type="email" placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
              <p className="text-xs opacity-70">Password: 3–20 characters with at least 1 uppercase, 1 lowercase and 1 number.</p>
            </>
          )}
          {err && <p className="text-sm font-bold text-destructive">{err}</p>}
          <button className={`${btnMain} w-full`} disabled={busy}>{busy ? "…" : mode === "login" ? "Log in" : "Create account"}</button>
          <button type="button" className={`${btnAlt} w-full`} onClick={() => { setMode(mode === "login" ? "create" : "login"); setErr(""); }}>
            {mode === "login" ? "Create an account" : "I already have an account"}
          </button>
          <button type="button" className={`${btnAlt} w-full`} onClick={() => { clearProgressTransfer?.(); playAsGuest(); onClose?.(); }}>Play as guest</button>
        </div>
      </form>
    </div>
  );
}

export function AccountBadge({ onLogin }: { onLogin: () => void }) {
  const acc = useAccount();
  const [confirmGuestOut, setConfirmGuestOut] = useState(false);
  useEffect(() => {
    if (acc.status === "user" || acc.status === "guest") startInbox();
    else stopInbox();
  }, [acc.status, acc.username]);

  if (acc.status === "user") {
    return (
      <div className="mt-6 flex items-center justify-between gap-2 text-xs">
        <span className="opacity-80">Signed in as <b className="text-crosshair">{acc.username}</b></span>
        <button
          type="button"
          className="pointer-events-auto underline opacity-80"
          onClick={() => void signOut()}
        >
          Log out
        </button>
      </div>
    );
  }

  if (acc.status === "guest") {
    return (
      <>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="opacity-80">Signed in as guest <b className="text-crosshair">{acc.username}</b></span>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="pointer-events-auto font-bold text-crosshair underline" onClick={() => { transferGuestProgress(); onLogin(); }}>
              Transfer progress
            </button>
            <button type="button" className="pointer-events-auto underline opacity-80" onClick={() => setConfirmGuestOut(true)}>
              Log out
            </button>
          </div>
        </div>
        {confirmGuestOut && (
          <div className="gui fixed inset-0 z-[90] flex items-center justify-center bg-hud-scrim p-6 font-mono text-hud">
            <div className="w-full max-w-md rounded-lg border-2 border-hud/30 bg-hud-panel p-8 text-center">
              <h2 className="text-2xl font-black uppercase tracking-widest text-crosshair">Log out?</h2>
              <p className="mt-4 text-sm leading-relaxed opacity-90">
                Are you sure you want to log out? This could delete your current progress if you log in to another account.
                Instead you can click <b className="text-crosshair">Transfer progress</b> to keep your progress and log in or create an account.
              </p>
              <div className="mt-6 flex flex-col gap-3">
                <button type="button" className={btnMain} onClick={() => { setConfirmGuestOut(false); logoutGuest(); onLogin(); }}>Log out anyway</button>
                <button type="button" className={btnAlt} onClick={() => { setConfirmGuestOut(false); transferGuestProgress(); onLogin(); }}>Transfer progress</button>
                <button type="button" className={btnAlt} onClick={() => setConfirmGuestOut(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="mt-6 flex items-center justify-between gap-2 text-xs">
      <span className="opacity-80">Not signed in</span>
      <button type="button" className="pointer-events-auto underline opacity-80" onClick={onLogin}>Log in</button>
    </div>
  );
}



// ---------------------------------------------------------------- play menu


const selectTheme = "w-full rounded-lg border-2 border-hud/40 bg-hud-panel font-mono text-sm text-hud shadow-inner";

/** Scrollable tble picker matching HUD theme (no native OS select). */
function TblePickList({
  label,
  onPick,
  maxH = "max-h-36",
}: {
  label: string;
  onPick: (name: string) => void | Promise<void>;
  maxH?: string;
}) {
  const friends = useFriends();
  if (!friends.length) return null;
  return (
    <div
      className={`${selectTheme} ${maxH} overflow-y-auto`}
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      <style>{`.tble-pick-scroll::-webkit-scrollbar{display:none}`}</style>
      <div className="tble-pick-scroll max-h-full overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        <div className="border-b border-hud/30 bg-hud-track px-3 py-2 text-[10px] font-black uppercase tracking-widest text-crosshair/90">
          {label}
        </div>
        <ul className="divide-y divide-hud/20">
          {friends.map((f) => (
            <li key={f.name}>
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-bold transition hover:bg-crosshair/15"
                onClick={() => void onPick(f.name)}
              >
                <span className="rounded border border-hud/25 bg-black/30 px-2 py-0.5">{f.name}</span>
                <span className="text-[10px] uppercase opacity-50">Invite</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function InviteBox({ kind, label }: { kind: "party" | "lobby"; label: string }) {
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; msg: string } | null>(null);
  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-2">
        <input className={input} placeholder="Exact username" value={name} onChange={(e) => setName(e.target.value)} />
        <button className={btnAlt} onClick={async () => setMsg(await sendInvite(name, kind))}>{label}</button>
      </div>
      <TblePickList label="Invite tble…" onPick={async (n) => setMsg(await sendInvite(n, kind))} />
      {msg && <p className={`mt-1 text-xs font-bold ${msg.ok ? "text-crosshair" : "text-destructive"}`}>{msg.msg}</p>}
    </div>
  );
}

function FriendInviteRow({
  kind, label,
}: { kind: "party" | "lobby" | "play_party" | "play_1v1"; label: string }) {
  const friends = useFriends();
  const [msg, setMsg] = useState<{ ok: boolean; msg: string } | null>(null);
  if (!friends.length) return null;
  return (
    <div className="mt-1 flex flex-col gap-1">
      <TblePickList
        label={label}
        onPick={async (n) => {
          const r = kind === "play_party" || kind === "play_1v1"
            ? await sendPlayInvite(n, kind)
            : await sendInvite(n, kind);
          setMsg(r);
        }}
      />
      {msg && <span className={`text-xs font-bold ${msg.ok ? "text-crosshair" : "text-destructive"}`}>{msg.msg}</span>}
    </div>
  );
}

function SkinSpinPreview({ skin }: { skin: Skin }) {
  const group = useRef<THREE.Group>(null);
  const key = JSON.stringify(skin);
  const bot = useRef(createTableBot({ skin, scale: 0.55, emitLight: true }));
  useEffect(() => {
    bot.current = createTableBot({ skin, scale: 0.55, emitLight: true });
  }, [key]);
  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.7;
  });
  return (
    <group ref={group}>
      <primitive object={bot.current} key={key} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <circleGeometry args={[1.6, 32]} />
        <meshStandardMaterial color="#1a1e28" metalness={0.2} roughness={0.8} />
      </mesh>
    </group>
  );
}

export type ProfileData = {
  name: string;
  skin?: Skin;
  ability?: string;
  mastery?: boolean;
  achList?: string[];
  isSelf?: boolean;
};

/** Full profile tab (home or in-game). */
export function ProfileTab({
  data,
  onClose,
  onUnadd,
  live,
}: {
  data: ProfileData;
  onClose: () => void;
  onUnadd?: () => void;
  /** If set, re-read profile every 1s (skin / ability / achievements). */
  live?: () => ProfileData;
}) {
  const [view, setView] = useState(data);
  useEffect(() => { setView(data); }, [data]);
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => {
      try { setView(live()); } catch { /* ignore */ }
    }, 1000);
    return () => clearInterval(id);
  }, [live]);
  const skin = view.skin ?? DEFAULT_SKIN;
  const achIds = view.achList ?? [];
  const achs = ACHIEVEMENTS.filter((a) => achIds.includes(a.id));
  return (
    <div className="gui fixed inset-0 z-[95] flex items-center justify-center bg-hud-scrim p-4 font-mono text-hud">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border-2 border-hud/30 bg-hud-panel shadow-2xl">
        <div className="flex items-center justify-between border-b border-hud/30 px-5 py-3">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black uppercase tracking-widest text-crosshair">{view.name}</h2>
            {onUnadd && !view.isSelf && (
              <button type="button" className="rounded bg-orange-500 px-3 py-1 text-xs font-black uppercase text-black" onClick={onUnadd}>Unadd</button>
            )}
          </div>
          <button type="button" className="text-xs uppercase underline opacity-80" onClick={onClose}>Close</button>
        </div>
        <div className="grid flex-1 gap-4 overflow-y-auto p-5 md:grid-cols-2">
          <div className="rounded-lg border-2 border-hud/25 bg-black/40">
            <div className="border-b border-hud/20 px-3 py-2 text-[10px] font-black uppercase tracking-widest opacity-70">Skin</div>
            <div className="h-48">
              <Canvas camera={{ position: [0, 2.2, 5.5], fov: 40 }} gl={{ antialias: true }}>
                <ambientLight intensity={0.45} />
                <directionalLight position={[4, 8, 3]} intensity={1.2} />
                <SkinSpinPreview skin={skin} />
              </Canvas>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="rounded-lg border-2 border-hud/25 bg-black/40 p-3">
              <div className="text-[10px] font-black uppercase tracking-widest opacity-70">Ability</div>
              <div className="mt-2 flex items-center gap-3">
                <span className="text-2xl">{ABILITY_LIST.find((a) => a.id === view.ability)?.icon ?? "—"}</span>
                <div>
                  <div className="text-lg font-black uppercase text-crosshair">
                    {ABILITY_LIST.find((a) => a.id === view.ability)?.name ?? (view.ability || "None shown")}
                  </div>
                  <div className="text-xs opacity-70">
                    {view.ability === "boss" ? "Boss" : view.mastery ? "Mastered" : view.ability ? "Normal" : "—"}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex min-h-0 flex-col rounded-lg border-2 border-hud/25 bg-black/40">
              <div className="border-b border-hud/20 px-3 py-2 text-[10px] font-black uppercase tracking-widest opacity-70">
                Achievements ({achs.length || achIds.length})
              </div>
              {/* ~3 rows tall; scroll if more so the panel does not grow */}
              <ul className="h-[7.25rem] max-h-[7.25rem] space-y-1 overflow-y-auto p-2">
                {(achs.length ? achs : achIds.map((id) => ({ id, name: id, summary: "" }))).map((a) => (
                  <li key={a.id} className="rounded border border-hud/20 bg-hud-panel/80 px-3 py-2">
                    <div className="text-xs font-black uppercase text-crosshair">{a.name}</div>
                    {"summary" in a && a.summary ? <div className="text-[10px] opacity-60">{a.summary}</div> : null}
                  </li>
                ))}
                {!achs.length && !achIds.length && (
                  <li className="px-2 py-3 text-xs opacity-50">No achievements shared.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FriendsPanel({ onClose }: { onClose: () => void }) {
  const acc = useAccount();
  const friends = useFriends();
  const { incoming, outgoing } = useFriendRequests();
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [unadd, setUnadd] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  useTick(2000);
  useEffect(() => { markSplinteredRequests(); }, []);
  useEffect(() => {
    if (profileName) void requestProfile(profileName);
  }, [profileName]);

  if (acc.status !== "user" && acc.status !== "guest") {
    return (
      <div className="relative m-6 flex-1 overflow-y-auto rounded-lg border-2 border-hud/30 bg-hud-panel p-8">
        <div className="mb-4 flex items-center justify-between border-b border-hud/30 pb-2">
          <h3 className="text-2xl font-black uppercase tracking-widest text-crosshair">Tbles</h3>
          <button type="button" className="text-xs uppercase underline" onClick={onClose}>Close</button>
        </div>
        <p className="text-sm opacity-80">Log in or play as guest to manage tbles.</p>
      </div>
    );
  }

  return (
    <div className="relative m-6 flex-1 overflow-y-auto rounded-lg border-2 border-hud/30 bg-hud-panel p-8">
      <div className="mb-4 flex items-center justify-between border-b border-hud/30 pb-2">
        <h3 className="text-2xl font-black uppercase tracking-widest text-crosshair">Tbles</h3>
        <button type="button" className="text-xs uppercase underline" onClick={onClose}>Close</button>
      </div>

      <div className="mb-6">
        <h4 className="mb-2 text-xs font-black uppercase tracking-widest opacity-70">Add tble · ({friendCount()}/{MAX_TBLES})</h4>
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setMsg(await sendFriendRequest(name));
            setBusy(false);
          }}
        >
          <input className={input} placeholder="Exact username" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
          <button className={btnMain} disabled={busy || name.trim().length < 3 || friendCount() >= MAX_TBLES}>Send request</button>
        </form>
        <p className="mt-1 text-[10px] opacity-50">Online players get a 10s toast. Offline requests wait in this tab.</p>
        {msg && <p className={`mt-2 text-xs font-bold ${msg.ok ? "text-crosshair" : "text-destructive"}`}>{msg.msg}</p>}
      </div>

      <div className="mb-6">
        <h4 className="mb-2 text-xs font-black uppercase tracking-widest opacity-70">
          Tble requests {incoming.length > 0 ? `(${incoming.length})` : ""}
        </h4>
        {incoming.length === 0 ? (
          <p className="text-sm opacity-60">No incoming tble requests.</p>
        ) : (
          <ul className="space-y-2">
            {incoming.map((r: FriendRequest) => (
              <li key={r.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border-2 px-3 py-2 text-sm ${
                r.splintered ? "border-red-500/70 bg-red-950/50" : "border-hud/30 bg-black/30"
              }`}>
                <span className="rounded border border-hud/25 bg-black/40 px-2 py-0.5">
                  <b className={r.splintered ? "text-red-400" : "text-crosshair"}>{r.from}</b>
                  {r.splintered ? <span className="ml-1 text-red-300/90">(splintered)</span> : <span className="ml-1 opacity-70"> wants to be tbles</span>}
                </span>
                <span className="flex gap-2">
                  {!r.splintered && (
                    <button type="button" className="rounded bg-crosshair px-3 py-1 text-xs font-black uppercase text-hud-ink" onClick={async () => setMsg(await acceptFriendRequest(r))}>Accept</button>
                  )}
                  <button type="button" className="rounded border border-white/25 px-3 py-1 text-xs font-bold uppercase" onClick={() => { dismissSplintered(r.id); declineFriendRequest(r); }}>Dismiss</button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {outgoing.length > 0 && (
          <div className="mt-3">
            <p className="mb-1 text-[10px] uppercase opacity-50">Outgoing</p>
            <ul className="space-y-1 text-sm opacity-80">
              {outgoing.map((r) => (
                <li key={r.id} className="flex items-center justify-between">
                  <span>To <b>{r.to}</b>…</span>
                  <button type="button" className="text-xs underline opacity-70" onClick={() => cancelFriendRequest(r)}>Cancel</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div>
        <h4 className="mb-2 text-xs font-black uppercase tracking-widest opacity-70">Your tbles ({friends.length}/{MAX_TBLES})</h4>
        {friends.length === 0 ? (
          <p className="text-sm opacity-60">No tbles yet. Send a request above.</p>
        ) : (
          <ul className="space-y-2">
            {friends.map((f) => (
              <li key={f.name} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border-2 px-3 py-2 text-sm ${
                f.splintered ? "border-red-500/70 bg-red-950/50" : "border-hud/30 bg-black/30"
              }`}>
                <button type="button" className={`rounded border border-hud/25 bg-black/40 px-2 py-0.5 font-bold underline decoration-crosshair/40 ${f.splintered ? "text-red-400" : "text-crosshair"}`} onClick={() => setProfileName(f.name)}>
                  {f.name}{f.splintered ? " (splintered)" : ""}
                </button>
                {f.splintered ? (
                  <button type="button" className="rounded border-2 border-red-400/80 bg-red-900/40 px-3 py-1 text-xs font-black uppercase text-red-100" onClick={() => removeFriend(f.name)}>
                    Dismiss and unfriend
                  </button>
                ) : (
                  <button type="button" className="rounded bg-orange-500 px-3 py-1 text-xs font-black uppercase text-black" onClick={() => setUnadd(f.name)}>Unadd</button>
                )}
              </li>
            ))}
          </ul>
        )}
        {acc.status === "guest" && (
          <p className="mt-3 text-[10px] opacity-50">Guest tbles are temporary. Transfer progress when creating an account to keep them.</p>
        )}
      </div>

      {unadd && (
        <div className="gui fixed inset-0 z-[90] flex items-center justify-center bg-hud-scrim p-6">
          <div className="w-full max-w-sm rounded-lg border-2 border-hud/30 bg-hud-panel p-6 text-center">
            <h2 className="text-xl font-black uppercase text-crosshair">Unadd tble?</h2>
            <p className="mt-3 text-sm opacity-90">This will remove <b>{unadd}</b> from your tbles.</p>
            <div className="mt-5 flex flex-col gap-2">
              <button type="button" className={btnMain} onClick={() => { removeFriend(unadd); setUnadd(null); }}>Unadd</button>
              <button type="button" className={btnAlt} onClick={() => setUnadd(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {profileName && (
        <ProfileTab
          data={(() => {
            const c = getCachedProfile(profileName);
            return {
              name: profileName,
              skin: c?.skin ?? DEFAULT_SKIN,
              ability: c?.ability,
              mastery: c?.mastery,
              achList: c?.achList,
            };
          })()}
          onClose={() => setProfileName(null)}
          onUnadd={() => { setUnadd(profileName); setProfileName(null); }}
          live={() => {
            void requestProfile(profileName);
            const c = getCachedProfile(profileName);
            return {
              name: profileName,
              skin: c?.skin ?? DEFAULT_SKIN,
              ability: c?.ability,
              mastery: c?.mastery,
              achList: c?.achList,
            };
          }}
        />
      )}
    </div>
  );
}

export function PlayMenu({ onCampaign, onClose }: { onCampaign: () => void; onClose: () => void }) {
  useProgress();
  const net = useNet();
  const acc = useAccount();
  const [code, setCode] = useState("");
  const [codeErr, setCodeErr] = useState("");
  const [partyOpen, setPartyOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const party = inParty();
  const leader = isPartyLeader();
  const waiting = party && !leader;
  const run = async (label: string, fn: () => void | Promise<void>) => {
    if (busy) return;
    setBusy(label);
    setNote("");
    setCodeErr("");
    try {
      await fn();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null); // QueueOverlay covers 1v1 search after this
    }
  };
  const go = async (mode: "game" | "training" | "pvp" | "lobby") => {
    const labels = { game: "Starting party campaign…", training: "Opening party training…", pvp: "Starting party 1v1…", lobby: "Opening party lobby…" };
    await run(labels[mode], async () => {
      const e = await partyGo(mode);
      if (e) setNote(e);
    });
  };
  return (
    <div className="relative m-6 flex-1 overflow-y-auto rounded-lg border-2 border-hud/30 bg-hud-panel p-8">
      {busy && <ConnectingOverlay label={busy} />}
      <div className="mb-4 flex items-center justify-between border-b border-hud/30 pb-2">
        <h3 className="text-2xl font-black uppercase tracking-widest text-crosshair">Play</h3>
        <button className="text-xs uppercase underline" onClick={onClose}>Close</button>
      </div>
      {waiting && <p className="mb-4 text-sm font-bold text-crosshair">You're in a party — waiting for the leader to start.</p>}
      <div className="flex max-w-md flex-col gap-3">
        <button className={btnMain} disabled={waiting || !!busy} onClick={() => (party ? void go("game") : onCampaign())}>
          {party ? "Campaign with party" : "Offline campaign"}
        </button>
        {party && <button className={btnAlt} disabled={waiting || !!busy} onClick={() => void go("training")}>Training with party</button>}
        <button className={btnAlt} disabled={waiting || !!busy} onClick={() => (party ? void go("pvp") : void run("Finding 1v1 match…", () => queue1v1()))}>
          {party ? "1v1 with party" : "1v1"}
        </button>
        <div className="text-center text-xs font-bold uppercase tracking-widest opacity-70">
          1v1 career wins · <span className="text-crosshair">{getPvpWins()}</span>
        </div>
        <button className={btnAlt} disabled={waiting || !!busy} onClick={() => (party ? void go("lobby") : void run("Creating lobby…", () => createLobby()))}>
          {party ? "Lobby with party" : "Lobby"}
        </button>
        {net.code && (
          <div className="rounded border border-hud/20 bg-black/20 p-2">
            <p className="mb-1 text-[10px] font-bold uppercase opacity-60">Lobby · invite tbles</p>
            <FriendInviteRow kind="lobby" label="Invite tble to lobby…" />
          </div>
        )}
        <div>
          <form className="flex gap-2" onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            await run("Joining lobby…", async () => {
              const r = await joinLobby(code);
              if (r) setCodeErr(r);
            });
          }}>
            <input className={`${input} uppercase tracking-[0.3em]`} placeholder="Lobby code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} disabled={!!busy} />
            <button className={btnAlt} disabled={!!busy}>Join</button>
          </form>
          {codeErr && <p className="mt-1 text-sm font-bold text-destructive">{codeErr}</p>}
        </div>
        <button className={btnAlt} onClick={() => setPartyOpen(!partyOpen)}>Party{net.party ? ` (${net.party.members.length})` : ""}</button>
        {partyOpen && (
          <div className="rounded border-2 border-hud/20 p-4">
            {acc.status !== "user" && acc.status !== "guest" ? (
              <p className="text-sm opacity-80">Log in or play as guest to make a party.</p>
            ) : (
              <>
                {net.party && net.party.members.length > 0 && (
                  <ul className="mb-3 space-y-1 text-sm">
                    {net.party.members.map((m) => (
                      <li key={m.id} className="flex items-center justify-between">
                        <span><b>{m.name}</b>{m.leader ? " · leader" : ""}{m.id === myId() ? " (you)" : ""}</span>
                        {leader && m.id !== myId() && <button className="text-xs uppercase text-destructive underline" onClick={() => kickMember(m.id)}>Kick</button>}
                      </li>
                    ))}
                  </ul>
                )}
                {(!net.party || leader) && <InviteBox kind="party" label="Invite" />}
                <p className="mt-1 text-xs opacity-60">Up to 4 invited players. Guests show up as guest + 6 digits.</p>
                {net.party && (
                  <button className={`${btnAlt} mt-3 border-destructive text-destructive`} onClick={() => (leader ? disbandParty() : leaveParty())}>
                    {leader ? "Disband party" : "Leave party"}
                  </button>
                )}
              </>
            )}
          </div>
        )}
        {(note || net.partyNote) && <p className="text-sm font-bold text-destructive">{note || net.partyNote}</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- overlays

export function QueueOverlay() {
  const net = useNet();
  useTick(500);
  if (net.stage !== "queue") return null;
  return (
    <ConnectingOverlay label="Searching for an opponent…" onCancel={leaveQueue} />
  );
}

const TODS: { id: TimeOfDay; label: string }[] = [{ id: "day", label: "Day" }, { id: "evening", label: "Evening" }, { id: "night", label: "Night" }];

const BAN_OPTIONS: { id: "none" | AbilityId; label: string; icon: string }[] = [
  { id: "none", label: "None", icon: "—" },
  ...ABILITY_LIST.map((a) => ({ id: a.id, label: a.name, icon: a.icon })),
];

export function MapPick() {
  const net = useNet();
  useTick(200);
  useProgress();
  if (net.kind !== "pvp") return null;
  if (net.stage !== "pick" && net.stage !== "ban" && net.stage !== "abilityPick") return null;
  const left = net.pickEnds ? Math.max(0, Math.ceil((net.pickEnds - Date.now()) / 1000)) : 10;
  const opp = net.names[opponentId()];
  const locked = net.myPhaseLocked;

  // Combined bans for ability phase
  const banned = new Set<string>();
  for (const v of Object.values(net.bans)) if (v && v !== "none") banned.add(v);

  // Choose phase: show everything non-banned; lock mastery/boss you don't own ("Not available"). Ban phase stays unrestricted.
  const abilityChoices: { key: string; label: string; icon: string; available: boolean }[] = [];
  for (const a of ABILITY_LIST) {
    if (banned.has(a.id)) continue;
    if (a.id === "boss") {
      const own = hasAchievement("hardcore");
      abilityChoices.push({
        key: "boss",
        label: own ? a.name : `${a.name} — Not available`,
        icon: a.icon,
        available: own,
      });
      continue;
    }
    // base ability always free
    abilityChoices.push({ key: a.id, label: a.name, icon: a.icon, available: true });
    // mastered variant always listed; locked if not owned
    const ownM = hasMastery(a.id);
    abilityChoices.push({
      key: `${a.id}:m`,
      label: ownM ? `${a.name} (Mastered)` : `${a.name} (Mastered) — Not available`,
      icon: a.icon,
      available: ownM,
    });
  }
  abilityChoices.push({ key: "random", label: "Random", icon: "🎲", available: true });

  return (
    <div className="gui fixed inset-0 z-40 flex items-center justify-center bg-hud-scrim p-6 font-mono text-hud">
      <div className="w-full max-w-2xl rounded-lg border-2 border-hud/30 bg-hud-panel p-8 text-center">
        <div className="text-xs uppercase tracking-widest opacity-70">{opp ? `vs ${opp}` : "Waiting for opponent…"}</div>

        {net.stage === "pick" && (
          <>
            <h1 className="mt-2 text-4xl font-black uppercase">Choose the arena</h1>
            <div className="mt-2 text-6xl font-black text-crosshair">{left}</div>
            <div className="mt-6 grid grid-cols-3 gap-3">
              {TODS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={locked}
                  onClick={() => choosePick(t.id)}
                  className={`tod-card tod-${t.id} rounded-xl border-2 p-6 text-lg font-black uppercase ${net.myPick === t.id ? "tod-active" : "border-transparent"} disabled:opacity-50`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="mt-4 text-xs opacity-70">Same pick wins. Different picks: one is chosen at random. Both choose → skip timer.</p>
            <button type="button" className={`${btnMain} mt-4`} disabled={!net.myPick || locked} onClick={() => confirmTodPick()}>
              {locked ? "Waiting for opponent…" : "Choose"}
            </button>
          </>
        )}

        {net.stage === "ban" && (
          <>
            <h1 className="mt-2 text-4xl font-black uppercase">Ban an ability</h1>
            <div className="mt-2 text-6xl font-black text-crosshair">{left}</div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {BAN_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  disabled={locked}
                  onClick={() => chooseBan(o.id)}
                  className={`rounded-xl border-2 p-4 text-left transition ${net.myBan === o.id ? "border-crosshair bg-crosshair/15" : "border-white/15 bg-black/30"} disabled:opacity-50`}
                >
                  <div className="text-2xl">{o.icon}</div>
                  <div className="mt-1 text-sm font-black uppercase">{o.label}</div>
                </button>
              ))}
            </div>
            <p className="mt-4 text-xs opacity-70">Both bans apply. Pick None to ban nothing. Both ban → skip timer.</p>
            <button type="button" className={`${btnMain} mt-4`} disabled={!net.myBan || locked} onClick={() => confirmBan()}>
              {locked ? "Waiting for opponent…" : "Ban ability"}
            </button>
          </>
        )}

        {net.stage === "abilityPick" && (
          <>
            <h1 className="mt-2 text-4xl font-black uppercase">Choose ability</h1>
            <div className="mt-2 text-6xl font-black text-crosshair">{left}</div>
            {banned.size > 0 && (
              <p className="mt-2 text-xs opacity-60">Banned: {[...banned].join(", ")}</p>
            )}
            <div className="mt-6 grid max-h-[40vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
              {abilityChoices.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  disabled={locked || !o.available}
                  onClick={() => o.available && chooseAbilityPick(o.key)}
                  className={`rounded-xl border-2 p-4 text-left transition ${
                    !o.available
                      ? "cursor-not-allowed border-white/10 bg-black/20 opacity-40"
                      : net.myAbilityChoice === o.key
                        ? "border-crosshair bg-crosshair/15"
                        : "border-white/15 bg-black/30"
                  } disabled:opacity-50`}
                >
                  <div className="text-2xl">{o.icon}</div>
                  <div className="mt-1 text-sm font-black uppercase">{o.label}</div>
                </button>
              ))}
            </div>
            <p className="mt-4 text-xs opacity-70">Random picks from non-banned abilities. Both ready → skip timer.</p>
            <button type="button" className={`${btnMain} mt-4`} disabled={!net.myAbilityChoice || locked} onClick={() => confirmAbilityPick()}>
              {locked ? "Waiting for opponent…" : "Ready"}
            </button>
          </>
        )}

        <button className={`${btnAlt} mt-6`} onClick={goHomeOnline}>Leave</button>
      </div>
    </div>
  );
}

export function Scoreboard() {
  const net = useNet();
  useTick(250);
  if (net.kind !== "pvp" || (net.stage !== "playing" && net.stage !== "roundEnd")) return null;
  const me = myId(), opp = opponentId();
  const side = (id: string) => (
    <div className="flex items-center gap-2">
      <span className="h-3 w-3 rounded-full" style={{ background: net.colors[id] === "red" ? "#d43a3a" : "#3a7bd4" }} />
      <b>{net.names[id] ?? "player"}</b>
      <span className="flex gap-1">
        {Array.from({ length: PVP_WIN }, (_, i) => (
          <span key={i} className={`h-3 w-3 rounded-sm border border-hud/50 ${i < (net.scores[id] ?? 0) ? "bg-crosshair" : ""}`} />
        ))}
      </span>
    </div>
  );
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-20 flex flex-col items-center gap-2 font-mono text-hud">
      <div className="flex items-center gap-6 rounded bg-hud-panel px-5 py-2 text-sm uppercase">{side(me)}<span className="opacity-50">vs</span>{side(opp)}</div>
      {net.stage === "roundEnd" && <div className="text-5xl font-black uppercase drop-shadow-[0_3px_0_rgba(0,0,0,0.7)]">{net.roundMsg}</div>}
      {G.pvpDead && net.stage === "playing" && <div className="text-3xl font-black uppercase text-destructive">Splintered</div>}
    </div>
  );
}

export function PvpEnd() {
  const net = useNet();
  useTick(250);
  if (net.kind !== "pvp" || net.stage !== "over") return null;
  const won = net.winner === myId();
  const now = Date.now();
  const cd = Math.max(net.rematchSentAt + 3000, net.rematchBlockedUntil) - now;
  return (
    <div className="gui fixed inset-0 z-40 flex items-center justify-center bg-hud-scrim p-6 font-mono text-hud">
      <div className="w-full max-w-md rounded-lg border-2 border-hud/30 bg-hud-panel p-8 text-center">
        <h1 className={`text-6xl font-black uppercase ${won ? "text-crosshair" : "text-destructive"}`}>{won ? "You win" : "You lose"}</h1>
        {net.opponentLeft && <p className="mt-2 text-sm opacity-80">Your opponent left the match.</p>}
        <p className="mt-3 text-lg">
          {net.names[myId()]} {net.scores[myId()] ?? 0} – {net.scores[opponentId()] ?? 0} {net.names[opponentId()] ?? "opponent"}
        </p>
        {net.partyMatch ? (
          <p className="mt-6 text-sm opacity-70">Returning home…</p>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            <button className={btnMain} onClick={() => void requeue()}>Requeue</button>
            {!net.opponentLeft && (
              <button className={btnAlt} disabled={cd > 0} onClick={sendRematch}>
                Rematch{cd > 0 ? ` (${Math.ceil(cd / 1000)}s)` : ""}
              </button>
            )}
            {net.rematchStatus && <p className="text-xs font-bold text-crosshair">{net.rematchStatus}</p>}
            {net.rematchIn && (
              <div className="rounded border-2 border-crosshair p-3">
                <p className="font-bold">{net.rematchIn.name} wants a rematch!</p>
                <div className="mt-2 flex justify-center gap-2">
                  <button className={btnMain} onClick={() => answerRematch(true)}>Yes</button>
                  <button className={btnAlt} onClick={() => answerRematch(false)}>No</button>
                </div>
              </div>
            )}
            <button className={btnAlt} onClick={goHomeOnline}>Return to home</button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Online pause: nothing stops — just a menu over the live game. */
export function OnlinePause({ onSettings }: { onSettings: () => void }) {
  const net = useNet();
  useTick(150);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Enter" && e.code !== "NumpadEnter") return;
      if (G.chatOpen || G.locked || G.phase !== "playing") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      G.userPaused = false;
      lockPointer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  if (!net.online || G.phase !== "playing" || G.locked || G.trainMenu || G.chatOpen) return null;
  if (net.kind === "pvp" && net.stage !== "playing" && net.stage !== "roundEnd") return null;
  return (
    <div className="gui fixed inset-0 z-20 flex items-center justify-center bg-hud-scrim/60 font-mono text-hud" onClick={(e) => { if (e.target === e.currentTarget) { if (G.countdown <= 0) G.countdown = 0; lockPointer(); } }}>
      <div className="w-full max-w-sm rounded-lg border-2 border-hud/30 bg-hud-panel p-8 text-center">
        <h1 className="text-4xl font-black uppercase">Menu</h1>
        <p className="mt-1 text-xs opacity-70">The match keeps going. Click outside to return.</p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            className={btnMain}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); G.userPaused = false; G.chatOpen = false; lockPointer(); }}
            onPointerDown={(e) => { if (e.button !== 0) return; e.preventDefault(); G.userPaused = false; G.chatOpen = false; lockPointer(); }}
          >Resume</button>
          <button type="button" className={btnAlt} onClick={onSettings}>Settings</button>
          <button type="button" className={btnAlt} onClick={goHomeOnline}>Return to home</button>
        </div>
        <OnlineRoster />
      </div>
    </div>
  );
}

function OnlineRoster() {
  const net = useNet();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [reqMsg, setReqMsg] = useState<string | null>(null);
  const [reqCooldown, setReqCooldown] = useState<Record<string, number>>({});
  useTick(500);
  const meName = displayName();
  const me: ProfileData = {
    name: meName,
    skin: SKIN,
    ability: (() => { try { return getAbility(); } catch { return undefined; } })(),
    mastery: false,
    achList: Object.keys(getProgress().earned || {}),
    isSelf: true,
  };
  const peers = [...net.peers.values()].filter((p) => p.id && p.id !== myId());
  const rows: { id: string; data: ProfileData }[] = [
    { id: "me", data: me },
    ...peers.map((p) => ({
      id: p.id,
      data: {
        name: p.name || "player",
        skin: p.skin,
        ability: net.kind === "pvp" ? undefined : p.ability,
        mastery: p.mastery,
        achList: p.achList,
        isSelf: false,
      },
    })),
  ];

  return (
    <div className="mt-6 border-t border-hud/20 pt-4 text-left">
      <h3 className="mb-2 text-xs font-black uppercase tracking-widest opacity-70">Players</h3>
      <ul className="max-h-52 space-y-2 overflow-y-auto">
        {rows.map(({ id, data }) => {
          const already = isFriend(data.name);
          const cd = reqCooldown[data.name.toLowerCase()] ?? 0;
          const cooling = Date.now() < cd;
          return (
            <li key={id} className="flex items-center justify-between gap-2 rounded-lg border-2 border-hud/30 bg-black/35 px-3 py-2">
              <button
                type="button"
                className="truncate rounded border border-hud/25 bg-black/40 px-2 py-0.5 font-bold text-crosshair underline decoration-crosshair/30"
                onClick={() => setProfile(data)}
              >
                {data.name}{data.isSelf ? " (you)" : ""}
              </button>
              {!data.isSelf && (
                <button
                  type="button"
                  title={already ? "Already tbles" : cooling ? "Wait 1 min" : "Add tble"}
                  disabled={already || cooling}
                  className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded ${
                    already ? "bg-orange-500" : cooling ? "bg-neutral-500" : "bg-emerald-500"
                  }`}
                  onClick={async () => {
                    if (already || cooling) return;
                    const r = await sendFriendRequest(data.name);
                    setReqMsg(r.msg.includes("Too many") ? "They likely have too many tbles." : r.msg);
                    if (r.ok) setReqCooldown((m) => ({ ...m, [data.name.toLowerCase()]: Date.now() + 60_000 }));
                  }}
                >
                  <span className="text-[10px] font-black text-black">▦</span>
                  <span className="absolute -right-0.5 -top-0.5 text-[9px] font-black text-black">+</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {reqMsg && <p className="mt-2 text-[10px] font-bold text-crosshair">{reqMsg}</p>}
      {profile && (
        <ProfileTab
          data={profile}
          onClose={() => setProfile(null)}
          onUnadd={!profile.isSelf && isFriend(profile.name) ? () => { removeFriend(profile.name); setProfile(null); } : undefined}
          live={() => {
            if (profile.isSelf) {
              return {
                name: displayName(),
                skin: SKIN,
                ability: getAbility(),
                mastery: false,
                achList: Object.keys(getProgress().earned || {}),
                isSelf: true,
              };
            }
            const p = [...NET.peers.values()].find((x) => x.name === profile.name || x.id === profile.name);
            if (!p) return profile;
            return {
              name: p.name || profile.name,
              skin: p.skin,
              ability: net.kind === "pvp" ? undefined : p.ability,
              mastery: p.mastery,
              achList: p.achList,
              isSelf: false,
            };
          }}
        />
      )}
    </div>
  );
}

export function LobbyBar() {
  const net = useNet();
  if (!net.online || net.kind !== "lobby" || G.phase !== "playing") return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-20 flex justify-center font-mono text-hud">
      <div className="rounded bg-hud-panel px-5 py-2 text-center">
        <div className="text-[10px] uppercase tracking-widest opacity-70">Lobby code · {net.peers.size + 1} / 8 players</div>
        <div className="text-3xl font-black tracking-[0.4em] text-crosshair">{net.code}</div>
      </div>
    </div>
  );
}

export function LobbyInvite() {
  const net = useNet();
  const acc = useAccount();
  if (net.kind !== "lobby") return null;
  return (
    <section className="mt-6 border-t border-hud/30 pt-4">
      <h3 className="mb-1 text-lg font-black uppercase tracking-widest text-crosshair">Invite to lobby · code {net.code}</h3>
      {acc.status === "user" || acc.status === "guest" ? <InviteBox kind="lobby" label="Invite" /> : <p className="text-sm opacity-70">Share the code to invite players.</p>}
    </section>
  );
}

export function Invites() {
  const net = useNet();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  useTick(400);
  // Expire short-lived invites (friend 10s, play 5s) — friend still stays in home requests
  const now = Date.now();
  const list = net.invites.filter((i) => {
    if (i.expires && now > i.expires) {
      // leave in friends incoming if friend kind
      return false;
    }
    if (!i.expires && now - i.t > 60000) return false;
    return true;
  });
  useEffect(() => {
    const expired = NET.invites.filter((i) => (i.expires && Date.now() > i.expires) || (!i.expires && Date.now() - i.t > 60000));
    if (expired.length) {
      NET.invites = NET.invites.filter((i) => !expired.includes(i));
    }
  }, [now, net.invites.length]);
  if (list.length === 0 && !err && !busy) return null;

  const labelFor = (i: typeof list[0]) => {
    if (i.kind === "friend") return <> wants to be <b className="text-crosshair">tbles</b></>;
    if (i.kind === "play_party") return <> invited you to <b>party campaign</b></>;
    if (i.kind === "play_1v1") return <> invited you to <b>1v1</b></>;
    if (i.kind === "lobby") return <> invited you to lobby <b>{i.target}</b></>;
    return <> invited you to their party</>;
  };

  return (
    <>
      {busy && <ConnectingOverlay label={busy} />}
      <div className="gui pointer-events-auto fixed inset-x-3 top-16 z-[60] mx-auto flex w-full max-w-md flex-col gap-2 font-mono text-hud sm:inset-x-auto sm:right-6 sm:top-auto sm:bottom-6 sm:w-96">
        {err && <div className="rounded bg-hud-panel p-3 text-sm font-bold text-destructive">{err}</div>}
        {list.map((i) => (
          <div key={i.id} className="rounded-lg border-2 border-crosshair bg-hud-panel p-4 shadow-xl">
            <p className="text-sm"><b>{i.from}</b>{labelFor(i)}.</p>
            {i.expires && (
              <p className="mt-1 text-[10px] opacity-50">{Math.max(0, Math.ceil((i.expires - now) / 1000))}s</p>
            )}
            <div className="mt-2 flex gap-2">
              <button
                className={btnMain}
                disabled={!!busy}
                onClick={async () => {
                  if (busy) return;
                  setErr("");
                  if (i.kind === "friend") {
                    setBusy("Accepting…");
                    try {
                      const r = await acceptFriendRequest({ id: i.id, from: i.from, to: "", t: i.t });
                      if (!r.ok) setErr(r.msg);
                      dismissInvite(i.id);
                    } finally { setBusy(null); }
                    return;
                  }
                  setBusy(i.kind === "lobby" ? "Joining lobby…" : "Joining party…");
                  try {
                    const e = await acceptInvite(i);
                    if (e) setErr(e);
                    else document.exitPointerLock?.();
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                {i.kind === "friend" ? "Accept" : "Yes"}
              </button>
              <button
                className={btnAlt}
                disabled={!!busy}
                onClick={() => {
                  if (i.kind === "friend") {
                    declineFriendRequest({ id: i.id, from: i.from, to: "", t: i.t });
                  }
                  dismissInvite(i.id);
                }}
              >
                {i.kind === "friend" ? "Dismiss" : "No"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export { resetGame };
