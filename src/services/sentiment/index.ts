import { createService } from "../../lib/service-factory.js";
import { validateString } from "../../lib/validate.js";
import { config } from "../../config/env.js";
import { callLLMJson, isLLMEnabled } from "../../lib/llm.js";
import { BULL_WORDS, BEAR_WORDS, STRONG_BULL, STRONG_BEAR, BULL_PHRASES, BEAR_PHRASES, NEGATIONS } from "./lexicon.js";
import type { SentimentLabel, ConfidenceLevel, SentimentSignal } from "../../types/index.js";

const MAX_STAKE = 100;

type EngagementLevel = "viral" | "high" | "moderate" | "low" | "dead";

const ENGAGEMENT_KEYWORDS: Record<string, number> = {
  hype: 3, amazing: 2, subscribe: 2, tip: 3, fire: 2,
  goat: 3, insane: 2, legendary: 3, epic: 2, clutch: 2,
  cracked: 2, banger: 3, sheesh: 2, pog: 2, pogchamp: 3,
  letsgoooo: 3, lfg: 3, w: 1, dub: 2, massive: 2,
  donate: 3, gifted: 2, raid: 2, host: 2, follow: 1,
  share: 1, repost: 1, clip: 2, highlight: 2, peak: 2,
  goated: 3, bussin: 2, slay: 2, based: 2, chad: 2,
  king: 2, queen: 2, god: 2, nuts: 2, wild: 1,
  unreal: 2, broken: 1, gg: 1, ez: 1, carried: 2,
};

const NEGATIVE_ENGAGEMENT: Record<string, number> = {
  boring: -2, dead: -3, sleeper: -2, mid: -1, trash: -2,
  ratio: -1, l: -1, skip: -2, meh: -1, yawn: -2,
  cringe: -2, fake: -2, bot: -2, scam: -3, snooze: -2,
  terrible: -2, worst: -2, leave: -1, unfollow: -2, bye: -1,
};

const { app, log, start } = createService({
  name: "sentiment",
  displayName: "engagement-monitor",
  port: config.ports.sentiment,
  routes: {
    "POST /analyze": {
      price: "$0.001",
      description: "Stream engagement analysis — detect viral moments and tip-worthy content from chat",
    },
  },
});

// -- AI Engagement Analysis (primary) --

interface AIEngagementResult {
  engagementLevel: EngagementLevel;
  score: number;
  confidence: ConfidenceLevel;
  reasoning: string;
  keyPhrases: string[];
  tipRecommendation: string;
}

async function aiEngagement(text: string): Promise<AIEngagementResult | null> {
  return callLLMJson<AIEngagementResult>(
    `You are a live stream engagement analyzer. Analyze this chat message or stream metadata for audience engagement signals.

Text: "${text.slice(0, 3000)}"

Consider: hype levels, tip/donation intent, subscription signals, viral potential, spam detection, and overall audience energy.

Return ONLY valid JSON:
{"engagementLevel":"viral|high|moderate|low|dead","score":<float 0.0 to 1.0>,"confidence":"high|medium|low","reasoning":"<1 sentence why>","keyPhrases":["<up to 5 key engagement signals>"],"tipRecommendation":"<tip action: e.g. 'tip $5 — viral moment' or 'hold — low engagement'>"}`,
    256,
  );
}

// -- Lexicon Engagement (fallback) --
// Reuses the existing lexicon infrastructure but interprets scores as engagement levels

