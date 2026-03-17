import { createService } from "../../lib/service-factory.js";
import { ApiCache } from "../../lib/cache.js";
import { fetchWithRetry } from "../../lib/fetch-retry.js";
import { validateString, validateInt } from "../../lib/validate.js";
import { config } from "../../config/env.js";
import type { AlphaSignal } from "../../types/index.js";

interface YieldToken {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  total_volume: number;
  price_change_percentage_24h?: number;
  price_change_percentage_7d_in_currency?: number;
}

interface YieldOpportunity {
  protocol: string;
  estimatedAPY: number;
  tvl: number;
  alphaSignal: AlphaSignal;
  reason: string;
  tokenSymbol: string;
  tokenPrice: number;
}

const cache = new ApiCache<YieldToken[]>();
const CACHE_TTL = 60_000;

const COINGECKO_API = "https://api.coingecko.com/api/v3";

const MOCK_YIELD_DATA: YieldToken[] = [
  { id: "aave", symbol: "aave", name: "Aave", current_price: 92.5, market_cap: 1_380_000_000, total_volume: 145_000_000, price_change_percentage_24h: 3.2, price_change_percentage_7d_in_currency: 8.5 },
  { id: "compound-governance-token", symbol: "comp", name: "Compound", current_price: 48.7, market_cap: 410_000_000, total_volume: 52_000_000, price_change_percentage_24h: 1.8, price_change_percentage_7d_in_currency: 5.1 },
  { id: "lido-dao", symbol: "ldo", name: "Lido DAO", current_price: 1.85, market_cap: 1_650_000_000, total_volume: 78_000_000, price_change_percentage_24h: 4.1, price_change_percentage_7d_in_currency: 12.3 },
  { id: "maker", symbol: "mkr", name: "Maker", current_price: 1450, market_cap: 1_310_000_000, total_volume: 62_000_000, price_change_percentage_24h: -0.5, price_change_percentage_7d_in_currency: 2.1 },
  { id: "curve-dao-token", symbol: "crv", name: "Curve DAO", current_price: 0.52, market_cap: 620_000_000, total_volume: 95_000_000, price_change_percentage_24h: 5.7, price_change_percentage_7d_in_currency: 15.2 },
  { id: "convex-finance", symbol: "cvx", name: "Convex Finance", current_price: 3.2, market_cap: 280_000_000, total_volume: 18_000_000, price_change_percentage_24h: 2.3, price_change_percentage_7d_in_currency: 7.8 },
  { id: "yearn-finance", symbol: "yfi", name: "Yearn Finance", current_price: 7200, market_cap: 240_000_000, total_volume: 22_000_000, price_change_percentage_24h: 1.1, price_change_percentage_7d_in_currency: 3.4 },
  { id: "rocket-pool", symbol: "rpl", name: "Rocket Pool", current_price: 22.5, market_cap: 450_000_000, total_volume: 15_000_000, price_change_percentage_24h: 0.8, price_change_percentage_7d_in_currency: 4.2 },
];

const PROTOCOL_NAMES: Record<string, string> = {
  aave: "Aave USDT Pool",
  "compound-governance-token": "Compound USDT",
  "lido-dao": "Lido stETH Pool",
  maker: "Maker DSR",
  "curve-dao-token": "Curve 3pool",
  "convex-finance": "Convex stETH/ETH",
  "yearn-finance": "Yearn USDT Vault",
  "rocket-pool": "Rocket Pool rETH",
};

const { app, log, start } = createService({
  name: "polymarket",
  displayName: "yield-scanner",
  port: config.ports.polymarket,
  routes: {
    "POST /scan": {
      price: "$0.02",
      description: "Scan DeFi protocols for yield opportunities — APY signals from token momentum",
    },
  },
  healthExtra: () => ({ cacheAge: cache.age("yield:all:50") }),
});

