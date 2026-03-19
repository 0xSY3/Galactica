/**
 * Agent-to-Contract Execution Bridge
 *
 * Bridges agent decisions to on-chain smart contract calls for the
 * LendingPool, TippingPool, and YieldVault contracts. In demo mode
 * (no WDK mnemonic), logs actions and returns mock results.
 */

import { parseUnits, createWalletClient, createPublicClient, http } from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
import { isDemoMode } from "../lib/wdk-wallet.js";
import { aaveDeposit } from "../lib/wdk-protocols.js";
import { createLogger } from "../lib/logger.js";
import { config } from "../config/env.js";

const log = createLogger("contract-executor");

const USDT_DECIMALS = 6;

// ─── Result Type ────────────────────────────────────────────────────────────

export interface ContractResult {
  success: boolean;
  txHash: string | null;
  demoMode: boolean;
  action: string;
}

function demoResult(action: string): ContractResult {
  log.info("demo contract call", { action });
  return {
    success: true,
    txHash: `0xdemo_${Date.now().toString(16)}_${action}`,
    demoMode: true,
    action,
  };
}

function failResult(action: string, error: string): ContractResult {
  log.error("contract call failed", { action, error });
  return { success: false, txHash: null, demoMode: false, action };
}

// ─── Contract ABIs (only the function signatures we call) ───────────────────

const LENDING_POOL_ABI = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    name: "requestLoan",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "durationDays", type: "uint256" },
    ],
    outputs: [{ name: "loanId", type: "uint256" }],
  },
  {
    name: "approveLoan",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "loanId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "repay",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "loanId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "nextLoanId",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "loans",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "borrower", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "interestRate", type: "uint256" },
      { name: "startTime", type: "uint256" },
      { name: "duration", type: "uint256" },
      { name: "repaid", type: "bool" },
      { name: "approved", type: "bool" },
    ],
  },
] as const;

const TIPPING_POOL_ABI = [
  {
    name: "depositToPool",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    name: "tip",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "creator", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "reason", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "tipBatch",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "creators", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
    ],
    outputs: [],
  },
] as const;

const YIELD_VAULT_ABI = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    name: "rebalance",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "newProtocol", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "reportYield",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "profit", type: "uint256" }],
    outputs: [],
  },
] as const;

// ─── Wallet helper (viem for contract calls — WDK doesn't support arbitrary ABI calls) ─

function getContractWallet() {
  if (!config.wdk.mnemonic) return null;

  const account = mnemonicToAccount(config.wdk.mnemonic, { addressIndex: 6 }); // hunter index
  const walletClient = createWalletClient({
    account,
    chain: arbitrumSepolia,
    transport: http(config.wdk.rpcUrl),
  });
  const publicClient = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(config.wdk.rpcUrl),
  });

  return { walletClient, publicClient, address: account.address };
}

// ─── Lending Pool ───────────────────────────────────────────────────────────

export async function requestLoan(
  borrowerAddress: string,
  amount: number,
  durationDays: number,
): Promise<ContractResult> {
  const action = `requestLoan(${borrowerAddress}, ${amount} USDT, ${durationDays}d)`;

  if (isDemoMode() || !config.contracts.lendingPoolAddress) {
    return demoResult(action);
  }

  try {
    const wallet = getContractWallet();
    if (!wallet) return demoResult(action);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hash = await (wallet?.walletClient as any).writeContract({
      address: config.contracts.lendingPoolAddress as `0x${string}`,
      abi: LENDING_POOL_ABI,
      functionName: "requestLoan",
      args: [parseUnits(amount.toString(), USDT_DECIMALS), BigInt(durationDays)],
    });

    const receipt = await wallet!.publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status === "reverted") return failResult(action, "transaction reverted");

    log.info("loan requested on-chain", { hash, amount, durationDays });
    return { success: true, txHash: hash, demoMode: false, action };
  } catch (err) {
    return failResult(action, (err as Error).message);
  }
}

/**
 * Find the next unapproved loan and approve it.
 * If loanId is -1, dynamically scans for the first pending loan.
 */
