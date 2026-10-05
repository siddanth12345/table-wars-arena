import { Canvas } from "@react-three/fiber";
import { useFrame, useThree } from "@react-three/fiber";
import { useSettings, keyLabel, ACTIONS } from "./settings";
import { SettingsPanel } from "./SettingsPanel";
import { TrainingMenu } from "./TrainingMenu";
import { Environment, Lightformer } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { World } from "./World";
import { G, MAG, PARRY_CD, DASH_CD, BOMB_CD, TABLE_CAP, cfg, resetGame, lockPointer, MAP, TUT_STEPS, goHome, finishTutorial } from "./state";
import { ROOM, SOLIDS, WINDOW_ANGLES } from "./Room";
import { LoadingScreen } from "./LoadingScreen";
import { AuthPanel, AccountBadge, PlayMenu, QueueOverlay, MapPick, Scoreboard, PvpEnd, OnlinePause, LobbyBar, Invites } from "./OnlineUI";
import { NET } from "./net";
import { useAccount } from "./account";

const LIGHT = {
  day: { hemiSky: "#e6f1ff", hemiGround: "#8a8f94", hemi: 0.75, amb: 0.3, ambC: "#f2f7ff", sun: 6.5, sunC: "#f6f9ff", bg: "#9cc9f0", fog: "#cfe3f5", lf: "#eef5ff", lf2: "#b9cde0", lfI: 0.9 },
  evening: { hemiSky: "#ffb36b", hemiGround: "#24120e", hemi: 0.18, amb: 0.06, ambC: "#ffd0a0", sun: 5.8, sunC: "#ff8b3d", bg: "#d96c32", fog: "#b85b32", lf: "#ffb15f", lf2: "#8f4a45", lfI: 0.5 },
  night: { hemiSky: "#3a4a7a", hemiGround: "#05060c", hemi: 0.06, amb: 0.02, ambC: "#8fa2d8", sun: 3.2, sunC: "#a9bcff", bg: "#070b1a", fog: "#0a1124", lf: "#6f84c4", lf2: "#1c2448", lfI: 0.12 },
};

function SceneLighting() {
  const tod = useSettings().timeOfDay;
  const L = LIGHT[tod];
  const hemisphere = useRef<THREE.HemisphereLight>(null);
  const ambient = useRef<THREE.AmbientLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const warmer = useRef(new THREE.Color("#ff6a24"));
  const tmp = useRef(new THREE.Color());

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const home = G.phase === "home" && tod === "evening";
    const blend = 1 - Math.exp(-3 * dt);
    if (hemisphere.current) {
      hemisphere.current.intensity = THREE.MathUtils.lerp(hemisphere.current.intensity, home ? 0.12 : L.hemi, blend);
      hemisphere.current.color.lerp(tmp.current.set(L.hemiSky), blend);
      hemisphere.current.groundColor.lerp(tmp.current.set(L.hemiGround), blend);
    }
    if (ambient.current) {
      ambient.current.intensity = THREE.MathUtils.lerp(ambient.current.intensity, home ? 0.035 : L.amb, blend);
      ambient.current.color.lerp(tmp.current.set(L.ambC), blend);
    }
    if (sun.current) {
      sun.current.intensity = THREE.MathUtils.lerp(sun.current.intensity, home ? 7.2 : L.sun, blend);
      sun.current.color.lerp(home ? warmer.current : tmp.current.set(L.sunC), blend);
    }
  });

  return (
    <>
      <color attach="background" args={[L.bg]} />
      <fog attach="fog" args={[L.fog, 1550, 2750]} />
      <hemisphereLight ref={hemisphere} args={["#ffb36b", "#24120e", 0.18]} />
      <ambientLight ref={ambient} intensity={0.06} color="#ffd0a0" />
      <directionalLight
        ref={sun}
        position={[-410, 310, -760]}
        intensity={5.8}
        color="#ff8b3d"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-420}
        shadow-camera-right={420}
        shadow-camera-top={420}
        shadow-camera-bottom={-420}
        shadow-camera-near={10}
        shadow-camera-far={1900}
        shadow-bias={-0.00015}
        shadow-normalBias={0.04}
      />
      <Environment key={tod}>
        <Lightformer intensity={L.lfI} position={[0, 10, 0]} rotation-x={Math.PI / 2} scale={[30, 20, 1]} color={L.lf} />
        <Lightformer intensity={L.lfI * 0.16} position={[0, 6, -20]} scale={[20, 6, 1]} color={L.lf2} />
      </Environment>
    </>
  );
}

