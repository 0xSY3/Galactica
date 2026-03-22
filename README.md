# Galactica Agent Network

**Multi-agent autonomous financial system built on Tether WDK.**

7 AI agents hold their own wallets, pay each other in USDT, lend capital, optimize DeFi yields, score credit on-chain, and tip content creators — all without human intervention. Every transaction settles on **Arbitrum Sepolia**.

Built for **Hackathon Galactica: WDK Edition 1**.

---

## How It Works

```
Client ──[$0.05 USDT]──> Strategy Engine (0xA133...CDFD)
                            ├──[$0.001]──> Engagement Monitor    (Rumble stream analysis)
                            ├──[$0.001]──> Risk Monitor          (protocol health scoring)
                            ├──[$0.020]──> Yield Scanner         (Aave/Compound APYs)
                            ├──[$0.015]──> DeFi Scanner          (token momentum)
                            └──[$0.002]──> Credit Analyzer       (on-chain credit scores)
                                    ↓
                         Multi-Agent Consensus (ACP)
                         Stake-weighted voting + slashing
                                    ↓
                         On-Chain Contract Execution
                         ├── LendingPool  → deposit, approve, repay
                         ├── TippingPool  → tip creators, milestone bonuses
                         └── YieldVault   → deposit, rebalance across protocols
```

Each agent derives its own HD wallet from a shared BIP-44 mnemonic using `@tetherto/wdk`. Agent-to-agent payments use WDK's native `account.transfer()`. DeFi operations route through WDK protocol modules (Aave, Velora, USDT0 bridge).

---

## Tether WDK Integration

This project uses **6 official `@tetherto` packages**:

| Package | Purpose |
|---------|---------|
| `@tetherto/wdk` | Core SDK — wallet initialization, HD derivation, `getAccount()` |
| `@tetherto/wdk-wallet-evm` | EVM wallet manager — `registerWallet()`, `transfer()`, signing |
| `@tetherto/wdk-protocol-lending-aave-evm` | Aave V3 — `supply()`, `withdraw()`, `borrow()`, `repay()` |
| `@tetherto/wdk-protocol-swap-velora-evm` | Velora DEX — `swap()` for token rebalancing |
| `@tetherto/wdk-protocol-bridge-usdt0-evm` | USDT0 bridge — `bridge()` for cross-chain transfers |
| `@tetherto/wdk-mcp-toolkit` | MCP server — 35 tools exposing wallet ops to AI agents |

**WDK usage in code:**

```typescript
import WDK from "@tetherto/wdk";
import WalletManagerEvm from "@tetherto/wdk-wallet-evm";

const wdk = new WDK(seedPhrase);
wdk.registerWallet("ethereum", WalletManagerEvm, { provider: rpcUrl });

// Each agent gets its own wallet
const account = await wdk.getAccount("ethereum", agentIndex);
const address = await account.getAddress();

// Transfer USDT between agents
await account.transfer({ token: USDT_ADDRESS, recipient: toAddress, amount: 1000000n });

// DeFi operations via WDK protocol modules
const lending = account.getLendingProtocol("aave");
await lending.supply({ token: USDT_ADDRESS, amount: 5000000n });

const swap = account.getSwapProtocol("velora");
await swap.swap({ tokenIn: USDT, tokenOut: XAUT, tokenInAmount: 10000000n });

const bridge = account.getBridgeProtocol("usdt0");
await bridge.bridge({ targetChain: "polygon", token: USDT, amount: 5000000n });
```

---

## Deployed Contracts (Arbitrum Sepolia)