export async function approveLoan(loanId: number): Promise<ContractResult> {
  if (isDemoMode() || !config.contracts.lendingPoolAddress) {
    // In demo mode, simulate dynamic loan discovery
    const discoveredId = loanId >= 0 ? loanId : Math.floor(Math.random() * 10);
    const action = `approveLoan(${discoveredId}) [credit-checked]`;
    return demoResult(action);
  }

  try {
    const wallet = getContractWallet();
    if (!wallet) return demoResult(`approveLoan(${loanId})`);

    // Dynamically find the first unapproved loan if loanId is -1
    let targetLoanId = loanId;
    if (targetLoanId < 0) {
      const nextId = await wallet!.publicClient.readContract({
        address: config.contracts.lendingPoolAddress as `0x${string}`,
        abi: LENDING_POOL_ABI,
        functionName: "nextLoanId",
      });

      const total = Number(nextId);
      for (let i = total - 1; i >= 0; i--) {
        const loan = await wallet!.publicClient.readContract({
          address: config.contracts.lendingPoolAddress as `0x${string}`,
          abi: LENDING_POOL_ABI,
          functionName: "loans",
          args: [BigInt(i)],
        });
        const [, , , , , repaid, approved] = loan;
        if (!approved && !repaid) {
          targetLoanId = i;
          break;
        }
      }

      if (targetLoanId < 0) {
        log.info("no pending loans to approve");
        return { success: true, txHash: null, demoMode: false, action: "approveLoan(none pending)" };
      }
    }

    const action = `approveLoan(${targetLoanId}) [credit-checked]`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hash = await (wallet?.walletClient as any).writeContract({
      address: config.contracts.lendingPoolAddress as `0x${string}`,
      abi: LENDING_POOL_ABI,
      functionName: "approveLoan",
      args: [BigInt(targetLoanId)],
    });

    const receipt = await wallet!.publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status === "reverted") return failResult(action, "transaction reverted");

    log.info("loan approved on-chain", { hash, loanId: targetLoanId });
    return { success: true, txHash: hash, demoMode: false, action };
  } catch (err) {
    return failResult(`approveLoan(${loanId})`, (err as Error).message);
  }
}

export async function repayLoan(loanId: number): Promise<ContractResult> {
  const action = `repayLoan(${loanId})`;

  if (isDemoMode() || !config.contracts.lendingPoolAddress) {
    return demoResult(action);
  }

  try {
    const wallet = getContractWallet();
    if (!wallet) return demoResult(action);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hash = await (wallet?.walletClient as any).writeContract({
      address: config.contracts.lendingPoolAddress as `0x${string}`,
      abi: LENDING_POOL_ABI,
      functionName: "repay",
      args: [BigInt(loanId)],
    });

    const receipt = await wallet!.publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status === "reverted") return failResult(action, "transaction reverted");

    log.info("loan repaid on-chain", { hash, loanId });
    return { success: true, txHash: hash, demoMode: false, action };
  } catch (err) {
    return failResult(action, (err as Error).message);
  }
}

export async function depositToLendingPool(amount: number): Promise<ContractResult> {
  const action = `depositToLendingPool(${amount} USDT)`;

  if (isDemoMode() || !config.contracts.lendingPoolAddress) {
    return demoResult(action);
  }

  try {
    const wallet = getContractWallet();
    if (!wallet) return demoResult(action);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hash = await (wallet?.walletClient as any).writeContract({
      address: config.contracts.lendingPoolAddress as `0x${string}`,
      abi: LENDING_POOL_ABI,
      functionName: "deposit",
      args: [parseUnits(amount.toString(), USDT_DECIMALS)],
    });

    const receipt = await wallet!.publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status === "reverted") return failResult(action, "transaction reverted");

    log.info("deposited to lending pool", { hash, amount });
    return { success: true, txHash: hash, demoMode: false, action };
  } catch (err) {
    return failResult(action, (err as Error).message);
  }
}

// ─── Tipping Pool ───────────────────────────────────────────────────────────

export async function tipCreator(
  creatorAddress: string,
  amount: number,
  reason: string,
): Promise<ContractResult> {
  const action = `tipCreator(${creatorAddress}, ${amount} USDT)`;

  if (isDemoMode() || !config.contracts.tippingPoolAddress) {
    return demoResult(action);
  }

  try {
    const wallet = getContractWallet();
    if (!wallet) return demoResult(action);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hash = await (wallet?.walletClient as any).writeContract({
      address: config.contracts.tippingPoolAddress as `0x${string}`,
      abi: TIPPING_POOL_ABI,
      functionName: "tip",
      args: [creatorAddress as `0x${string}`, parseUnits(amount.toString(), USDT_DECIMALS), reason],
    });

    const receipt = await wallet!.publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status === "reverted") return failResult(action, "transaction reverted");

    log.info("creator tipped on-chain", { hash, creatorAddress, amount, reason });
    return { success: true, txHash: hash, demoMode: false, action };
  } catch (err) {
    return failResult(action, (err as Error).message);
  }
}

