import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { colors, fonts, fullScreen, card, badge } from "../styles";

const TRANSACTIONS = [
  { fn: "depositToLendingPool", amount: "10 USDT", hash: "0xa3f1...c82d" },
  { fn: "tipCreator", amount: "1 USDT", hash: "0x7e92...1f4a" },
  { fn: "depositToVault", amount: "5 USDT", hash: "0xb8d4...e6c1" },
];

export const LiveTxScene: React.FC = () => {
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
        REAL ON-CHAIN TRANSACTIONS
      </div>

      {/* Transaction feed */}
      <div style={{ width: "100%", marginTop: 50, display: "flex", flexDirection: "column", gap: 20 }}>
        {TRANSACTIONS.map((tx, i) => {
          const delay = 50 + i * 60;
          const txScale = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 100 } });
          const txOpacity = interpolate(frame, [delay, delay + 25], [0, 1], { extrapolateRight: "clamp" });
          const txX = interpolate(frame, [delay, delay + 25], [-40, 0], { extrapolateRight: "clamp" });
          const checkDelay = delay + 30;
          const checkScale = spring({ frame: frame - checkDelay, fps, config: { damping: 10, stiffness: 150 } });
          const livePulse = Math.sin((frame - delay) * 0.1) * 0.3 + 0.7;

          return (
            <div
              key={tx.fn}
              style={{
                ...card,
                padding: "24px 36px",
                border: `2px solid ${colors.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                opacity: txOpacity,
                transform: `translateX(${txX}px) scale(${Math.min(txScale, 1)})`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <div
                  style={{
                    fontSize: 32,
                    color: colors.green,
                    transform: `scale(${Math.min(checkScale, 1)})`,
                  }}
                >
                  &#10003;
                </div>

                <div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: colors.text }}>
                    {tx.fn}
                    <span style={{ color: colors.accent2, marginLeft: 12 }}>({tx.amount})</span>
                  </div>
                  <div style={{ fontSize: 14, fontFamily: fonts.mono, color: colors.text3, marginTop: 4 }}>
                    {tx.hash}
                  </div>
                </div>
              </div>

              <span
                style={{
                  ...badge(colors.green),
                  fontSize: 16,
                  padding: "6px 16px",
                  opacity: livePulse,
                }}
              >
                LIVE
              </span>
            </div>
          );
        })}
      </div>

      {/* Arbiscan note */}
      <div
        style={{
          marginTop: 40,
          textAlign: "center",
          width: "100%",
          opacity: interpolate(frame, [280, 310], [0, 1], { extrapolateRight: "clamp" }),
          transform: `translateY(${interpolate(frame, [280, 310], [15, 0], { extrapolateRight: "clamp" })}px)`,
        }}
      >
        <div style={{ fontSize: 22, color: colors.text2 }}>
          All verifiable on{" "}
          <span style={{ color: colors.accent2, fontFamily: fonts.mono }}>sepolia.arbiscan.io</span>
        </div>
      </div>

      {/* Groq AI recommendation */}
      <div
        style={{
          ...card,
          marginTop: 36,
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 24,
          border: `2px solid ${colors.accent2}`,
          opacity: interpolate(frame, [400, 440], [0, 1], { extrapolateRight: "clamp" }),
          transform: `translateY(${interpolate(frame, [400, 440], [20, 0], { extrapolateRight: "clamp" })}px)`,
        }}
      >
        <div
          style={{
            ...badge(colors.accent2),
            fontSize: 14,
            padding: "6px 14px",
            flexShrink: 0,
          }}
        >
          GROQ AI
        </div>
        <div style={{ fontSize: 22, color: colors.accent2, fontWeight: 600 }}>
          "Halt lending — weak consensus"
        </div>
        <div style={{ fontSize: 16, color: colors.text3, marginLeft: "auto" }}>
          llama-3.3-70b recommendation
        </div>
      </div>
    </AbsoluteFill>
  );
};
