---
name: wdk-wallet-operations
description: Tether WDK wallet operations — create wallets, send USDT/XAUT, interact with DeFi protocols
version: 1.0.0
---

# WDK Wallet Operations Skill

This agent uses Tether's Wallet Development Kit (WDK) for all wallet operations.

## Capabilities
- Create HD wallets from seed phrase via `@tetherto/wdk`
- Send USDT transfers via `account.transfer()`
- Send XAUT (Tether Gold) transfers
- Interact with Aave V3 (deposit, borrow, repay) via `@tetherto/wdk-protocol-lending-aave-evm`
- Swap tokens via Velora DEX via `@tetherto/wdk-protocol-swap-velora-evm`
- Bridge assets cross-chain via `@tetherto/wdk-protocol-bridge-usdt0-evm`

## Usage Pattern
```typescript
import WDK from '@tetherto/wdk'
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'

const wdk = new WDK(seedPhrase)
wdk.registerWallet('ethereum', WalletManagerEvm, { provider: rpcUrl })
const account = await wdk.getAccount('ethereum', 0)
await account.transfer({ token: USDT_ADDRESS, recipient: toAddr, amount: value })
```

## MCP Server
The WDK MCP server exposes wallet tools via the Model Context Protocol:
```bash
npm run mcp-server
```

Tools available via MCP: `getAddress`, `getBalance`, `transfer`, `quoteSwap`, `swap`, `quoteBridge`, `bridge`, `quoteSupply`, `supply`, `quoteBorrow`, `borrow`, `getCurrentPrice`.
