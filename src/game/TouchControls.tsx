import { useEffect, useRef, useState } from "react";
import { useSettings, type MobileLayout } from "./settings";
import { MOB } from "./mobileInput";
import { G } from "./state";
import { NET } from "./net";
import { useSyncExternalStore } from "react";

function useTick(ms: number) {
  return useSyncExternalStore(
    (cb) => { const i = setInterval(cb, ms); return () => clearInterval(i); },
    () => performance.now(),
    () => 0,
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

/** Default on-screen button stack (right side, fits phones). */
const DEFAULT_BTN_POS: Record<string, { x: number; y: number }> = {
  fire: { x: 0.86, y: 0.28 },
  jump: { x: 0.70, y: 0.22 },
  dash: { x: 0.70, y: 0.38 },
  reload: { x: 0.54, y: 0.28 },
  parry: { x: 0.86, y: 0.46 },
  bomb: { x: 0.54, y: 0.46 },
};

type BtnProps = {
  id: keyof MobileLayout;
  label: string;
  icon: string;
  onDown: () => void;
  onUp?: () => void;
  highlight?: boolean;
  size?: "lg" | "md";
};

function ActionBtn({ id, label, icon, onDown, onUp, highlight, size = "md" }: BtnProps) {
  const layout = useSettings().mobileLayout;
  const pos = layout[id] ?? DEFAULT_BTN_POS[id] ?? { x: 0.8, y: 0.3 };
  const dim = size === "lg" ? "h-[4.5rem] w-[4.5rem] text-2xl" : "h-16 w-16 text-xl";
  return (
    <button
      type="button"
      aria-label={label}
      className={`pointer-events-auto absolute flex ${dim} -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 shadow-[0_4px_16px_rgba(0,0,0,0.45)] select-none touch-none backdrop-blur-sm transition active:scale-95 ${
        highlight
          ? "border-yellow-300 bg-gradient-to-b from-yellow-400/50 to-yellow-700/40 text-yellow-50"
          : "border-white/35 bg-gradient-to-b from-white/25 to-black/55 text-white"
      }`}
      style={{ left: `${pos.x * 100}%`, bottom: `${pos.y * 100}%` }}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        onDown();
      }}
      onPointerUp={(e) => { e.preventDefault(); onUp?.(); }}
      onPointerCancel={() => onUp?.()}
    >
      <span className="leading-none drop-shadow">{icon}</span>
      <span className="text-[9px] font-black uppercase tracking-wider opacity-90">{label}</span>
    </button>
  );
}

/**
 * Dynamic move stick: appears where you press in the bottom-left quadrant.
 * Look: drag anywhere else on the screen (Roblox-style).
 */
