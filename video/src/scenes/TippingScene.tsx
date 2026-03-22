import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { colors, fonts, fullScreen, card, badge, codeBlock } from "../styles";

const FEATURES = ["tip()", "tipBatch()", "tipSplit()"];

const CHECKS = [
  "Engagement-driven",
  "Milestone bonuses",
  "Collaboration splits",
];

export const TippingScene: React.FC = () => {
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
        TRACK 4: TIPPING BOT
      </div>

      <div style={{ display: "flex", gap: 40, width: "100%", marginTop: 50 }}>
        {/* Engagement analysis card */}
        <div
          style={{
            flex: 1,
            ...card,
            padding: "32px 36px",
            border: `2px solid ${colors.border}`,
            opacity: interpolate(frame, [30, 55], [0, 1], { extrapolateRight: "clamp" }),
            transform: `translateX(${interpolate(frame, [30, 55], [-30, 0], { extrapolateRight: "clamp" })}px)`,
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 600, color: colors.text2, marginBottom: 20 }}>
            Engagement Analysis
          </div>

          {/* Input text */}
          <div
            style={{
              ...codeBlock,
              fontSize: 16,
              padding: "16px 20px",
              opacity: interpolate(frame, [60, 85], [0, 1], { extrapolateRight: "clamp" }),
            }}
          >
            <div style={{ color: colors.text2 }}>"FIRE stream! GOAT legendary!"</div>
          </div>

          {/* Result flow */}
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 24 }}>
            <div
              style={{
                opacity: interpolate(frame, [100, 125], [0, 1], { extrapolateRight: "clamp" }),
              }}
            >
              <div style={{ fontSize: 16, color: colors.text3, marginBottom: 6 }}>Engagement Level</div>
              <span
                style={{
                  ...badge(colors.accent2),
                  fontSize: 18,
                  padding: "6px 16px",
                }}
              >
                VIRAL
              </span>
            </div>

            <div
              style={{
                fontSize: 28,
                color: colors.accent,
                opacity: interpolate(frame, [130, 150], [0, 1], { extrapolateRight: "clamp" }),
                margin: "0 12px",
              }}
            >
              &rarr;
            </div>

            <div
              style={{
                opacity: interpolate(frame, [150, 175], [0, 1], { extrapolateRight: "clamp" }),
              }}
            >
              <div style={{ fontSize: 16, color: colors.text3, marginBottom: 6 }}>Action</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: colors.green }}>
                Tip $10 USDT
              </div>
            </div>
          </div>
        </div>

        {/* TippingPool features */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: colors.text,
              opacity: interpolate(frame, [180, 210], [0, 1], { extrapolateRight: "clamp" }),
              marginBottom: 8,
            }}
          >
            TippingPool Features
          </div>

          {FEATURES.map((feat, i) => {
            const delay = 210 + i * 25;
            const featScale = spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 120 } });
            const featOpacity = interpolate(frame, [delay, delay + 20], [0, 1], { extrapolateRight: "clamp" });

            return (
              <div
                key={feat}
                style={{
                  ...card,
                  padding: "14px 24px",
                  border: `2px solid ${colors.border}`,
                  opacity: featOpacity,
                  transform: `scale(${Math.min(featScale, 1)})`,
                }}
              >
                <span style={{ fontFamily: fonts.mono, fontSize: 19, color: colors.accent2 }}>
                  {feat}
                </span>
              </div>
            );
          })}

          {/* Rumble note */}
          <div
            style={{
              fontSize: 18,
              color: colors.text3,
              marginTop: 12,
              opacity: interpolate(frame, [340, 370], [0, 1], { extrapolateRight: "clamp" }),
            }}
          >
            Built on Rumble's WDK wallet infrastructure
          </div>
        </div>
      </div>

      {/* Checkmarks */}
      <div
        style={{
          display: "flex",
          gap: 40,
          marginTop: 40,
          justifyContent: "center",
          width: "100%",
        }}
      >
        {CHECKS.map((check, i) => {
          const checkDelay = 400 + i * 25;
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
