import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { colors, fonts, fullScreen, card, badge } from "../styles";

const VOTERS = [
  { agent: "sentiment", vote: "BULLISH", stake: 120 },
  { agent: "polymarket", vote: "BULLISH", stake: 95 },
  { agent: "defi", vote: "BEARISH", stake: 80 },
  { agent: "whale", vote: "BULLISH", stake: 110 },
  { agent: "news", vote: "BEARISH", stake: 70 },
];

export const ACPScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [0, 25], [30, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ ...fullScreen, padding: 0 }}>
      {/* Screenshot background */}
      <Img
        src={require("../../screenshots/05-consensus.png")}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.25,
        }}
      />

      {/* Dark overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.75)",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "60px 80px",
          boxSizing: "border-box",
        }}
      >
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
          CONSENSUS PROTOCOL
        </div>

        {/* Stats row */}
        <div
          style={{
            display: "flex",
            gap: 32,
            marginTop: 40,
            justifyContent: "center",
            width: "100%",
          }}
        >
          {[
            { label: "Rounds", value: "28", color: colors.accent },
            { label: "Slashes", value: "62", color: colors.red },
            { label: "Rewards", value: "68", color: colors.green },
          ].map((stat, i) => {
            const delay = 30 + i * 20;
            const statOpacity = interpolate(frame, [delay, delay + 20], [0, 1], { extrapolateRight: "clamp" });
            const statScale = spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 100 } });

            return (
              <div
                key={stat.label}
                style={{
                  ...card,
                  padding: "24px 40px",
                  textAlign: "center",
                  border: `2px solid ${stat.color}`,
                  opacity: statOpacity,
                  transform: `scale(${Math.min(statScale, 1)})`,
                }}
              >
                <div style={{ fontSize: 40, fontWeight: 800, color: stat.color, fontFamily: fonts.mono }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: 16, color: colors.text3, marginTop: 4 }}>
                  {stat.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Voting bars */}
        <div style={{ marginTop: 40, width: "100%" }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: colors.text2,
              marginBottom: 20,
              opacity: interpolate(frame, [90, 110], [0, 1], { extrapolateRight: "clamp" }),
            }}
          >
            Agent Consensus Votes
          </div>

          {VOTERS.map((voter, i) => {
            const delay = 110 + i * 18;
            const voterOpacity = interpolate(frame, [delay, delay + 18], [0, 1], { extrapolateRight: "clamp" });
            const barWidth = interpolate(frame, [delay + 10, delay + 35], [0, voter.stake], { extrapolateRight: "clamp" });
            const isBullish = voter.vote === "BULLISH";

            return (
              <div
                key={voter.agent}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  marginBottom: 14,
                  opacity: voterOpacity,
                }}
              >
                <div style={{ width: 120, fontSize: 16, fontWeight: 600, color: colors.text, fontFamily: fonts.mono }}>
                  {voter.agent}
                </div>
                <div style={{ flex: 1, height: 28, background: colors.bg3, borderRadius: 0, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${barWidth}%`,
                      background: isBullish ? colors.green : colors.red,
                      borderRadius: 0,
                    }}
                  />
                </div>
                <span style={badge(isBullish ? colors.green : colors.red)}>
                  {voter.vote}
                </span>
                <div style={{ fontSize: 14, color: colors.text3, fontFamily: fonts.mono, width: 50, textAlign: "right" }}>
                  {voter.stake}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom message */}
        <div
          style={{
            fontSize: 22,
            color: colors.text2,
            textAlign: "center",
            width: "100%",
            marginTop: 32,
            opacity: interpolate(frame, [280, 310], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          Agents stake reputation. Wrong signals = slashed.
        </div>
      </div>
    </AbsoluteFill>
  );
};
