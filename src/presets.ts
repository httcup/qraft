import type { EyeId, QrDesign, StyleId } from "./render";

export const STYLE_IDS: StyleId[] = [
  "classic",
  "rounded",
  "dot",
  "liquid",
  "line",
  "vline",
  "diamond",
  "leaf",
];

export const EYE_IDS: EyeId[] = ["square", "rounded", "circle", "leaf"];

export const DEFAULT_DESIGN: QrDesign = {
  style: "liquid",
  eye: "rounded",
  fg: "#111111",
  fg2: "#5b21b6",
  gradient: false,
  angle: 45,
  bg: "#ffffff",
  transparent: false,
  margin: 2,
  logo: null,
  logoScale: 0.22,
};

type Palette = { fg: string; fg2: string; angle: number; bg: string };

export const PALETTES: Palette[] = [
  { fg: "#111111", fg2: "#4b5563", angle: 45, bg: "#ffffff" },
  { fg: "#0f172a", fg2: "#1d4ed8", angle: 40, bg: "#ffffff" },
  { fg: "#3b0764", fg2: "#db2777", angle: 35, bg: "#fff7fb" },
  { fg: "#7c2d12", fg2: "#f59e0b", angle: 30, bg: "#fffbf2" },
  { fg: "#022c22", fg2: "#10b981", angle: 25, bg: "#f5fffb" },
  { fg: "#1e1b4b", fg2: "#6366f1", angle: 55, bg: "#f7f7ff" },
  { fg: "#4a044e", fg2: "#f472b6", angle: 60, bg: "#fff5fa" },
  { fg: "#082f49", fg2: "#0ea5e9", angle: 45, bg: "#f5fbff" },
];

export const SAMPLE = "QRBTF";

export function randomDesign(current: QrDesign): QrDesign {
  const palette = PALETTES[Math.floor(Math.random() * PALETTES.length)];
  const style = STYLE_IDS[Math.floor(Math.random() * STYLE_IDS.length)];
  const eye = EYE_IDS[Math.floor(Math.random() * EYE_IDS.length)];
  return {
    ...current,
    style,
    eye,
    fg: palette.fg,
    fg2: palette.fg2,
    angle: palette.angle,
    bg: palette.bg,
    gradient: Math.random() > 0.35,
  };
}
