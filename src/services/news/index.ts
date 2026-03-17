import { createService } from "../../lib/service-factory.js";
import { ApiCache } from "../../lib/cache.js";
import { fetchWithRetry } from "../../lib/fetch-retry.js";
import { validateString, validateInt } from "../../lib/validate.js";
import { config } from "../../config/env.js";
import { callLLMJson, isLLMEnabled } from "../../lib/llm.js";
import type { NewsArticle, CryptoPanicResponse } from "../../types/index.js";

const cache = new ApiCache<NewsArticle[]>();
const CACHE_TTL = 300_000;

type RiskLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "SAFE";

interface ProtocolRisk {
  protocol: string;
  riskScore: number;
  mentions: number;
  riskKeywords: string[];
}

const RISK_KEYWORDS: Record<string, number> = {
  hack: 10, hacked: 10, exploit: 10, exploited: 10,
  vulnerability: 8, vulnerable: 8,
  "rug pull": 10, rugpull: 10, rug: 8,
  depeg: 9, depegged: 9,
  insolvency: 9, insolvent: 9, bankrupt: 9, bankruptcy: 9,
  audit: 3, "failed audit": 8,
  "tvl drop": 7, "tvl decline": 7,
  breach: 8, compromised: 8,
  drain: 8, drained: 8,
  flash: 5, "flash loan": 6,
  phishing: 7, malware: 7,
  freeze: 6, frozen: 6,
  lawsuit: 5, sued: 5,
  shutdown: 7, "shut down": 7,
  scam: 9, fraud: 8,
  "price manipulation": 8, manipulation: 6,
  warning: 4, alert: 4, caution: 4,
};

// Positive signals that reduce risk
const SAFE_KEYWORDS: Record<string, number> = {
  "audit passed": -5, "no issues": -3, secure: -2, secured: -2,
  partnership: -2, upgrade: -2, growth: -2, record: -1,
  "all clear": -4, resolved: -3, patched: -3, fixed: -3,
  recovery: -2, recovered: -2,
};

const KNOWN_PROTOCOLS = [
  "aave", "compound", "uniswap", "curve", "maker", "lido",
  "convex", "yearn", "sushi", "balancer", "synthetix", "euler",
  "frax", "rocket pool", "chainlink", "tether", "usdc", "dai",
  "pax gold", "xaut", "gmx", "dydx", "blur", "opensea",
];

const { app, log, start } = createService({
  name: "news",
  displayName: "risk-monitor",
  port: config.ports.news,
  routes: {
    "POST /news": {
      price: "$0.001",
      description: "Protocol risk monitoring — scan news for hacks, exploits, and risk signals",
    },
  },
  healthExtra: () => ({ configured: !!config.cryptoPanicToken }),
});

const CRYPTOPANIC_API = "https://cryptopanic.com/api/developer/v2/posts/";

