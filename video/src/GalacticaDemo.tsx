import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from "remotion";
import { TitleScene } from "./scenes/TitleScene";
import { ArchitectureScene } from "./scenes/ArchitectureScene";
import { WDKScene } from "./scenes/WDKScene";
import { AgentWalletsScene } from "./scenes/AgentWalletsScene";
import { LendingScene } from "./scenes/LendingScene";
import { DeFiScene } from "./scenes/DeFiScene";
import { TippingScene } from "./scenes/TippingScene";
import { ContractsScene } from "./scenes/ContractsScene";
import { ACPScene } from "./scenes/ACPScene";
import { LiveTxScene } from "./scenes/LiveTxScene";
import { ClosingScene } from "./scenes/ClosingScene";

const FPS = 30;
const SEC = FPS;

export const GalacticaDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0f" }}>
      {/* Scene 1: Title (0:00 - 0:08) */}
      <Sequence from={0} durationInFrames={8 * SEC}>
        <TitleScene />
      </Sequence>

      {/* Scene 2: Architecture (0:08 - 0:20) */}
      <Sequence from={8 * SEC} durationInFrames={12 * SEC}>
        <ArchitectureScene />
      </Sequence>

      {/* Scene 3: WDK Integration (0:20 - 0:35) */}
      <Sequence from={20 * SEC} durationInFrames={15 * SEC}>
        <WDKScene />
      </Sequence>

      {/* Scene 4: Agent Wallets - Track 1 (0:35 - 0:55) */}
      <Sequence from={35 * SEC} durationInFrames={20 * SEC}>
        <AgentWalletsScene />
      </Sequence>

      {/* Scene 5: Lending Bot - Track 2 (0:55 - 1:15) */}
      <Sequence from={55 * SEC} durationInFrames={20 * SEC}>
        <LendingScene />
      </Sequence>

      {/* Scene 6: DeFi Agent - Track 3 (1:15 - 1:35) */}
      <Sequence from={75 * SEC} durationInFrames={20 * SEC}>
        <DeFiScene />
      </Sequence>

      {/* Scene 7: Tipping Bot - Track 4 (1:35 - 1:55) */}
      <Sequence from={95 * SEC} durationInFrames={20 * SEC}>
        <TippingScene />
      </Sequence>

      {/* Scene 8: Smart Contracts (1:55 - 2:10) */}
      <Sequence from={115 * SEC} durationInFrames={15 * SEC}>
        <ContractsScene />
      </Sequence>

      {/* Scene 9: ACP Consensus (2:10 - 2:25) */}
      <Sequence from={130 * SEC} durationInFrames={15 * SEC}>
        <ACPScene />
      </Sequence>

      {/* Scene 10: Live Transactions (2:25 - 2:50) */}
      <Sequence from={145 * SEC} durationInFrames={25 * SEC}>
        <LiveTxScene />
      </Sequence>

      {/* Scene 11: Closing (2:50 - 4:00) */}
      <Sequence from={170 * SEC} durationInFrames={70 * SEC}>
        <ClosingScene />
      </Sequence>
    </AbsoluteFill>
  );
};
