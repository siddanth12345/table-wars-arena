import { useState } from "react";
import { ABILITY_LIST, setAbility, useAbility, type AbilityId } from "./abilities";
import { MASTERY_LINES, achievementFor, hasAchievement, hasMastery, masteryOn, setMasteryOn, useProgress } from "./mastery";
import { G } from "./state";
import { NET } from "./net";

const btn = "rounded-xl border-2 border-white/20 bg-black/50 px-3 py-2 text-sm font-bold uppercase tracking-wide text-white hover:bg-white/10 transition";
const btnOn = "rounded-xl border-2 border-crosshair bg-crosshair/20 px-3 py-2 text-sm font-bold uppercase tracking-wide text-crosshair";

const DETAILS: Record<AbilityId, { summary: string; lines: string[] }> = {
  wall: {
    summary: "Wooden cover you can aim anywhere — floors, ceilings, ramps.",
    lines: [
      "Press V to place a boss-sized wooden wall 5× farther along your crosshair.",
      "Height is 1.6× boss height; thickness is one table. Lasts 2 seconds.",
      "6 charges, then a 3s cooldown. Walls have no friction (usable as ramps).",
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
      "Place up to 3 pads. After all 3, press the ability key again to Reset Trampolines — starts the 5s cooldown and deletes every pad.",
      "Launch speed is at least 200 u/s, or your current speed if higher.",
      "Grapple a trampoline (C), or auto-grapple the nearest pad within 2× grapple range if nothing else is hit.",
      "On touch, the rope vanishes and the pad launches you along its spring direction.",
      "If the pad despawns mid-grapple, the rope releases automatically.",
      "Campaign boss (after parry lock): Trampoline is disabled.",
    ],
  },
  fire: {
    summary: "Ground fire line or aerial fireball (bomb-like) with burn.",
    lines: [
      "On the ground: V fires a wide, tall fire line (5s cooldown). Direct hit does 10 damage.",
      "Line does not hurt you. Ticks while enemies stay inside; leaving slows them.",
      "Boss can be hit if the line is under it.",
      "In the air: V throws a FIREBALL that behaves like the F bomb (same flight/collision), but 0.5× blast size (4s cooldown).",
      "Fireball applies BURN: 3 dmg / 0.1s while the target moves, for 4 seconds.",
      "While burn is active, your hits deal +2 bonus damage.",
      "Campaign boss (after parry lock): Fire is disabled.",
    ],
  },
  teleport: {
    summary: "Launch a purple marker like a bullet, expand, then blink — keep your speed.",
    lines: [
      "Press V aiming within 3.5× grapple range: a purple ball launches like a bullet toward that point.",
      "On arrival it expands (2× table → 4× table), then you teleport there and keep your velocity.",
      "Press V during flight/expand to CANCEL with no cooldown.",
      "After a successful blink: 2.5s cooldown. Press V once during CD to REWIND (does not refresh CD).",
      "Touching a bot, player, or boss during flight or expand stuns them for 2 seconds after you arrive.",
      "Campaign boss (after parry lock): Teleport is disabled.",
    ],
  },
  boss: {
    summary: "A boss-style quarter-room strike on the ground, a bouncing spinning sword in the air, and a stun ring from maximum-area slams.",
    lines: [
      "Unlock by earning the Hardcore achievement: beat the offline campaign boss fight without taking damage (you start the fight at full health, and Combo Burst healing disqualifies the attempt). Always available in training and lobby.",
      "Press V to use it. You have 3 charges. Once they are used up there is a 5s cooldown, then the charges refill.",
      "On the ground, V aims a quarter-room strike (costs 2 charges): a warning sector pointing at your crosshair, starting at the room center, appears for 1 second, then deals 25 damage to enemy bots and enemy players. It never hurts you or teammates, and works at any angle. With only 1 charge left you can't use it on the ground.",
      "In the air, V throws a spinning sword (costs 1 charge) at 350 u/s. Up to 3 can be out at once. It bounces off solid surfaces and flies back to you after 5 bounces.",
      "Anything the sword touches takes 15 damage and gets carried along stuck to it, taking 2 more damage every time the sword bounces off a solid. Swords never hurt you or teammates.",
      "A maximum-area slam creates an expanding purple ring that deals no damage and stuns bots and enemy players it catches for 3 seconds.",
      "In 1v1s and lobbies other players see all of it and get hit. In party campaign and party training nobody on your team is ever hurt or stunned by it.",
      "This ability has no mastery.",
    ],
  },
};

