import { useSyncExternalStore } from "react";

/** Shared color chart used by every color option in the skins menu. */
export const COLOR_CHART = [
  "#ffffff", "#f2f2f2", "#d9d9d9", "#bfbfbf", "#a6a6a6", "#8c8c8c", "#737373", "#595959", "#404040", "#262626", "#0d0d0d", "#000000",
  "#ffcccc", "#ff9999", "#ff6666", "#ff3333", "#ff0000", "#cc0000", "#990000", "#660000", "#330000",
  "#ffe0cc", "#ffc299", "#ffa366", "#ff8533", "#ff6600", "#cc5200", "#993d00", "#662900", "#331400",
  "#fff2cc", "#ffe699", "#ffd966", "#ffcc33", "#ffbf00", "#cc9900", "#997300", "#664d00", "#332600",
  "#ffffcc", "#ffff99", "#ffff66", "#ffff33", "#ffff00", "#cccc00", "#999900", "#666600", "#333300",
  "#e6ffcc", "#ccff99", "#b3ff66", "#99ff33", "#80ff00", "#66cc00", "#4d9900", "#336600", "#1a3300",
  "#ccffcc", "#99ff99", "#66ff66", "#33ff33", "#00ff00", "#00cc00", "#009900", "#006600", "#003300",
  "#ccffe6", "#99ffcc", "#66ffb3", "#33ff99", "#00ff80", "#00cc66", "#00994d", "#006633", "#00331a",
  "#ccffff", "#99ffff", "#66ffff", "#33ffff", "#00ffff", "#00cccc", "#009999", "#006666", "#003333",
  "#cce6ff", "#99ccff", "#66b3ff", "#3399ff", "#0080ff", "#0066cc", "#004d99", "#003366", "#001a33",
  "#ccccff", "#9999ff", "#6666ff", "#3333ff", "#0000ff", "#0000cc", "#000099", "#000066", "#000033",
  "#e6ccff", "#cc99ff", "#b366ff", "#9933ff", "#8000ff", "#6600cc", "#4d0099", "#330066", "#1a0033",
  "#ffccff", "#ff99ff", "#ff66ff", "#ff33ff", "#ff00ff", "#cc00cc", "#990099", "#660066", "#330033",
  "#ffcce6", "#ff99cc", "#ff66b3", "#ff3399", "#ff0080", "#cc0066", "#99004d", "#660033", "#33001a",
  "#4da861", "#277b44", "#96653f", "#75492e", "#2f6fd6", "#1f4fa8", "#e6452c", "#ffd058", "#ffae34",
] as const;

export type EyeDesign = "boss" | "square" | "triangle";
export type TableDecoration = "none" | "plates" | "rug" | "office" | "birthday";
export type LegDesign = "triangle" | "conic" | "minimal" | "oneleg";

export type Skin = {
  eyeColor: string;
  tablePrimary: string;
  eyeDesign: EyeDesign;
  decoration: TableDecoration;
  decorationColor: string;
  lightColor: string;
  legDesign: LegDesign;
};

export const DEFAULT_SKIN: Skin = {
  eyeColor: "#ffd058",
  tablePrimary: "#4da861",
  eyeDesign: "boss",
  decoration: "none",
  decorationColor: "#ffffff",
  lightColor: "#4da861",
  legDesign: "conic",
};

const STORE_KEY = "tw-skins";

export let SKIN: Skin = structuredClone(DEFAULT_SKIN);
const subs = new Set<() => void>();
let loaded = false;

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Skin>;
      SKIN = { ...DEFAULT_SKIN, ...p };
    }
  } catch { /* ignore */ }
}

let persist: ((s: Skin) => void) | null = null;
export function setSkinPersister(fn: ((s: Skin) => void) | null) {
  persist = fn;
}

export function applySkin(next: Skin, fromAccount = false) {
  SKIN = { ...DEFAULT_SKIN, ...structuredClone(next) };
  try { localStorage.setItem(STORE_KEY, JSON.stringify(SKIN)); } catch { /* ignore */ }
  if (!fromAccount) persist?.(SKIN);
  subs.forEach((f) => f());
}

function subscribe(f: () => void) {
  load();
  subs.add(f);
  queueMicrotask(f);
  return () => subs.delete(f);
}

export function useSkin() {
  return useSyncExternalStore(subscribe, () => SKIN, () => DEFAULT_SKIN);
}

export const EYE_DESIGNS: { id: EyeDesign; label: string }[] = [
  { id: "boss", label: "Boss eyes" },
  { id: "square", label: "Square eyes" },
  { id: "triangle", label: "Triangle eyes" },
];

export const DECORATIONS: { id: TableDecoration; label: string }[] = [
  { id: "none", label: "None" },
  { id: "plates", label: "Plates" },
  { id: "rug", label: "Table rug" },
  { id: "office", label: "Office table" },
  { id: "birthday", label: "Birthday table" },
];

export const LEG_DESIGNS: { id: LegDesign; label: string }[] = [
  { id: "triangle", label: "Triangle" },
  { id: "conic", label: "Default conic" },
  { id: "minimal", label: "Minimalistic" },
  { id: "oneleg", label: "One-legged" },
];