function lexiconEngagement(text: string): { engagementLevel: EngagementLevel; score: number; confidence: ConfidenceLevel; signals: SentimentSignal[] } {
  const lower = text.toLowerCase();
  const words = lower.split(/[\s,.\-!?;:()[\]{}'"]+/).filter(Boolean);
  const origWords = text.split(/[\s,.\-;:()[\]{}'"]+/).filter(Boolean);

  let engagementScore = 0;
  const signals: SentimentSignal[] = [];

  // Phase 1: Engagement keyword detection
  for (let i = 0; i < words.length; i++) {
    const raw = words[i]!;
    const clean = raw.replace(/[^a-z0-9]/g, "");
    if (!clean) continue;

    const origWord = origWords[i] ?? raw;
    const isAllCaps = origWord.length > 2 && origWord === origWord.toUpperCase() && /[A-Z]/.test(origWord);
    const hasExclaim = origWord.endsWith("!");

    let modifier = 1.0;
    if (isAllCaps) modifier *= 1.5;
    if (hasExclaim) modifier *= 1.3;

    const engScore = ENGAGEMENT_KEYWORDS[clean];
    if (engScore !== undefined) {
      const pts = engScore * modifier;
      engagementScore += pts;
      signals.push({ word: clean, type: "STRONG_BULL", score: pts });
    }

    const negScore = NEGATIVE_ENGAGEMENT[clean];
    if (negScore !== undefined) {
      const pts = Math.abs(negScore) * modifier;
      engagementScore -= pts;
      signals.push({ word: clean, type: "STRONG_BEAR", score: -pts });
    }
  }

  // Phase 2: Also check existing lexicon for overlap (hype words map to bullish)
  const lowerJoined = " " + words.join(" ") + " ";
  for (const [phrase, pts] of BULL_PHRASES) {
    if (lowerJoined.includes(` ${phrase} `)) {
      engagementScore += pts * 0.5;
      signals.push({ word: phrase, type: "BULL", score: pts * 0.5 });
    }
  }

  for (let i = 0; i < words.length; i++) {
    const clean = (words[i] ?? "").replace(/[^a-z0-9]/g, "");
    if (!clean) continue;

    const prevWord = i > 0 ? (words[i - 1]?.replace(/[^a-z']/g, "") ?? "") : "";
    const negated = NEGATIONS.has(prevWord);

    const bullScore = BULL_WORDS.get(clean);
    if (bullScore !== undefined && STRONG_BULL.has(clean)) {
      const pts = bullScore * 0.3;
      if (negated) { engagementScore -= pts; }
      else { engagementScore += pts; }
    }

    const bearScore = BEAR_WORDS.get(clean);
    if (bearScore !== undefined && STRONG_BEAR.has(clean)) {
      const pts = bearScore * 0.3;
      if (negated) { engagementScore += pts; }
      else { engagementScore -= pts; }
    }
  }

  // Normalize to 0-1
  const normalized = Math.max(0, Math.min(1, engagementScore / Math.max(words.length * 0.3, 1)));

  let engagementLevel: EngagementLevel;
  let confidence: ConfidenceLevel;
  if (normalized > 0.7)       { engagementLevel = "viral";    confidence = "high";   }
  else if (normalized > 0.4)  { engagementLevel = "high";     confidence = "high";   }
  else if (normalized > 0.2)  { engagementLevel = "moderate"; confidence = "medium"; }
  else if (normalized > 0.05) { engagementLevel = "low";      confidence = "medium"; }
  else                        { engagementLevel = "dead";     confidence = "low";    }

  return { engagementLevel, score: parseFloat(normalized.toFixed(3)), confidence, signals };
}

function engagementToTipRecommendation(level: EngagementLevel, score: number): string {
  switch (level) {
    case "viral":    return `TIP $${(score * 10).toFixed(2)} — viral moment detected`;
    case "high":     return `TIP $${(score * 5).toFixed(2)} — high engagement worth rewarding`;
    case "moderate": return `TIP $${(score * 2).toFixed(2)} — decent engagement`;
    case "low":      return "HOLD — engagement too low for tipping";
    case "dead":     return "SKIP — no engagement detected";
  }
}

function engagementToSentiment(level: EngagementLevel): SentimentLabel {
  switch (level) {
    case "viral":    return "strongly_bullish";
    case "high":     return "bullish";
    case "moderate": return "neutral";
    case "low":      return "bearish";
    case "dead":     return "strongly_bearish";
  }
}

// -- Route --

app.post("/analyze", async (req, res) => {
  const text = validateString(req, res, "text", { required: true, maxLen: 5000 });
  if (text === null) return;

  let engagementLevel: EngagementLevel;
  let score: number;
  let confidence: ConfidenceLevel;
  let signals: SentimentSignal[] = [];
  let reasoning: string | undefined;
  let keyPhrases: string[] | undefined;
  let tipRecommendation: string;
  let source: "ai" | "lexicon" = "lexicon";

  if (isLLMEnabled()) {
    const ai = await aiEngagement(text);
    if (ai) {
      engagementLevel = ai.engagementLevel;
      score = Math.max(0, Math.min(1, ai.score));
      confidence = ai.confidence;
      reasoning = ai.reasoning;
      keyPhrases = ai.keyPhrases;
      tipRecommendation = ai.tipRecommendation;
      source = "ai";
      signals = (ai.keyPhrases ?? []).map(p => ({
        word: p,
        type: (score > 0.5 ? "STRONG_BULL" : score > 0.2 ? "BULL" : "BEAR") as SentimentSignal["type"],
        score,
      }));
    } else {
      const fallback = lexiconEngagement(text);
      engagementLevel = fallback.engagementLevel;
      score = fallback.score;
      confidence = fallback.confidence;
      signals = fallback.signals;
      tipRecommendation = engagementToTipRecommendation(engagementLevel, score);
    }
  } else {
    const fallback = lexiconEngagement(text);
    engagementLevel = fallback.engagementLevel;
    score = fallback.score;
    confidence = fallback.confidence;
    signals = fallback.signals;
    tipRecommendation = engagementToTipRecommendation(engagementLevel, score);
  }

  // Map engagement to sentiment label for ACP compatibility
  const label = engagementToSentiment(engagementLevel);

  const confMap: Record<string, number> = { high: 0.85, medium: 0.6, low: 0.35 };
  const confidenceScore = Math.min(1, (confMap[confidence] ?? 0.35) * 0.6 + score * 0.25 + Math.min(signals.length / 10, 1) * 0.15);
  const confidenceBasis = `${source} ${confidence} + ${score.toFixed(2)} engagement + ${signals.length} signals`;

  log.info("analyze", { source, engagementLevel, score, signalCount: signals.length, confidenceScore: confidenceScore.toFixed(3) });

  // ACP protocol headers — high engagement maps to bullish (bullish for tipping)
  const acpDirection = (label === "strongly_bullish" || label === "bullish") ? "bullish"
    : (label === "strongly_bearish" || label === "bearish") ? "bearish" : "neutral";
  res.setHeader("X-ACP-Direction", acpDirection);
  res.setHeader("X-ACP-Confidence", confidenceScore.toFixed(3));
  res.setHeader("X-ACP-Stake", (MAX_STAKE * confidenceScore).toFixed(2));
  res.setHeader("X-ACP-Version", "1");

  res.json({
    service: "engagement-monitor",
    timestamp: new Date().toISOString(),
    result: {
      score,
      label,
      engagementLevel,
      tipRecommendation,
      confidence,
      confidenceScore: parseFloat(confidenceScore.toFixed(3)),
      confidenceBasis,
      signals: signals.slice(0, 20),
      wordCount: text.split(/\s+/).length,
      ...(reasoning ? { reasoning } : {}),
      ...(keyPhrases ? { keyPhrases } : {}),
      source,
    },
  });
});

start();
