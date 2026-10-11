import { NET } from "./net";
import { useEffect, useRef, useState } from "react";
import { ACTIONS, DEFAULT_SETTINGS, DEFAULT_MOBILE_LAYOUT, applySettings, keyLabel, useSettings, type Action, type Settings, type TimeOfDay, type MobileLayout } from "./settings";
import { isTouchDevice } from "./mobileInput";
import { G } from "./state";

const TODS: { id: TimeOfDay; label: string; sub: string }[] = [
  { id: "day", label: "Day", sub: "Bright, cool daylight" },
  { id: "evening", label: "Evening", sub: "Warm sunset glow" },
  { id: "night", label: "Night", sub: "Moonlight & lamps" },
];

function TodIcon({ id }: { id: TimeOfDay }) {
  if (id === "day")
    return (
      <div className="tod-sun relative h-12 w-12">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="tod-ray" style={{ transform: `rotate(${i * 45}deg) translateY(-22px)` }} />
        ))}
        <span className="tod-sun-core" />
      </div>
    );
  if (id === "evening")
    return (
      <div className="relative h-12 w-14 overflow-hidden">
        <span className="tod-setting-sun" />
        <span className="tod-horizon" />
      </div>
    );
  return (
    <div className="relative h-12 w-12">
      <span className="tod-moon" />
      <span className="tod-star" style={{ left: "2px", top: "4px" }} />
      <span className="tod-star" style={{ right: "0px", top: "30px", animationDelay: "0.7s" }} />
      <span className="tod-star" style={{ left: "10px", bottom: "0px", animationDelay: "1.3s" }} />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-hud/15 py-3">
      <span className="text-sm font-bold uppercase tracking-widest">{label}</span>
      {children}
    </div>
  );
}

