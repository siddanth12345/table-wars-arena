import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  NET, PVP_WIN, useNet, queue1v1, leaveQueue, choosePick, sendRematch, answerRematch, requeue, goHomeOnline,
  createLobby, joinLobby, sendInvite, acceptInvite, dismissInvite, partyGo, kickMember, disbandParty, leaveParty,
  isPartyLeader, inParty, myId, opponentId, startInbox, stopInbox,
} from "./net";
import { useAccount, signIn, signUp, playAsGuest, signOut } from "./account";
import { G, resetGame, lockPointer } from "./state";
import type { TimeOfDay } from "./settings";

const btnMain = "pointer-events-auto rounded bg-crosshair px-6 py-3 text-base font-black uppercase text-hud-ink disabled:opacity-40";
const btnAlt = "pointer-events-auto rounded border-2 border-hud/40 px-6 py-3 text-base font-black uppercase disabled:opacity-40";
const input = "w-full rounded border-2 border-hud/40 bg-hud-track px-3 py-2 font-bold text-hud placeholder:text-hud/40";

function useTick(ms: number) {
  const [, t] = useState(0);
  useEffect(() => { const id = setInterval(() => t((n) => n + 1), ms); return () => clearInterval(id); }, [ms]);
}

/** Small green table that spins — used while lobby / 1v1 / joins load. */
function LoaderTable() {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += dt * 2.4;
  });
  return (
    <group ref={g} position={[0, -0.4, 0]}>
      <mesh position={[0, 0.85, 0]} castShadow>
        <boxGeometry args={[2.4, 0.28, 1.6]} />
        <meshStandardMaterial color="#2fa84f" roughness={0.45} />
      </mesh>
      {([[-0.95, 0.2, -0.55], [0.95, 0.2, -0.55], [-0.95, 0.2, 0.55], [0.95, 0.2, 0.55]] as const).map((p, i) => (
        <mesh key={i} position={p}>
          <boxGeometry args={[0.22, 1.1, 0.22]} />
          <meshStandardMaterial color="#197a37" roughness={0.5} />
        </mesh>
      ))}
      {[-0.4, 0.4].map((x) => (
        <group key={x} position={[x, 0.95, 0.82]}>
          <mesh><sphereGeometry args={[0.16, 14, 10]} /><meshStandardMaterial color="#f5f2dc" /></mesh>
          <mesh position={[0, 0, 0.14]}><sphereGeometry args={[0.06, 10, 8]} /><meshStandardMaterial color="#172117" /></mesh>
        </group>
      ))}
    </group>
  );
}

