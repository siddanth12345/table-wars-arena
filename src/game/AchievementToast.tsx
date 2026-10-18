import { useEffect, useRef, useState } from "react";
import { onAchievement, type Achievement } from "./mastery";
import { playSfx } from "./sfx";

type Item = { key: number; a: Achievement; shown: boolean };

/** Stack of achievement pop-ups (top-right). Multiple unlocks slide in one under the other. */
export function AchievementToast() {
  const [items, setItems] = useState<Item[]>([]);
  const keyRef = useRef(0);

  useEffect(() => onAchievement((a) => {
    const key = ++keyRef.current;
    playSfx("shard_pickup");
    setItems((prev) => [...prev, { key, a, shown: false }]);
    // slide in
    setTimeout(() => {
      setItems((prev) => prev.map((it) => (it.key === key ? { ...it, shown: true } : it)));
    }, 30);
    // slide out after 2.5s
    setTimeout(() => {
      setItems((prev) => prev.map((it) => (it.key === key ? { ...it, shown: false } : it)));
    }, 30 + 450 + 2500);
    // remove
    setTimeout(() => {
      setItems((prev) => prev.filter((it) => it.key !== key));
    }, 30 + 450 + 2500 + 500);
  }), []);

  if (!items.length) return null;
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-72 max-w-[80vw] flex-col gap-2 font-mono text-hud">
      {items.map((it) => {
        const dark = it.a.id === "hacker";
        return (
          <div
            key={it.key}
            className={`flex items-center gap-3 rounded-xl border-2 p-3 shadow-2xl transition-transform duration-[450ms] ease-out ${
              dark ? "border-white/30 bg-[#0a0a0c]/95" : "border-crosshair bg-[#0a1210]/95"
            }`}
            style={{ transform: it.shown ? "translateX(0)" : "translateX(calc(100% + 2rem))" }}
          >
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border text-2xl ${dark ? "border-white/20 bg-black/80" : "border-white/20 bg-black/50"}`}>
              {it.a.icon}
            </div>
            <div className="min-w-0">
              <div className={`text-[10px] font-bold uppercase tracking-[0.25em] ${dark ? "text-white/50" : "text-crosshair"}`}>Achievement unlocked</div>
              <div className="text-sm font-black uppercase leading-tight">{it.a.name}</div>
              {it.a.masteryName ? (
                <div className="mt-0.5 text-[10px] uppercase tracking-widest opacity-70">{it.a.masteryName} earned</div>
              ) : it.a.summary ? (
                <div className="mt-0.5 text-[10px] opacity-70">{it.a.summary}</div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
