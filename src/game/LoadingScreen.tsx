import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { initAccount } from "./account";
import { supabase } from "@/integrations/supabase/client";

const SIZE = 220;

function SpinTable({ spin }: { spin: React.MutableRefObject<number> }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += dt * spin.current;
  });
  return (
    <group ref={g} position={[0, -1.2, 0]}>
      <mesh position={[0, 1.7, 0]}><boxGeometry args={[5, 0.55, 3.4]} /><meshStandardMaterial color="#2fa84f" roughness={0.5} /></mesh>
      {([[-2, 0.6, -1.2], [2, 0.6, -1.2], [-2, 0.6, 1.2], [2, 0.6, 1.2]] as const).map((p, i) => (
        <mesh key={i} position={p}><boxGeometry args={[0.45, 2.6, 0.45]} /><meshStandardMaterial color="#197a37" /></mesh>
      ))}
      {[-0.85, 0.85].map((x) => (
        <group key={x} position={[x, 1.8, 1.72]}>
          <mesh><sphereGeometry args={[0.32, 18, 12]} /><meshStandardMaterial color="#f5f2dc" /></mesh>
          <mesh position={[0, 0, 0.29]}><sphereGeometry args={[0.12, 12, 8]} /><meshStandardMaterial color="#172117" /></mesh>
        </group>
      ))}
    </group>
  );
}

const STEPS = ["Connecting to TBLE servers", "Checking your account", "Opening matchmaking", "Spinning up your private server", "Loading the arena"];

/** Loads the servers while you fling the spinning green table around. */
export function LoadingScreen({ onDone }: { onDone: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const spin = useRef(2.5);
  const phys = useRef({ x: 0, y: 0, vx: 260, vy: 190, drag: false, ox: 0, oy: 0, hist: [] as { x: number; y: number; t: number }[] });
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);

  // real loading work
  useEffect(() => {
    let alive = true;
    const run = async () => {
      const t0 = Date.now();
      const tick = (i: number) => alive && setStep(i);
      tick(0);
      await supabase.auth.getSession().catch(() => null);
      tick(1);
      await initAccount().catch(() => null);
      tick(2);
      await new Promise<void>((resolve) => {
        const ch = supabase.channel("tble:ping");
        const t = setTimeout(() => { void supabase.removeChannel(ch); resolve(); }, 4000);
        ch.subscribe((s) => { if (s === "SUBSCRIBED") { clearTimeout(t); void supabase.removeChannel(ch); resolve(); } });
      });
      tick(3);
      await new Promise((r) => setTimeout(r, 300));
      tick(4);
      await new Promise((r) => setTimeout(r, Math.max(0, 2200 - (Date.now() - t0))));
      if (alive) { setStep(STEPS.length); setReady(true); }
    };
    void run();
    return () => { alive = false; };
  }, []);

  // bouncing physics
  useEffect(() => {
    const P = phys.current;
    P.x = window.innerWidth / 2 - SIZE / 2;
    P.y = window.innerHeight / 3 - SIZE / 2;
    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!P.drag) {
        P.x += P.vx * dt;
        P.y += P.vy * dt;
        const W = window.innerWidth - SIZE, H = window.innerHeight - SIZE;
        if (P.x < 0) { P.x = 0; P.vx = Math.abs(P.vx) * 0.92; spin.current = -spin.current; }
        if (P.x > W) { P.x = W; P.vx = -Math.abs(P.vx) * 0.92; spin.current = -spin.current; }
        if (P.y < 0) { P.y = 0; P.vy = Math.abs(P.vy) * 0.92; }
        if (P.y > H) { P.y = H; P.vy = -Math.abs(P.vy) * 0.92; }
        const sp = Math.hypot(P.vx, P.vy);
        if (sp < 120) { P.vx *= 1.01; P.vy *= 1.01; } // keep it drifting
        if (sp > 3000) { P.vx *= 0.98; P.vy *= 0.98; }
      }
      spin.current = Math.sign(spin.current || 1) * Math.max(2.5, Math.min(18, Math.hypot(P.vx, P.vy) / 90));
      if (box.current) box.current.style.transform = `translate(${P.x}px, ${P.y}px)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const move = (e: PointerEvent) => {
      if (!P.drag) return;
      P.x = e.clientX - P.ox;
      P.y = e.clientY - P.oy;
      P.hist.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      if (P.hist.length > 6) P.hist.shift();
    };
    const up = () => {
      if (!P.drag) return;
      P.drag = false;
      const h = P.hist;
      if (h.length >= 2) {
        const a = h[0]!, b = h[h.length - 1]!;
        const dt = Math.max(0.016, (b.t - a.t) / 1000);
        P.vx = (b.x - a.x) / dt;
        P.vy = (b.y - a.y) / dt;
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, []);

  const grab = (e: React.PointerEvent) => {
    const P = phys.current;
    P.drag = true;
    P.ox = e.clientX - P.x;
    P.oy = e.clientY - P.y;
    P.hist = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
    P.vx = P.vy = 0;
  };

  const pct = Math.round((step / STEPS.length) * 100);
  return (
    <div className="gui fixed inset-0 z-50 select-none overflow-hidden bg-hud-scrim font-mono text-hud" style={{ background: "radial-gradient(circle at 50% 30%, oklch(0.32 0.06 55), oklch(0.12 0.03 55))" }}>
      <div ref={box} onPointerDown={grab} className="absolute left-0 top-0 cursor-grab active:cursor-grabbing" style={{ width: SIZE, height: SIZE, touchAction: "none" }}>
        <Canvas camera={{ position: [6, 4, 8], fov: 40 }} gl={{ alpha: true }}>
          <ambientLight intensity={1.2} />
          <directionalLight position={[5, 10, 6]} intensity={2.2} />
          <SpinTable spin={spin} />
        </Canvas>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 p-10">
        <h1 className="text-7xl font-black tracking-tight">TBLE</h1>
        <p className="text-xs uppercase tracking-widest opacity-70">Drag and throw the table while you wait</p>
        <div className="h-3 w-[min(32rem,80vw)] overflow-hidden rounded-sm bg-hud-track">
          <div className="h-full bg-crosshair transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <div className="text-sm font-bold uppercase tracking-widest">{ready ? "All servers ready" : `${STEPS[step]}…`}</div>
        {ready && (
          <button className="pointer-events-auto rounded bg-crosshair px-10 py-3 text-lg font-black uppercase text-hud-ink" onClick={onDone}>
            Enter
          </button>
        )}
      </div>
    </div>
  );
}
