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

/** Safe default positions — all in the lower-right, fully on-screen for large buttons. */
const DEFAULT_BTN_POS: Record<string, { x: number; y: number }> = {
  fire: { x: 0.82, y: 0.20 },
  jump: { x: 0.62, y: 0.18 },
  dash: { x: 0.62, y: 0.36 },
  reload: { x: 0.42, y: 0.22 },
  parry: { x: 0.82, y: 0.40 },
  bomb: { x: 0.42, y: 0.40 },
};

/** Clamp so a button of `halfPct` of screen stays fully visible. */
function clampPos(x: number, y: number, halfX = 0.12, halfY = 0.10) {
  return {
    x: Math.min(1 - halfX, Math.max(halfX, x)),
    y: Math.min(0.48, Math.max(halfY, y)), // keep action buttons in lower half
  };
}

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
  const raw = layout[id] ?? DEFAULT_BTN_POS[id] ?? { x: 0.8, y: 0.25 };
  const pos = clampPos(raw.x, raw.y);
  // ~2.5× previous sizes (was ~4rem / 4.5rem)
  const dim =
    size === "lg"
      ? "h-[min(22vw,7.5rem)] w-[min(22vw,7.5rem)] text-3xl"
      : "h-[min(18vw,6.25rem)] w-[min(18vw,6.25rem)] text-2xl";

  return (
    <button
      type="button"
      aria-label={label}
      className={`pointer-events-auto absolute flex ${dim} -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-1 rounded-[1.25rem] border-[3px] shadow-[0_6px_20px_rgba(0,0,0,0.5)] select-none touch-none backdrop-blur-sm transition active:scale-95 ${
        highlight
          ? "border-yellow-300 bg-gradient-to-b from-yellow-400/55 to-yellow-800/45 text-yellow-50"
          : "border-white/40 bg-gradient-to-b from-white/30 to-black/60 text-white"
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
      <span className="leading-none drop-shadow-md">{icon}</span>
      <span className="text-[10px] font-black uppercase tracking-wider opacity-95">{label}</span>
    </button>
  );
}

export function TouchControls() {
  useTick(50);
  const fireDbl = useRef(doubleTapTracker());
  const jumpDbl = useRef(doubleTapTracker());
  const [fireOn, setFireOn] = useState(false);
  const settings = useSettings();

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
    return nx < 0.48 && ny > 0.48;
  };

  const onRootDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();

    if (isInMoveZone(e.clientX, e.clientY) && movePtr.current === null) {
      movePtr.current = e.pointerId;
      moveOrigin.current = { x: e.clientX, y: e.clientY };
      const r = rootRef.current!.getBoundingClientRect();
      setJoy({ on: true, x: e.clientX - r.left, y: e.clientY - r.top, kx: 0, ky: 0 });
      MOB.moveX = 0;
      MOB.moveY = 0;
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* */ }
      return;
    }

    if (lookPtr.current === null) {
      lookPtr.current = e.pointerId;
      lookLast.current = { x: e.clientX, y: e.clientY };
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* */ }
    }
  };

  const onRootMove = (e: React.PointerEvent) => {
    if (e.pointerId === movePtr.current) {
      const dx = (e.clientX - moveOrigin.current.x) / 80;
      const dy = (e.clientY - moveOrigin.current.y) / 80;
      const len = Math.hypot(dx, dy) || 1;
      const c = Math.min(1, len);
      const mx = (dx / len) * c;
      const my = (dy / len) * c;
      MOB.moveX = mx;
      MOB.moveY = -my;
      setJoy((j) => ({ ...j, kx: mx * 40, ky: my * 40 }));
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
    if (e.pointerId === lookPtr.current) lookPtr.current = null;
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
      {joy.on && (
        <div
          className="pointer-events-none absolute h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white/45 bg-black/40 shadow-inner"
          style={{ left: joy.x, top: joy.y }}
        >
          <div
            className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white/80 bg-white/40 shadow-lg"
            style={{ transform: `translate(calc(-50% + ${joy.kx}px), calc(-50% + ${joy.ky}px))` }}
          />
        </div>
      )}

      <button
        type="button"
        aria-label="Pause"
        className="pointer-events-auto absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-40 flex h-14 w-14 flex-col items-center justify-center rounded-2xl border-[3px] border-white/40 bg-black/60 text-white shadow-lg touch-none"
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          G.mobilePaused = true;
          G.locked = false;
        }}
      >
        <span className="text-xl leading-none">❚❚</span>
        <span className="text-[9px] font-black uppercase">Pause</span>
      </button>

      {canFreecam && (
        <button
          type="button"
          aria-label="Camera"
          className={`pointer-events-auto absolute left-3 top-[max(0.75rem,env(safe-area-inset-top))] z-40 flex h-14 w-14 flex-col items-center justify-center rounded-2xl border-[3px] shadow-lg touch-none ${
            G.freecam ? "border-yellow-300 bg-yellow-500/45 text-yellow-50" : "border-white/40 bg-black/60 text-white"
          }`}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (G.campaignDead) { G.freecam = true; return; }
            G.freecam = !G.freecam;
            if (!G.freecam) G.freecamSpeedIdx = 0;
          }}
        >
          <span className="text-xl leading-none">📷</span>
          <span className="text-[9px] font-black uppercase">Cam</span>
        </button>
      )}

      <ActionBtn id="fire" label="Fire" icon="⦿" size="lg" highlight={fireOn}
        onDown={() => {
          const dbl = fireDbl.current();
          if (dbl) { MOB.fireDouble = true; MOB.bombTap = true; }
          MOB.fire = true; MOB.fireTap = true; setFireOn(true);
          if (settings.fireMode === "toggle") G.firing = !G.firing;
          else G.firing = true;
        }}
        onUp={() => {
          MOB.fire = false; setFireOn(false);
          if (settings.fireMode === "hold") G.firing = false;
        }}
      />
      <ActionBtn id="jump" label="Jump" icon="⬆" highlight={G.canGrapple}
        onDown={() => {
          const dbl = jumpDbl.current();
          MOB.jumpTap = true;
          if (dbl) MOB.jumpDouble = true;
        }}
      />
      <ActionBtn id="dash" label="Dash" icon="⇢" onDown={() => { MOB.dashTap = true; }} />
      <ActionBtn id="reload" label={G.grounded ? "Reload" : "Slam"} icon={G.grounded ? "↻" : "⬇"}
        onDown={() => { MOB.reloadTap = true; }}
      />
      <ActionBtn id="parry" label="Parry" icon="⛨" onDown={() => { MOB.parryTap = true; }} />
      <ActionBtn id="bomb" label="Bomb" icon="⬤" onDown={() => { MOB.bombTap = true; }} />
    </div>
  );
}