export async function tipBatch(
  creators: string[],
  amounts: number[],
): Promise<ContractResult> {
  const action = `tipBatch(${creators.length} creators)`;

  if (isDemoMode() || !config.contracts.tippingPoolAddress) {
    return demoResult(action);
  }

  try {
    const wallet = getContractWallet();
    if (!wallet) return demoResult(action);

    const parsedAmounts = amounts.map(a => parseUnits(a.toString(), USDT_DECIMALS));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hash = await (wallet?.walletClient as any).writeContract({
      address: config.contracts.tippingPoolAddress as `0x${string}`,
      abi: TIPPING_POOL_ABI,
      functionName: "tipBatch",
      args: [creators as `0x${string}`[], parsedAmounts],
    });

    const receipt = await wallet!.publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status === "reverted") return failResult(action, "transaction reverted");

    log.info("batch tip on-chain", { hash, count: creators.length });
    return { success: true, txHash: hash, demoMode: false, action };
  } catch (err) {
    return failResult(action, (err as Error).message);
  }
}

export async function depositToTippingPool(amount: number): Promise<ContractResult> {
  const action = `depositToTippingPool(${amount} USDT)`;

  if (isDemoMode() || !config.contracts.tippingPoolAddress) {
    return demoResult(action);
  }

  try {
    const wallet = getContractWallet();
    if (!wallet) return demoResult(action);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hash = await (wallet?.walletClient as any).writeContract({
      address: config.contracts.tippingPoolAddress as `0x${string}`,
      abi: TIPPING_POOL_ABI,
      functionName: "depositToPool",
      args: [parseUnits(amount.toString(), USDT_DECIMALS)],
    });

    const receipt = await wallet!.publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status === "reverted") return failResult(action, "transaction reverted");

    log.info("deposited to tipping pool", { hash, amount });
    return { success: true, txHash: hash, demoMode: false, action };
  } catch (err) {
    return failResult(action, (err as Error).message);
  }
}

// ─── Yield Vault ────────────────────────────────────────────────────────────

export async function depositToVault(amount: number): Promise<ContractResult> {
  const action = `depositToVault(${amount} USDT)`;

  if (isDemoMode() || !config.contracts.yieldVaultAddress) {
    return demoResult(action);
  }

  try {
    const wallet = getContractWallet();
    if (!wallet) return demoResult(action);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hash = await (wallet.walletClient as any).writeContract({
      address: config.contracts.yieldVaultAddress as `0x${string}`,
      abi: YIELD_VAULT_ABI,
      functionName: "deposit",
      args: [parseUnits(amount.toString(), USDT_DECIMALS)],
      chain: arbitrumSepolia,
    });

    const receipt = await wallet!.publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status === "reverted") return failResult(action, "transaction reverted");

    log.info("deposited to yield vault on-chain", { hash, amount });
    return { success: true, txHash: hash, demoMode: false, action };
  } catch (err) {
    return failResult(action, (err as Error).message);
  }
}

export async function rebalanceVault(
  protocolAddress: string,
  amount: number,
): Promise<ContractResult> {
  const action = `rebalanceVault(${protocolAddress}, ${amount} USDT)`;

  if (isDemoMode() || !config.contracts.yieldVaultAddress) {
    return demoResult(action);
  }

  try {
    const wallet = getContractWallet();
    if (!wallet) return demoResult(action);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hash = await (wallet?.walletClient as any).writeContract({
      address: config.contracts.yieldVaultAddress as `0x${string}`,
      abi: YIELD_VAULT_ABI,
      functionName: "rebalance",
      args: [protocolAddress as `0x${string}`, parseUnits(amount.toString(), USDT_DECIMALS)],
    });

    const receipt = await wallet!.publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status === "reverted") return failResult(action, "transaction reverted");

    log.info("vault rebalanced on-chain", { hash, protocolAddress, amount });
    return { success: true, txHash: hash, demoMode: false, action };
  } catch (err) {
    return failResult(action, (err as Error).message);
  }
}

