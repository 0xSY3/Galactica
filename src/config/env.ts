import dotenv from "dotenv";
import { randomBytes } from "crypto";

dotenv.config();

export interface AppConfig {
  groq: {
    apiKey: string;
    model: string;
  };
  wdk: {
    mnemonic: string;
    network: string;
    rpcUrl: string;
    usdtContract: string;
    xautContract: string;
  };
  corsOrigins: string;
  cryptoPanicToken: string;
  baseRpcUrl: string;
  baseMainnetRpcUrl: string;
  ports: {
    sentiment: number;
    sentiment2: number;
    polymarket: number;
    defi: number;
    news: number;
    whale: number;
    agent: number;
  };
  telegram: {
    botToken: string;
    chatId: string;
    alertThreshold: number;
  };
  contracts: {
    lendingPoolAddress: string;
    tippingPoolAddress: string;
    yieldVaultAddress: string;
  };
  lending: {
    aavePoolAddress: string;
    compoundCTokenAddress: string;
    minYieldThresholdBps: number;
  };
  tipping: {
    rumbleApiKey: string;
    defaultTipUsdt: number;
    poolAddress: string;
    creatorAddress: string;
  };
  bridgeDefaultChain: string;
  openclaw: {
    mode: string;
  };
  autopilot: {
    baseIntervalMs: number;
    minIntervalMs: number;
    maxIntervalMs: number;
    topics: string[];
  };
  internalSecret: string;
}

function env(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function envInt(key: string, fallback: number): number {
  const v = process.env[key];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function envFloat(key: string, fallback: number): number {
  const v = process.env[key];
  if (!v) return fallback;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

export const config: AppConfig = Object.freeze({
  groq: Object.freeze({
    apiKey: env("GROQ_API_KEY", ""),
    model: env("GROQ_MODEL", "llama-3.3-70b-versatile"),
  }),
  wdk: Object.freeze({
    mnemonic: env("WDK_MNEMONIC", ""),
    network: env("WDK_NETWORK", "arbitrum"),
    rpcUrl: env("WDK_RPC_URL", "https://arb-sepolia.g.alchemy.com/v2/demo"),
    usdtContract: env("USDT_CONTRACT", ""),
    xautContract: env("XAUT_CONTRACT", "0x68749665FF8D2d112Fa859AA293F07A622782F38"),
  }),
  corsOrigins: env("CORS_ORIGINS", "*"),
  cryptoPanicToken: env("CRYPTOPANIC_TOKEN", ""),
  baseRpcUrl: env("BASE_RPC_URL", "https://sepolia.base.org"),
  baseMainnetRpcUrl: env("BASE_MAINNET_RPC_URL", "https://mainnet.base.org"),
  ports: Object.freeze({
    sentiment: envInt("PORT_SENTIMENT", 4001),
    sentiment2: envInt("PORT_SENTIMENT2", 4006),
    polymarket: envInt("PORT_POLYMARKET", 4002),
    defi: envInt("PORT_DEFI", 4003),
    news: envInt("PORT_NEWS", 4004),
    whale: envInt("PORT_WHALE", 4005),
    agent: envInt("PORT_AGENT", 5000),
  }),
  telegram: Object.freeze({
    botToken: env("TELEGRAM_BOT_TOKEN", ""),
    chatId: env("TELEGRAM_CHAT_ID", ""),
    alertThreshold: envInt("TELEGRAM_ALERT_THRESHOLD", 50),
  }),
  contracts: Object.freeze({
    lendingPoolAddress: env("LENDING_POOL_ADDRESS", ""),
    tippingPoolAddress: env("TIPPING_POOL_ADDRESS", ""),
    yieldVaultAddress: env("YIELD_VAULT_ADDRESS", ""),
  }),
  lending: Object.freeze({
    aavePoolAddress: env("AAVE_POOL_ADDRESS", ""),
    compoundCTokenAddress: env("COMPOUND_CTOKEN_ADDRESS", ""),
    minYieldThresholdBps: envInt("MIN_YIELD_THRESHOLD_BPS", 300),
  }),
  tipping: Object.freeze({
    rumbleApiKey: env("RUMBLE_API_KEY", ""),
    defaultTipUsdt: envFloat("DEFAULT_TIP_USDT", 1.0),
    poolAddress: env("TIPPING_POOL_ADDRESS", ""),
    creatorAddress: env("CREATOR_ADDRESS", ""),
  }),
  bridgeDefaultChain: env("DEFAULT_BRIDGE_CHAIN", "polygon"),
  openclaw: Object.freeze({
    mode: env("OPENCLAW_MODE", "embedded"),
  }),
  internalSecret: env("INTERNAL_SECRET", randomBytes(32).toString("hex")),
  autopilot: Object.freeze({
    baseIntervalMs: envInt("AUTOPILOT_INTERVAL_MS", 30_000),
    minIntervalMs: envInt("AUTOPILOT_MIN_INTERVAL_MS", 30_000),
    maxIntervalMs: envInt("AUTOPILOT_MAX_INTERVAL_MS", 15 * 60_000),
    topics: Object.freeze(
      env("AUTOPILOT_TOPICS", "USDT lending,yield farming,DeFi alpha,credit scoring,tipping").split(",").map(t => t.trim()),
    ) as unknown as string[],
  }),
});