function ShadowToggle() {
  const on = useSettings().shadows;
  const { gl, scene } = useThree();
  useEffect(() => {
    gl.shadowMap.enabled = on;
    gl.shadowMap.needsUpdate = true;
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(m)) m.forEach((x) => (x.needsUpdate = true));
      else if (m) m.needsUpdate = true;
    });
  }, [on, gl, scene]);
  return null;
}

function useTick(ms: number) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

function Bar({ label, value, max = 100, tone, right }: { label: string; value: number; max?: number; tone: string; right?: string }) {
  return (
    <div className="w-64">
      <div className="mb-1 flex justify-between text-xs font-bold uppercase tracking-widest">
        <span>{label}</span>
        <span>{right ?? Math.ceil(value)}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-sm bg-hud-track">
        <div className="h-full transition-all" style={{ width: `${(value / max) * 100}%`, background: `var(--${tone})` }} />
      </div>
    </div>
  );
}

function groundedLabel(seconds: number) {
  return seconds > 0 ? `recharging ${seconds.toFixed(1)}s` : "locked";
}

function MiniMap() {
  const R = ROOM.r;
  const dot = (x: number, z: number, c: string, r: number, k: string) => <circle key={k} cx={x} cy={z} r={r} fill={c} stroke="#000" strokeWidth={2} />;
  const t: React.ReactNode[] = [];
  for (let i = 0; i < MAP.tables.length; i += 2) t.push(dot(MAP.tables[i]!, MAP.tables[i + 1]!, "#22c55e", 7, "t" + i));
  for (let i = 0; i < MAP.blues.length; i += 2) t.push(dot(MAP.blues[i]!, MAP.blues[i + 1]!, "#60a5fa", 6, "u" + i));
  for (let i = 0; i < MAP.peers.length; i += 2) t.push(dot(MAP.peers[i]!, MAP.peers[i + 1]!, "#f59e0b", 9, "p" + i));
  for (let i = 0; i < MAP.health.length; i += 2) t.push(<circle key={"h" + i} cx={MAP.health[i]} cy={MAP.health[i + 1]} r={8} fill="none" stroke="var(--crosshair)" strokeWidth={4} />);
  const hx = MAP.px - Math.sin(MAP.yaw) * 30, hz = MAP.pz - Math.cos(MAP.yaw) * 30;
  return (
    <div className="absolute right-6 top-6 rounded-full border border-hud/30 bg-hud-panel p-1 shadow-2xl">
      <svg viewBox={`${-R} ${-R} ${2 * R} ${2 * R}`} className="h-[min(27.2vh,12.8rem)] w-[min(27.2vh,12.8rem)]">
        <circle cx={0} cy={0} r={R - 2} fill="#e8dcc4" fillOpacity={0.25} stroke="currentColor" strokeWidth={4} />
        {SOLIDS.slice(0, SOLIDS.length - WINDOW_ANGLES.length * 12).map((s, i) => (
          <rect key={i} x={s.x - s.hw} y={s.z - s.hd} width={s.hw * 2} height={s.hd * 2} fill={s.c ?? "#8a6a4a"} fillOpacity={0.88} stroke="#e8dcc4" strokeWidth={1.5} />
        ))}
        {t}
        {MAP.boss && dot(MAP.boss.x, MAP.boss.z, "#ef4444", 16, "boss")}
        <line x1={MAP.px} y1={MAP.pz} x2={hx} y2={hz} stroke="#1d4ed8" strokeWidth={5} />
        {dot(MAP.px, MAP.pz, "#1d4ed8", 9, "me")}
      </svg>
    </div>
  );
}

