# galactica-agent

Multi-agent autonomous financial network for **Galactica Hackathon: WDK Edition 1** — lending, DeFi yield, credit scoring, and creator tipping powered by Tether WDK.

## Project Overview

Seven services: six specialized AI agent microservices + one strategy engine coordinator that pays all six via WDK USDT.

| Service | Port | Endpoint | USDT Price | Track |
|---------|------|----------|-----------|-------|
| engagement-monitor | 4001 | `POST /analyze` | $0.001 | Tipping |
| engagement-monitor-v2 | 4006 | `POST /analyze` | $0.001 | Tipping |
| yield-scanner | 4002 | `POST /scan` | $0.02 | Lending, DeFi |
| defi-scanner | 4003 | `POST /scan` | $0.015 | DeFi |
| risk-monitor | 4004 | `POST /news` | $0.001 | All |
| credit-analyzer | 4005 | `POST /whale` | $0.002 | Lending |
| strategy-engine | 5000 | `POST /hunt` | $0.05 | All |

## Tech Stack

- **Runtime**: Node.js 22+ ESM (`"type": "module"`)
- **Language**: TypeScript (strict, `tsx` runner)
- **Framework**: Express 5
- **Payments**: Tether WDK (`@tetherto/wdk`, `@tetherto/wdk-wallet-evm`)
- **Protocols**: `@tetherto/wdk-protocol-lending-aave-evm`, `@tetherto/wdk-protocol-swap-velora-evm`, `@tetherto/wdk-protocol-bridge-usdt0-evm`
- **AI Toolkit**: `@tetherto/wdk-mcp-toolkit` (35 MCP tools)
- **AI**: OpenClaw reasoning + Groq LLM (llama-3.3-70b)
- **Contracts**: Solidity 0.8.20 (LendingPool, TippingPool, YieldVault)
- **Frontend**: React 19 + Vite

## Commands

```bash
npm start         # Start all 7 services
npm run demo      # Interactive CLI demo
npm run typecheck  # tsc --noEmit
npm run web:dev   # Vite dev server
npm run web:build # Build dashboard
```

## Conventions

- All services use `createService()` from `lib/service-factory.ts`
- All config reads go through `config` from `config/env.ts`
- Shared types live in `types/index.ts`
- WDK wallet operations in `lib/wdk-wallet.ts`
- WDK protocol operations in `lib/wdk-protocols.ts`
- ESM only — `import`/`export`, no `require()`
