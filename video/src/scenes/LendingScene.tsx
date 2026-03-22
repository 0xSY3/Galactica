import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { colors, fonts, fullScreen, card, badge } from "../styles";

const FLOW_STEPS = [
  { label: "Credit Analyzer", color: colors.accent },
  { label: "Score: 43/100", color: colors.accent2 },
  { label: "Strategy Engine", color: colors.accent },
  { label: "Approve / Deny", color: colors.accent2 },
  { label: "LendingPool", color: colors.accent },
  { label: "USDT", color: colors.green },
];

const CHECKS = [
  "Autonomous decisions",
  "On-chain settlement",
  "Repayment tracking",
];

export const LendingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [0, 25], [30, 0], { extrapolateRight: "clamp" });

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
        TRACK 2: LENDING BOT
      </div>

      {/* Flow diagram */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 60,
          width: "100%",
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        {FLOW_STEPS.map((step, i) => {
          const delay = 35 + i * 25;
          const stepScale = spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 120 } });
          const stepOpacity = interpolate(frame, [delay, delay + 20], [0, 1], { extrapolateRight: "clamp" });
          const arrowOpacity = i < FLOW_STEPS.length - 1
            ? interpolate(frame, [delay + 15, delay + 30], [0, 1], { extrapolateRight: "clamp" })
            : 0;

          return (
            <div key={step.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  ...card,
                  padding: "14px 22px",
                  border: `2px solid ${step.color}`,
                  opacity: stepOpacity,
                  transform: `scale(${Math.min(stepScale, 1)})`,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 17, fontWeight: 600, color: step.color }}>
                  {step.label}
                </div>
              </div>
              {i < FLOW_STEPS.length - 1 && (
                <div style={{ fontSize: 22, color: colors.accent, opacity: arrowOpacity }}>
                  &rarr;
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Stats card */}
      <div
        style={{
          ...card,
          marginTop: 50,
          textAlign: "center",
          width: "100%",
          border: `2px solid ${colors.border}`,
          opacity: interpolate(frame, [220, 250], [0, 1], { extrapolateRight: "clamp" }),
          transform: `translateY(${interpolate(frame, [220, 250], [20, 0], { extrapolateRight: "clamp" })}px)`,
        }}
      >
        <div style={{ fontSize: 26, fontWeight: 600, color: colors.text }}>
          5% APR &bull; Uncollateralized &bull; On-chain credit scoring
        </div>
      </div>

      {/* Tx hash */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginTop: 30,
          justifyContent: "center",
          width: "100%",
          opacity: interpolate(frame, [280, 310], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        <div style={{ fontFamily: fonts.mono, fontSize: 18, color: colors.text3 }}>
          tx: 0xd7052f03...18273
        </div>
        <span style={badge(colors.green)}>VERIFIED ON ARBISCAN</span>
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
          const checkDelay = 350 + i * 25;
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