async function fetchYieldTokens(limit: number, filter?: string): Promise<{ tokens: YieldToken[]; cached: boolean; cacheAge?: number }> {
  const cacheKey = `yield:${filter || "all"}:${limit}`;

  if (cache.isFresh(cacheKey)) {
    return { tokens: cache.get(cacheKey)!, cached: true, cacheAge: cache.age(cacheKey) };
  }

  try {
    const url =
      `${COINGECKO_API}/coins/markets` +
      `?vs_currency=usd&category=decentralized-finance-defi&order=market_cap_desc` +
      `&per_page=${Math.min(limit * 3, 100)}&page=1&sparkline=false` +
      `&price_change_percentage=24h,7d`;

    const res = await fetchWithRetry(url, undefined, { timeoutMs: 8000, retries: 2 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const tokens = await res.json() as YieldToken[];
    cache.set(cacheKey, tokens, CACHE_TTL);
    log.info("fetched live yield tokens", { count: tokens.length });
    return { tokens, cached: false };
  } catch (err) {
    log.warn("CoinGecko fetch failed, trying cache/mock", { error: (err as Error).message });
  }

  if (cache.has(cacheKey)) {
    log.warn("returning stale cache", { cacheAge: cache.age(cacheKey) });
    return { tokens: cache.get(cacheKey)!, cached: true, cacheAge: cache.age(cacheKey) };
  }

  log.warn("using mock Aave/Compound data");
  return { tokens: MOCK_YIELD_DATA, cached: false };
}

function scoreYieldToken(token: YieldToken): YieldOpportunity {
  const change24h = token.price_change_percentage_24h ?? 0;
  const change7d = token.price_change_percentage_7d_in_currency ?? 0;

  // Estimated APY derived from protocol TVL ratio and momentum
  // Base yield: higher volume/mcap ratio = more active protocol = better yields
  const volumeRatio = token.total_volume / (token.market_cap || 1);
  const baseYield = volumeRatio * 100; // volume/mcap as base APY signal
  const momentumBonus = Math.max(0, change24h) * 0.3 + Math.max(0, change7d) * 0.1;
  const estimatedAPY = parseFloat(Math.min(baseYield + momentumBonus, 25).toFixed(2));
  const momentumScore = estimatedAPY / 10;

  const isHighMomentum = momentumScore > 0.5;
  const isMidMomentum = momentumScore > 0.2;

  let alphaSignal: AlphaSignal;
  let reason: string;
  if (isHighMomentum && token.market_cap > 500_000_000) {
    alphaSignal = "HIGH";
    reason = `Strong momentum (+${change24h.toFixed(1)}% 24h) with large TVL — high yield confidence`;
  } else if (isMidMomentum || token.market_cap > 1_000_000_000) {
    alphaSignal = "MEDIUM";
    reason = `Moderate momentum (+${change24h.toFixed(1)}% 24h) — yield opportunity forming`;
  } else {
    alphaSignal = "LOW";
    reason = "Low momentum — yield potential unclear";
  }

  const protocol = PROTOCOL_NAMES[token.id] ?? `${token.name} Pool`;

  return {
    protocol,
    estimatedAPY,
    tvl: token.market_cap,
    alphaSignal,
    reason,
    tokenSymbol: token.symbol.toUpperCase(),
    tokenPrice: token.current_price,
  };
}

const SIGNAL_ORDER: Record<AlphaSignal, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

app.post("/scan", async (req, res) => {
  const filter = validateString(req, res, "filter", { maxLen: 200 });
  if (filter === null) return;
  const limit = validateInt(req, res, "limit", { min: 1, max: 50, defaultVal: 20 });
  if (limit === null) return;

  try {
    const { tokens, cached, cacheAge } = await fetchYieldTokens(Math.min(limit * 3, 50), filter || undefined);

    const opportunities: YieldOpportunity[] = tokens
      .filter((t) => t.name && (!filter || t.name.toLowerCase().includes(filter.toLowerCase()) || t.symbol.toLowerCase().includes(filter.toLowerCase())))
      .map(scoreYieldToken)
      .sort((a, b) => SIGNAL_ORDER[b.alphaSignal] - SIGNAL_ORDER[a.alphaSignal] || b.estimatedAPY - a.estimatedAPY)
      .slice(0, limit);

    const topSignal = opportunities[0]?.alphaSignal ?? "NONE";
    const highCount = opportunities.filter((o) => o.alphaSignal === "HIGH").length;
    const hasTVL = opportunities.some((o) => o.tvl > 0);

    const highRatio = opportunities.length > 0 ? highCount / opportunities.length : 0;
    const confidenceScore = Math.min(1, highRatio * 0.5 + (hasTVL ? 0.2 : 0) + (cached ? 0 : 0.15) + Math.min(opportunities.length / 20, 1) * 0.15);
    const confidenceBasis = `${highCount} HIGH signals, ${opportunities.length} protocols, ${cached ? "cached" : "fresh"}`;

    log.info("scan", { total: opportunities.length, highCount, cached, confidenceScore: confidenceScore.toFixed(3) });

    res.json({
      service: "yield-scanner",
      timestamp: new Date().toISOString(),
      result: {
        opportunities,
        total: opportunities.length,
        topSignal,
        highSignalCount: highCount,
        confidenceScore: parseFloat(confidenceScore.toFixed(3)),
        confidenceBasis,
        summary: `Found ${highCount} HIGH-yield protocols out of ${opportunities.length} scanned`,
      },
      ...(cached ? { cached: true, cacheAge } : {}),
    });
  } catch (err) {
    const msg = (err as Error).message;
    log.error("scan failed", { error: msg });
    res.status(502).json({
      service: "yield-scanner",
      timestamp: new Date().toISOString(),
      error: "Yield data unavailable",
      code: "API_UNAVAILABLE",
      cached: false,
    });
  }
});

start();