export function AbilitiesPanel({ onClose }: { onClose: () => void }) {
  const selected = useAbility();
  useProgress(); // re-render when a mastery is earned or toggled
  const [detail, setDetail] = useState<AbilityId | null>(null);
  const d = detail ? DETAILS[detail] : null;
  const def = detail ? ABILITY_LIST.find((a) => a.id === detail) : null;
  const masteryAchievement = detail ? achievementFor(detail) : undefined;
  const masteryLines = detail ? MASTERY_LINES[detail] : undefined;

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
              const unlocked = a.id !== "boss" || hasAchievement("hardcore") || G.mode === "training" || NET.kind === "lobby";
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
                    <button type="button" disabled={!unlocked} className={on ? btnOn : btn} onClick={() => { if (unlocked) setAbility(a.id as AbilityId, G.mode === "training" ? "training" : NET.kind === "lobby" ? "lobby" : undefined); }}>
                      {!unlocked ? "Locked 🔒" : on ? "Selected" : "Select"}
                    </button>
                    <button type="button" className={btn} onClick={() => setDetail(a.id)}>
                      Details
                    </button>
                    {a.id !== "boss" && (hasMastery(a.id) ? (
                      <button
                        type="button"
                        className={masteryOn(a.id) ? btnOn : btn}
                        onClick={() => setMasteryOn(a.id, !masteryOn(a.id))}
                        title="Turn this ability's mastery on or off"
                      >
                        Mastery: {masteryOn(a.id) ? "On" : "Off"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={`${btn} cursor-not-allowed opacity-40`}
                        onClick={() => setDetail(a.id)}
                        title={`Earn "${achievementFor(a.id)?.name ?? "the required achievement"}" to unlock`}
                      >
                        Mastery 🔒
                      </button>
                    ))}
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
                <div className="mt-5 border-t border-white/10 pt-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-crosshair">
                    {masteryAchievement?.masteryName ?? "No mastery available"} · {masteryAchievement ? (hasMastery(detail) ? (masteryOn(detail) ? "ON" : "OFF") : "LOCKED") : "N/A"}
                  </div>
                  {masteryAchievement && !hasMastery(detail) && (
                    <p className="mt-1 text-[11px] opacity-70">Unlock it with the “{masteryAchievement.name}” achievement: beat campaign mode using this ability.</p>
                  )}
                  <ul className="mt-2 space-y-2 text-xs leading-relaxed opacity-80">
                    {(masteryLines ?? []).map((line) => (
                      <li key={line} className="border-l-2 border-crosshair/40 pl-2">{line}</li>
                    ))}
                  </ul>
                  {detail !== "boss" && hasMastery(detail) && (
                    <button type="button" className={`mt-3 w-full ${masteryOn(detail) ? btnOn : btn}`} onClick={() => setMasteryOn(detail, !masteryOn(detail))}>
                      Mastery: {masteryOn(detail) ? "On" : "Off"}
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  className={`mt-4 w-full ${selected === detail ? btnOn : btn}`}
                  onClick={() => { if (detail !== "boss" || hasAchievement("hardcore") || G.mode === "training" || NET.kind === "lobby") setAbility(detail, G.mode === "training" ? "training" : NET.kind === "lobby" ? "lobby" : undefined); }}
                  disabled={detail === "boss" && !hasAchievement("hardcore") && G.mode !== "training" && NET.kind !== "lobby"}
                >
                  {detail === "boss" && !hasAchievement("hardcore") && G.mode !== "training" && NET.kind !== "lobby" ? "Locked 🔒" : selected === detail ? "Selected" : "Select this ability"}
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
