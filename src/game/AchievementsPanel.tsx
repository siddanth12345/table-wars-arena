import { useState } from "react";
import { ACHIEVEMENTS, MASTERY_LINES, hasAchievement, useProgress, type Achievement } from "./mastery";
import { ABILITY_LIST } from "./abilities";
import { useAccount } from "./account";

const btn = "rounded-xl border-2 border-white/20 bg-black/50 px-3 py-2 text-sm font-bold uppercase tracking-wide text-white hover:bg-white/10 transition";

/** Home-screen Achievements tab: the list on the left, a Details panel on the right. */
export function AchievementsPanel({ onClose }: { onClose: () => void }) {
  useProgress(); // re-render when something is earned
  const acc = useAccount();
  const [detail, setDetail] = useState<Achievement | null>(null);
  const earnedCount = ACHIEVEMENTS.filter((a) => hasAchievement(a.id)).length;
  const abilityName = (a: Achievement) => ABILITY_LIST.find((x) => x.id === a.ability)?.name ?? a.ability;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 font-mono text-hud backdrop-blur-sm">
      <div className={`flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl border-2 border-crosshair/40 bg-[#0a1210] shadow-2xl ${detail ? "max-w-4xl" : "max-w-2xl"}`}>
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.3em] text-crosshair">TBLE</div>
            <h2 className="text-3xl font-black tracking-tight">Achievements</h2>
            <div className="mt-1 text-xs opacity-60">{earnedCount} / {ACHIEVEMENTS.length} earned</div>
          </div>
          <button type="button" className={btn} onClick={onClose}>Close</button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="space-y-3 overflow-y-auto p-6 md:flex-1">
            {ACHIEVEMENTS.map((a) => {
              const got = hasAchievement(a.id);
              return (
                <div
                  key={a.id}
                  className={`flex items-center gap-4 rounded-2xl border-2 p-4 transition ${got ? "border-crosshair bg-crosshair/10" : "border-white/15 bg-black/40"}`}
                >
                  <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-black/50 text-3xl ${got ? "" : "opacity-40 grayscale"}`}>
                    {a.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-lg font-black uppercase tracking-wide">{a.name}</div>
                    <p className="mt-1 text-xs leading-relaxed opacity-70">{a.summary}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-crosshair">Gives: {a.masteryName}</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    <div className={`rounded-xl border-2 px-3 py-2 text-center text-xs font-bold uppercase tracking-wide ${got ? "border-crosshair bg-crosshair/20 text-crosshair" : "border-white/15 opacity-60"}`}>
                      {got ? "Earned" : "Locked"}
                    </div>
                    <button type="button" className={btn} onClick={() => setDetail(a)}>
                      Details
                    </button>
                  </div>
                </div>
              );
            })}
            {acc.status !== "user" && (
              <p className="pt-2 text-center text-[11px] leading-relaxed opacity-60">
                You're playing as a guest — achievements and masteries are only kept until you close this tab. Sign in to keep them.
              </p>
            )}
          </div>
          {detail && (
            <div className="flex w-full flex-col border-t border-white/10 bg-black/30 md:w-80 md:border-l md:border-t-0">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{detail.icon}</span>
                  <span className="text-sm font-black uppercase leading-tight tracking-wide">{detail.name}</span>
                </div>
                <button type="button" className={btn} onClick={() => setDetail(null)}>✕</button>
              </div>
              <div className="overflow-y-auto p-4">
                <p className={`text-sm font-bold ${hasAchievement(detail.id) ? "text-crosshair" : "opacity-80"}`}>
                  {hasAchievement(detail.id) ? "Earned" : "Not earned yet"}
                </p>
                <div className="mt-3 text-[10px] font-bold uppercase tracking-widest opacity-60">How to get it</div>
                <p className="mt-1 text-xs leading-relaxed opacity-90">{detail.how}</p>
                <div className="mt-4 text-[10px] font-bold uppercase tracking-widest text-crosshair">Gives you: {detail.masteryName}</div>
                <p className="mt-1 text-[11px] opacity-60">For the {abilityName(detail)} ability. Switch it on or off from the Abilities tab.</p>
                <ul className="mt-2 space-y-2 text-xs leading-relaxed opacity-80">
                  {MASTERY_LINES[detail.ability].map((line) => (
                    <li key={line} className="border-l-2 border-crosshair/40 pl-2">{line}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
