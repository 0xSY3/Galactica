import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { colors, fonts, fullScreen, card, badge } from "../styles";

const FEATURES = [
  "7 WDK Agent Wallets",
  "6 @tetherto Packages",
  "3 Smart Contracts",
  "35 MCP Tools",
  "OpenClaw Reasoning",
  "ACP Consensus",
  "On-chain Settlement",
];

const TRACKS = [
  "Agent Wallets",
  "Lending Bot",
  "DeFi Agent",
  "Tipping Bot",
];

export const ClosingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [0, 30], [40, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ ...fullScreen, padding: "60px 80px", justifyContent: "flex-start" }}>
      {/* Dot grid background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle, #1a1a1a 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          opacity: 0.4,
        }}
      />

      <div
        style={{
          fontSize: 64,
          fontWeight: 800,
          color: colors.accent,
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          textAlign: "center",
          width: "100%",
          letterSpacing: "-0.02em",
          zIndex: 1,
        }}
      >
        GALACTICA AGENT NETWORK
      </div>

      {/* Feature grid */}
      <div
        style={{
          ...card,
          marginTop: 40,
          width: "100%",
          padding: "32px 48px",
          border: `2px solid ${colors.border}`,
          zIndex: 1,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "16px 60px",
          }}
        >
          {FEATURES.map((feature, i) => {
            const delay = 50 + i * 18;
            const rowOpacity = interpolate(frame, [delay, delay + 18], [0, 1], { extrapolateRight: "clamp" });
            const rowX = interpolate(frame, [delay, delay + 18], [-20, 0], { extrapolateRight: "clamp" });
            const checkScale = spring({
              frame: frame - (delay + 12),
              fps,
              config: { damping: 10, stiffness: 150 },
            });

            return (
              <div
                key={feature}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  opacity: rowOpacity,
                  transform: `translateX(${rowX}px)`,
                }}
              >
                <span
                  style={{
                    fontSize: 22,
                    color: colors.green,
                    transform: `scale(${Math.min(checkScale, 1)})`,
                    display: "inline-block",
                  }}
                >
                  &#10003;
                </span>
                <span style={{ fontSize: 22, fontWeight: 500, color: colors.text }}>
                  {feature}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Track coverage */}
      <div
        style={{
          marginTop: 36,
          textAlign: "center",
          width: "100%",
          opacity: interpolate(frame, [230, 260], [0, 1], { extrapolateRight: "clamp" }),
          transform: `translateY(${interpolate(frame, [230, 260], [20, 0], { extrapolateRight: "clamp" })}px)`,
          zIndex: 1,
        }}
      >
        <div style={{ fontSize: 24, color: colors.text2, marginBottom: 12 }}>
          Covers all 4 tracks
        </div>
        <div style={{ display: "flex", gap: 24, justifyContent: "center" }}>
          {TRACKS.map((track, i) => {
            const trackDelay = 270 + i * 15;
            const trackOpacity = interpolate(frame, [trackDelay, trackDelay + 15], [0, 1], { extrapolateRight: "clamp" });

            return (
              <span
                key={track}
                style={{
                  ...badge(colors.accent2),
                  fontSize: 16,
                  padding: "8px 20px",
                  opacity: trackOpacity,
                }}
              >
                {track}
              </span>
            );
          })}
        </div>
      </div>

      {/* GitHub */}
      <div
        style={{
          ...card,
          marginTop: 32,
          padding: "16px 32px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          border: `2px solid ${colors.border}`,
          opacity: interpolate(frame, [330, 360], [0, 1], { extrapolateRight: "clamp" }),
          zIndex: 1,
        }}
      >
        <div style={{ fontSize: 20, color: colors.text3 }}>
          github.com/
        </div>
        <div style={{ fontSize: 20, fontWeight: 600, color: colors.accent }}>
          0xSY3/Galactica
        </div>
      </div>

      {/* Hackathon badge */}
      <div
        style={{
          marginTop: 32,
          opacity: interpolate(frame, [400, 440], [0, 1], { extrapolateRight: "clamp" }),
          transform: `scale(${spring({ frame: frame - 400, fps, config: { damping: 12, stiffness: 80 } })})`,
          zIndex: 1,
        }}
      >
        <span
          style={{
            ...badge(colors.accent),
            fontSize: 22,
            padding: "14px 36px",
          }}
        >
          Built for Hackathon Galactica: WDK Edition 1
        </span>
      </div>
    </AbsoluteFill>
  );
};
