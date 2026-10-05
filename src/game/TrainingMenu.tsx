import { useEffect, useState } from "react";
import { G, TRAIN, TRAIN_CMD, TRAIN_DEFAULTS, TRAIN_Q, lockPointer, type TrainCfg, type TrainSpawn } from "./state";

function useTick(ms: number) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

function Slider({ label, value, min, max, step, unit = "", onChange }: { label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 border-b border-hud/15 py-2 text-sm">
      <span className="font-bold uppercase tracking-wider">{label}</span>
      <span className="flex items-center gap-3">
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-40 accent-[var(--crosshair)]" />
        <span className="w-16 text-right font-black">{step < 1 ? value.toFixed(1) : value}{unit}</span>
      </span>
    </label>
  );
}

function NumBox({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wider">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Math.round(Number(e.target.value) || min))))}
        className="w-24 rounded border-2 border-hud/40 bg-hud-track px-2 py-1 text-base font-black text-hud"
      />
    </label>
  );
}

const btn = "rounded px-6 py-3 font-black uppercase";

/** Training sandbox menu: opened with Enter, changes only take effect on Close (or Enter again). */
export function TrainingMenu() {
  useTick(150);
  const open = G.phase === "playing" && G.mode === "training" && G.trainMenu;
  const [draft, setDraft] = useState<TrainCfg>({ ...TRAIN });
  const [queue, setQueue] = useState<TrainSpawn[]>([]);
  const [browns, setBrowns] = useState(1);
  const [blues, setBlues] = useState(1);
  const [delay, setDelay] = useState(0);

  // fresh draft every time the menu opens
  useEffect(() => {
    if (open) { setDraft({ ...TRAIN }); setQueue([]); }
  }, [open]);

  const close = (apply: boolean) => {
    if (apply) {
      const hpChanged = draft.maxHp !== TRAIN.maxHp;
      Object.assign(TRAIN, draft);
      TRAIN_Q.push(...queue.map((q) => ({ ...q })));
      if (hpChanged) G.playerHp = TRAIN.maxHp;
      G.playerHp = Math.min(G.playerHp, TRAIN.maxHp);
      G.airJumps = Math.min(G.airJumps, TRAIN.airJumps);
      G.airDashes = Math.min(G.airDashes, TRAIN.airDashes);
      G.parryCd = Math.min(G.parryCd, TRAIN.parryCd);
      G.dashCd = Math.min(G.dashCd, TRAIN.dashCd);
      G.bombCd = Math.min(G.bombCd, TRAIN.bombCd);
      G.slamCd = Math.min(G.slamCd, TRAIN.slamCd);
    }
    G.trainMenu = false;
    lockPointer();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Enter") return;
      e.preventDefault();
      e.stopPropagation();
      close(true);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  if (!open) return null;
  const set = <K extends keyof TrainCfg>(k: K) => (v: number) => setDraft((d) => ({ ...d, [k]: v }));
  const add = (kind: TrainSpawn["kind"], n: number) => setQueue((q) => [...q, { kind, n, t: delay }]);
  const pending = TRAIN_Q.length;

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-hud-scrim p-6 font-mono text-hud">
      <div className="max-h-full w-full max-w-5xl overflow-y-auto rounded-lg border-2 border-hud/30 bg-hud-panel p-8">
        <div className="mb-4 flex items-baseline justify-between border-b border-hud/30 pb-2">
          <h1 className="text-4xl font-black uppercase tracking-tight">Training menu</h1>
          <span className="text-xs uppercase tracking-widest opacity-70">Enter = close &amp; apply</span>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <section>
            <h3 className="mb-2 text-lg font-black uppercase tracking-widest text-crosshair">Spawn</h3>
            <Slider label="Spawn after" value={delay} min={0} max={30} step={1} unit="s" onChange={setDelay} />
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <NumBox label="Brown tables" value={browns} min={1} max={40} onChange={setBrowns} />
              <button className={`${btn} border-2 border-hud/40`} onClick={() => add("brown", browns)}>Spawn brown</button>
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <NumBox label="Blue tables" value={blues} min={1} max={40} onChange={setBlues} />
              <button className={`${btn} border-2 border-hud/40`} onClick={() => add("blue", blues)}>Spawn blue</button>
            </div>
            <div className="mt-3">
              <button className={`${btn} border-2 border-destructive text-destructive`} onClick={() => add("boss", 1)}>Spawn boss</button>
            </div>
            <div className="mt-3 min-h-10 text-xs uppercase tracking-widest">
              {queue.length > 0 ? (
                <ul className="space-y-0.5">
                  {queue.map((q, i) => (
                    <li key={i}>Queued: {q.kind === "boss" ? "boss" : `${q.n} ${q.kind}`} in {q.t}s</li>
                  ))}
                </ul>
              ) : (
                <span className="opacity-60">Nothing queued{pending ? ` · ${pending} spawn(s) already waiting` : ""}</span>
              )}
            </div>

            <h3 className="mb-2 mt-6 text-lg font-black uppercase tracking-widest text-destructive">Boss</h3>
            <Slider label="Boss start health" value={draft.bossHp} min={50} max={400} step={10} onChange={set("bossHp")} />
            <Slider label="Boss move cooldown" value={draft.bossCd} min={0.5} max={5} step={0.1} unit="s" onChange={set("bossCd")} />
            <Slider label="Health rings / 10s" value={draft.ringsPer10} min={1} max={5} step={1} onChange={set("ringsPer10")} />
          </section>

          <section>
            <h3 className="mb-2 text-lg font-black uppercase tracking-widest text-crosshair">Player</h3>
            <Slider label="Health" value={draft.maxHp} min={1} max={500} step={1} onChange={set("maxHp")} />
            <Slider label="Parry cooldown" value={draft.parryCd} min={0.1} max={10} step={0.1} unit="s" onChange={set("parryCd")} />
            <Slider label="Dash cooldown" value={draft.dashCd} min={0.1} max={10} step={0.1} unit="s" onChange={set("dashCd")} />
            <Slider label="Bomb cooldown" value={draft.bombCd} min={0.1} max={10} step={0.1} unit="s" onChange={set("bombCd")} />
            <Slider label="Wallrun cooldown" value={draft.wallrunCd} min={0.1} max={10} step={0.1} unit="s" onChange={set("wallrunCd")} />
            <Slider label="Air jumps" value={draft.airJumps} min={1} max={20} step={1} onChange={set("airJumps")} />
            <Slider label="Air dashes" value={draft.airDashes} min={1} max={20} step={1} onChange={set("airDashes")} />
            <Slider label="Slam cooldown" value={draft.slamCd} min={1} max={10} step={0.5} unit="s" onChange={set("slamCd")} />
            <Slider label="Grapple distance" value={draft.grappleM} min={5} max={100} step={0.5} unit="m" onChange={set("grappleM")} />
          </section>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <button className={`${btn} bg-crosshair text-hud-ink`} onClick={() => close(true)}>Close</button>
          <button className={`${btn} border-2 border-hud/40`} onClick={() => close(false)}>Cancel</button>
          <button className={`${btn} border-2 border-hud/40`} onClick={() => { setDraft({ ...TRAIN_DEFAULTS }); setQueue([]); setBrowns(1); setBlues(1); setDelay(0); }}>Reset to defaults</button>
          <button className={`${btn} border-2 border-destructive text-destructive`} onClick={() => { TRAIN_CMD.despawn = true; setQueue([]); }}>Despawn all entities</button>
        </div>
      </div>
    </div>
  );
}
