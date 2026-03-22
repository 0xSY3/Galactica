import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { colors, fonts, fullScreen, card, codeBlock } from "../styles";

const PACKAGES = [
  { name: "@tetherto/wdk", desc: "Core SDK" },
  { name: "@tetherto/wdk-wallet-evm", desc: "EVM Wallet" },
  { name: "@tetherto/wdk-mcp-toolkit", desc: "35 MCP Tools" },
  { name: "@tetherto/wdk-protocol-lending-aave-evm", desc: "Aave V3" },
  { name: "@tetherto/wdk-protocol-swap-velora-evm", desc: "Velora DEX" },
  { name: "@tetherto/wdk-protocol-bridge-usdt0-evm", desc: "USDT0 Bridge" },
];

const CODE_LINES = [
  'const wdk = new WDK(mnemonic)',
  'wdk.registerWallet("ethereum", WalletManagerEvm)',
  'account.transfer({ token, recipient, amount })',
];

export const WDKScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [0, 25], [30, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ ...fullScreen, alignItems: "flex-start", padding: "60px 80px" }}>
      <div
        style={{
          fontSize: 56,
          fontWeight: 700,
          color: colors.accent,
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          marginBottom: 40,
          width: "100%",
          textAlign: "center",
        }}
      >
        BUILT ON TETHER WDK
      </div>

      <div style={{ display: "flex", gap: 40, width: "100%" }}>
        {/* Package list */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          {PACKAGES.map((pkg, i) => {
            const delay = 30 + i * 18;
            const itemScale = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 120 } });
            const itemOpacity = interpolate(frame, [delay, delay + 15], [0, 1], { extrapolateRight: "clamp" });
            const itemX = interpolate(frame, [delay, delay + 15], [-30, 0], { extrapolateRight: "clamp" });

            return (
              <div
                key={pkg.name}
                style={{
                  ...card,
                  padding: "16px 24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  opacity: itemOpacity,
                  transform: `translateX(${itemX}px) scale(${Math.min(itemScale, 1)})`,
                  border: `2px solid ${colors.border}`,
                }}
              >
                <div style={{ fontFamily: fonts.mono, fontSize: 17, color: colors.accent2 }}>
                  {pkg.name}
                </div>
                <div style={{ fontSize: 15, color: colors.text3, marginLeft: 16 }}>
                  {pkg.desc}
                </div>
              </div>
            );
          })}
        </div>

        {/* Code snippet */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div
            style={{
              ...codeBlock,
              opacity: interpolate(frame, [140, 165], [0, 1], { extrapolateRight: "clamp" }),
              transform: `translateY(${interpolate(frame, [140, 165], [20, 0], { extrapolateRight: "clamp" })}px)`,
            }}
          >
            {CODE_LINES.map((line, i) => {
              const lineDelay = 160 + i * 25;
              const lineOpacity = interpolate(frame, [lineDelay, lineDelay + 20], [0, 1], { extrapolateRight: "clamp" });

              return (
                <div key={i} style={{ opacity: lineOpacity, marginBottom: i < CODE_LINES.length - 1 ? 8 : 0 }}>
                  <span style={{ color: colors.text3 }}>{i + 1} </span>
                  <span style={{ color: colors.accent }}>
                    {line}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Arrow connectors */}
          {[0, 1].map((i) => {
            const arrowDelay = 195 + i * 25;
            const arrowOpacity = interpolate(frame, [arrowDelay, arrowDelay + 15], [0, 1], { extrapolateRight: "clamp" });
            return (
              <div
                key={i}
                style={{
                  textAlign: "center",
                  fontSize: 24,
                  color: colors.accent,
                  opacity: arrowOpacity,
                  margin: "4px 0",
                }}
              >
                &darr;
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
