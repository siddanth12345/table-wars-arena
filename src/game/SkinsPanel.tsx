import { useState } from "react";
import {
  applySkin, useSkin, COLOR_CHART, EYE_DESIGNS, DECORATIONS, LEG_DESIGNS,
  type Skin, type EyeDesign, type TableDecoration, type LegDesign,
} from "./skins";

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

/** Live 3D-style CSS preview of the table bot on a circular stage. */
function SkinPreview({ skin }: { skin: Skin }) {
  const legCount = skin.legDesign === "oneleg" ? 1 : skin.legDesign === "minimal" ? 2 : 4;
  return (
    <div className="relative flex h-56 w-full items-end justify-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#1a1020] to-[#0a0610]">
      {/* stage */}
      <div
        className="absolute bottom-6 h-4 w-40 rounded-full opacity-80"
        style={{ background: `radial-gradient(ellipse, ${skin.lightColor}88, transparent 70%)`, boxShadow: `0 0 40px ${skin.lightColor}` }}
      />
      <div className="absolute bottom-4 h-3 w-36 rounded-full bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] shadow-lg" />
      {/* table model */}
      <div className="relative mb-8 flex flex-col items-center" style={{ filter: `drop-shadow(0 0 12px ${skin.lightColor}aa)` }}>
        {/* eyes */}
        <div className="mb-1 flex gap-3">
          {[-1, 1].map((side) => {
            if (skin.eyeDesign === "triangle") {
              return (
                <div
                  key={side}
                  className="h-0 w-0 border-l-[8px] border-r-[8px] border-b-[12px] border-l-transparent border-r-transparent"
                  style={{ borderBottomColor: skin.eyeColor, transform: `rotate(${side * 12}deg)` }}
                />
              );
            }
            if (skin.eyeDesign === "square") {
              return <div key={side} className="h-3 w-3 rounded-sm" style={{ background: skin.eyeColor, boxShadow: `0 0 8px ${skin.eyeColor}` }} />;
            }
            // boss eyes — slanted bars
            return (
              <div
                key={side}
                className="h-1.5 w-5 rounded-sm"
                style={{ background: skin.eyeColor, boxShadow: `0 0 8px ${skin.eyeColor}`, transform: `rotate(${side * -20}deg)` }}
              />
            );
          })}
        </div>
        {/* tabletop */}
        <div className="relative h-4 w-28 rounded-sm border border-black/30" style={{ background: skin.tablePrimary }}>
          {skin.decoration === "plates" && (
            <div className="absolute inset-0 flex items-center justify-center gap-2">
              <div className="h-2 w-2 rounded-full" style={{ background: skin.decorationColor }} />
              <div className="h-2 w-2 rounded-full" style={{ background: skin.decorationColor }} />
            </div>
          )}
          {skin.decoration === "rug" && (
            <div className="absolute inset-x-2 top-0.5 h-3 rounded-sm opacity-70" style={{ background: skin.decorationColor }} />
          )}
          {skin.decoration === "office" && (
            <div className="absolute left-1/2 top-0.5 h-2.5 w-6 -translate-x-1/2 rounded-sm border border-black/40" style={{ background: skin.decorationColor }} />
          )}
          {skin.decoration === "birthday" && (
            <div className="absolute left-1/2 top-0 flex -translate-x-1/2 flex-col items-center">
              <div className="h-1.5 w-1 rounded-t-sm bg-yellow-300" />
              <div className="h-2 w-4 rounded-sm" style={{ background: skin.decorationColor }} />
            </div>
          )}
        </div>
        {/* legs */}
        <div className={`mt-0.5 flex ${legCount === 1 ? "justify-center" : "justify-between"} w-24`}>
          {Array.from({ length: legCount }, (_, i) => (
            <div
              key={i}
              className={skin.legDesign === "triangle" ? "h-10 w-0 border-l-[6px] border-r-[6px] border-b-[40px] border-l-transparent border-r-transparent" : "h-10 w-2 rounded-b-sm"}
              style={
                skin.legDesign === "triangle"
                  ? { borderBottomColor: skin.tablePrimary }
                  : skin.legDesign === "conic"
                    ? { background: `linear-gradient(to bottom, ${skin.tablePrimary}, #222)`, width: 10, clipPath: "polygon(20% 0, 80% 0, 100% 100%, 0 100%)" }
                    : { background: skin.tablePrimary }
              }
            />
          ))}
        </div>
      </div>
    </div>
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

        <SkinPreview skin={draft} />

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
          <button
            type="button"
            className={btnOn}
            onClick={() => {
              applySkin(draft);
              onClose();
            }}
          >
            Save skin
          </button>
        </div>
      </div>
    </div>
  );
}
