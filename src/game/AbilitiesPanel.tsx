import { ABILITY_LIST, setAbility, useAbility, type AbilityId } from "./abilities";

const btn = "rounded-xl border-2 border-white/20 bg-black/50 px-3 py-2 text-sm font-bold uppercase tracking-wide text-white hover:bg-white/10 transition";
const btnOn = "rounded-xl border-2 border-crosshair bg-crosshair/20 px-3 py-2 text-sm font-bold uppercase tracking-wide text-crosshair";

export function AbilitiesPanel({ onClose }: { onClose: () => void }) {
  const selected = useAbility();
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 font-mono text-hud backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border-2 border-crosshair/40 bg-[#0a1210] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.3em] text-crosshair">TBLE</div>
            <h2 className="text-3xl font-black tracking-tight">Abilities</h2>
          </div>
          <button type="button" className={btn} onClick={onClose}>Close</button>
        </div>
        <div className="space-y-3 overflow-y-auto p-6">
          {ABILITY_LIST.map((a) => {
            const on = selected === a.id;
            return (
              <div
                key={a.id}
                className={`flex items-center gap-4 rounded-2xl border-2 p-4 transition ${on ? "border-crosshair bg-crosshair/10" : "border-white/15 bg-black/40"}`}
              >
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-black/50 text-3xl">
                  {a.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-black uppercase tracking-wide">{a.name}</div>
                  <p className="mt-1 text-xs leading-relaxed opacity-70">{a.desc}</p>
                </div>
                <button
                  type="button"
                  className={on ? btnOn : btn}
                  onClick={() => setAbility(a.id as AbilityId)}
                >
                  {on ? "Selected" : "Select"}
                </button>
              </div>
            );
          })}
        </div>
        <div className="border-t border-white/10 px-6 py-3 text-center text-[10px] font-bold uppercase tracking-widest opacity-50">
          Press V in-game to use your selected ability
        </div>
      </div>
    </div>
  );
}
