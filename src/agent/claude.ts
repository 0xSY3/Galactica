/**
 * Galactica narrative generation — powered by Groq LLM via OpenClaw reasoning.
 * Uses openclaw.ts for structured reasoning, falls back to direct llm.ts calls.
 */

import { callLLMJson, isLLMEnabled } from "../lib/llm.js";
import { queryOpenClaw, isOpenClawEnabled } from "../lib/openclaw.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("narrative");

export { isLLMEnabled as isClaudeEnabled };

// ─── Alpha Narrative ────────────────────────────────────────────────────────

export interface AlphaInput {
  topic: string;
  sentiment?: { label: string; score: number; confidence: string } | null;
  polymarket?: { market: string; signal: string; yesPrice: string } | null;
  defi?: { asset: string; action: string; change24h: string } | null;
  news?: { topHeadline: string; articleCount: number } | null;
  whale?: { signal: string; whaleCount: number; totalVolume: string } | null;
  confidence: string;
  recommendation: string;
  consensusStrength: number;
}

export interface ClaudeNarrative {
  summary: string;
  moltbookTitle: string;
  moltbookBody: string;
  keyInsight: string;
}

export async function generateAlphaNarrative(input: AlphaInput): Promise<ClaudeNarrative | null> {
  const signals: string[] = [];
  if (input.sentiment) signals.push(`Sentiment: ${input.sentiment.label} (score: ${input.sentiment.score})`);
  if (input.polymarket) signals.push(`Polymarket: ${input.polymarket.market} — ${input.polymarket.signal}, YES at ${input.polymarket.yesPrice}`);
  if (input.defi) signals.push(`DeFi: ${input.defi.asset} — ${input.defi.action}, 24h change: ${input.defi.change24h}`);
  if (input.news) signals.push(`News: "${input.news.topHeadline}" (${input.news.articleCount} articles)`);
  if (input.whale) signals.push(`Whale activity: ${input.whale.signal}, ${input.whale.whaleCount} whales, volume: ${input.whale.totalVolume}`);

  // Try OpenClaw reasoning first for the key insight and summary
  if (isOpenClawEnabled()) {
    const openclawResult = await queryOpenClaw(
      `Analyze a multi-source alpha hunt on "${input.topic}" and produce a narrative with: ` +
      "a 2-3 sentence analyst summary, a punchy title (max 80 chars), " +
      "a full post (200-350 words, first person as Galactica, end with disclaimer), " +
      "and one key actionable insight (max 120 chars).",
      {
        topic: input.topic,
        signals,
        confidence: input.confidence,
        recommendation: input.recommendation,
        consensusStrength: `${(input.consensusStrength * 100).toFixed(0)}%`,
      },
    );

    if (openclawResult) {
      log.info("narrative generated via openclaw", { topic: input.topic });
      return {
        summary: openclawResult.reasoning,
        moltbookTitle: openclawResult.decision.slice(0, 80),
        moltbookBody: openclawResult.actions.join("\n\n") || openclawResult.reasoning,
        keyInsight: openclawResult.decision.slice(0, 120),
      };
    }
  }

  // Fallback: direct LLM call for full narrative structure
  const result = await callLLMJson<ClaudeNarrative>(
    `You are Galactica — an autonomous DeFi and prediction market alpha agent. You completed a multi-source intelligence hunt on: "${input.topic}".

Signal data from 5 agents:
${signals.map(s => `- ${s}`).join("\n")}

Assessment:
- Confidence: ${input.confidence}
- Recommendation: ${input.recommendation}
- Consensus: ${(input.consensusStrength * 100).toFixed(0)}% of agents agree

Return ONLY valid JSON, no markdown, no explanation:
{"summary":"2-3 sentence analyst take, direct, data-driven","moltbookTitle":"Punchy title max 80 chars","moltbookBody":"Full post 200-350 words, markdown, first person as Galactica, end with disclaimer","keyInsight":"One-liner max 120 chars, most actionable insight"}`,
    1024,
  );

  if (result) log.info("narrative generated via llm fallback", { topic: input.topic });
  return result;
}