/** Full-screen connecting overlay — blocks extra clicks while online actions run. */
export function ConnectingOverlay({ label, onCancel }: { label: string; onCancel?: () => void }) {
  return (
    <div className="pointer-events-auto fixed inset-0 z-[80] flex flex-col items-center justify-center bg-[#0a0c10]/92 font-mono text-hud backdrop-blur-sm">
      <div className="h-44 w-44">
        <Canvas camera={{ position: [0, 1.6, 4.2], fov: 42 }} dpr={[1, 1.5]}>
          <ambientLight intensity={0.55} />
          <directionalLight position={[3, 5, 2]} intensity={1.1} />
          <LoaderTable />
        </Canvas>
      </div>
      <div className="mt-2 text-center">
        <div className="text-xs font-bold uppercase tracking-[0.35em] text-crosshair">TBLE</div>
        <div className="mt-2 text-xl font-black uppercase tracking-widest">{label}</div>
        <div className="mt-2 animate-pulse text-[11px] font-bold uppercase tracking-widest opacity-50">Please wait · do not spam click</div>
      </div>
      {onCancel && (
        <button type="button" className={`${btnAlt} mt-8`} onClick={onCancel}>Cancel</button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- account

export function AuthPanel({ onClose }: { onClose?: () => void }) {
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
          <button type="button" className={`${btnAlt} w-full`} onClick={() => { playAsGuest(); onClose?.(); }}>Play as guest</button>
        </div>
      </form>
    </div>
  );
}

export function AccountBadge({ onLogin }: { onLogin: () => void }) {
  const acc = useAccount();
  useEffect(() => {
    if (acc.status === "user" || acc.status === "guest") startInbox();
    else stopInbox();
  }, [acc.status, acc.username]);
  if (acc.status === "user")
    return (
      <div className="mt-6 flex items-center justify-between gap-2 text-xs">
        <span className="opacity-80">Signed in as <b className="text-crosshair">{acc.username}</b></span>
        <button className="pointer-events-auto underline opacity-80" onClick={() => void signOut()}>Sign out</button>
      </div>
    );
  return (
    <div className="mt-6 flex items-center justify-between gap-2 text-xs">
      <span className="opacity-80">{acc.status === "guest" ? <>Playing as <b className="text-crosshair">{acc.username}</b></> : "Not signed in"}</span>
      <button className="pointer-events-auto underline" onClick={onLogin}>Log in / Create account</button>
    </div>
  );
}

// ---------------------------------------------------------------- play menu

function InviteBox({ kind, label }: { kind: "party" | "lobby"; label: string }) {
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; msg: string } | null>(null);
  return (
    <div className="mt-2">
      <div className="flex gap-2">
        <input className={input} placeholder="Exact username" value={name} onChange={(e) => setName(e.target.value)} />
        <button className={btnAlt} onClick={async () => setMsg(await sendInvite(name, kind))}>{label}</button>
      </div>
      {msg && <p className={`mt-1 text-xs font-bold ${msg.ok ? "text-crosshair" : "text-destructive"}`}>{msg.msg}</p>}
    </div>
  );
}

export function PlayMenu({ onCampaign, onClose }: { onCampaign: () => void; onClose: () => void }) {
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
        <button className={btnAlt} disabled={waiting || !!busy} onClick={() => (party ? void go("lobby") : void run("Creating lobby…", () => createLobby()))}>
          {party ? "Lobby with party" : "Lobby"}
        </button>
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

export function MapPick() {
  const net = useNet();
  useTick(200);
  if (net.kind !== "pvp" || net.stage !== "pick") return null;
  const left = net.pickEnds ? Math.max(0, Math.ceil((net.pickEnds - Date.now()) / 1000)) : 10;
  const opp = net.names[opponentId()];
  return (
    <div className="gui fixed inset-0 z-40 flex items-center justify-center bg-hud-scrim p-6 font-mono text-hud">
      <div className="w-full max-w-2xl rounded-lg border-2 border-hud/30 bg-hud-panel p-8 text-center">
        <div className="text-xs uppercase tracking-widest opacity-70">{opp ? `vs ${opp}` : "Waiting for opponent…"}</div>
        <h1 className="mt-2 text-4xl font-black uppercase">Choose the arena</h1>
        <div className="mt-2 text-6xl font-black text-crosshair">{left}</div>
        <div className="mt-6 grid grid-cols-3 gap-3">
          {TODS.map((t) => (
            <button key={t.id} onClick={() => choosePick(t.id)} className={`tod-card tod-${t.id} rounded-xl border-2 p-6 text-lg font-black uppercase ${net.myPick === t.id ? "tod-active" : "border-transparent"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <p className="mt-4 text-xs opacity-70">Same pick wins. Different picks: one is chosen at random.</p>
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
  if (!net.online || G.phase !== "playing" || G.locked || G.trainMenu) return null;
  if (net.kind === "pvp" && net.stage !== "playing" && net.stage !== "roundEnd") return null;
  return (
    <div className="gui fixed inset-0 z-20 flex items-center justify-center bg-hud-scrim/60 font-mono text-hud" onClick={(e) => { if (e.target === e.currentTarget) { if (G.countdown <= 0) G.countdown = 0; lockPointer(); } }}>
      <div className="w-full max-w-sm rounded-lg border-2 border-hud/30 bg-hud-panel p-8 text-center">
        <h1 className="text-4xl font-black uppercase">Menu</h1>
        <p className="mt-1 text-xs opacity-70">The match keeps going. Click outside to return.</p>
        <div className="mt-6 flex flex-col gap-3">
          <button className={btnAlt} onClick={onSettings}>Settings</button>
          <button className={btnAlt} onClick={goHomeOnline}>Return to home</button>
        </div>
      </div>
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
  useTick(1000);
  const list = net.invites.filter((i) => Date.now() - i.t < 60000);
  if (list.length === 0 && !err && !busy) return null;
  return (
    <>
      {busy && <ConnectingOverlay label={busy} />}
      <div className="gui pointer-events-auto fixed inset-x-3 top-16 z-[60] mx-auto flex w-full max-w-md flex-col gap-2 font-mono text-hud sm:inset-x-auto sm:right-6 sm:top-auto sm:bottom-6 sm:w-96">
        {err && <div className="rounded bg-hud-panel p-3 text-sm font-bold text-destructive">{err}</div>}
        {list.map((i) => (
          <div key={i.id} className="rounded-lg border-2 border-crosshair bg-hud-panel p-4 shadow-xl">
            <p className="text-sm"><b>{i.from}</b> invited you to {i.kind === "party" ? "their party" : `lobby ${i.target}`}.</p>
            <div className="mt-2 flex gap-2">
              <button
                className={btnMain}
                disabled={!!busy}
                onClick={async () => {
                  if (busy) return;
                  setErr("");
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
                Yes
              </button>
              <button className={btnAlt} disabled={!!busy} onClick={() => dismissInvite(i.id)}>No</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export { resetGame };
