/**
 * Tether WDK Wallet Manager — using the REAL @tetherto/wdk SDK.
 *
 * Each microservice agent gets its own deterministic wallet derived from the master seed phrase.
 * Uses WDK's native wallet management for USDT/XAUT transfers across EVM chains.
 */

import WDK from "@tetherto/wdk";
import WalletManagerEvm from "@tetherto/wdk-wallet-evm";
import { createLogger } from "./logger.js";
import { config } from "../config/env.js";

const log = createLogger("wdk");

const USDT_DECIMALS = 6;
const XAUT_DECIMALS = 6;

// WDK chain name mapping
const CHAIN_NAME_MAP: Record<string, string> = {
  "ethereum": "ethereum",
  "arbitrum": "ethereum",
  "arbitrum-sepolia": "ethereum",
  "base": "ethereum",
  "base-sepolia": "ethereum",
  "polygon": "ethereum",
};

export interface AgentWallet {
  address: string;
  agentKey: string;
  accountIndex: number;
  demoMode: boolean;
}

export interface TransferResult {
  success: boolean;
  txHash: string | null;
  amount: string;
  token: "USDT" | "XAUT";
  from: string;
  to: string;
  demoMode: boolean;
}

// Global WDK instance
let wdkInstance: InstanceType<typeof WDK> | null = null;
const agentWallets = new Map<string, AgentWallet>();

const AGENT_DERIVATION_INDICES: Record<string, number> = {
  sentiment: 0,
  sentiment2: 1,
  polymarket: 2,
  defi: 3,
  news: 4,
  whale: 5,
  hunter: 6,
};

export function isDemoMode(): boolean {
  return !config.wdk.mnemonic;
}

export function getWDK(): InstanceType<typeof WDK> | null {
  if (wdkInstance) return wdkInstance;
  if (!config.wdk.mnemonic) return null;

  try {
    const wdk = new WDK(config.wdk.mnemonic);

    // Register EVM wallet with the configured RPC
    wdk.registerWallet("ethereum", WalletManagerEvm, {
      provider: config.wdk.rpcUrl,
    });

    wdkInstance = wdk;

    log.info("WDK initialized", { network: config.wdk.network, rpc: config.wdk.rpcUrl });
    return wdkInstance;
  } catch (err) {
    log.warn("WDK initialization failed — falling back to demo mode", { error: (err as Error).message });
    return null;
  }
}

export async function createAgentWallet(agentKey: string): Promise<AgentWallet> {
  const existing = agentWallets.get(agentKey);
  if (existing) return existing;

  const index = AGENT_DERIVATION_INDICES[agentKey] ?? Object.keys(AGENT_DERIVATION_INDICES).length;
  let address = `0x${"0".repeat(40)}`;

  const wdk = getWDK();
  if (wdk) {
    try {
      const chainName = CHAIN_NAME_MAP[config.wdk.network] ?? "ethereum";
      const account = await wdk.getAccount(chainName, index);
      address = await account.getAddress();
      log.info("WDK agent wallet created", { agent: agentKey, address, index });
    } catch (err) {
      log.warn("WDK wallet creation failed", { agent: agentKey, error: (err as Error).message });
    }
  } else {
    // Deterministic demo addresses
    const demoAddresses: Record<string, string> = {
      sentiment:  "0x1111111111111111111111111111111111111001",
      sentiment2: "0x1111111111111111111111111111111111111002",
      polymarket: "0x1111111111111111111111111111111111111003",
      defi:       "0x1111111111111111111111111111111111111004",
      news:       "0x1111111111111111111111111111111111111005",
      whale:      "0x1111111111111111111111111111111111111006",
      hunter:     "0x1111111111111111111111111111111111111007",
    };
    address = demoAddresses[agentKey] ?? `0x${"0".repeat(40)}`;
    log.info("demo wallet assigned", { agent: agentKey, address });
  }

  const wallet: AgentWallet = {
    address,
    agentKey,
    accountIndex: index,
    demoMode: !wdk,
  };

  agentWallets.set(agentKey, wallet);
  return wallet;
}

