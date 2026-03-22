import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { colors, fonts, fullScreen, card, badge } from "../styles";

const CONTRACTS = [
  {
    name: "LendingPool",
    address: "0x0dee...87ac",
    features: ["deposit()", "approveLoan()", "repay()", "liquidate()"],
  },
  {
    name: "TippingPool",
    address: "0x944e...599c",
    features: ["tip()", "tipBatch()", "tipSplit()", "withdraw()"],
  },
  {
    name: "YieldVault",
    address: "0xff74...bec6",
    features: ["deposit()", "rebalance()", "harvest()", "withdraw()"],
  },
];

export const ContractsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [0, 25], [30, 0], { extrapolateRight: "clamp" });

  const subtitleOpacity = interpolate(frame, [15, 35], [0, 1], { extrapolateRight: "clamp" });

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
        DEPLOYED CONTRACTS
      </div>

      <div
        style={{
          fontSize: 24,
          fontWeight: 600,
          color: colors.accent2,
          textAlign: "center",
          width: "100%",
          marginTop: 8,
          opacity: subtitleOpacity,
          fontFamily: fonts.mono,
        }}
      >
        Arbitrum Sepolia
      </div>

      {/* Contract cards */}
      <div
        style={{
          display: "flex",
          gap: 32,
          width: "100%",
          marginTop: 50,
          justifyContent: "center",
        }}
      >
        {CONTRACTS.map((contract, i) => {
          const delay = 40 + i * 35;
          const cardScale = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 100 } });
          const cardOpacity = interpolate(frame, [delay, delay + 25], [0, 1], { extrapolateRight: "clamp" });

          return (
            <div
              key={contract.name}
              style={{
                ...card,
                flex: 1,
                padding: "36px 32px",
                opacity: cardOpacity,
                transform: `scale(${Math.min(cardScale, 1)})`,
                display: "flex",
                flexDirection: "column",
                border: `2px solid ${colors.accent}`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: colors.accent2 }}>
                  {contract.name}
                </div>
                <span style={{ ...badge(colors.green), fontSize: 11, padding: "3px 10px" }}>
                  DEPLOYED
                </span>
              </div>
              <div style={{ fontFamily: fonts.mono, fontSize: 15, color: colors.text3, marginBottom: 20 }}>
                {contract.address}
              </div>

              {/* Features */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {contract.features.map((feat, j) => {
                  const featDelay = delay + 40 + j * 15;
                  const featOpacity = interpolate(frame, [featDelay, featDelay + 15], [0, 1], { extrapolateRight: "clamp" });

                  return (
                    <div
                      key={feat}
                      style={{
                        fontSize: 16,
                        fontFamily: fonts.mono,
                        color: colors.text2,
                        opacity: featOpacity,
                        paddingLeft: 12,
                        borderLeft: `2px solid ${colors.accent}`,
                      }}
                    >
                      {feat}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