async function fetchCryptoPanic(topic: string, limit: number): Promise<{ articles: NewsArticle[]; cached: boolean; cacheAge?: number }> {
  const cacheKey = `news:${topic}`;

  if (cache.isFresh(cacheKey)) {
    const articles = cache.get(cacheKey)!.slice(0, limit);
    return { articles, cached: true, cacheAge: cache.age(cacheKey) };
  }

  try {
    const params = new URLSearchParams({
      auth_token: config.cryptoPanicToken,
      currencies: topic,
      filter: "hot",
      kind: "news",
      public: "true",
    });

    const res = await fetchWithRetry(
      `${CRYPTOPANIC_API}?${params}`,
      undefined,
      { timeoutMs: 8000, retries: 2 },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json() as CryptoPanicResponse;
    const articles: NewsArticle[] = (data.results ?? []).map((p) => ({
      title: p.title,
      description: p.description ?? p.metadata?.description ?? "",
      publishedAt: p.published_at,
      source: p.source?.title ?? p.source?.domain ?? "Unknown",
      url: p.original_url ?? p.url,
    }));

    cache.set(cacheKey, articles, CACHE_TTL);
    log.info("fetched live news", { topic, count: articles.length });
    return { articles: articles.slice(0, limit), cached: false };
  } catch (err) {
    log.warn("API fetch failed", { error: (err as Error).message, topic });
  }

  if (cache.has(cacheKey)) {
    log.warn("returning stale cache", { topic, cacheAge: cache.age(cacheKey) });
    const articles = cache.get(cacheKey)!.slice(0, limit);
    return { articles, cached: true, cacheAge: cache.age(cacheKey) };
  }

  throw new Error("API_UNAVAILABLE");
}

function scoreArticleRisk(article: NewsArticle): { riskScore: number; keywords: string[] } {
  const text = `${article.title} ${article.description}`.toLowerCase();
  let riskScore = 0;
  const keywords: string[] = [];

  for (const [keyword, score] of Object.entries(RISK_KEYWORDS)) {
    if (text.includes(keyword)) {
      riskScore += score;
      keywords.push(keyword);
    }
  }

  for (const [keyword, score] of Object.entries(SAFE_KEYWORDS)) {
    if (text.includes(keyword)) {
      riskScore += score;
    }
  }

  return { riskScore: Math.max(0, riskScore), keywords };
}

function extractProtocolRisks(articles: NewsArticle[]): ProtocolRisk[] {
  const protocolMap = new Map<string, ProtocolRisk>();

  for (const article of articles) {
    const text = `${article.title} ${article.description}`.toLowerCase();
    const { riskScore, keywords } = scoreArticleRisk(article);

    for (const protocol of KNOWN_PROTOCOLS) {
      if (text.includes(protocol)) {
        const existing = protocolMap.get(protocol);
        if (existing) {
          existing.riskScore += riskScore;
          existing.mentions++;
          for (const kw of keywords) {
            if (!existing.riskKeywords.includes(kw)) {
              existing.riskKeywords.push(kw);
            }
          }
        } else {
          protocolMap.set(protocol, {
            protocol,
            riskScore,
            mentions: 1,
            riskKeywords: [...keywords],
          });
        }
      }
    }
  }

  return Array.from(protocolMap.values())
    .sort((a, b) => b.riskScore - a.riskScore);
}

function overallRiskLevel(articles: NewsArticle[]): RiskLevel {
  let totalRisk = 0;
  for (const article of articles) {
    totalRisk += scoreArticleRisk(article).riskScore;
  }

  const avgRisk = articles.length > 0 ? totalRisk / articles.length : 0;

  if (avgRisk >= 8) return "CRITICAL";
  if (avgRisk >= 5) return "HIGH";
  if (avgRisk >= 3) return "MEDIUM";
  if (avgRisk >= 1) return "LOW";
  return "SAFE";
}

app.post("/news", async (req, res) => {
  if (!config.cryptoPanicToken) {
    res.status(503).json({
      service: "risk-monitor",
      timestamp: new Date().toISOString(),
      error: "Risk monitor not configured — set CRYPTOPANIC_TOKEN env var",
      code: "NOT_CONFIGURED",
    });
    return;
  }

  const topic = validateString(req, res, "topic", { required: true, maxLen: 200 });
  if (topic === null) return;
  const limit = validateInt(req, res, "limit", { min: 1, max: 20, defaultVal: 5 });
  if (limit === null) return;

  try {
    const { articles, cached, cacheAge } = await fetchCryptoPanic(topic, limit);

    const riskLevel = overallRiskLevel(articles);
    const protocolsAtRisk = extractProtocolRisks(articles);
    const safeToLend = riskLevel === "SAFE" || riskLevel === "LOW";

    // AI risk analysis
    let aiSummary: { riskAssessment: string; impact: string; keyThreat: string; relevance: number } | undefined;
    if (isLLMEnabled() && articles.length > 0) {
      const headlines = articles.slice(0, 8).map((a, i) => `${i + 1}. ${a.title}`).join("\n");
      const ai = await callLLMJson<{ riskAssessment: string; impact: string; keyThreat: string; relevance: number }>(
        `You are a DeFi protocol risk analyst. Analyze these news headlines about "${topic}" for security risks, exploits, and protocol health threats:

${headlines}

Focus on: hacks, exploits, rug pulls, depegs, insolvency, TVL drops, regulatory actions, and protocol vulnerabilities.

Return ONLY valid JSON:
{"riskAssessment":"critical|high|medium|low|safe","impact":"severe|moderate|minimal|none","keyThreat":"<most important risk in 15 words or 'no significant threats detected'>","relevance":<0.0-1.0 how relevant to ${topic}>}`,
        128,
      );
      if (ai) {
        aiSummary = ai;
        log.info("risk AI summary", { riskAssessment: ai.riskAssessment, impact: ai.impact });
      }
    }

    const recencyBonus = articles.length > 0 && articles[0]
      ? Math.max(0, 1 - (Date.now() - new Date(articles[0].publishedAt).getTime()) / 3_600_000)
      : 0;
    const aiRelevanceBonus = aiSummary ? aiSummary.relevance * 0.2 : 0;
    const aiImpactBonus = aiSummary?.impact === "severe" ? 0.15 : aiSummary?.impact === "moderate" ? 0.08 : 0;
    const confidenceScore = Math.min(1,
      Math.min(articles.length / 5, 1) * 0.4
      + recencyBonus * 0.2
      + (cached ? 0 : 0.05)
      + aiRelevanceBonus
      + aiImpactBonus,
    );
    const confidenceBasis = aiSummary
      ? `AI: ${aiSummary.riskAssessment}/${aiSummary.impact}, ${articles.length} articles, relevance ${aiSummary.relevance}`
      : `${articles.length} articles, recency ${recencyBonus.toFixed(2)}, ${cached ? "cached" : "fresh"}`;

    log.info("risk-monitor", { topic, count: articles.length, riskLevel, protocolsAtRisk: protocolsAtRisk.length, cached, confidenceScore: confidenceScore.toFixed(3) });

    res.json({
      service: "risk-monitor",
      timestamp: new Date().toISOString(),
      result: {
        topic,
        riskLevel,
        protocolsAtRisk,
        safeToLend,
        articles,
        count: articles.length,
        confidenceScore: parseFloat(confidenceScore.toFixed(3)),
        confidenceBasis,
        source: "cryptopanic",
        ...(aiSummary ? { aiSummary } : {}),
      },
      ...(cached ? { cached: true, cacheAge } : {}),
    });
  } catch (err) {
    const msg = (err as Error).message;
    log.error("risk monitor failed", { error: msg, topic });
    res.status(502).json({
      service: "risk-monitor",
      timestamp: new Date().toISOString(),
      error: "News API unavailable",
      code: "API_UNAVAILABLE",
      cached: false,
    });
  }
});

if (!config.cryptoPanicToken) {
  log.warn("CRYPTOPANIC_TOKEN not set — /news will return NOT_CONFIGURED");
}

start();