export async function sendUSDT(
  fromAgent: string,
  toAddress: string,
  amount: number,
): Promise<TransferResult> {
  const wallet = agentWallets.get(fromAgent) ?? await createAgentWallet(fromAgent);
  const result: TransferResult = {
    success: false,
    txHash: null,
    amount: amount.toFixed(USDT_DECIMALS),
    token: "USDT",
    from: wallet.address,
    to: toAddress,
    demoMode: wallet.demoMode,
  };

  if (wallet.demoMode) {
    log.info("demo USDT transfer", { from: fromAgent, to: toAddress, amount });
    result.success = true;
    result.txHash = `0xdemo_${Date.now().toString(16)}_${fromAgent}`;
    return result;
  }

  const wdk = getWDK();
  if (!wdk) return result;

  try {
    const chainName = CHAIN_NAME_MAP[config.wdk.network] ?? "ethereum";
    const account = await wdk.getAccount(chainName, wallet.accountIndex);

    // WDK native token transfer
    const value = BigInt(Math.round(amount * 10 ** USDT_DECIMALS));
    const txResult = await account.transfer({
      token: config.wdk.usdtContract,
      recipient: toAddress,
      amount: value,
    });

    result.success = true;
    result.txHash = txResult.hash ?? null;
    log.info("WDK USDT transfer confirmed", { from: fromAgent, to: toAddress, amount, hash: result.txHash });
    return result;
  } catch (err) {
    log.error("WDK USDT transfer failed", { from: fromAgent, to: toAddress, error: (err as Error).message });
    return result;
  }
}

export async function sendXAUT(
  fromAgent: string,
  toAddress: string,
  amount: number,
): Promise<TransferResult> {
  const wallet = agentWallets.get(fromAgent) ?? await createAgentWallet(fromAgent);
  const result: TransferResult = {
    success: false,
    txHash: null,
    amount: amount.toFixed(XAUT_DECIMALS),
    token: "XAUT",
    from: wallet.address,
    to: toAddress,
    demoMode: wallet.demoMode,
  };

  if (!config.wdk.xautContract) {
    log.warn("XAUT contract not configured");
    return result;
  }

  if (wallet.demoMode) {
    log.info("demo XAUT transfer", { from: fromAgent, to: toAddress, amount });
    result.success = true;
    result.txHash = `0xdemo_xaut_${Date.now().toString(16)}_${fromAgent}`;
    return result;
  }

  const wdk = getWDK();
  if (!wdk) return result;

  try {
    const chainName = CHAIN_NAME_MAP[config.wdk.network] ?? "ethereum";
    const account = await wdk.getAccount(chainName, wallet.accountIndex);

    const value = BigInt(Math.round(amount * 10 ** XAUT_DECIMALS));
    const txResult = await account.transfer({
      token: config.wdk.xautContract,
      recipient: toAddress,
      amount: value,
    });

    result.success = true;
    result.txHash = txResult.hash ?? null;
    log.info("WDK XAUT transfer confirmed", { from: fromAgent, to: toAddress, amount, hash: result.txHash });
    return result;
  } catch (err) {
    log.error("WDK XAUT transfer failed", { from: fromAgent, to: toAddress, error: (err as Error).message });
    return result;
  }
}

export async function getUSDTBalance(agentKey: string): Promise<string> {
  const wallet = agentWallets.get(agentKey) ?? await createAgentWallet(agentKey);

  if (wallet.demoMode) return "10000.00";

  const wdk = getWDK();
  if (!wdk) return "0.00";

  try {
    const chainName = CHAIN_NAME_MAP[config.wdk.network] ?? "ethereum";
    const account = await wdk.getAccount(chainName, wallet.accountIndex);
    const balance = await account.getTokenBalance(config.wdk.usdtContract);
    return (Number(balance) / 10 ** USDT_DECIMALS).toFixed(2);
  } catch (err) {
    log.warn("balance check failed", { agent: agentKey, error: (err as Error).message });
    return "0.00";
  }
}

export function getAgentAddress(agentKey: string): string {
  const wallet = agentWallets.get(agentKey);
  return wallet?.address ?? `0x${"0".repeat(40)}`;
}

export function getAllAgentWallets(): { key: string; address: string; demoMode: boolean }[] {
  return Array.from(agentWallets.entries()).map(([key, w]) => ({
    key,
    address: w.address,
    demoMode: w.demoMode,
  }));
}

export async function initializeAllWallets(): Promise<void> {
  const agents = ["sentiment", "sentiment2", "polymarket", "defi", "news", "whale", "hunter"];
  for (const agent of agents) {
    await createAgentWallet(agent);
  }
  log.info("all agent wallets initialized", {
    count: agents.length,
    mode: isDemoMode() ? "demo" : "live",
    network: config.wdk.network,
    sdk: "@tetherto/wdk",
  });
}

// Re-export WDK class for direct access if needed
export { WDK, WalletManagerEvm };
