import { createService } from "../../lib/service-factory.js";
import { ApiCache } from "../../lib/cache.js";
import { config } from "../../config/env.js";
import { createPublicClient, http, formatEther, type PublicClient } from "viem";
import { base } from "viem/chains";

const publicClient: PublicClient = createPublicClient({
  chain: base,
  transport: http(config.baseMainnetRpcUrl),
}) as PublicClient;

interface CreditFactor {
  factor: string;
  value: string;
  score: number;
  weight: number;
  contribution: number;
}

interface CreditResult {
  address: string;
  creditScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  maxLoanUsdt: number;
  factors: CreditFactor[];
  confidenceScore: number;
  confidenceBasis: string;
}

const creditCache = new ApiCache<CreditResult>();
const CACHE_TTL = 120_000;

const { app, log, start } = createService({
  name: "whale",
  displayName: "credit-analyzer",
  port: config.ports.whale,
  routes: {
    "POST /whale": {
      price: "$0.002",
      description: "On-chain credit scoring — analyze wallet transaction history on Base mainnet",
    },
  },
  healthExtra: () => ({ network: "base-mainnet", rpcUrl: config.baseMainnetRpcUrl }),
});

async function analyzeWallet(address: string): Promise<CreditResult> {
  const factors: CreditFactor[] = [];
  let totalWeightedScore = 0;
  let totalWeight = 0;

  // Factor 1: ETH Balance (weight: 0.30)
  const balanceWeight = 0.30;
  let balanceScore = 0;
  let balanceValue = "0 ETH";
  try {
    const balance = await publicClient.getBalance({ address: address as `0x${string}` });
    const ethBalance = parseFloat(formatEther(balance));
    balanceValue = `${ethBalance.toFixed(4)} ETH`;

    if (ethBalance >= 10) balanceScore = 100;
    else if (ethBalance >= 5) balanceScore = 85;
    else if (ethBalance >= 1) balanceScore = 70;
    else if (ethBalance >= 0.5) balanceScore = 55;
    else if (ethBalance >= 0.1) balanceScore = 40;
    else if (ethBalance >= 0.01) balanceScore = 25;
    else balanceScore = 10;
  } catch (err) {
    log.warn("balance check failed", { error: (err as Error).message });
    balanceScore = 0;
  }
  factors.push({
    factor: "ETH Balance",
    value: balanceValue,
    score: balanceScore,
    weight: balanceWeight,
    contribution: balanceScore * balanceWeight,
  });
  totalWeightedScore += balanceScore * balanceWeight;
  totalWeight += balanceWeight;

  // Factor 2: Transaction frequency (weight: 0.30)
  const txWeight = 0.30;
  let txScore = 0;
  let txCount = 0;
  try {
    const latestBlock = await publicClient.getBlockNumber();
    const sampleRange = 500n;
    const fromBlock = latestBlock > sampleRange ? latestBlock - sampleRange : 0n;

    const batchSize = 10;
    const blockNums: bigint[] = [];
    for (let i = 0n; i < 50n && fromBlock + i * 10n <= latestBlock; i++) {
      blockNums.push(latestBlock - i * 10n);
    }

    const blocks = await Promise.all(
      blockNums.slice(0, batchSize).map((bn) =>
        publicClient.getBlock({ blockNumber: bn, includeTransactions: true }).catch(() => null),
      ),
    );

    const addr = address.toLowerCase();
    for (const block of blocks) {
      if (!block?.transactions || !Array.isArray(block.transactions)) continue;
      for (const tx of block.transactions) {
        if (typeof tx === "string") continue;
        if (tx.from?.toLowerCase() === addr || tx.to?.toLowerCase() === addr) {
          txCount++;
        }
      }
    }

    if (txCount >= 10) txScore = 95;
    else if (txCount >= 5) txScore = 75;
    else if (txCount >= 3) txScore = 60;
    else if (txCount >= 1) txScore = 40;
    else txScore = 15;
  } catch (err) {
    log.warn("tx frequency check failed", { error: (err as Error).message });
    txScore = 10;
  }
  factors.push({
    factor: "Transaction Frequency",
    value: `${txCount} txs in sample`,
    score: txScore,
    weight: txWeight,
    contribution: txScore * txWeight,
  });
  totalWeightedScore += txScore * txWeight;
  totalWeight += txWeight;

  // Factor 3: Account age estimate (weight: 0.25)
  const ageWeight = 0.25;
  let ageScore = 0;
  let ageValue = "unknown";
  try {
    const latestBlock = await publicClient.getBlockNumber();
    const checkpoints = [
      latestBlock - 1_000_000n,
      latestBlock - 5_000_000n,
      latestBlock - 10_000_000n,
    ].filter((b) => b > 0n);

    let oldestActivity = latestBlock;
    for (const checkpoint of checkpoints) {
      try {
        const nonce = await publicClient.getTransactionCount({
          address: address as `0x${string}`,
          blockNumber: checkpoint,
        });
        if (nonce > 0) {
          oldestActivity = checkpoint;
        }
      } catch {
        // RPC may not support historical state
      }
    }

    const blockAge = latestBlock - oldestActivity;
    const estimatedDays = Number(blockAge) * 2 / 86400;

    if (estimatedDays > 200) { ageScore = 95; ageValue = "200+ days"; }
    else if (estimatedDays > 100) { ageScore = 80; ageValue = "100+ days"; }
    else if (estimatedDays > 30) { ageScore = 60; ageValue = "30+ days"; }
    else if (estimatedDays > 7) { ageScore = 40; ageValue = "7+ days"; }
    else { ageScore = 20; ageValue = "<7 days"; }
  } catch (err) {
    log.warn("age estimate failed", { error: (err as Error).message });
    ageScore = 20;
    ageValue = "unknown";
  }
  factors.push({
    factor: "Account Age",
    value: ageValue,
    score: ageScore,
    weight: ageWeight,
    contribution: ageScore * ageWeight,
  });
  totalWeightedScore += ageScore * ageWeight;
  totalWeight += ageWeight;

  // Factor 4: Nonce as proxy for token diversity / overall activity (weight: 0.15)
  const diversityWeight = 0.15;
  let diversityScore = 0;
  let nonceValue = 0;
  try {
    nonceValue = await publicClient.getTransactionCount({
      address: address as `0x${string}`,
    });

    if (nonceValue >= 100) diversityScore = 95;
    else if (nonceValue >= 50) diversityScore = 80;
    else if (nonceValue >= 20) diversityScore = 65;
    else if (nonceValue >= 10) diversityScore = 50;
    else if (nonceValue >= 5) diversityScore = 35;
    else if (nonceValue >= 1) diversityScore = 20;
    else diversityScore = 5;
  } catch (err) {
    log.warn("nonce check failed", { error: (err as Error).message });
    diversityScore = 5;
  }
  factors.push({
    factor: "On-chain Activity (nonce)",
    value: `${nonceValue} total txs`,
    score: diversityScore,
    weight: diversityWeight,
    contribution: diversityScore * diversityWeight,
  });
  totalWeightedScore += diversityScore * diversityWeight;
  totalWeight += diversityWeight;

  const creditScore = Math.round(totalWeight > 0 ? totalWeightedScore / totalWeight : 0);

  let riskLevel: "LOW" | "MEDIUM" | "HIGH";
  if (creditScore >= 70) riskLevel = "LOW";
  else if (creditScore >= 40) riskLevel = "MEDIUM";
  else riskLevel = "HIGH";

  // Max loan: $100 per credit point for LOW risk, $50 for MEDIUM, $20 for HIGH
  const multiplier = riskLevel === "LOW" ? 100 : riskLevel === "MEDIUM" ? 50 : 20;
  const maxLoanUsdt = creditScore * multiplier;

  const confidenceScore = Math.min(1,
    (totalWeight > 0 ? 0.4 : 0) +
    (balanceScore > 0 ? 0.2 : 0) +
    (txCount > 0 ? 0.2 : 0) +
    (nonceValue > 0 ? 0.1 : 0) +
    (ageScore > 20 ? 0.1 : 0),
  );
  const confidenceBasis = `${factors.filter((f) => f.score > 0).length}/4 factors available, score ${creditScore}/100`;

  return {
    address,
    creditScore,
    riskLevel,
    maxLoanUsdt,
    factors,
    confidenceScore: parseFloat(confidenceScore.toFixed(3)),
    confidenceBasis,
  };
}

