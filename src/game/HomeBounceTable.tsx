import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { noteHomeTableBounce } from "./mastery";

const SIZE = 160;

function SpinTable({ spin }: { spin: React.MutableRefObject<number> }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += dt * spin.current;
  });
  return (
    <group ref={g} position={[0, -1.0, 0]}>
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[4.5, 0.5, 3]} />
        <meshStandardMaterial color="#2fa84f" roughness={0.5} />
      </mesh>
      {([[-1.8, 0.55, -1.0], [1.8, 0.55, -1.0], [-1.8, 0.55, 1.0], [1.8, 0.55, 1.0]] as const).map((p, i) => (
        <mesh key={i} position={p}>
          <boxGeometry args={[0.4, 2.2, 0.4]} />
          <meshStandardMaterial color="#197a37" />
        </mesh>
      ))}
    </group>
  );
}

/** Flingable green table on the home menu — wall hits count toward a secret achievement. */
export function HomeBounceTable() {
  const box = useRef<HTMLDivElement>(null);
  const spin = useRef(2.2);
  const phys = useRef({ x: 40, y: 40, vx: 180, vy: 140, drag: false, ox: 0, oy: 0, hist: [] as { x: number; y: number; t: number }[] });

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const el = box.current;
      if (!el) return;
      const parent = el.parentElement;
      if (!parent) return;
      const W = Math.max(40, parent.clientWidth - SIZE);
      const H = Math.max(40, parent.clientHeight - SIZE);
      const P = phys.current;
      if (!P.drag) {
        P.x += P.vx * 0.016;
        P.y += P.vy * 0.016;
        if (P.x < 0) { P.x = 0; P.vx = Math.abs(P.vx) * 0.92; spin.current = -spin.current; noteHomeTableBounce(); }
        if (P.x > W) { P.x = W; P.vx = -Math.abs(P.vx) * 0.92; spin.current = -spin.current; noteHomeTableBounce(); }
        if (P.y < 0) { P.y = 0; P.vy = Math.abs(P.vy) * 0.92; noteHomeTableBounce(); }
        if (P.y > H) { P.y = H; P.vy = -Math.abs(P.vy) * 0.92; noteHomeTableBounce(); }
        spin.current = Math.sign(spin.current || 1) * Math.max(2.0, Math.min(16, Math.hypot(P.vx, P.vy) / 90));
      }
      el.style.transform = `translate(${P.x}px, ${P.y}px)`;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const grab = (e: React.PointerEvent) => {
    const P = phys.current;
    P.drag = true;
    P.ox = e.clientX - P.x;
    P.oy = e.clientY - P.y;
    P.hist = [];
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const P = phys.current;
    if (!P.drag) return;
    P.x = e.clientX - P.ox;
    P.y = e.clientY - P.oy;
    P.hist.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    if (P.hist.length > 6) P.hist.shift();
  };
  const release = (e: React.PointerEvent) => {
    const P = phys.current;
    if (!P.drag) return;
    P.drag = false;
    const h = P.hist;
    if (h.length >= 2) {
      const a = h[0]!, b = h[h.length - 1]!;
      const dt = Math.max(16, b.t - a.t);
      P.vx = ((b.x - a.x) / dt) * 1000;
      P.vy = ((b.y - a.y) / dt) * 1000;
    }
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      <div
        ref={box}
        onPointerDown={grab}
        onPointerMove={move}
        onPointerUp={release}
        onPointerCancel={release}
        className="pointer-events-auto absolute left-0 top-0 cursor-grab active:cursor-grabbing"
        style={{ width: SIZE, height: SIZE, touchAction: "none" }}
        title="Fling the table"
      >
        <Canvas camera={{ position: [5, 3.5, 7], fov: 40 }} dpr={[1, 1.25]} gl={{ alpha: true, antialias: false }}>
          <ambientLight intensity={1.1} />
          <directionalLight position={[5, 10, 6]} intensity={2} />
          <SpinTable spin={spin} />
        </Canvas>
      </div>
    </div>
  );
}