function HUD() {
  useTick(50);
  const keys = useSettings().keys;
  const kl = (a: keyof typeof keys) => keyLabel(keys[a]);
  const playing = G.phase === "playing";
  if (G.phase === "won" || G.phase === "home") return null;
  const step = TUT_STEPS[G.tutStep];
  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none font-mono text-hud">
      {playing && G.locked && G.countdown <= 0.6 && !G.scoped && (
        <div className="absolute inset-0 overflow-hidden transition-opacity duration-500" aria-hidden="true" style={{ opacity: Math.max(0, Math.min(1, (G.speed - 28) / 80)) }}>
          {([-1, 1] as const).flatMap((side) => Array.from({ length: Math.min(8, 2 + Math.floor((G.speed - 38) / 24)) }, (_, i) => {
            const intensity = Math.max(0, Math.min(1, (G.speed - 28) / 150));
            return <div key={`${side}-${i}`} className="absolute h-px rounded-full bg-hud shadow-[0_0_5px_var(--hud)] transition-[width,opacity] duration-500" style={{
              top: `${32 + i * 4.7 + (i % 2) * 1.5}%`,
              [side < 0 ? "left" : "right"]: `${2 + (i % 3) * 2}%`,
              width: `${20 + intensity * (48 + i * 7)}px`,
              opacity: (0.14 + intensity * 0.32) * (i % 3 === 0 ? 1 : 0.68),
              transform: `rotate(${side * (10 + i % 3 * 3)}deg)`,
            }} />;
          }))}
        </div>
      )}
      {G.hurtFlash > 0 && <div className="absolute inset-0 bg-destructive/25" />}
      {G.redFlash > 0 && <div className="absolute inset-0 bg-destructive/40" />}
      {(G.buff > 0 || G.parryFlash > 0) && <div className="absolute inset-0 shadow-[inset_0_0_120px_var(--shield)]" />}
      {G.scoped && playing && <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_32%,var(--scope)_34%)]" />}
      {playing && G.locked && G.countdown > 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-9xl font-black drop-shadow-[0_4px_0_rgba(0,0,0,0.6)]">
          {G.countdown > 0.6 ? Math.ceil(G.countdown - 0.6) : "GO!"}
        </div>
      )}
      {G.stun > 0 && playing && (
        <div className="absolute left-1/2 top-[38%] -translate-x-1/2 text-4xl font-black uppercase text-destructive">Stunned</div>
      )}
      {G.compromisedT > 0 && playing && (
        <div className="absolute left-1/2 top-[28%] -translate-x-1/2 text-center text-6xl font-black uppercase text-shield drop-shadow-[0_3px_0_rgba(0,0,0,0.7)]">
          Parry compromised
        </div>
      )}
      {G.respawnMsg > 0 && playing && (
        <div className="absolute left-1/2 top-[20%] -translate-x-1/2 rounded bg-hud-panel px-6 py-3 text-2xl font-black uppercase">Back to the boss checkpoint</div>
      )}
      {G.mode === "training" && playing && !G.trainMenu && (
        <div className="absolute left-1/2 top-6 -translate-x-1/2 rounded border-2 border-crosshair/60 bg-hud-panel px-5 py-2 text-center text-sm font-black uppercase tracking-widest">
          Training · press Enter for the training menu
        </div>
      )}
      {G.mode === "tutorial" && playing && step && (
        <div className="absolute left-1/2 top-6 w-[min(40rem,60vw)] -translate-x-1/2 rounded border-2 border-shield/60 bg-hud-panel p-4 text-center">
          <div className="text-xs uppercase tracking-widest opacity-70">Tutorial {G.tutStep + 1} / {TUT_STEPS.length} · Esc for menu</div>
          <div className="mt-1 text-2xl font-black uppercase">{step.title}</div>
          <div className="mt-2 text-sm">{step.text}</div>
        </div>
      )}

      {playing && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="relative h-8 w-8">
            <div className="absolute left-1/2 top-0 h-2.5 w-0.5 -translate-x-1/2 bg-crosshair" />
            <div className="absolute bottom-0 left-1/2 h-2.5 w-0.5 -translate-x-1/2 bg-crosshair" />
            <div className="absolute left-0 top-1/2 h-0.5 w-2.5 -translate-y-1/2 bg-crosshair" />
            <div className="absolute right-0 top-1/2 h-0.5 w-2.5 -translate-y-1/2 bg-crosshair" />
            <div className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-crosshair" />
            {G.hitFlash > 0 && <div className="absolute -inset-2 rotate-45 border-2 border-crosshair" />}
          </div>
        </div>
      )}

      <MiniMap />
      <div className="absolute left-6 top-6 w-72 space-y-3 rounded bg-hud-panel p-3 text-xs font-bold uppercase tracking-widest">
        <div className="flex h-28 items-stretch gap-5">
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            <span className="opacity-70">Altitude</span>
            <span className="text-lg text-crosshair">{G.altitude.toFixed(1)} m</span>
          </div>
          <div className="relative w-3 overflow-hidden rounded-sm bg-hud-track" aria-label="Altitude">
            <div className="absolute inset-x-0 bottom-0 bg-crosshair transition-[height] duration-200" style={{ height: `${Math.min(100, G.altitude / (ROOM.h / 10) * 100)}%` }} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            <span className="opacity-70">Slam AOE<br />diameter</span>
            <span>{G.slamAoe.toFixed(1)} m</span>
          </div>
          <div className="relative w-3 overflow-hidden rounded-sm bg-hud-track" aria-label="Slam AOE diameter">
            <div className="absolute inset-x-0 bottom-0 bg-enemy transition-[height] duration-200" style={{ height: `${Math.min(100, G.slamAoe / G.slamAoeMax * 100)}%` }} />
          </div>
        </div>
        {G.stage === "tables" && (
          <>
            <div className={G.mode === "pvp" ? "hidden" : ""}>Tables alive: {G.alive}{G.mode === "training" ? "" : G.capReached ? " — clear them all!" : ` / ${TABLE_CAP}`}</div>
            {G.bluesAlive > 0 && <div className="text-shield">Blue tables: {G.bluesAlive}</div>}
            <div className="opacity-70">Kills: {G.kills}</div>
          </>
        )}
        {G.stage === "incoming" && <div className="text-destructive">Boss incoming — {Math.ceil(G.bossWarn)}s</div>}
        {G.stage === "boss" && <Bar label="Boss Table" value={G.bossMax - G.bossHits} max={G.bossMax} tone="enemy" right={`${G.bossMax - G.bossHits} hits`} />}
      </div>
      {G.stage === "incoming" && (
        <div className="absolute left-1/2 top-24 -translate-x-1/2 rounded bg-destructive/80 px-6 py-3 text-center text-destructive-foreground">
          <div className="text-2xl font-black uppercase">Stay away from the center!</div>
          <div className="mx-auto mt-2 h-2 w-72 bg-hud-track">
            <div className="h-full bg-destructive-foreground" style={{ width: `${(G.bossWarn / 10) * 100}%` }} />
          </div>
        </div>
      )}

      <div className="absolute bottom-6 left-6 space-y-3 rounded bg-hud-panel p-3">
        <Bar label="Your Health" value={G.playerHp} max={cfg.maxHp()} tone="crosshair" />
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold uppercase tracking-widest">
          <span className={G.buff > 0 ? "text-shield" : ""}>
            [{kl("parry")}] Parry {G.buff > 0 ? `POWER ${G.buff.toFixed(1)}s` : G.parryLocked ? "COMPROMISED" : G.parryWin > 0 ? "ACTIVE" : G.parryCd > 0 ? G.parryCd.toFixed(1) : "ready"}
          </span>
          <span>[{kl("dash")}] Dash {G.dashCd > 0 ? G.dashCd.toFixed(1) : "ready"}</span>
          <span>[{kl("bomb")}] Bomb {G.bombCd > 0 ? G.bombCd.toFixed(1) : "ready"}</span>
          <span className={G.grappling ? "text-shield" : ""}>[{kl("grapple")}] Grapple</span>
          <span className={G.slamming || G.bounceWin > 0 ? "text-shield" : ""}>[{kl("reload")} air] Slam {G.bounceWin > 0 ? `${kl("reload")} = BOUNCE` : G.slamCd > 0 ? G.slamCd.toFixed(1) : "ready"}</span>
        </div>
        <div className="flex gap-4 text-xs font-bold uppercase tracking-widest">
          <span>Air jumps {G.airJumps}</span>
          <span>Air dashes {G.airDashes}</span>
          <span>{Math.round(G.speed)} u/s</span>
          <span className={G.wallrun ? "text-shield" : G.wallrunReady ? "" : "opacity-60"}>
            Wallrun {G.wallrun ? `${G.wallrunTime.toFixed(1)}s` : G.wallrunReady ? "ready" : G.grounded ? groundedLabel(G.wallrunRecharge) : "locked"}
          </span>
        </div>
        <div className="h-1 w-64 bg-hud-track">
          <div className="h-full bg-shield" style={{ width: `${(1 - G.parryCd / PARRY_CD) * 100}%` }} />
        </div>
        <div className="h-1 w-64 bg-hud-track">
          <div className="h-full bg-hud" style={{ width: `${(1 - G.dashCd / DASH_CD) * 100}%` }} />
        </div>
        <div className="h-1 w-64 bg-hud-track">
          <div className="h-full bg-enemy" style={{ width: `${Math.min(1, 1 - G.bombCd / BOMB_CD) * 100}%` }} />
        </div>
      </div>
      <div className="absolute bottom-6 right-6 rounded bg-hud-panel p-3 text-right">
        <div className="text-xs uppercase tracking-widest opacity-70">Splinters</div>
        <div className="text-4xl font-black">
          {G.buff > 0 ? "∞" : G.reloading > 0 ? "RELOADING" : `${G.ammo} / ${MAG}`}
        </div>
      </div>
    </div>
  );
}

