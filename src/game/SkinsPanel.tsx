import { useRef, useState, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  applySkin, useSkin, COLOR_CHART, LAVA_COLOR, isLavaColor, EYE_DESIGNS, DECORATIONS, TOP_DECORATIONS, LEG_DESIGNS,
  type Skin, type EyeDesign, type TableDecoration, type TopDecoration, type LegDesign,
} from "./skins";
import { decorationUnlocked, legUnlocked, useProgress, hasAchievement } from "./mastery";
import { createStageDisc, createTableBot, skinKey, animateLavaMaterials } from "./tableBotFactory";

const btn = "rounded-xl border-2 border-white/20 bg-black/50 px-3 py-2 text-sm font-bold uppercase tracking-wide text-white hover:bg-white/10 transition";
const btnOn = "rounded-xl border-2 border-crosshair bg-crosshair/20 px-3 py-2 text-sm font-bold uppercase tracking-wide text-crosshair";
const btnLocked = "rounded-xl border-2 border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm font-bold uppercase tracking-wide text-amber-200/90 hover:bg-amber-500/20 transition";
const btnLockedOn = "rounded-xl border-2 border-amber-400 bg-amber-500/25 px-3 py-2 text-sm font-bold uppercase tracking-wide text-amber-100";

function ColorChart({
  value, onPick, allowLava,
}: { value: string; onPick: (c: string) => void; allowLava?: boolean }) {
  const lavaUnlocked = hasAchievement("hacker");
  const lavaSelected = isLavaColor(value);
  return (
    <div className="space-y-2">
      {allowLava && (
        <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/40 p-2">
          <button
            type="button"
            title={lavaUnlocked ? "Lava (animated)" : "Locked — unlock with ???"}
            className="relative h-10 w-10 shrink-0 cursor-pointer rounded-md transition hover:scale-105"
            style={{
              background: "linear-gradient(145deg, #1a0500 0%, #ff4500 45%, #ffcc00 100%)",
              // Always glow; selected gets a stronger rim (preview allowed even when locked)
              boxShadow: lavaSelected
                ? (lavaUnlocked
                  ? "0 0 0 3px #fff, 0 0 18px 4px rgba(255,80,0,0.95), 0 0 28px rgba(255,40,0,0.6)"
                  : "0 0 0 3px #f59e0b, 0 0 14px 3px rgba(245,158,11,0.7)")
                : "0 0 0 2px rgba(255,100,40,0.9), 0 0 14px 3px rgba(255,60,0,0.75)",
              opacity: lavaUnlocked || lavaSelected ? 1 : 0.75,
            }}
            onClick={() => onPick(LAVA_COLOR)}
          >
            {!lavaUnlocked && (
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white/90">🔒</span>
            )}
          </button>
          <div className="text-[10px] leading-snug opacity-70">
            <div className="font-black uppercase tracking-wide text-orange-300">Lava</div>
            {lavaUnlocked
              ? "Animated table primary"
              : lavaSelected
                ? "Preview only — deselect to save · Unlock with ???"
                : "Unlock with ???"}
          </div>
        </div>
      )}
      <div className="grid max-h-40 grid-cols-12 gap-1 overflow-y-auto rounded-lg border border-white/10 bg-black/40 p-2">
        {COLOR_CHART.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            className="h-5 w-5 rounded-sm border border-white/20 transition hover:scale-125"
            style={{ background: c, outline: !lavaSelected && value.toLowerCase() === c.toLowerCase() ? "2px solid #fff" : undefined }}
            onClick={() => onPick(c)}
          />
        ))}
      </div>
    </div>
  );
}

function OrbitDrag({
  yawRef,
  distRef,
}: {
  yawRef: React.MutableRefObject<number>;
  distRef: React.MutableRefObject<number>;
}) {
  const { gl, camera } = useThree();
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
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      // Scroll up = zoom in, scroll down = zoom out
      const next = distRef.current + e.deltaY * 0.012;
      distRef.current = Math.min(22, Math.max(4.5, next));
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
    };
  }, [gl, yawRef, distRef]);

  useFrame(() => {
    // Keep camera looking at the stage center while distance changes
    const d = distRef.current;
    const elev = 0.45; // slight top-down
    camera.position.set(0, d * elev, d);
    camera.lookAt(0, 1.2, 0);
  });

  return null;
}

function PreviewScene({ skin }: { skin: Skin }) {
  const yawRef = useRef(0);
  const distRef = useRef(11);
  const key = skinKey(skin);
  const bot = useMemo(() => createTableBot({ skin, scale: 1.05, emitLight: true, lightIntensity: 1.4 }), [key]);
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
    if (root.current) {
      root.current.rotation.y = yawRef.current;
      animateLavaMaterials(root.current);
    }
  });

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[6, 12, 4]} intensity={1.5} castShadow />
      <OrbitDrag yawRef={yawRef} distRef={distRef} />
      <group ref={root} position={[0, -0.4, 0]}>
        <primitive object={stage} />
        <primitive object={bot} />
      </group>
    </>
  );
}

