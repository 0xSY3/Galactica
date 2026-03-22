import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { colors, fonts, fullScreen, card, codeBlock } from "../styles";

const FLOW = [
  { label: "Yield Scanner", color: colors.accent },
  { label: "Risk Check", color: colors.accent2 },
  { label: "Strategy Engine", color: colors.accent },
  { label: "WDK Protocol", color: colors.accent2 },
  { label: "On-chain", color: colors.green },
];

const PROTOCOL_CALLS = [
  "lending.supply()",
  "swap.swap()",
  "bridge.bridge()",
];

const CHECKS = [
  "Agent decides when & why",
  "USDT/XAUT base",
  "WDK execution",
];

export const DeFiScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [0, 25], [30, 0], { extrapolateRight: "clamp" });

  const barWidth = interpolate(frame, [55, 120], [0, 100], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ ...fullScreen, padding: "60px 80px", justifyContent: "flex-start" }}>
      <div
        style={{
          fontSize: 56,
          fontWeight: 700,
          color: colors.accent,
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          textAlign: "center",
          width: "100%",
        }}
      >
        TRACK 3: DEFI AGENT
      </div>

      {/* Yield result */}
      <div
        style={{
          ...card,
          marginTop: 40,
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          border: `2px solid ${colors.border}`,
          opacity: interpolate(frame, [30, 55], [0, 1], { extrapolateRight: "clamp" }),
          transform: `translateY(${interpolate(frame, [30, 55], [20, 0], { extrapolateRight: "clamp" })}px)`,
        }}
      >
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, color: colors.text }}>
            Aave USDT Pool
          </div>
          <div style={{ fontSize: 18, color: colors.text3, marginTop: 4 }}>
            Yield Scanner Result
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* Animated APY bar */}
          <div style={{ width: 200, height: 24, background: colors.bg3, borderRadius: 0, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${barWidth}%`,
                background: `linear-gradient(90deg, ${colors.accent}, ${colors.green})`,
                borderRadius: 0,
              }}
            />
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: colors.green }}>
            13.65% APY
          </div>
        </div>
      </div>

      {/* Decision flow */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginTop: 40,
          justifyContent: "center",
          width: "100%",
        }}
      >
        {FLOW.map((step, i) => {
          const delay = 80 + i * 25;
          const stepScale = spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 120 } });
          const stepOpacity = interpolate(frame, [delay, delay + 20], [0, 1], { extrapolateRight: "clamp" });
          const arrowOpacity = i < FLOW.length - 1
            ? interpolate(frame, [delay + 15, delay + 25], [0, 1], { extrapolateRight: "clamp" })
            : 0;

          return (
            <div key={step.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  ...card,
                  padding: "12px 20px",
                  border: `2px solid ${step.color}`,
                  opacity: stepOpacity,
                  transform: `scale(${Math.min(stepScale, 1)})`,
                }}
              >
                <div style={{ fontSize: 17, fontWeight: 600, color: step.color }}>
                  {step.label}
                </div>
              </div>
              {i < FLOW.length - 1 && (
                <div style={{ fontSize: 22, color: colors.accent, opacity: arrowOpacity }}>
                  &rarr;
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Protocol calls */}
      <div
        style={{
          ...codeBlock,
          marginTop: 40,
          width: "100%",
          display: "flex",
          justifyContent: "center",
          gap: 48,
          opacity: interpolate(frame, [230, 260], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        {PROTOCOL_CALLS.map((call, i) => {
          const callDelay = 260 + i * 25;
          const callOpacity = interpolate(frame, [callDelay, callDelay + 20], [0, 1], { extrapolateRight: "clamp" });

          return (
            <div key={call} style={{ opacity: callOpacity, display: "flex", alignItems: "center" }}>
              <span style={{ color: colors.accent, fontSize: 20 }}>{call}</span>
              {i < PROTOCOL_CALLS.length - 1 && (
                <span style={{ color: colors.text3, marginLeft: 24 }}>&bull;</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Checkmarks */}
      <div
        style={{
          display: "flex",
          gap: 40,
          marginTop: 36,
          justifyContent: "center",
          width: "100%",
        }}
      >
        {CHECKS.map((check, i) => {
          const checkDelay = 380 + i * 25;
          const checkOpacity = interpolate(frame, [checkDelay, checkDelay + 20], [0, 1], { extrapolateRight: "clamp" });

          return (
            <div
              key={check}
              style={{
                fontSize: 20,
                color: colors.green,
                fontFamily: fonts.mono,
                opacity: checkOpacity,
              }}
            >
              &#10003; {check}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