const btnMain = "pointer-events-auto rounded bg-crosshair px-8 py-3 text-lg font-black uppercase text-hud-ink";
const btnAlt = "pointer-events-auto rounded border-2 border-hud/40 px-8 py-3 text-lg font-black uppercase";

function playGame() {
  resetGame("game");
  lockPointer();
}
function startTraining() {
  resetGame("training");
  lockPointer();
}
function startTutorial() {
  resetGame("tutorial");
  lockPointer();
}
function resume() {
  G.countdown = 3.6;
  lockPointer();
}

const BOTS: [string, string, string][] = [
  ["Green table", "var(--crosshair)", "That's you! A fast, jumping, dashing, grappling table."],
  ["Brown table", "#8a5a33", "Normal enemy. Hops around and shoots splinters. Break one and two more appear — up to 30. Then clear them all."],
  ["Blue table", "#2f6fd6", "Fast chaser. Rushes you and explodes on contact. 20 of them appear when you must clear the tables, and the boss summons more."],
  ["Red boss", "#b3121b", "Drops from the ceiling. Shoots hard-hitting bullets, drops swords that stun you, stomps out shockwaves you must jump over and compromises your parry after 5 seconds."],
];

function ControlsList() {
  const st = useSettings();
  const k = (a: (typeof ACTIONS)[number]["id"]) => keyLabel(st.keys[a]);
  const CONTROLS: [string, string][] = [
    [`${k("forward")} ${k("left")} ${k("back")} ${k("right")}`, "Move"],
    ["Mouse", `Look around · sensitivity ${st.sensitivity.toFixed(2)}x`],
    ...ACTIONS.slice(4).map((a) => [a.id === "grapple" ? `Hold ${k(a.id)}` : k(a.id), a.desc] as [string, string]),
    ["Left click", `Shoot exploding splinters (${st.fireMode === "hold" ? "hold to fire" : "click to toggle fire"})`],
    ["Right click", "Scope · scroll wheel to zoom"],
    ["Esc", "Pause menu"],
  ];
  return (
    <ul className="space-y-1 text-left text-sm">
      {CONTROLS.map(([k, d]) => (
        <li key={k} className="grid grid-cols-[8rem_1fr] gap-2"><b>{k}</b><span className="opacity-80">{d}</span></li>
      ))}
    </ul>
  );
}
function BotList() {
  return (
    <ul className="space-y-3 text-left text-sm">
      {BOTS.map(([n, c, d]) => (
        <li key={n} className="flex gap-3">
          <span className="mt-1 h-4 w-6 shrink-0 rounded-sm border border-hud/40" style={{ background: c }} />
          <span><b className="uppercase">{n}</b> — <span className="opacity-80">{d}</span></span>
        </li>
      ))}
    </ul>
  );
}

