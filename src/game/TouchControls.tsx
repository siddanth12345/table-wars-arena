import { useEffect, useRef, useState } from "react";
import { useSettings, type MobileLayout } from "./settings";
import { MOB } from "./mobileInput";
import { G } from "./state";
import { useSyncExternalStore } from "react";

function useTick(ms: number) {
  return useSyncExternalStore(
    (cb) => { const i = setInterval(cb, ms); return () => clearInterval(i); },
    () => performance.now(),
    () => 0,
  );
}

type Id = keyof MobileLayout;

function Btn({
  id, label, symbol, onDown, onUp, highlight,
}: {
  id: Id; label: string; symbol: string; onDown: () => void; onUp?: () => void; highlight?: boolean;
}) {
  const layout = useSettings().mobileLayout;
  const pos = layout[id] ?? { x: 0.5, y: 0.2 };
  return (
    <button
      type="button"
      aria-label={label}
      className={`pointer-events-auto absolute flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-2xl font-black shadow-lg select-none touch-none ${
        highlight ? "border-yellow-300 bg-yellow-400/40 text-yellow-100" : "border-white/40 bg-black/45 text-white"
      }`}
      style={{ left: `${pos.x * 100}%`, bottom: `${pos.y * 100}%` }}
      onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); onDown(); }}
      onPointerUp={(e) => { e.preventDefault(); onUp?.(); }}
      onPointerCancel={() => onUp?.()}
    >
      {symbol}
    </button>
  );
}

function Stick({ id, onChange }: { id: "move" | "look"; onChange: (x: number, y: number) => void }) {
  const layout = useSettings().mobileLayout;
  const pos = layout[id];
  const base = useRef<HTMLDivElement>(null);
  const origin = useRef({ x: 0, y: 0 });
  const active = useRef(false);

  return (
    <div
      ref={base}
      className="pointer-events-auto absolute h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/30 bg-black/30 touch-none"
      style={{ left: `${pos.x * 100}%`, bottom: `${pos.y * 100}%` }}
      onPointerDown={(e) => {
        e.preventDefault();
        active.current = true;
        origin.current = { x: e.clientX, y: e.clientY };
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!active.current) return;
        const dx = (e.clientX - origin.current.x) / 55;
        const dy = (e.clientY - origin.current.y) / 55;
        const len = Math.hypot(dx, dy) || 1;
        const c = Math.min(1, len);
        onChange((dx / len) * c, (dy / len) * c);
      }}
      onPointerUp={() => { active.current = false; onChange(0, 0); }}
      onPointerCancel={() => { active.current = false; onChange(0, 0); }}
    >
      <div className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/25" />
    </div>
  );
}

function doubleTapTracker() {
  let last = 0;
  return () => {
    const now = performance.now();
    const dbl = now - last < 320;
    last = now;
    return dbl;
  };
}

/** On-screen mobile controls (symbols only). */
export function TouchControls() {
  useTick(50);
  const fireDbl = useRef(doubleTapTracker());
  const jumpDbl = useRef(doubleTapTracker());
  const [fireOn, setFireOn] = useState(false);
  const settings = useSettings();

  useEffect(() => {
    MOB.active = true;
    G.isMobile = true;
    return () => { MOB.active = false; };
  }, []);

  if (G.phase !== "playing" || G.freecam && !G.campaignDead) {
    // still show when freecam dead spectate
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-30 select-none" style={{ touchAction: "none" }}>
      <Stick id="move" onChange={(x, y) => { MOB.moveX = x; MOB.moveY = -y; }} />
      <Stick
        id="look"
        onChange={(x, y) => {
          MOB.lookDX += x * 2.8 * settings.mobileSensitivity;
          MOB.lookDY += y * 2.2 * settings.mobileSensitivity;
        }}
      />
      <Btn
        id="fire"
        label="Fire"
        symbol="⦿"
        highlight={fireOn}
        onDown={() => {
          const dbl = fireDbl.current();
          if (dbl) { MOB.fireDouble = true; MOB.bombTap = true; }
          MOB.fire = true;
          MOB.fireTap = true;
          setFireOn(true);
          if (settings.fireMode === "toggle") {
            G.firing = !G.firing;
          } else {
            G.firing = true;
          }
        }}
        onUp={() => {
          MOB.fire = false;
          setFireOn(false);
          if (settings.fireMode === "hold") G.firing = false;
        }}
      />
      <Btn
        id="jump"
        label="Jump"
        symbol="⬆"
        highlight={G.canGrapple}
        onDown={() => {
          const dbl = jumpDbl.current();
          MOB.jumpTap = true;
          if (dbl) MOB.jumpDouble = true;
        }}
      />
      <Btn id="dash" label="Dash" symbol="⇢" onDown={() => { MOB.dashTap = true; }} />
      <Btn id="reload" label="Reload / Slam" symbol={G.grounded ? "↻" : "⬇"} onDown={() => { MOB.reloadTap = true; }} />
      <Btn id="parry" label="Parry" symbol="⛨" onDown={() => { MOB.parryTap = true; }} />
      <Btn id="bomb" label="Bomb" symbol="⬤" onDown={() => { MOB.bombTap = true; }} />
    </div>
  );
}
