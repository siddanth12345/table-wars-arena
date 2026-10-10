import { NET } from "./net";
import { useEffect, useState } from "react";
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
  );
}

function MobileLayoutEditor({ draft, setDraft, setSaved, onClose }: {
  draft: Settings;
  setDraft: (fn: (d: Settings) => Settings) => void;
  setSaved: (v: boolean) => void;
  onClose: () => void;
}) {
  const layout = draft.mobileLayout ?? DEFAULT_MOBILE_LAYOUT;
  const labels: Record<string, string> = {
    fire: "Fire", jump: "Jump", dash: "Dash", reload: "Reload", parry: "Parry", bomb: "Bomb",
  };
  const ids = Object.keys(labels) as (keyof MobileLayout)[];
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#0c0a12] font-mono text-hud">
      <div className="flex items-center justify-between border-b border-white/15 px-4 py-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-crosshair">Mobile layout</div>
          <div className="text-sm opacity-70">Drag buttons · move stick is dynamic (bottom-left)</div>
        </div>
        <button type="button" className="rounded-lg border-2 border-white/30 px-4 py-2 text-sm font-black uppercase" onClick={onClose}>Done</button>
      </div>
      <div className="relative min-h-0 flex-1 touch-none">
        <div className="absolute inset-3 rounded-2xl border-2 border-dashed border-white/20 bg-black/50">
          {/* move zone hint */}
          <div className="absolute bottom-0 left-0 h-1/2 w-[48%] rounded-bl-2xl border-r border-t border-crosshair/30 bg-crosshair/5">
            <span className="absolute bottom-2 left-2 text-[10px] font-bold uppercase text-crosshair/70">Move zone</span>
          </div>
          <div className="absolute right-2 top-2 text-[10px] font-bold uppercase text-white/40">Look = rest of screen</div>
          {ids.map((id) => {
            const pos = layout[id] ?? DEFAULT_MOBILE_LAYOUT[id];
            return (
              <div
                key={id}
                className="absolute flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 cursor-grab flex-col items-center justify-center rounded-2xl border-2 border-white/40 bg-gradient-to-b from-white/20 to-black/60 text-white active:cursor-grabbing"
                style={{ left: `${pos.x * 100}%`, bottom: `${pos.y * 100}%` }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const parent = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                  const move = (ev: PointerEvent) => {
                    const x = Math.min(0.94, Math.max(0.06, (ev.clientX - parent.left) / parent.width));
                    const y = Math.min(0.92, Math.max(0.08, 1 - (ev.clientY - parent.top) / parent.height));
                    setSaved(false);
                    setDraft((d) => ({ ...d, mobileLayout: { ...d.mobileLayout, [id]: { x, y } } }));
                  };
                  const up = () => {
                    window.removeEventListener("pointermove", move);
                    window.removeEventListener("pointerup", up);
                  };
                  window.addEventListener("pointermove", move);
                  window.addEventListener("pointerup", up);
                }}
              >
                <span className="text-sm font-black leading-none">{labels[id]}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex gap-2 border-t border-white/15 p-3">
        <button
          type="button"
          className="rounded-lg border-2 border-destructive/60 px-4 py-2 text-sm font-black uppercase text-destructive"
          onClick={() => { setSaved(false); setDraft((d) => ({ ...d, mobileLayout: { ...DEFAULT_MOBILE_LAYOUT } })); }}
        >
          Reset layout
        </button>
        <button type="button" className="flex-1 rounded-lg bg-crosshair py-2 text-sm font-black uppercase text-hud-ink" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
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