const ADVANCED: [string, string][] = [
  ["Exploding splinters", "Every left-click splinter explodes where it lands — on a table, the floor or a wall. The blast is one table wide and hits everything inside it for full damage. It never hurts you."],
  ["Parry timing", "Press E just before an enemy bullet reaches you. You reflect it at the nearest enemy for 10 damage and get a 2 second power boost: infinite ammo, triple fire rate and 2x damage. Cooldown is 9s from the moment you press E. In the boss fight it gets compromised after 5 seconds."],
  ["Ground pound", "Press R in the air to slam straight down at double bot-bullet speed. Higher drops hit harder: below half the boss height 1.5 tables wide (5 dmg, 1s), up to boss height 3 tables (5 dmg, 2s), up to 2x boss height 4 tables (10 dmg, 5s), above that 1.5 boss-table lengths (25 dmg, 10s) and the boss's next attack is delayed 2s. Getting hit mid-air cancels the slam. No fall damage."],
  ["Bounce", "Press R again right after a slam lands to bounce back up to the height you slammed from."],
  ["Bomb", "F throws a bomb that explodes in a huge area. After a boss sword strike your bombs grow 1.5x for 5 seconds."],
  ["Healing rings", "During the boss fight a ring appears every 5 seconds and fades after 10. Walk through it or shoot / bomb it to heal 10 HP (max 150). At full health, a ring resets your bomb cooldown instead. Rings block your bullets, but not the boss's."],
  ["Boss stomp", "The boss leans back and stomps, sending a red shockwave ring outward. Jump over it."],
];
const TIPS = [
  "Aim at the floor next to groups of tables — the blast hits all of them.",
  "Climb high with wallruns and the grapple, then slam for the biggest ground pound.",
  "Save a high slam for the boss to delay his attacks.",
  "At full health, shoot rings from afar to reset your bomb.",
  "Rings block your shots — don't stand behind one when shooting the boss.",
  "Parry early in the boss fight: after 5 seconds it's locked.",
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h3 className="mb-2 border-b border-hud/30 pb-1 text-lg font-black uppercase tracking-widest text-crosshair">{title}</h3>
      {children}
    </section>
  );
}