export function TouchControls() {
  useTick(50);
  const fireDbl = useRef(doubleTapTracker());
  const jumpDbl = useRef(doubleTapTracker());
  const [fireOn, setFireOn] = useState(false);
  const settings = useSettings();

  // Dynamic joystick visual
  const [joy, setJoy] = useState<{ x: number; y: number; kx: number; ky: number; on: boolean }>({
    x: 0, y: 0, kx: 0, ky: 0, on: false,
  });
  const movePtr = useRef<number | null>(null);
  const lookPtr = useRef<number | null>(null);
  const moveOrigin = useRef({ x: 0, y: 0 });
  const lookLast = useRef({ x: 0, y: 0 });
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    MOB.active = true;
    G.isMobile = true;
    return () => { MOB.active = false; };
  }, []);

  if (G.phase !== "playing") return null;
  if (G.mobilePaused) return null;

  const canFreecam =
    G.mode === "training" || NET.kind === "lobby" || NET.kind === "pvp" || G.campaignDead;

  const isInMoveZone = (clientX: number, clientY: number) => {
    const el = rootRef.current;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const nx = (clientX - r.left) / r.width;
    const ny = (clientY - r.top) / r.height;
    // bottom-left quarter (left 48%, bottom 50%)
    return nx < 0.48 && ny > 0.5;
  };

  const onRootDown = (e: React.PointerEvent) => {
    // Ignore if target is a button
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();

    if (isInMoveZone(e.clientX, e.clientY) && movePtr.current === null) {
      movePtr.current = e.pointerId;
      moveOrigin.current = { x: e.clientX, y: e.clientY };
      const el = rootRef.current!;
      const r = el.getBoundingClientRect();
      setJoy({
        on: true,
        x: e.clientX - r.left,
        y: e.clientY - r.top,
        kx: 0,
        ky: 0,
      });
      MOB.moveX = 0;
      MOB.moveY = 0;
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
      return;
    }

    // Look drag (rest of screen)
    if (lookPtr.current === null) {
      lookPtr.current = e.pointerId;
      lookLast.current = { x: e.clientX, y: e.clientY };
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
    }
  };

  const onRootMove = (e: React.PointerEvent) => {
    if (e.pointerId === movePtr.current) {
      const dx = (e.clientX - moveOrigin.current.x) / 70;
      const dy = (e.clientY - moveOrigin.current.y) / 70;
      const len = Math.hypot(dx, dy) || 1;
      const c = Math.min(1, len);
      const mx = (dx / len) * c;
      const my = (dy / len) * c;
      MOB.moveX = mx;
      MOB.moveY = -my;
      setJoy((j) => ({ ...j, kx: mx * 36, ky: my * 36 }));
      return;
    }
    if (e.pointerId === lookPtr.current) {
      const dx = e.clientX - lookLast.current.x;
      const dy = e.clientY - lookLast.current.y;
      lookLast.current = { x: e.clientX, y: e.clientY };
      const sens = settings.mobileSensitivity ?? 1.15;
      MOB.lookDX += dx * 0.055 * sens;
      MOB.lookDY += dy * 0.045 * sens;
    }
  };

  const onRootUp = (e: React.PointerEvent) => {
    if (e.pointerId === movePtr.current) {
      movePtr.current = null;
      MOB.moveX = 0;
      MOB.moveY = 0;
      setJoy((j) => ({ ...j, on: false, kx: 0, ky: 0 }));
    }
    if (e.pointerId === lookPtr.current) {
      lookPtr.current = null;
    }
  };

  return (
    <div
      ref={rootRef}
      className="pointer-events-auto absolute inset-0 z-30 select-none"
      style={{ touchAction: "none" }}
      onPointerDown={onRootDown}
      onPointerMove={onRootMove}
      onPointerUp={onRootUp}
      onPointerCancel={onRootUp}
    >
      {/* Dynamic move joystick */}
      {joy.on && (
        <div
          className="pointer-events-none absolute h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/40 bg-black/35 shadow-inner"
          style={{ left: joy.x, top: joy.y }}
        >
          <div
            className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/70 bg-white/35 shadow-lg"
            style={{ transform: `translate(calc(-50% + ${joy.kx}px), calc(-50% + ${joy.ky}px))` }}
          />
        </div>
      )}

      {/* Pause */}
      <button
        type="button"
        aria-label="Pause"
        className="pointer-events-auto absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-40 flex h-12 w-12 flex-col items-center justify-center rounded-xl border-2 border-white/40 bg-black/55 text-white shadow-lg touch-none"
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          G.mobilePaused = true;
          G.locked = false;
        }}
      >
        <span className="text-lg leading-none">❚❚</span>
        <span className="text-[8px] font-black uppercase">Pause</span>
      </button>

      {/* Freecam */}
      {canFreecam && (
        <button
          type="button"
          aria-label="Camera"
          className={`pointer-events-auto absolute left-3 top-[max(0.75rem,env(safe-area-inset-top))] z-40 flex h-12 w-12 flex-col items-center justify-center rounded-xl border-2 shadow-lg touch-none ${
            G.freecam ? "border-yellow-300 bg-yellow-500/40 text-yellow-50" : "border-white/40 bg-black/55 text-white"
          }`}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (G.campaignDead) { G.freecam = true; return; }
            G.freecam = !G.freecam;
            if (!G.freecam) G.freecamSpeedIdx = 0;
          }}
        >
          <span className="text-lg leading-none">📷</span>
          <span className="text-[8px] font-black uppercase">Cam</span>
        </button>
      )}

      {/* Action buttons — right side cluster */}
      <ActionBtn
        id="fire"
        label="Fire"
        icon="⦿"
        size="lg"
        highlight={fireOn}
        onDown={() => {
          const dbl = fireDbl.current();
          if (dbl) { MOB.fireDouble = true; MOB.bombTap = true; }
          MOB.fire = true;
          MOB.fireTap = true;
          setFireOn(true);
          if (settings.fireMode === "toggle") G.firing = !G.firing;
          else G.firing = true;
        }}
        onUp={() => {
          MOB.fire = false;
          setFireOn(false);
          if (settings.fireMode === "hold") G.firing = false;
        }}
      />
      <ActionBtn
        id="jump"
        label="Jump"
        icon="⬆"
        highlight={G.canGrapple}
        onDown={() => {
          const dbl = jumpDbl.current();
          MOB.jumpTap = true;
          if (dbl) MOB.jumpDouble = true;
        }}
      />
      <ActionBtn id="dash" label="Dash" icon="⇢" onDown={() => { MOB.dashTap = true; }} />
      <ActionBtn
        id="reload"
        label={G.grounded ? "Reload" : "Slam"}
        icon={G.grounded ? "↻" : "⬇"}
        onDown={() => { MOB.reloadTap = true; }}
      />
      <ActionBtn id="parry" label="Parry" icon="⛨" onDown={() => { MOB.parryTap = true; }} />
      <ActionBtn id="bomb" label="Bomb" icon="⬤" onDown={() => { MOB.bombTap = true; }} />

      {/* Hint strip */}
      <div className="pointer-events-none absolute bottom-1 left-1/2 max-w-[90%] -translate-x-1/2 rounded bg-black/40 px-2 py-0.5 text-center text-[9px] font-bold uppercase tracking-wide text-white/50">
        Left half · move · rest of screen · look
      </div>
    </div>
  );
}
