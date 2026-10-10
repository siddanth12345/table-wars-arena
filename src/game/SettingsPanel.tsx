import { NET } from "./net";
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

function MobileLayoutEditor({ draft, setDraft, setSaved }: { draft: Settings; setDraft: (fn: (d: Settings) => Settings) => void; setSaved: (v: boolean) => void }) {
  const layout = draft.mobileLayout ?? DEFAULT_MOBILE_LAYOUT;
  const labels: Record<string, string> = { move: "Move", look: "Look", fire: "⦿", jump: "⬆", dash: "⇢", reload: "↻", parry: "⛨", bomb: "⬤" };
  return (
    <div className="relative mx-auto h-56 w-full max-w-md rounded-xl border-2 border-hud/30 bg-black/40">
      {(Object.keys(labels) as (keyof MobileLayout)[]).map((id) => {
        const pos = layout[id] ?? DEFAULT_MOBILE_LAYOUT[id];
        return (
          <div
            key={id}
            className="absolute flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full border border-white/40 bg-black/60 text-xs font-black active:cursor-grabbing"
            style={{ left: `${pos.x * 100}%`, bottom: `${pos.y * 100}%` }}
            onPointerDown={(e) => {
              e.preventDefault();
              const parent = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
              const move = (ev: PointerEvent) => {
                const x = Math.min(0.95, Math.max(0.05, (ev.clientX - parent.left) / parent.width));
                const y = Math.min(0.95, Math.max(0.05, 1 - (ev.clientY - parent.top) / parent.height));
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
            {labels[id]}
          </div>
        );
      })}
      <button type="button" className="absolute bottom-1 right-1 rounded border border-white/30 px-2 py-0.5 text-[10px] font-bold uppercase" onClick={() => { setSaved(false); setDraft((d) => ({ ...d, mobileLayout: { ...DEFAULT_MOBILE_LAYOUT } })); }}>Reset layout</button>
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
          <div className="mb-2 mt-5 text-xs font-bold uppercase tracking-widest opacity-70">Mobile layout · drag controls on the preview</div>
          <MobileLayoutEditor draft={draft} setDraft={setDraft} setSaved={setSaved} />
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
