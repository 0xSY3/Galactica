import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { colors, fonts, fullScreen, badge } from "../styles";

export const TitleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [0, 30], [40, 0], { extrapolateRight: "clamp" });

  const subtitleOpacity = interpolate(frame, [20, 50], [0, 1], { extrapolateRight: "clamp" });
  const subtitleY = interpolate(frame, [20, 50], [30, 0], { extrapolateRight: "clamp" });

  const badgeScale = spring({ frame: frame - 40, fps, config: { damping: 12, stiffness: 100 } });
  const badgeOpacity = interpolate(frame, [40, 55], [0, 1], { extrapolateRight: "clamp" });

  const bottomOpacity = interpolate(frame, [70, 100], [0, 1], { extrapolateRight: "clamp" });
  const bottomY = interpolate(frame, [70, 100], [20, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={fullScreen}>
      {/* Dot grid background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle, #1a1a1a 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          opacity: 0.6,
        }}
      />

      <div
        style={{
          fontSize: 96,
          fontWeight: 800,
          fontFamily: fonts.sans,
          color: colors.accent,
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          letterSpacing: "-0.03em",
          textAlign: "center",
          zIndex: 1,
        }}
      >
        GALACTICA
      </div>

      <div
        style={{
          fontSize: 36,
          fontWeight: 400,
          fontFamily: fonts.sans,
          color: colors.text,
          opacity: subtitleOpacity,
          transform: `translateY(${subtitleY}px)`,
          marginTop: 16,
          textAlign: "center",
          zIndex: 1,
        }}
      >
        Agent Network
      </div>

      <div
        style={{
          marginTop: 48,
          opacity: badgeOpacity,
          transform: `scale(${badgeScale})`,
          zIndex: 1,
        }}
      >
        <span
          style={{
            ...badge(colors.accent2),
            fontSize: 18,
            padding: "10px 24px",
          }}
        >
          Hackathon Galactica: WDK Edition 1
        </span>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 80,
          display: "flex",
          gap: 32,
          fontSize: 22,
          fontFamily: fonts.mono,
          color: colors.text3,
          opacity: bottomOpacity,
          transform: `translateY(${bottomY}px)`,
          textAlign: "center",
          letterSpacing: "0.02em",
          zIndex: 1,
        }}
      >
        <span>7 Agents</span>
        <span style={{ color: colors.border2 }}>&bull;</span>
        <span>6 WDK Packages</span>
        <span style={{ color: colors.border2 }}>&bull;</span>
        <span>3 Contracts</span>
        <span style={{ color: colors.border2 }}>&bull;</span>
        <span>4 Tracks</span>
      </div>
    </AbsoluteFill>
  );
};
