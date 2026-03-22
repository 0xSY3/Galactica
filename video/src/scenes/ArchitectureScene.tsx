import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { colors, fonts, fullScreen, card } from "../styles";

const AGENTS = [
  { name: "Engagement Monitor", price: "$0.001" },
  { name: "Yield Scanner", price: "$0.02" },
  { name: "DeFi Scanner", price: "$0.015" },
  { name: "Risk Monitor", price: "$0.001" },
  { name: "Credit Analyzer", price: "$0.002" },
];

export const ArchitectureScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [0, 25], [30, 0], { extrapolateRight: "clamp" });

  const centerScale = spring({ frame: frame - 30, fps, config: { damping: 14, stiffness: 80 } });
  const centerOpacity = interpolate(frame, [30, 55], [0, 1], { extrapolateRight: "clamp" });

  const lineOpacity = interpolate(frame, [55, 80], [0, 0.4], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ ...fullScreen, padding: 60, justifyContent: "flex-start" }}>
      <div
        style={{
          fontSize: 56,
          fontWeight: 700,
          color: colors.accent,
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          textAlign: "center",
          width: "100%",
          marginBottom: 60,
        }}
      >
        MULTI-AGENT ARCHITECTURE
      </div>

      {/* Strategy Engine — center hub */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          width: "100%",
          marginBottom: 40,
        }}
      >
        <div
          style={{
            ...card,
            border: `3px solid ${colors.accent}`,
            padding: "28px 56px",
            textAlign: "center",
            opacity: centerOpacity,
            transform: `scale(${Math.min(centerScale, 1)})`,
            boxShadow: `0 0 40px ${colors.accent}33`,
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 700, color: colors.accent }}>
            Strategy Engine
          </div>
          <div style={{ fontSize: 16, color: colors.text3, fontFamily: fonts.mono, marginTop: 8 }}>
            :5050 &bull; $0.05/call &bull; USDT payments
          </div>
        </div>
      </div>

      {/* Connector lines */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 80,
          marginBottom: 20,
          opacity: lineOpacity,
        }}
      >
        {AGENTS.map((_, i) => (
          <div
            key={i}
            style={{
              width: 2,
              height: 40,
              background: colors.accent2,
            }}
          />
        ))}
      </div>

      {/* Sub-agents row */}
      <div
        style={{
          display: "flex",
          gap: 20,
          width: "100%",
          justifyContent: "center",
        }}
      >
        {AGENTS.map((agent, i) => {
          const delay = 60 + i * 20;
          const agentScale = spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 100 } });
          const agentOpacity = interpolate(frame, [delay, delay + 20], [0, 1], { extrapolateRight: "clamp" });

          return (
            <div
              key={agent.name}
              style={{
                ...card,
                border: `2px solid ${colors.accent2}`,
                padding: "20px 24px",
                textAlign: "center",
                minWidth: 180,
                opacity: agentOpacity,
                transform: `scale(${Math.min(agentScale, 1)})`,
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 600, color: colors.text }}>
                {agent.name}
              </div>
              <div style={{ fontSize: 14, color: colors.accent2, fontFamily: fonts.mono, marginTop: 8 }}>
                {agent.price} USDT
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
