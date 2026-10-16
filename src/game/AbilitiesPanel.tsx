import { useState } from "react";
import { ABILITY_LIST, setAbility, useAbility, type AbilityId } from "./abilities";

const btn = "rounded-xl border-2 border-white/20 bg-black/50 px-3 py-2 text-sm font-bold uppercase tracking-wide text-white hover:bg-white/10 transition";
const btnOn = "rounded-xl border-2 border-crosshair bg-crosshair/20 px-3 py-2 text-sm font-bold uppercase tracking-wide text-crosshair";

const DETAILS: Record<AbilityId, { summary: string; lines: string[] }> = {
  wall: {
    summary: "Wooden cover you can aim anywhere — floors, ceilings, ramps.",
    lines: [
      "Press V to place a boss-sized wooden wall 5× farther along your crosshair.",
      "Height is 1.6× boss height; thickness is one table. Lasts 2 seconds.",
      "4 charges, then a 3s cooldown. Walls have no friction (usable as ramps).",
      "Omnidirectional: look down to place a floor/ceiling plate or a 45° ramp.",
      "You can GRAPPLE onto walls (hold C while aiming at one).",
      "If a wall despawns while you're grappled to it, the rope releases automatically.",
      "Campaign boss (after parry lock): Wall is disabled along with parry.",
    ],
  },
  trampoline: {
    summary: "Spring pads that launch you hard — place in mid-air at any angle.",
    lines: [
      "Press V to place a pad the same way as walls (omnidirectional, 0.5× wall size).",
      "Visual is a green circle; the hitbox stays a rectangular volume.",
      "3 charges, then a 4s cooldown. Pads last 3 seconds.",
      "Launch speed is at least 200 u/s, or your current speed if higher.",
      "Grapple a trampoline (C): you are pulled straight toward it (other velocity ignored).",
      "On touch, the rope vanishes and the pad launches you along its spring direction.",
      "If the pad despawns mid-grapple, the rope releases automatically.",
      "Campaign boss (after parry lock): Trampoline is disabled.",
    ],
  },
  fire: {
    summary: "Ground fire line or aerial fireball with burn.",
    lines: [
      "On the ground: V fires a wide, tall fire line up to 2× grapple range (lasts 3s).",
      "Line does not hurt you. Enemies take 10 on enter, then 2 every 0.1s while inside.",
      "Leaving after ticks applies a 50% slow for 2s. Boss can be hit if the line is under it.",
      "In the air: V launches a fireball (bomb speed/range/damage), smaller & redder.",
      "Fireball applies BURN: 3 dmg / 0.1s while the target moves, for 4 seconds.",
      "While burn is active, your next hits deal +2 bonus damage (bots, boss, players).",
      "4s cooldown. Campaign boss (after parry lock): Fire is disabled.",
    ],
  },
};

export function AbilitiesPanel({ onClose }: { onClose: () => void }) {
  const selected = useAbility();
  const [detail, setDetail] = useState<AbilityId | null>(null);
  const d = detail ? DETAILS[detail] : null;
  const def = detail ? ABILITY_LIST.find((a) => a.id === detail) : null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 font-mono text-hud backdrop-blur-sm">
      <div className={`flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl border-2 border-crosshair/40 bg-[#0a1210] shadow-2xl ${detail ? "max-w-4xl" : "max-w-2xl"}`}>
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.3em] text-crosshair">TBLE</div>
            <h2 className="text-3xl font-black tracking-tight">Abilities</h2>
          </div>
          <button type="button" className={btn} onClick={onClose}>Close</button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="space-y-3 overflow-y-auto p-6 md:flex-1">
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
                  <div className="flex shrink-0 flex-col gap-2">
                    <button type="button" className={on ? btnOn : btn} onClick={() => setAbility(a.id as AbilityId)}>
                      {on ? "Selected" : "Select"}
                    </button>
                    <button type="button" className={btn} onClick={() => setDetail(a.id)}>
                      Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {detail && d && def && (
            <div className="flex w-full flex-col border-t border-white/10 bg-black/30 md:w-80 md:border-l md:border-t-0">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{def.icon}</span>
                  <span className="text-sm font-black uppercase tracking-wide">{def.name}</span>
                </div>
                <button type="button" className={btn} onClick={() => setDetail(null)}>✕</button>
              </div>
              <div className="overflow-y-auto p-4">
                <p className="text-sm font-bold text-crosshair">{d.summary}</p>
                <ul className="mt-3 space-y-2 text-xs leading-relaxed opacity-80">
                  {d.lines.map((line) => (
                    <li key={line} className="border-l-2 border-crosshair/40 pl-2">{line}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={`mt-4 w-full ${selected === detail ? btnOn : btn}`}
                  onClick={() => setAbility(detail)}
                >
                  {selected === detail ? "Selected" : "Select this ability"}
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="border-t border-white/10 px-6 py-3 text-center text-[10px] font-bold uppercase tracking-widest opacity-50">
          Press V in-game · Default keybind is V (rebind in Settings)
        </div>
      </div>
    </div>
  );
}
