/**
 * WDK Protocol Integration Layer
 *
 * Registers and exposes Tether WDK protocol modules (Aave lending, Velora swap,
 * USDT0 bridge) so on-chain DeFi operations flow through WDK's native protocol
 * API instead of raw viem writeContract calls.
 */

import AaveProtocolEvm from "@tetherto/wdk-protocol-lending-aave-evm";
import VeloraProtocolEvm from "@tetherto/wdk-protocol-swap-velora-evm";
import Usdt0ProtocolEvm from "@tetherto/wdk-protocol-bridge-usdt0-evm";
import { getWDK, isDemoMode } from "./wdk-wallet.js";
import { createLogger } from "./logger.js";
import { config } from "../config/env.js";
import type { ContractResult } from "../agent/contract-executor.js";

const log = createLogger("wdk-protocols");

const USDT_DECIMALS = 6;

const PROTOCOL_LABELS = {
  aave: "aave",
  velora: "velora",
  usdt0: "usdt0",
} as const;

const CHAIN_NAME = "ethereum";

let protocolsRegistered = false;

function demoResult(action: string): ContractResult {
  log.info("demo protocol call", { action });
  return {
    success: true,
    txHash: `0xdemo_${Date.now().toString(16)}_${action}`,
    demoMode: true,
    action,
  };
}

function failResult(action: string, error: string): ContractResult {
  log.error("protocol call failed", { action, error });
  return { success: false, txHash: null, demoMode: false, action };
}

/**
 * Register all WDK protocol modules with the WDK instance.
 * Safe to call multiple times — registration is idempotent.
 */
export function initializeProtocols(): void {
  if (protocolsRegistered) return;

  const wdk = getWDK();
  if (!wdk) {
    log.info("WDK not available — protocols will operate in demo mode");
    protocolsRegistered = true;
    return;
  }

  try {
    wdk.registerProtocol(CHAIN_NAME, PROTOCOL_LABELS.aave, AaveProtocolEvm, undefined);
    wdk.registerProtocol(CHAIN_NAME, PROTOCOL_LABELS.velora, VeloraProtocolEvm, undefined);
    wdk.registerProtocol(CHAIN_NAME, PROTOCOL_LABELS.usdt0, Usdt0ProtocolEvm, undefined);

    protocolsRegistered = true;
    log.info("WDK protocols registered", {
      protocols: Object.values(PROTOCOL_LABELS),
      chain: CHAIN_NAME,
    });
  } catch (err) {
    log.warn("WDK protocol registration failed — falling back to demo mode", {
      error: (err as Error).message,
    });
    protocolsRegistered = true;
  }
}

// -- Aave Lending -----------------------------------------------------------------

export async function aaveDeposit(amount: number, accountIndex = 6): Promise<ContractResult> {
  const action = `aaveDeposit(${amount} USDT)`;

  if (isDemoMode()) return demoResult(action);

  const wdk = getWDK();
  if (!wdk) return demoResult(action);

  try {
    const account = await wdk.getAccount(CHAIN_NAME, accountIndex);
    const lending = account.getLendingProtocol(PROTOCOL_LABELS.aave);

    const value = BigInt(Math.round(amount * 10 ** USDT_DECIMALS));
    const result = await lending.supply({
      token: config.wdk.usdtContract,
      amount: value,
    });

    log.info("Aave deposit via WDK protocol", { hash: result.hash, amount });
    return { success: true, txHash: result.hash, demoMode: false, action };
  } catch (err) {
    return failResult(action, (err as Error).message);
  }
}

export async function aaveWithdraw(amount: number, accountIndex = 6): Promise<ContractResult> {
  const action = `aaveWithdraw(${amount} USDT)`;

  if (isDemoMode()) return demoResult(action);

  const wdk = getWDK();
  if (!wdk) return demoResult(action);

  try {
    const account = await wdk.getAccount(CHAIN_NAME, accountIndex);
    const lending = account.getLendingProtocol(PROTOCOL_LABELS.aave);

    const value = BigInt(Math.round(amount * 10 ** USDT_DECIMALS));
    const result = await lending.withdraw({
      token: config.wdk.usdtContract,
      amount: value,
    });

    log.info("Aave withdraw via WDK protocol", { hash: result.hash, amount });
    return { success: true, txHash: result.hash, demoMode: false, action };
  } catch (err) {
    return failResult(action, (err as Error).message);
  }
}

// -- Velora Swap ------------------------------------------------------------------

export async function swapTokens(
  fromToken: string,
  toToken: string,
  amount: number,
  accountIndex = 6,
): Promise<ContractResult> {
  const action = `swapTokens(${fromToken.slice(0, 10)}→${toToken.slice(0, 10)}, ${amount})`;

  if (isDemoMode()) return demoResult(action);

  const wdk = getWDK();
  if (!wdk) return demoResult(action);

  try {
    const account = await wdk.getAccount(CHAIN_NAME, accountIndex);
    const swap = account.getSwapProtocol(PROTOCOL_LABELS.velora);

    const value = BigInt(Math.round(amount * 10 ** USDT_DECIMALS));
    const result = await swap.swap({
      tokenIn: fromToken,
      tokenOut: toToken,
      tokenInAmount: value,
    });

    log.info("Velora swap via WDK protocol", {
      hash: result.hash,
      tokenIn: fromToken,
      tokenOut: toToken,
      amountIn: result.tokenInAmount.toString(),
      amountOut: result.tokenOutAmount.toString(),
    });
    return { success: true, txHash: result.hash, demoMode: false, action };
  } catch (err) {
    return failResult(action, (err as Error).message);
  }
}

// -- USDT0 Bridge -----------------------------------------------------------------

export async function bridgeUSDT(
  amount: number,
  destChain: string,
  accountIndex = 6,
): Promise<ContractResult> {
  const action = `bridgeUSDT(${amount} USDT → ${destChain})`;

  if (isDemoMode()) return demoResult(action);

  const wdk = getWDK();
  if (!wdk) return demoResult(action);

  try {
    const account = await wdk.getAccount(CHAIN_NAME, accountIndex);
    const bridge = account.getBridgeProtocol(PROTOCOL_LABELS.usdt0);
    const senderAddress = await account.getAddress();

    const value = BigInt(Math.round(amount * 10 ** USDT_DECIMALS));
    const result = await bridge.bridge({
      targetChain: destChain,
      recipient: senderAddress,
      token: config.wdk.usdtContract,
      amount: value,
    });

    log.info("USDT0 bridge via WDK protocol", {
      hash: result.hash,
      amount,
      destChain,
      bridgeFee: result.bridgeFee.toString(),
    });
    return { success: true, txHash: result.hash, demoMode: false, action };
  } catch (err) {
    return failResult(action, (err as Error).message);
  }
}