function Switch({ on, onChange, a, b }: { on: boolean; onChange: (v: boolean) => void; a: string; b: string }) {
  return (
    <div className="flex overflow-hidden rounded border-2 border-hud/40 text-xs font-black uppercase">
      <button className={`px-4 py-2 ${on ? "bg-crosshair text-hud-ink" : ""}`} onClick={() => onChange(true)}>{a}</button>
      <button className={`px-4 py-2 ${!on ? "bg-crosshair text-hud-ink" : ""}`} onClick={() => onChange(false)}>{b}</button>
    </div>
function MobileLayoutEditor({ draft, setDraft, setSaved, onClose }: {
  draft: Settings;
  setDraft: (fn: (d: Settings) => Settings) => void;
  setSaved: (v: boolean) => void;
  onClose: () => void;
}) {
  const labels: Record<string, string> = {
    fire: "Fire", jump: "Jump", dash: "Dash", reload: "Reload", parry: "Parry", bomb: "Bomb",
  };
  const ids = Object.keys(labels) as (keyof MobileLayout)[];
  const playfield = useRef<HTMLDivElement>(null);
  // Local positions during edit — only commit on release to avoid lag/glitch
  const [local, setLocal] = useState<Record<string, { x: number; y: number }>>(() => {
    const base = draft.mobileLayout ?? DEFAULT_MOBILE_LAYOUT;
    const out: Record<string, { x: number; y: number }> = {};
    for (const id of ids) {
      const p = base[id] ?? DEFAULT_MOBILE_LAYOUT[id];
      out[id] = {
        x: Math.min(0.88, Math.max(0.12, p.x)),
        y: Math.min(0.45, Math.max(0.12, p.y)),
      };
    }
    return out;
  });
  const dragging = useRef<string | null>(null);
  const localRef = useRef(local);
  localRef.current = local;

  const commit = (next: Record<string, { x: number; y: number }>) => {
    setSaved(false);
    setDraft((d) => ({
      ...d,
      mobileLayout: {
        ...DEFAULT_MOBILE_LAYOUT,
        ...d.mobileLayout,
        ...next,
      },
    }));
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#0c0a12] font-mono text-hud">
      <div className="flex shrink-0 items-center justify-between border-b border-white/15 px-4 py-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-crosshair">Mobile layout</div>
          <div className="text-sm opacity-70">Drag buttons · stick is dynamic (bottom-left)</div>
        </div>
        <button type="button" className="rounded-lg border-2 border-white/30 px-4 py-2 text-sm font-black uppercase" onClick={() => { commit(local); onClose(); }}>Done</button>
      </div>
      <div className="relative min-h-0 flex-1 p-3">
        <div
          ref={playfield}
          className="relative h-full w-full overflow-hidden rounded-2xl border-2 border-dashed border-white/25 bg-black/60 touch-none"
          onPointerMove={(e) => {
            if (!dragging.current || !playfield.current) return;
            e.preventDefault();
            const r = playfield.current.getBoundingClientRect();
            // Position is CENTER of button, using bottom-left origin (same as in-game)
            let x = (e.clientX - r.left) / r.width;
            let y = 1 - (e.clientY - r.top) / r.height;
            x = Math.min(0.88, Math.max(0.12, x));
            y = Math.min(0.45, Math.max(0.12, y));
            const id = dragging.current;
            const next = { ...localRef.current, [id]: { x, y } };
            localRef.current = next;
            setLocal(next);
          }}
          onPointerUp={() => {
            if (dragging.current) {
              commit(localRef.current);
              dragging.current = null;
            }
          }}
          onPointerCancel={() => {
            if (dragging.current) {
              commit(localRef.current);
              dragging.current = null;
            }
          }}
        >
          <div className="pointer-events-none absolute bottom-0 left-0 h-1/2 w-[48%] rounded-bl-2xl border-r border-t border-crosshair/25 bg-crosshair/5">
            <span className="absolute bottom-2 left-2 text-[10px] font-bold uppercase text-crosshair/70">Move zone</span>
          </div>
          <div className="pointer-events-none absolute right-2 top-2 text-[10px] font-bold uppercase text-white/40">Look = rest of screen</div>
          {ids.map((id) => {
            const pos = local[id] ?? { x: 0.7, y: 0.25 };
            return (
              <div
                key={id}
                className="absolute flex h-[min(18vw,5.5rem)] w-[min(18vw,5.5rem)] -translate-x-1/2 -translate-y-1/2 cursor-grab flex-col items-center justify-center rounded-2xl border-[3px] border-white/50 bg-gradient-to-b from-white/25 to-black/70 text-white active:cursor-grabbing"
                style={{ left: `${pos.x * 100}%`, bottom: `${pos.y * 100}%` }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  dragging.current = id as string;
                  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                }}
              >
                <span className="text-xs font-black uppercase leading-none">{labels[id]}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex shrink-0 gap-2 border-t border-white/15 p-3">
        <button
          type="button"
          className="rounded-lg border-2 border-destructive/60 px-4 py-2 text-sm font-black uppercase text-destructive"
          onClick={() => {
            const next: Record<string, { x: number; y: number }> = {};
            for (const id of ids) next[id] = { ...DEFAULT_MOBILE_LAYOUT[id] };
            setLocal(next);
            commit(next);
          }}
        >
          Reset layout
        </button>
        <button type="button" className="flex-1 rounded-lg bg-crosshair py-2 text-sm font-black uppercase text-hud-ink" onClick={() => { commit(local); onClose(); }}>
          Done
        </button>
      </div>
    </div>
  );
}

  );
}

export function SettingsPanel() {
  const applied = useSettings();
  const [draft, setDraft] = useState<Settings>(() => structuredClone(applied));
  const [binding, setBinding] = useState<Action | null>(null);
  const [saved, setSaved] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  useEffect(() => setDraft(structuredClone(applied)), [applied]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(applied);

  useEffect(() => {
    if (!binding) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code !== "Escape") {
        setDraft((d) => {
          const keys = { ...d.keys };
          const clash = (Object.keys(keys) as Action[]).find((k) => keys[k] === e.code && k !== binding);
          if (clash) keys[clash] = keys[binding];
          keys[binding] = e.code;
          return { ...d, keys };
        });
      }
      setBinding(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [binding]);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    setSaved(false);
    setDraft((d) => ({ ...d, [k]: v }));
  };

  return (
    <div>
      <h3 className="mb-2 border-b border-hud/30 pb-1 text-lg font-black uppercase tracking-widest text-crosshair">Settings</h3>

      {!NET.online && (<>
      <div className="mb-2 mt-4 text-xs font-bold uppercase tracking-widest opacity-70">Time of day</div>
      <div className="grid grid-cols-3 gap-3">
        {TODS.map((t) => (
          <button
            key={t.id}
            onClick={() => set("timeOfDay", t.id)}
            className={`tod-card tod-${t.id} flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-transform hover:-translate-y-0.5 ${draft.timeOfDay === t.id ? "tod-active" : "border-transparent"}`}
          >
            <TodIcon id={t.id} />
            <span className="text-base font-black uppercase tracking-widest">{t.label}</span>
            <span className="text-[10px] font-bold uppercase opacity-80">{t.sub}</span>
          </button>
        ))}
      </div>
      </>)}

      <div className="mt-4">
        <Row label={`Mouse sensitivity · ${draft.sensitivity.toFixed(2)}x`}>
          <input type="range" min={0.1} max={3} step={0.05} value={draft.sensitivity} onChange={(e) => set("sensitivity", Number(e.target.value))} className="w-56 accent-[var(--crosshair)]" />
        </Row>
        <Row label={`Field of view · ${draft.fov}°`}>
          <input type="range" min={60} max={120} step={1} value={draft.fov} onChange={(e) => set("fov", Number(e.target.value))} className="w-56 accent-[var(--crosshair)]" />
        </Row>
        <Row label="Shadows"><Switch on={draft.shadows} onChange={(v) => set("shadows", v)} a="On" b="Off" /></Row>
        <Row label="Screen shake"><Switch on={draft.screenShake} onChange={(v) => set("screenShake", v)} a="On" b="Off" /></Row>
        <Row label="Shooting"><Switch on={draft.fireMode === "hold"} onChange={(v) => set("fireMode", v ? "hold" : "toggle")} a="Hold" b="Toggle" /></Row>
        <Row label={`Aim assist · ${Math.round((draft.aimAssist ?? 0) * 100)}%`}>
          <input type="range" min={0} max={0.45} step={0.01} value={draft.aimAssist ?? 0} onChange={(e) => set("aimAssist", Number(e.target.value))} className="w-56 accent-[var(--crosshair)]" />
        </Row>
        <Row label="Auto bunny-hop"><Switch on={draft.autoBunnyHop !== false} onChange={(v) => set("autoBunnyHop", v)} a="On" b="Off" /></Row>
        {(G.isMobile || isTouchDevice()) && (
          <Row label={`Mobile look sens · ${(draft.mobileSensitivity ?? 1).toFixed(2)}`}>
            <input type="range" min={0.5} max={2.5} step={0.05} value={draft.mobileSensitivity ?? 1} onChange={(e) => set("mobileSensitivity", Number(e.target.value))} className="w-56 accent-[var(--crosshair)]" />
          </Row>
        )}
      </div>

      {(G.isMobile || isTouchDevice()) ? (
        <>
          <div className="mb-2 mt-5 text-xs font-bold uppercase tracking-widest opacity-70">Mobile controls</div>
          <button
            type="button"
            className="mb-2 w-full rounded-xl border-2 border-crosshair/50 bg-crosshair/10 px-4 py-4 text-left"
            onClick={() => setLayoutOpen(true)}
          >
            <div className="text-sm font-black uppercase tracking-widest text-crosshair">Edit button layout</div>
            <div className="mt-1 text-xs opacity-70">Opens a full-screen editor — drag Fire, Jump, Dash, and more</div>
          </button>
          {layoutOpen && (
            <MobileLayoutEditor
              draft={draft}
              setDraft={setDraft}
              setSaved={setSaved}
              onClose={() => setLayoutOpen(false)}
            />
          )}
        </>
      ) : (
        <>
          <div className="mb-2 mt-5 text-xs font-bold uppercase tracking-widest opacity-70">Key bindings · click, then press a key (Esc cancels)</div>
          <div className="grid grid-cols-2 gap-x-6">
            {ACTIONS.map((a) => (
              <div key={a.id} className="flex items-center justify-between border-b border-hud/15 py-2 text-sm">
                <span>{a.label}</span>
                <button
                  onClick={() => setBinding(a.id)}
                  className={`min-w-20 rounded border-2 px-3 py-1 font-black ${binding === a.id ? "animate-pulse border-crosshair text-crosshair" : "border-hud/40"}`}
                >
                  {binding === a.id ? "Press…" : keyLabel(draft.keys[a.id])}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          disabled={!dirty}
          onClick={() => { applySettings(draft); setSaved(true); }}
          className="rounded bg-crosshair px-8 py-3 text-lg font-black uppercase text-hud-ink disabled:opacity-40"
        >
          Save &amp; Apply
        </button>
        <button disabled={!dirty} onClick={() => setDraft(structuredClone(applied))} className="rounded border-2 border-hud/40 px-6 py-3 font-black uppercase disabled:opacity-40">Discard</button>
        <button onClick={() => { setSaved(false); setDraft(structuredClone(DEFAULT_SETTINGS)); }} className="rounded border-2 border-destructive px-6 py-3 font-black uppercase text-destructive">Reset settings</button>
        <span className="text-xs font-bold uppercase tracking-widest">
          {dirty ? <span className="text-destructive">Unsaved changes — not applied</span> : saved ? <span className="text-crosshair">Saved &amp; applied</span> : null}
        </span>
      </div>
    </div>
  );
}
