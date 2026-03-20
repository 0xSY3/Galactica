/**
 * WDK MCP Server — exposes wallet capabilities as MCP tools for AI agents.
 * Uses @tetherto/wdk-mcp-toolkit to provide wallet, swap, bridge, lending tools.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  WdkMcpServer,
  CHAINS,
  WALLET_TOOLS,
  SWAP_TOOLS,
  BRIDGE_TOOLS,
  LENDING_TOOLS,
  PRICING_TOOLS,
} from "@tetherto/wdk-mcp-toolkit";
import WalletManagerEvm from "@tetherto/wdk-wallet-evm";
import VeloraProtocolEvm from "@tetherto/wdk-protocol-swap-velora-evm";
import Usdt0ProtocolEvm from "@tetherto/wdk-protocol-bridge-usdt0-evm";
import AaveProtocolEvm from "@tetherto/wdk-protocol-lending-aave-evm";
import { config } from "../config/env.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("wdk-mcp");

let server: WdkMcpServer | null = null;

function resolveChainId(network: string): string {
  const map: Record<string, string> = {
    ethereum: CHAINS.ETHEREUM,
    arbitrum: CHAINS.ARBITRUM,
    "arbitrum-sepolia": CHAINS.ARBITRUM,
    polygon: CHAINS.POLYGON,
    base: CHAINS.BASE,
    "base-sepolia": CHAINS.BASE,
    optimism: CHAINS.OPTIMISM,
    avalanche: CHAINS.AVALANCHE,
  };
  return map[network] ?? CHAINS.ARBITRUM;
}

export async function startMcpServer(): Promise<WdkMcpServer> {
  if (server) return server;

  if (!config.wdk.mnemonic) {
    log.warn("no WDK_MNEMONIC set — MCP server running in demo mode (no wallet tools)");

    server = new WdkMcpServer("galactica-wdk", "1.0.0");
    server.usePricing();
    server.registerTools([...PRICING_TOOLS]);

    const transport = new StdioServerTransport();
    await server.connect(transport);
    log.info("MCP server started (demo mode — pricing only)");
    return server;
  }

  const chain = resolveChainId(config.wdk.network);

  server = new WdkMcpServer("galactica-wdk", "1.0.0");
  server
    .useWdk({ seed: config.wdk.mnemonic })
    .registerWallet(chain, WalletManagerEvm, {
      provider: config.wdk.rpcUrl,
    })
    .registerProtocol(chain, "velora", VeloraProtocolEvm)
    .registerProtocol(chain, "usdt0", Usdt0ProtocolEvm)
    .registerProtocol(chain, "aave", AaveProtocolEvm)
    .usePricing();

  // Register USDT/XAUT tokens from config if they differ from defaults
  if (config.wdk.usdtContract) {
    server.registerToken(chain, "USDT", {
      address: config.wdk.usdtContract,
      decimals: 6,
    });
  }
  if (config.wdk.xautContract) {
    server.registerToken(chain, "XAUT", {
      address: config.wdk.xautContract,
      decimals: 6,
    });
  }

  server.registerTools([
    ...WALLET_TOOLS,
    ...SWAP_TOOLS,
    ...BRIDGE_TOOLS,
    ...LENDING_TOOLS,
    ...PRICING_TOOLS,
  ]);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  log.info("MCP server started", {
    chain,
    chains: server.getChains(),
    swapProtocols: server.getSwapChains(),
    bridgeProtocols: server.getBridgeChains(),
    lendingProtocols: server.getLendingChains(),
  });

  return server;
}

export async function stopMcpServer(): Promise<void> {
  if (!server) return;

  try {
    await server.close();
    log.info("MCP server stopped");
  } catch (err) {
    log.error("MCP server stop failed", { error: (err as Error).message });
  } finally {
    server = null;
  }
}

// Direct execution: run as standalone MCP server
const isDirectRun = process.argv[1]?.endsWith("wdk-mcp-server.ts") ||
  process.argv[1]?.endsWith("wdk-mcp-server.js");

if (isDirectRun) {
  startMcpServer().catch((err) => {
    log.error("fatal", { error: (err as Error).message });
    process.exit(1);
  });
}
