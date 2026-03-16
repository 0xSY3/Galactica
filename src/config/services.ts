import { config } from "./env.js";
import type { ServiceKey, DynamicPrice } from "../types/index.js";

export interface ServiceDef {
  key: string;
  logName: string;
  displayName: string;
  port: number;
  endpoint: string;
  method: "POST" | "GET";
  price: string;
  description: string;
  entryFile: string;
}

export const SERVICE_DEFS: Record<string, ServiceDef> = {
  sentiment: {
    key: "sentiment",
    logName: "engagement",
    displayName: "engagement-monitor",
    port: config.ports.sentiment,
    endpoint: "/analyze",
    method: "POST",
    price: "$0.001",
    description: "Rumble stream engagement analysis — viewer sentiment, milestone detection, tip triggers",
    entryFile: "src/services/sentiment/index.ts",
  },
  sentiment2: {
    key: "sentiment2",
    logName: "engagement-v2",
    displayName: "engagement-monitor-v2",
    port: config.ports.sentiment2,
    endpoint: "/analyze",
    method: "POST",
    price: "$0.001",
    description: "Conservative engagement analysis — competing agent with higher tip thresholds",
    entryFile: "src/services/sentiment-v2/index.ts",
  },
  polymarket: {
    key: "polymarket",
    logName: "yield",
    displayName: "yield-scanner",
    port: config.ports.polymarket,
    endpoint: "/scan",
    method: "POST",
    price: "$0.02",
    description: "Scan Aave, Compound, and Curve for USDT/XAUT yield opportunities",
    entryFile: "src/services/polymarket/index.ts",
  },
  defi: {
    key: "defi",
    logName: "defi",
    displayName: "defi-scanner",
    port: config.ports.defi,
    endpoint: "/scan",
    method: "POST",
    price: "$0.015",
    description: "Scan DeFi markets for USDT/XAUT opportunities — momentum, yield, and arbitrage signals",
    entryFile: "src/services/defi/index.ts",
  },
  news: {
    key: "news",
    logName: "risk",
    displayName: "risk-monitor",
    port: config.ports.news,
    endpoint: "/news",
    method: "POST",
    price: "$0.001",
    description: "Protocol health monitoring — TVL changes, security incidents, risk scoring",
    entryFile: "src/services/news/index.ts",
  },
  whale: {
    key: "whale",
    logName: "credit",
    displayName: "credit-analyzer",
    port: config.ports.whale,
    endpoint: "/whale",
    method: "POST",
    price: "$0.002",
    description: "On-chain credit scoring — wallet history analysis for lending risk assessment",
    entryFile: "src/services/whale/index.ts",
  },
  hunter: {
    key: "hunter",
    logName: "strategy",
    displayName: "strategy-engine",
    port: config.ports.agent,
    endpoint: "/hunt",
    method: "POST",
    price: "$0.05",
    description: "Galactica Strategy Engine — multi-agent synthesis for lending, DeFi, and tipping decisions",
    entryFile: "src/agent/index.ts",
  },
};

export function serviceUrl(key: string): string {
  const def = SERVICE_DEFS[key];
  if (!def) throw new Error(`Unknown service: ${key}`);
  return `http://localhost:${def.port}`;
}

let _getRepScore: ((key: ServiceKey) => number) | null = null;

export function setReputationProvider(fn: (key: ServiceKey) => number): void {
  _getRepScore = fn;
}

let _getAgentPrice: ((key: string) => string | null) | null = null;
let _getAllKeys: (() => string[]) | null = null;

export function setRegistryProvider(
  getAgentPriceFn: (key: string) => string | null,
  getAllKeysFn: () => string[],
): void {
  _getAgentPrice = getAgentPriceFn;
  _getAllKeys = getAllKeysFn;
}

function parsePrice(p: string): number {
  return parseFloat(p.replace("$", ""));
}

export function getEffectivePrice(key: ServiceKey): DynamicPrice {
  const def = SERVICE_DEFS[key];
  let basePrice = def?.price ?? null;

  if (!basePrice && _getAgentPrice) {
    basePrice = _getAgentPrice(key);
  }

  const baseNum = basePrice ? parsePrice(basePrice) : 0;
  const rep = _getRepScore ? _getRepScore(key) : 0.5;
  const multiplier = parseFloat((0.5 + rep).toFixed(3));
  const effective = parseFloat((baseNum * multiplier).toFixed(4));
  return {
    service: key,
    basePrice: basePrice ?? "$0",
    effectivePrice: `$${effective}`,
    multiplier,
    reputation: parseFloat(rep.toFixed(3)),
  };
}

export function getAllDynamicPrices(): DynamicPrice[] {
  const builtinKeys: string[] = ["sentiment", "sentiment2", "polymarket", "defi", "news", "whale"];
  const allKeys = _getAllKeys ? _getAllKeys() : builtinKeys;
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const k of builtinKeys) { seen.add(k); keys.push(k); }
  for (const k of allKeys) { if (!seen.has(k)) { seen.add(k); keys.push(k); } }
  return keys.map(getEffectivePrice);
}
