import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { colors, fonts, fullScreen, card, badge } from "../styles";

const WALLETS = [
  { agent: "Strategy Engine", address: "0x3C4b...eEF1" },
  { agent: "Engagement Monitor", address: "0x3d97...1Eb2" },
  { agent: "Yield Scanner", address: "0x46dC...7523" },
  { agent: "DeFi Scanner", address: "0xbfC9...8144" },
  { agent: "Risk Monitor", address: "0x5d8f...BF05" },
  { agent: "Credit Analyzer", address: "0xA133...FD76" },
  { agent: "Engagement V2", address: "0x8e2a...C917" },
];

const CHECKS = [
  "OpenClaw",
  "WDK Primitives",
  "USDT/XAUT Management",
];

export const AgentWalletsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [0, 25], [30, 0], { extrapolateRight: "clamp" });

  const descOpacity = interpolate(frame, [340, 380], [0, 1], { extrapolateRight: "clamp" });
  const descY = interpolate(frame, [340, 380], [20, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ ...fullScreen, padding: 0 }}>
      {/* Screenshot background */}
      <Img
        src={require("../../screenshots/03-wallets.png")}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.3,
        }}
      />

      {/* Dark overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.7)",
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
          TRACK 1: AGENT WALLETS
        </div>

        {/* Wallet grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
            width: "100%",
            marginTop: 40,
          }}
        >
          {WALLETS.map((w, i) => {
            const delay = 40 + i * 20;
            const walletScale = spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 100 } });
            const walletOpacity = interpolate(frame, [delay, delay + 20], [0, 1], { extrapolateRight: "clamp" });
            const livePulse = Math.sin((frame - delay) * 0.08) * 0.3 + 0.7;

            return (
              <div
                key={w.agent}
                style={{
                  ...card,
                  opacity: walletOpacity,
                  transform: `scale(${Math.min(walletScale, 1)})`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  padding: "20px 24px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: colors.text }}>
                    {w.agent}
                  </div>
                  <span
                    style={{
                      ...badge(colors.green),
                      fontSize: 10,
                      padding: "2px 8px",
                      opacity: livePulse,
                    }}
                  >
                    LIVE
                  </span>
                </div>
                <div style={{ fontFamily: fonts.mono, fontSize: 15, color: colors.text3 }}>
                  {w.address}
                </div>
              </div>
            );
          })}
        </div>

        {/* Description */}
        <div
          style={{
            marginTop: 36,
            fontSize: 22,
            color: colors.text2,
            textAlign: "center",
            width: "100%",
            opacity: descOpacity,
            transform: `translateY(${descY}px)`,
          }}
        >
          Each agent derives its own HD wallet from BIP-44 mnemonic via @tetherto/wdk
        </div>

        {/* Checkmarks */}
        <div
          style={{
            display: "flex",
            gap: 40,
            marginTop: 24,
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
      </div>
    </AbsoluteFill>
  );
};