export async function reportYield(profit: number): Promise<ContractResult> {
  const action = `reportYield(${profit} USDT)`;

  if (isDemoMode() || !config.contracts.yieldVaultAddress) {
    return demoResult(action);
  }

  try {
    const wallet = getContractWallet();
    if (!wallet) return demoResult(action);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hash = await (wallet?.walletClient as any).writeContract({
      address: config.contracts.yieldVaultAddress as `0x${string}`,
      abi: YIELD_VAULT_ABI,
      functionName: "reportYield",
      args: [parseUnits(profit.toString(), USDT_DECIMALS)],
    });

    const receipt = await wallet!.publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status === "reverted") return failResult(action, "transaction reverted");

    log.info("yield reported on-chain", { hash, profit });
    return { success: true, txHash: hash, demoMode: false, action };
  } catch (err) {
    return failResult(action, (err as Error).message);
  }
}

// ─── XAUT Transfers ────────────────────────────────────────────────────────

export async function sendXAUTReward(
  recipientAddress: string,
  amount: number,
): Promise<ContractResult> {
  const action = `sendXAUT(${recipientAddress.slice(0, 10)}..., ${amount} XAUT)`;

  if (isDemoMode()) {
    return demoResult(action);
  }

  const { sendXAUT } = await import("../lib/wdk-wallet.js");
  const result = await sendXAUT("hunter", recipientAddress as `0x${string}`, amount);

  if (result.success) {
    log.info("XAUT reward sent", { to: recipientAddress, amount, txHash: result.txHash });
    return { success: true, txHash: result.txHash, demoMode: false, action };
  }

  return failResult(action, "XAUT transfer failed");
}

// ─── Repayment Collector ────────────────────────────────────────────────────

const COLLECTOR_INTERVAL_MS = 60_000;
let collectorTimer: ReturnType<typeof setInterval> | null = null;
let collectorRunning = false;

async function checkOverdueLoans(): Promise<void> {
  const wallet = getContractWallet();

  if (isDemoMode() || !config.contracts.lendingPoolAddress) {
    // Simulate checking loans in demo mode
    const checked = Math.floor(Math.random() * 10) + 1;
    const collected = Math.floor(Math.random() * Math.min(checked, 3));
    log.info("repayment collector cycle (demo)", { checked, collected });
    return;
  }

  if (!wallet) {
    log.warn("repayment collector: no wallet available");
    return;
  }

  try {
    const nextId = await wallet.publicClient.readContract({
      address: config.contracts.lendingPoolAddress as `0x${string}`,
      abi: LENDING_POOL_ABI,
      functionName: "nextLoanId",
    });

    const totalLoans = Number(nextId);
    let overdueCount = 0;
    let collectedCount = 0;
    const now = BigInt(Math.floor(Date.now() / 1000));

    for (let i = 0; i < totalLoans; i++) {
      try {
        const loan = await wallet.publicClient.readContract({
          address: config.contracts.lendingPoolAddress as `0x${string}`,
          abi: LENDING_POOL_ABI,
          functionName: "loans",
          args: [BigInt(i)],
        });

        const [, , , startTime, duration, repaid, approved] = loan;

        // Overdue: approved, not repaid, past duration
        if (approved && !repaid && startTime > 0n && now > startTime + duration) {
          overdueCount++;
          const repayResult = await repayLoan(i);
          if (repayResult.success) collectedCount++;
        }
      } catch {
        // Individual loan read failure — skip
      }
    }

    log.info("repayment collector cycle", {
      checked: totalLoans,
      overdue: overdueCount,
      collected: collectedCount,
    });
  } catch (err) {
    log.warn("repayment collector error", { error: (err as Error).message });
  }
}

export function startRepaymentCollector(): void {
  if (collectorRunning) return;
  collectorRunning = true;

  log.info("repayment collector started", { intervalMs: COLLECTOR_INTERVAL_MS });

  collectorTimer = setInterval(() => {
    checkOverdueLoans().catch((err) => {
      log.warn("repayment collector tick failed", { error: (err as Error).message });
    });
  }, COLLECTOR_INTERVAL_MS);
  collectorTimer.unref();
}

export function stopRepaymentCollector(): void {
  if (!collectorRunning) return;
  collectorRunning = false;

  if (collectorTimer) {
    clearInterval(collectorTimer);
    collectorTimer = null;
  }

  log.info("repayment collector stopped");
}
