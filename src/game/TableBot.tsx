import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Skin } from "./skins";
import { createStageDisc, createTableBot, skinKey, type TableBotOptions } from "./tableBotFactory";

/**
 * Thin R3F wrapper around imperative Three.js objects.
 * Geometry is built in tableBotFactory.ts (no mesh JSX) so Lovable's
 * data-tsd-source attribute injection cannot crash the canvas.
 */
export function TableBot(opts: TableBotOptions & { spin?: boolean }) {
  const { spin, ...rest } = opts;
  const key = skinKey(rest.skin) + "|" + (rest.scale ?? 1) + "|" + (rest.ghost ? 1 : 0) + "|" + (rest.emitLight === false ? 0 : 1);
  const object = useMemo(() => createTableBot(rest), [key]);

  useEffect(() => {
    return () => {
      object.traverse((o) => {
        const m = o as { geometry?: { dispose: () => void }; material?: { dispose: () => void } | { dispose: () => void }[] };
        m.geometry?.dispose();
        if (Array.isArray(m.material)) m.material.forEach((x) => x.dispose());
        else m.material?.dispose();
      });
    };
  }, [object]);

  useFrame((_, dt) => {
    if (spin) object.rotation.y += dt * 0.55;
  });

  // eslint-disable-next-line react/no-unknown-property -- R3F primitive
  return <primitive object={object} />;
}

export function StageDisc({ color = "#2a2430", lightColor = "#4da861" }: { color?: string; lightColor?: string }) {
  const object = useMemo(() => createStageDisc(color, lightColor), [color, lightColor]);
  useEffect(() => {
    return () => {
      object.traverse((o) => {
        const m = o as { geometry?: { dispose: () => void }; material?: { dispose: () => void } | { dispose: () => void }[] };
        m.geometry?.dispose();
        if (Array.isArray(m.material)) m.material.forEach((x) => x.dispose());
        else m.material?.dispose();
      });
    };
  }, [object]);
  // eslint-disable-next-line react/no-unknown-property
  return <primitive object={object} />;
}

export type { TableBotOptions };
export type { Skin };
