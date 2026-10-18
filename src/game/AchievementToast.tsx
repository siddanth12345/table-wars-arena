import { useEffect, useRef, useState } from "react";
import { onAchievement, type Achievement } from "./mastery";
import { playSfx } from "./sfx";

/** Small pop-up in the top-right corner: slides in, stays 2s, slides out to the right. Queues if several arrive. */
export function AchievementToast() {
  const [cur, setCur] = useState<Achievement | null>(null);
  const [shown, setShown] = useState(false);
  const queue = useRef<Achievement[]>([]);
  const busy = useRef(false);

  const next = useRef<() => void>(() => {});
  next.current = () => {
    const a = queue.current.shift();
    if (!a) { busy.current = false; return; }
    busy.current = true;
    setCur(a);
    setShown(false);
    playSfx("shard_pickup");
    setTimeout(() => setShown(true), 30); // slide in
    setTimeout(() => setShown(false), 30 + 450 + 2000); // stay 2s, then slide out to the right
    setTimeout(() => { setCur(null); next.current(); }, 30 + 450 + 2000 + 500);
  };

  useEffect(() => onAchievement((a) => {
    queue.current.push(a);
    if (!busy.current) next.current();
  }), []);

  if (!cur) return null;
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] w-72 max-w-[80vw] font-mono text-hud">
      <div
        className="flex items-center gap-3 rounded-xl border-2 border-crosshair bg-[#0a1210]/95 p-3 shadow-2xl transition-transform duration-[450ms] ease-out"
        style={{ transform: shown ? "translateX(0)" : "translateX(calc(100% + 2rem))" }}
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-black/50 text-2xl">{cur.icon}</div>
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-crosshair">Achievement unlocked</div>
          <div className="text-sm font-black uppercase leading-tight">{cur.name}</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-widest opacity-70">{cur.masteryName} earned</div>
        </div>
      </div>
    </div>
  );
}
