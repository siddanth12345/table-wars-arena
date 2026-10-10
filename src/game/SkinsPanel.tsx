import { useRef, useState, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  applySkin, useSkin, COLOR_CHART, EYE_DESIGNS, DECORATIONS, LEG_DESIGNS,
  type Skin, type EyeDesign, type TableDecoration, type LegDesign,
} from "./skins";
import { createStageDisc, createTableBot, skinKey } from "./tableBotFactory";

const btn = "rounded-xl border-2 border-white/20 bg-black/50 px-3 py-2 text-sm font-bold uppercase tracking-wide text-white hover:bg-white/10 transition";
const btnOn = "rounded-xl border-2 border-crosshair bg-crosshair/20 px-3 py-2 text-sm font-bold uppercase tracking-wide text-crosshair";

function ColorChart({ value, onPick }: { value: string; onPick: (c: string) => void }) {
  return (
    <div className="grid max-h-48 grid-cols-12 gap-1 overflow-y-auto rounded-lg border border-white/10 bg-black/40 p-2">
      {COLOR_CHART.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          className="h-5 w-5 rounded-sm border border-white/20 transition hover:scale-125"
          style={{ background: c, outline: value.toLowerCase() === c.toLowerCase() ? "2px solid #fff" : undefined }}
          onClick={() => onPick(c)}
        />
      ))}
    </div>
  );
}

function OrbitDrag({ yawRef }: { yawRef: React.MutableRefObject<number> }) {
  const { gl } = useThree();
  const dragging = useRef(false);
  const lastX = useRef(0);

  useEffect(() => {
    const el = gl.domElement;
    const down = (e: PointerEvent) => {
      dragging.current = true;
      lastX.current = e.clientX;
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging.current) return;
      yawRef.current += (e.clientX - lastX.current) * 0.01;
      lastX.current = e.clientX;
    };
    const up = (e: PointerEvent) => {
      dragging.current = false;
      try { el.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [gl, yawRef]);

  return null;
}

function PreviewScene({ skin }: { skin: Skin }) {
  const yawRef = useRef(0);
  const key = skinKey(skin);
  const bot = useMemo(() => createTableBot({ skin, scale: 0.85, emitLight: true, lightIntensity: 1.2 }), [key]);
  const stage = useMemo(() => createStageDisc("#2a2430", skin.lightColor), [skin.lightColor]);
  const root = useRef<THREE.Group>(null);

  useEffect(() => {
    return () => {
      for (const obj of [bot, stage]) {
        obj.traverse((o) => {
          const m = o as { geometry?: { dispose: () => void }; material?: { dispose: () => void } | { dispose: () => void }[] };
          m.geometry?.dispose();
          if (Array.isArray(m.material)) m.material.forEach((x) => x.dispose());
          else m.material?.dispose();
        });
      }
    };
  }, [bot, stage]);

  useFrame(() => {
    if (root.current) root.current.rotation.y = yawRef.current;
  });

  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[6, 12, 4]} intensity={1.4} castShadow />
      <OrbitDrag yawRef={yawRef} />
      <group ref={root}>
        <primitive object={stage} />
        <primitive object={bot} />
      </group>
    </>
  );
}

export function SkinsPanel({ onClose }: { onClose: () => void }) {
  const live = useSkin();
  const [draft, setDraft] = useState<Skin>(() => ({ ...live }));
  const [colorTarget, setColorTarget] = useState<"eyeColor" | "tablePrimary" | "decorationColor" | "lightColor">("tablePrimary");

  const set = <K extends keyof Skin>(key: K, value: Skin[K]) => setDraft((d) => ({ ...d, [key]: value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col gap-4 overflow-y-auto rounded-2xl border border-white/15 bg-[#120e18]/95 p-6 text-white shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black uppercase tracking-wider">Skins</h2>
          <button type="button" className={btn} onClick={onClose}>Close</button>
        </div>

        <div className="relative h-64 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0a0612]">
          <Canvas shadows camera={{ position: [7, 6, 9], fov: 40 }} style={{ width: "100%", height: "100%", cursor: "grab" }}>
            <PreviewScene skin={draft} />
          </Canvas>
          <p className="pointer-events-none absolute bottom-2 left-3 text-[10px] font-bold uppercase tracking-widest text-white/50">
            Drag to rotate · live 3D preview
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-widest opacity-70">Eye design</p>
            <div className="flex flex-wrap gap-2">
              {EYE_DESIGNS.map((e) => (
                <button key={e.id} type="button" className={draft.eyeDesign === e.id ? btnOn : btn} onClick={() => set("eyeDesign", e.id as EyeDesign)}>
                  {e.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-widest opacity-70">Leg design</p>
            <div className="flex flex-wrap gap-2">
              {LEG_DESIGNS.map((e) => (
                <button key={e.id} type="button" className={draft.legDesign === e.id ? btnOn : btn} onClick={() => set("legDesign", e.id as LegDesign)}>
                  {e.label}
                </button>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest opacity-70">Table decoration</p>
            <div className="flex flex-wrap gap-2">
              {DECORATIONS.map((e) => (
                <button key={e.id} type="button" className={draft.decoration === e.id ? btnOn : btn} onClick={() => set("decoration", e.id as TableDecoration)}>
                  {e.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest opacity-70">Color</p>
          <div className="mb-2 flex flex-wrap gap-2">
            {(
              [
                ["eyeColor", "Eye color"],
                ["tablePrimary", "Table primary"],
                ["decorationColor", "Decoration color"],
                ["lightColor", "Table light"],
              ] as const
            ).map(([k, label]) => (
              <button key={k} type="button" className={colorTarget === k ? btnOn : btn} onClick={() => setColorTarget(k)}>
                <span className="mr-2 inline-block h-3 w-3 rounded-sm border border-white/40" style={{ background: draft[k] }} />
                {label}
              </button>
            ))}
          </div>
          <ColorChart value={draft[colorTarget]} onPick={(c) => set(colorTarget, c)} />
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" className={btn} onClick={() => setDraft({ ...live })}>Reset draft</button>
          <button type="button" className={btnOn} onClick={() => { applySkin(draft); onClose(); }}>Save skin</button>
        </div>
      </div>
    </div>
  );
}
