import { CSSProperties } from "react";

export const colors = {
  bg: "#000000",
  bg2: "#0a0a0a",
  bg3: "#141414",
  accent: "#00FF88",
  accent2: "#F7931A",
  green: "#00FF88",
  red: "#ef4444",
  yellow: "#F7931A",
  blue: "#00CC6A",
  text: "#f0f0f0",
  text2: "#999999",
  text3: "#666666",
  border: "#1f1f1f",
  border2: "#2a2a2a",
};

export const fonts = {
  sans: "'Space Grotesk', system-ui, -apple-system, sans-serif",
  mono: "'Space Mono', 'Fira Code', monospace",
};

export const fullScreen: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  backgroundColor: colors.bg,
  fontFamily: fonts.sans,
  color: colors.text,
  padding: 80,
  boxSizing: "border-box",
};

export const card: CSSProperties = {
  background: colors.bg2,
  border: `2px solid ${colors.border}`,
  borderRadius: 0,
  padding: "32px 40px",
};

export const badge = (color: string): CSSProperties => ({
  display: "inline-block",
  background: color,
  color: "#000",
  borderRadius: 0,
  padding: "6px 16px",
  fontSize: 14,
  fontWeight: 800,
  fontFamily: fonts.mono,
  letterSpacing: "0.06em",
  textTransform: "uppercase" as const,
});

export const codeBlock: CSSProperties = {
  background: colors.bg3,
  border: `2px solid ${colors.border}`,
  borderRadius: 0,
  padding: "24px 32px",
  fontFamily: fonts.mono,
  fontSize: 18,
  lineHeight: 1.6,
  color: colors.accent,
  whiteSpace: "pre",
  overflow: "hidden",
};