app.post("/whale", async (req, res) => {
  const body = req.body as Record<string, unknown> | undefined;
  const rawAddr = body?.["address"] as string | undefined;
  const address = rawAddr && /^0x[a-fA-F0-9]{40}$/.test(rawAddr) ? rawAddr : undefined;

  if (!address) {
    res.status(400).json({
      service: "credit-analyzer",
      timestamp: new Date().toISOString(),
      error: "Valid EVM address required — provide 'address' field (0x + 40 hex chars)",
      code: "VALIDATION_ERROR",
    });
    return;
  }

  const cacheKey = `credit:${address.toLowerCase()}`;

  try {
    let result: CreditResult;
    let cached = false;
    let cacheAge: number | undefined;

    if (creditCache.isFresh(cacheKey)) {
      result = creditCache.get(cacheKey)!;
      cached = true;
      cacheAge = creditCache.age(cacheKey);
    } else {
      try {
        result = await analyzeWallet(address);
        creditCache.set(cacheKey, result, CACHE_TTL);
        log.info("credit analysis complete", { address, creditScore: result.creditScore, riskLevel: result.riskLevel });
      } catch (err) {
        log.warn("live analysis failed", { error: (err as Error).message });
        if (creditCache.has(cacheKey)) {
          result = creditCache.get(cacheKey)!;
          cached = true;
          cacheAge = creditCache.age(cacheKey);
        } else {
          throw new Error("API_UNAVAILABLE");
        }
      }
    }

    log.info("credit", {
      address,
      creditScore: result.creditScore,
      riskLevel: result.riskLevel,
      maxLoanUsdt: result.maxLoanUsdt,
      cached,
      confidenceScore: result.confidenceScore.toFixed(3),
    });

    res.json({
      service: "credit-analyzer",
      timestamp: new Date().toISOString(),
      network: "base-mainnet",
      result: {
        address: result.address,
        creditScore: result.creditScore,
        riskLevel: result.riskLevel,
        maxLoanUsdt: result.maxLoanUsdt,
        factors: result.factors,
        confidenceScore: result.confidenceScore,
        confidenceBasis: result.confidenceBasis,
        source: "base-mainnet-rpc",
      },
      ...(cached ? { cached: true, cacheAge } : {}),
    });
  } catch (err) {
    const msg = (err as Error).message;
    log.error("credit analysis failed", { error: msg });
    res.status(502).json({
      service: "credit-analyzer",
      timestamp: new Date().toISOString(),
      network: "base-mainnet",
      error: "Base mainnet RPC unavailable",
      code: "API_UNAVAILABLE",
      cached: false,
    });
  }
});

start();