export function SkinsPanel({ onClose }: { onClose: () => void }) {
  useProgress();
  const live = useSkin();
  const [draft, setDraft] = useState<Skin>(() => ({ ...live, topDecoration: live.topDecoration ?? "none" }));
  const [colorTarget, setColorTarget] = useState<"eyeColor" | "tablePrimary" | "decorationColor" | "lightColor">("tablePrimary");
  const [saveHint, setSaveHint] = useState("");

  const set = <K extends keyof Skin>(key: K, value: Skin[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setSaveHint("");
  };

  // Locked deco / lava selected for preview only — block save until cleared
  const decoLocked = !decorationUnlocked(draft.decoration);
  const topLocked = draft.decoration === "stack" && !decorationUnlocked(draft.topDecoration ?? "none");
  const legLocked = !legUnlocked(draft.legDesign);
  const lavaLocked = isLavaColor(draft.tablePrimary) && !hasAchievement("hacker");
  const canSave = !decoLocked && !topLocked && !legLocked && !lavaLocked;

  const trySave = () => {
    if (!canSave) {
      setSaveHint(
        lavaLocked
          ? "Lava is locked (???) — pick another table color to save."
          : "Unlock that decoration (or pick an unlocked one) before saving.",
      );
      return;
    }
    applySkin(draft);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-4">
      <div className="flex h-[min(92vh,920px)] w-full max-w-6xl overflow-hidden rounded-2xl border border-white/15 bg-[#120e18] text-white shadow-2xl">
        {/* LEFT — editor */}
        <div className="flex w-full max-w-md flex-col border-r border-white/10 sm:w-[42%] sm:max-w-none">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <h2 className="text-2xl font-black uppercase tracking-wider">Skins</h2>
          </div>
          <div className="flex-1 space-y-5 overflow-y-auto p-5">
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
                {LEG_DESIGNS.map((e) => {
                  const locked = !legUnlocked(e.id);
                  const selected = draft.legDesign === e.id;
                  const cls = locked ? (selected ? btnLockedOn : btnLocked) : (selected ? btnOn : btn);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      title={locked ? `Preview only — needs ${e.needs ?? "achievement"} to save` : e.label}
                      className={cls}
                      onClick={() => set("legDesign", e.id as LegDesign)}
                    >
                      {locked ? `🔒 ${e.label}` : e.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest opacity-70">Table decoration</p>
              <div className="flex flex-wrap gap-2">
                {DECORATIONS.map((e) => {
                  const locked = !decorationUnlocked(e.id);
                  const selected = draft.decoration === e.id;
                  const cls = locked
                    ? (selected ? btnLockedOn : btnLocked)
                    : (selected ? btnOn : btn);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      title={locked ? `Preview only — needs ${e.needs ?? "achievement"} to save` : e.label}
                      className={cls}
                      onClick={() => set("decoration", e.id as TableDecoration)}
                    >
                      {locked ? `🔒 ${e.label}` : e.label}
                    </button>
                  );
                })}
              </div>
              {draft.decoration === "stack" && (
                <div className="mt-3">
                  <p className="mb-2 text-xs font-bold uppercase tracking-widest opacity-70">Top table decoration</p>
                  <div className="flex flex-wrap gap-2">
                    {TOP_DECORATIONS.map((e) => {
                      const locked = !decorationUnlocked(e.id);
                      const selected = (draft.topDecoration ?? "none") === e.id;
                      const cls = locked
                        ? (selected ? btnLockedOn : btnLocked)
                        : (selected ? btnOn : btn);
                      return (
                        <button
                          key={e.id}
                          type="button"
                          title={locked ? `Preview only — needs ${e.needs ?? "achievement"}` : e.label}
                          className={cls}
                          onClick={() => set("topDecoration", e.id as TopDecoration)}
                        >
                          {locked ? `🔒 ${e.label}` : e.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {(decoLocked || topLocked) && (
                <p className="mt-2 text-[11px] leading-relaxed text-amber-200/90">
                  Locked decoration is only a preview. Earn the achievement to save it.
                </p>
              )}
              {legLocked && (
                <p className="mt-2 text-[11px] leading-relaxed text-amber-200/90">
                  Locked leg design is only a preview. Earn the achievement to save it.
                </p>
              )}
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
              <ColorChart value={draft[colorTarget]} onPick={(c) => set(colorTarget, c)} allowLava={colorTarget === "tablePrimary"} />
            </div>
          </div>

          <div className="border-t border-white/10 px-5 py-4">
            {saveHint && <p className="mb-2 text-xs text-amber-300">{saveHint}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className={btn} onClick={() => { setDraft({ ...live, topDecoration: live.topDecoration ?? "none" }); setSaveHint(""); }}>
                Reset draft
              </button>
              <button
                type="button"
                className={canSave ? btnOn : `${btn} opacity-50 cursor-not-allowed`}
                onClick={trySave}
                title={canSave ? "Save skin" : "Cannot save while a locked color or decoration is selected"}
              >
                Save skin
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT — large live 3D preview */}
        <div className="relative hidden min-w-0 flex-1 flex-col bg-[#0a0612] sm:flex">
          <div className="absolute right-3 top-3 z-10">
            <button type="button" className={btn} onClick={onClose}>Close</button>
          </div>
          <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-full border border-white/10 bg-black/50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white/70">
            Drag to rotate · Scroll to zoom · Live 3D preview
          </div>
          <Canvas
            className="h-full w-full flex-1"
            camera={{ position: [0, 5.5, 11], fov: 38 }}
            gl={{ antialias: true }}
          >
            <PreviewScene skin={draft} />
          </Canvas>
        </div>

        {/* Mobile: close + compact preview under editor if needed */}
        <button type="button" className={`${btn} absolute right-4 top-4 z-20 sm:hidden`} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