function Home() {
  useTick(150);
  const [tab, setTab] = useState<"main" | "controls" | "tutorial" | "settings" | "play">("main");
  const acc = useAccount();
  const [authOpen, setAuthOpen] = useState(false);
  if (G.phase !== "home") return null;
  return (
    <div className="fixed inset-0 z-20 flex bg-hud-scrim/40 font-mono text-hud">
      <div className="flex w-full max-w-md flex-col justify-center bg-hud-panel/70 p-10 backdrop-blur-[2px]">
        <h1 className="text-7xl font-black leading-none tracking-tight">TBLE</h1>
        <p className="mt-3 text-sm opacity-70">Break every table. Survive the red boss.</p>
        <div className="mt-10 flex flex-col gap-3">
          <button className={btnMain} onClick={() => setTab(tab === "play" ? "main" : "play")}>Play</button>
          <button className={tab === "controls" ? btnMain : btnAlt} onClick={() => setTab(tab === "controls" ? "main" : "controls")}>Controls &amp; Bot Types</button>
          <button className={tab === "tutorial" ? btnMain : btnAlt} onClick={() => setTab(tab === "tutorial" ? "main" : "tutorial")} data-glow="orange">Tutorial</button>
          <button className={btnAlt} onClick={startTraining}>Training</button>
          <button className={tab === "settings" ? btnMain : btnAlt} onClick={() => setTab(tab === "settings" ? "main" : "settings")}>Settings</button>
        </div>
        <AccountBadge onLogin={() => setAuthOpen(true)} />
        <p className="mt-4 text-xs opacity-60">Offline modes run on your own private server.</p>
      </div>
      {(authOpen || acc.status === "signedOut") && <AuthPanel onClose={() => setAuthOpen(false)} />}
      {tab === "play" && <PlayMenu onCampaign={playGame} onClose={() => setTab("main")} />}
      {tab !== "main" && tab !== "play" && (
        <div className="m-6 flex-1 overflow-y-auto rounded-lg border-2 border-hud/30 bg-hud-panel p-8">
          {tab === "settings" ? (
            <SettingsPanel />
          ) : tab === "controls" ? (
            <>
              <Section title="Controls"><ControlsList /></Section>
              <Section title="Bot types"><BotList /></Section>
            </>
          ) : (
            <>
              <Section title="Basics">
                <ol className="list-decimal space-y-1 pl-5 text-sm">
                  {TUT_STEPS.map((s) => (
                    <li key={s.title}><b className="uppercase">{s.title}</b> — <span className="opacity-80">{s.text.replace(/ ?Press ENTER to (continue|finish)\./, "")}</span></li>
                  ))}
                </ol>
                <button className={`${btnMain} mt-4`} onClick={startTutorial}>Start interactive tutorial</button>
              </Section>
              <Section title="Advanced">
                <ul className="space-y-3 text-sm">
                  {ADVANCED.map(([k, d]) => (
                    <li key={k}><b className="uppercase">{k}</b> — <span className="opacity-80">{d}</span></li>
                  ))}
                </ul>
              </Section>
              <Section title="Tips">
                <ul className="list-disc space-y-1 pl-5 text-sm opacity-90">
                  {TIPS.map((t) => <li key={t}>{t}</li>)}
                </ul>
              </Section>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Menu() {
  useTick(100);
  const [showSettings, setShowSettings] = useState(false);
  const phase = G.phase;
  if (phase === "lost") {
    return (
      <div className="fixed inset-0 z-20 flex items-center justify-center bg-hud-scrim font-mono text-hud">
        <div className="max-w-lg rounded-lg border-2 border-hud/30 bg-hud-panel p-8 text-center">
          <h1 className="text-5xl font-black tracking-tight">You Got Splintered</h1>
          <div className="mt-6 flex justify-center gap-3">
            <button className={btnMain} onClick={playGame}>Restart</button>
            <button className={btnAlt} onClick={goHome}>Home</button>
          </div>
        </div>
      </div>
    );
  }
  if (phase !== "playing" || G.locked || G.trainMenu) return null;
  if (NET.online && !showSettings) return <OnlinePause onSettings={() => setShowSettings(true)} />;
  const tut = G.mode === "tutorial";
  const train = G.mode === "training";
  if (showSettings) {
    return (
      <div className="fixed inset-0 z-20 flex items-center justify-center bg-hud-scrim p-6 font-mono text-hud">
        <div className="max-h-full w-full max-w-3xl overflow-y-auto rounded-lg border-2 border-hud/30 bg-hud-panel p-8">
          <SettingsPanel />
          <button className={`${btnAlt} mt-4`} onClick={() => setShowSettings(false)}>Back</button>
        </div>
      </div>
    );
  }
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-hud-scrim font-mono text-hud">
      <div className="w-full max-w-sm rounded-lg border-2 border-hud/30 bg-hud-panel p-8 text-center">
        <h1 className="text-5xl font-black tracking-tight">{tut ? "Tutorial" : train ? "Training" : "Paused"}</h1>
        <div className="mt-6 flex flex-col gap-3">
          <button className={btnMain} onClick={resume}>Resume</button>
          <button className={btnAlt} onClick={tut ? startTutorial : train ? startTraining : playGame}>Restart</button>
          {tut ? (
            <button className={btnAlt} onClick={finishTutorial}>Skip Tutorial</button>
          ) : (
            <button className={btnAlt} onClick={startTutorial}>Tutorial</button>
          )}
          <button className={btnAlt} onClick={() => setShowSettings(true)}>Settings</button>
          <button className={btnAlt} onClick={goHome}>Home</button>
        </div>
      </div>
    </div>
  );
}

function VictoryTable() {
  const table = useRef<THREE.Group>(null);
  useFrame(({ clock }, delta) => {
    const model = table.current;
    if (!model) return;
    model.rotation.y += delta * 0.65;
    model.position.y = Math.abs(Math.sin(clock.elapsedTime * 2.2)) * 0.8 - 1;
    model.rotation.z = Math.sin(clock.elapsedTime * 2.2) * 0.08;
  });
  return (
    <group ref={table} scale={0.9}>
      <mesh position={[0, 1.7, 0]} castShadow><boxGeometry args={[5, 0.55, 3.4]} /><meshStandardMaterial color="#2fa84f" roughness={0.55} /></mesh>
      {([[-2, 0.6, -1.2], [2, 0.6, -1.2], [-2, 0.6, 1.2], [2, 0.6, 1.2]] as const).map((p, i) => (
        <mesh key={i} position={p} castShadow><boxGeometry args={[0.45, 2.6, 0.45]} /><meshStandardMaterial color="#197a37" /></mesh>
      ))}
      {[-0.85, 0.85].map((x) => (
        <group key={x} position={[x, 1.8, 1.72]}>
          <mesh><sphereGeometry args={[0.32, 18, 12]} /><meshStandardMaterial color="#f5f2dc" /></mesh>
          <mesh position={[0, 0, 0.29]}><sphereGeometry args={[0.12, 12, 8]} /><meshStandardMaterial color="#172117" /></mesh>
        </group>
      ))}
    </group>
  );
}

function WinScreen() {
  useTick(200);
  if (G.phase !== "won") return null;
  const acc = G.shots ? (G.hits / G.shots) * 100 : 0;
  const m = Math.floor(G.time / 60), s = Math.floor(G.time % 60);
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-hud-scrim p-6 font-mono text-hud">
      <div className="grid w-full max-w-5xl grid-cols-1 overflow-hidden rounded-lg border-2 border-hud/30 bg-hud-panel shadow-2xl md:grid-cols-[0.9fr_1.1fr]">
        <div className="relative min-h-80 border-b-2 border-hud/20 md:min-h-[34rem] md:border-b-0 md:border-r-2">
          <div className="absolute left-6 top-6 z-10 text-5xl font-black uppercase">Victory</div>
          <Canvas shadows camera={{ position: [8, 5, 10], fov: 42 }}>
            <ambientLight intensity={1.1} />
            <directionalLight position={[5, 10, 6]} intensity={2.2} castShadow />
            <VictoryTable />
            <mesh rotation-x={-Math.PI / 2} position={[0, -1.1, 0]} receiveShadow><circleGeometry args={[7, 48]} /><meshStandardMaterial color="#314438" roughness={1} /></mesh>
          </Canvas>
          <div className="absolute bottom-6 left-6 text-sm font-black uppercase tracking-widest text-crosshair">The green table wins</div>
        </div>
        <div className="flex min-h-[34rem] flex-col justify-center p-8 md:p-12">
          <div className="mb-8 border-b-2 border-hud/30 pb-3 text-3xl font-black uppercase">Results</div>
          <dl className="space-y-3 text-lg">
            {[
              ["Time", `${m}:${s.toString().padStart(2, "0")}`],
              ["Bullets shot", G.shots],
              ["Bullets hit", G.hits],
              ["Accuracy", `${acc.toFixed(1)}%`],
              ["Tables defeated", G.kills],
              ["Shots parried", G.parries],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-[1fr_auto] items-center border-b border-hud/20 bg-hud-track px-4 py-3">
                <dt className="font-bold uppercase opacity-75">{label}</dt><dd className="text-2xl font-black">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-8 flex gap-3">
            <button className={btnMain} onClick={() => playGame()}>Play Again</button>
            <button className={btnAlt} onClick={() => goHome()}>Home</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Game() {
  const [, force] = useState(0);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    // Feed the cursor position to whichever GUI button it is over, for the hover glow.
    const move = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.(".gui button") as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, []);
  useEffect(() => {
    let done = false;
    try { done = localStorage.getItem("tw-tutorial-done") === "1"; } catch { /* ignore */ }
    void done;
    G.phase = "home";
    force((n) => n + 1);
  }, []);
  return (
    <div className="gui fixed inset-0 bg-black">
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0, 3.2, 12], fov: 72, near: 0.1, far: 3000 }}>
        <SceneLighting />
        <ShadowToggle />
        <World />
      </Canvas>
      <HUD />
      <Menu />
      <TrainingMenu />
      <Home />
      <WinScreen />
      <QueueOverlay />
      <MapPick />
      <Scoreboard />
      <PvpEnd />
      <LobbyBar />
      <Invites />
      {!loaded && <LoadingScreen onDone={() => setLoaded(true)} />}
    </div>
  );
}
