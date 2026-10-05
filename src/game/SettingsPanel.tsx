import { useEffect, useState } from "react";
import { ACTIONS, DEFAULT_SETTINGS, applySettings, keyLabel, useSettings, type Action, type Settings, type TimeOfDay } from "./settings";

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

export function SettingsPanel() {
  const applied = useSettings();
  const [draft, setDraft] = useState<Settings>(() => structuredClone(applied));
  const [binding, setBinding] = useState<Action | null>(null);
  const [saved, setSaved] = useState(false);
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
      </div>

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