| Contract | Address | Features |
|----------|---------|----------|
| **MockUSDT** | [`0x5cdd9f3688cb80d07c849419f555289aa2db7ffe`](https://sepolia.arbiscan.io/address/0x5cdd9f3688cb80d07c849419f555289aa2db7ffe) | ERC-20 test USDT (6 decimals) |
| **LendingPool** | [`0x0deec7879dd4a80f28e2797ee1c14bd6eeec87ac`](https://sepolia.arbiscan.io/address/0x0deec7879dd4a80f28e2797ee1c14bd6eeec87ac) | deposit, requestLoan, approveLoan, repay — 5% APR |
| **TippingPool** | [`0x944e6b54f9b862a5a419d7ed28bd17519f4c599c`](https://sepolia.arbiscan.io/address/0x944e6b54f9b862a5a419d7ed28bd17519f4c599c) | tip, tipBatch, tipSplit, milestone bonuses |
| **YieldVault** | [`0xff747b9d300182ee22332f2cefd46c05acf7bec6`](https://sepolia.arbiscan.io/address/0xff747b9d300182ee22332f2cefd46c05acf7bec6) | share-based vault, agent rebalancing, 10% performance fee |

**Verified on-chain transactions:**
- [Deposit 100 USDT to LendingPool](https://sepolia.arbiscan.io/tx/0xd7052f03cc0f7ae58503405293ca5011f6554d0e0a8242718f9bbaaf95d18273)
- [Request loan (50 USDT, 30 days)](https://sepolia.arbiscan.io/tx/0xb3f9b1dd4e5a9c1b8553651f4d25b7b4c3ebc40009ca0a4cf568a0940fbfbf20)

---

## Hackathon Tracks

### Track 1: Agent Wallets (WDK + OpenClaw)
- 7 deterministic HD wallets via `@tetherto/wdk` + `WalletManagerEvm`
- Agent-to-agent USDT micropayments using `account.transfer()`
- OpenClaw reasoning engine for autonomous decision-making
- Safety: $1.00 per-call spend cap, ACP consensus gating, paywall tx verification
- WDK MCP Server exposes 35 tools for AI agent integration

### Track 2: Lending Bot
- Credit Analyzer scores wallets from on-chain history (ETH balance, tx frequency, account age, nonce)
- Strategy Engine approves/denies loans based on credit score + multi-agent consensus
- LendingPool contract: 5% APR, uncollateralized, autonomous repayment collection every 60s
- Real on-chain USDT settlement on Arbitrum Sepolia

### Track 3: Autonomous DeFi Agent
- Adaptive autopilot: adjusts hunting interval based on confidence (speeds up when uncertain, slows down when confident)
- Yield Scanner finds APY opportunities across DeFi protocols
- Risk Monitor validates protocol health before capital allocation
- WDK protocol modules: Aave deposits (`lending.supply()`), Velora swaps (`swap.swap()`), USDT0 bridges (`bridge.bridge()`)
- Strategy → Execution separation: synthesis layer decides, WDK layer executes

### Track 4: Tipping Bot
- Engagement Monitor analyzes stream chat for viral moments, milestone triggers, engagement keywords
- Conditional tipping: engagement level drives tip amount ($1-$10 USDT based on viral/high/moderate scoring)
- TippingPool contract: `tip()`, `tipBatch()`, `tipSplit()` for collaboration splits
- Milestone bonuses: `MilestoneReached` events when creator earnings cross thresholds
- Built on Rumble's WDK wallet infrastructure

---

## Architecture

```
src/
  config/env.ts              — WDK config, contract addresses, API keys
  config/services.ts         — Service registry with USDT prices
  lib/
    wdk-wallet.ts            — @tetherto/wdk initialization, 7 agent wallets, transfer()
    wdk-protocols.ts         — @tetherto/wdk-protocol-* (Aave, Velora, USDT0)
    openclaw.ts              — OpenClaw reasoning engine (Groq LLM backend)
    paywall.ts               — WDK payment verification middleware
  services/
    sentiment/               — Engagement Monitor (stream chat analysis)
    polymarket/              — Yield Scanner (DeFi APY signals)
    defi/                    — DeFi Scanner (token momentum, USDT/XAUT focus)
    news/                    — Risk Monitor (protocol health, security incidents)
    whale/                   — Credit Analyzer (on-chain credit scoring)
  agent/
    index.ts                 — Strategy Engine coordinator
    wallet.ts                — WDK payment client (agent-to-agent USDT)
    contract-executor.ts     — On-chain contract calls (LendingPool, TippingPool, YieldVault)
    wdk-mcp-server.ts        — MCP server with 35 WDK tools
    acp.ts                   — Alpha Consensus Protocol (stake-weighted voting + slashing)
    synthesis.ts             — Multi-agent signal synthesis with OpenClaw reasoning
    autopilot.ts             — Autonomous hunting with adaptive intervals
    reputation.ts            — Agent reputation tracking + dynamic pricing
    memory.ts                — Pattern learning across hunts
    settlement.ts            — Settlement oracle (CoinGecko price verification)
contracts/
  MockUSDT.sol               — ERC-20 test token
  LendingPool.sol            — P2P lending with credit scoring
  TippingPool.sol            — Community tipping with milestone bonuses
  YieldVault.sol             — Share-based vault with agent rebalancing
web/                         — React 19 + Vite dashboard (10 pages)
```

---

## Quick Start

```bash
git clone <repo-url>
cd galactica-agent
npm install
cp .env.example .env
# Add your WDK_MNEMONIC and GROQ_API_KEY to .env
npm run web:build
npm start
# Open http://localhost:5050
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `WDK_MNEMONIC` | Yes | 12-word BIP-39 mnemonic for agent wallets |
| `WDK_RPC_URL` | Yes | Arbitrum Sepolia RPC endpoint |
| `USDT_CONTRACT` | Yes | Deployed MockUSDT address |
| `GROQ_API_KEY` | No | Groq API key for AI narratives (free at console.groq.com) |
| `CRYPTOPANIC_TOKEN` | No | CryptoPanic API key for news (free registration) |
| `LENDING_POOL_ADDRESS` | Yes | Deployed LendingPool contract |
| `TIPPING_POOL_ADDRESS` | Yes | Deployed TippingPool contract |
| `YIELD_VAULT_ADDRESS` | Yes | Deployed YieldVault contract |
| `INTERNAL_SECRET` | Yes | Shared secret for internal service auth |

---

## Commands

```bash
npm start              # Start all 7 services (supervisor with auto-restart)
npm run demo           # Interactive CLI demo
npm run typecheck      # TypeScript strict check
npm run strategy       # Start strategy engine only
npm run engagement     # Start engagement monitor only
npm run yield          # Start yield scanner only
npm run credit         # Start credit analyzer only
npm run risk           # Start risk monitor only
npm run defi           # Start DeFi scanner only
npm run mcp-server     # Start WDK MCP server (35 tools)
npm run web:dev        # Vite dev server for dashboard
npm run web:build      # Build dashboard for production
```

---

## Tech Stack

- **Runtime**: Node.js 22+ (ESM)
- **Language**: TypeScript (strict)
- **Framework**: Express 5
- **Wallet SDK**: Tether WDK (`@tetherto/wdk` + 5 modules)
- **AI Reasoning**: OpenClaw + Groq LLM (LLaMA 3.3 70B)
- **Smart Contracts**: Solidity 0.8.20 on Arbitrum Sepolia
- **Frontend**: React 19 + Vite
- **Deployment**: Foundry (forge)

---

## Judging Criteria Alignment

| Criterion | How We Address It |
|-----------|-------------------|
| **Technical correctness** | 6 `@tetherto/wdk-*` packages with real SDK calls (`transfer()`, `supply()`, `swap()`, `bridge()`). 3 deployed contracts with verified on-chain transactions. TypeScript strict, zero errors. |
| **Agent autonomy** | Adaptive autopilot with no human input. OpenClaw reasoning generates decisions. ACP consensus with slashing enforces agent accountability. Repayment collector runs autonomously every 60s. |
| **Economic soundness** | Agent-to-agent USDT micropayments with $0.011 margin per hunt. ACP slashing penalizes bad signals. Dynamic pricing adjusts costs by reputation. LendingPool with 5% APR. YieldVault with 10% performance fee. |
| **Real-world applicability** | 10-page React dashboard. Multi-track coverage (lending, DeFi, tipping). Circuit breakers for fault tolerance. Demo mode for easy testing. Real on-chain settlement. |

---

## License

MIT
