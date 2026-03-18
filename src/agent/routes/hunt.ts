import { randomUUID } from "crypto";
import type { Application } from "express";
import { validateString } from "../../lib/validate.js";
import { createLogger } from "../../lib/logger.js";
import { walletClient } from "../wallet.js";
import { callAllServices } from "../orchestrator.js";
import { synthesizeAlpha } from "../synthesis.js";
import { generateReportId, cacheReport } from "../report-cache.js";
import { getEffectivePrice } from "../../config/services.js";
import { recordHunt } from "../memory.js";
import { notifyHuntResult } from "../telegram.js";
// moltbook disabled in Galactica build
import { generateAlphaNarrative, isClaudeEnabled } from "../claude.js";
import { executeACPRound } from "../acp.js";
import { approveLoan, depositToLendingPool, tipCreator, depositToVault, sendXAUTReward } from "../contract-executor.js";
import { swapTokens, bridgeUSDT, aaveWithdraw } from "../../lib/wdk-protocols.js";
import { getAgentAddress } from "../../lib/wdk-wallet.js";
import { config } from "../../config/env.js";
import type { SentimentResult, PolymarketResult, DefiResult, NewsResult, WhaleResult, PaymentLog, CachedReport } from "../../types/index.js";

const log = createLogger("coordinator");

export function registerHuntRoutes(app: Application): void {
  app.post("/hunt", async (req, res) => {
    try {
    const topic = validateString(req, res, "topic", { maxLen: 200, defaultVal: "crypto market" });
    if (topic === null) return;

    const huntId = randomUUID().slice(0, 12);
    const ts = new Date().toISOString();
    const { news, sentiment, polymarket, defi, whale, external, warnings, competitionResult } = await callAllServices(topic);

    log.info("hunt", { huntId, topic, warnings: warnings.length > 0 ? warnings : undefined });

    const alpha = await synthesizeAlpha({
      huntId,
      sentimentResult:  sentiment?.data as { result?: SentimentResult } | null,
      polymarketResult: polymarket?.data as { result?: PolymarketResult } | null,
      defiResult:       defi?.data as { result?: DefiResult } | null,
      newsResult:       news?.data as { result?: NewsResult } | null,
      whaleResult:      whale?.data as { result?: WhaleResult } | null,
      warnings,
      competitionResult,
      externalResults: external,
    });

    // Execute ACP round
    const acpRound = executeACPRound({
      roundId: huntId,
      topic,
      responses: [
        { key: "news", response: news },
        { key: "sentiment", response: sentiment },
        { key: "polymarket", response: polymarket },
        { key: "defi", response: defi },
        { key: "whale", response: whale },
        ...Object.entries(external).map(([key, resp]) => ({ key, response: resp })),
      ],
    });

    const dp = alpha.dynamicPricing;
    const priceOf = (svc: string) => dp.find(p => p.service === svc)?.effectivePrice ?? "?";

    const builtinBreakdown = [
      { service: "news-agent",                price: priceOf("news"),       paid: news?.paid ?? false,       txHash: news?.txHash },
      { service: "crypto-sentiment",          price: priceOf("sentiment"),  paid: sentiment?.paid ?? false,  txHash: sentiment?.txHash },
      { service: "polymarket-alpha-scanner",  price: priceOf("polymarket"), paid: polymarket?.paid ?? false, txHash: polymarket?.txHash },
      { service: "defi-alpha-scanner",        price: priceOf("defi"),       paid: defi?.paid ?? false,       txHash: defi?.txHash },
      { service: "whale-agent",               price: priceOf("whale"),      paid: whale?.paid ?? false,      txHash: whale?.txHash },
    ];
    for (const [key, resp] of Object.entries(external)) {
      builtinBreakdown.push({
        service: key,
        price: priceOf(key),
        paid: resp?.paid ?? false,
        txHash: resp?.txHash,
      });
    }
    const agentCount = 5 + Object.keys(external).length;
    const paymentLog: PaymentLog = {
      totalPaid: walletClient ? `${dp.reduce((s, p) => s + parseFloat(p.effectivePrice.replace("$", "")), 0).toFixed(4)} USDT to ${agentCount} sub-agents (dynamic)` : "demo mode — no wallet",
      breakdown: builtinBreakdown,
    };

    // Generate Claude narrative (async, enriches alpha if enabled)
    if (isClaudeEnabled()) {
      try {
        const narrative = await generateAlphaNarrative({
          topic,
          sentiment: alpha.breakdown.sentiment,
          polymarket: alpha.breakdown.polymarket
            ? { ...alpha.breakdown.polymarket, yesPrice: String(alpha.breakdown.polymarket.yesPrice) }
            : null,
          defi: alpha.breakdown.defi,
          news: alpha.breakdown.news,
          whale: alpha.breakdown.whale,
          confidence: alpha.confidence,
          recommendation: alpha.recommendation,
          consensusStrength: alpha.consensusStrength,
        });
        if (narrative) alpha.narrative = narrative;
      } catch (err) {
        log.warn("claude narrative skipped", { error: (err as Error).message });
      }
    }

    const reportId = generateReportId(topic, ts);
    const report: CachedReport = {
      id: reportId,
      topic,
      timestamp: ts,
      createdAt: Date.now(),
      alpha,
      agentPayments: paymentLog,
      stakingSummary: alpha.stakingSummary,
      preview: `${alpha.recommendation} | Confidence: ${alpha.confidence}`,
    };
    cacheReport(report);

    // Record in memory for pattern learning
    recordHunt({
      topic,
      timestamp: ts,
      signals: alpha.signals,
      confidence: alpha.weightedConfidence,
      recommendation: alpha.recommendation,
    });

    // Notify Telegram + Moltbook (async, don't block response)
    notifyHuntResult(topic, alpha, "manual").catch(() => {});
    // moltbook disabled

    // Contract execution bridge — trigger on-chain actions based on signal strength
    let contractActions: { action: string; success: boolean; demoMode: boolean }[] = [];
    try {
      const topicLower = topic.toLowerCase();
      const confidence = alpha.weightedConfidence;
      const whaleSignal = alpha.breakdown.whale?.signal ?? "";

      if (topicLower.includes("lending")) {
        const r1 = await depositToLendingPool(10);
        contractActions.push({ action: r1.action, success: r1.success, demoMode: r1.demoMode });

        // Gate loan approval on credit score from whale service
        const creditSignal = alpha.breakdown.whale?.signal ?? "";
        const creditScore = alpha.breakdown.whale?.creditScore ?? 0;
        if (creditScore >= 50 || creditSignal === "ACCUMULATION") {
          const r2 = await approveLoan(-1);
          contractActions.push({ action: r2.action, success: r2.success, demoMode: r2.demoMode });
        } else {
          contractActions.push({ action: `approveLoan(skipped: creditScore=${creditScore})`, success: true, demoMode: false });
        }
      }

      if (topicLower.includes("tip") || topicLower.includes("creator")) {
        const creatorAddr = config.tipping.creatorAddress || getAgentAddress("hunter");
        const r = await tipCreator(creatorAddr, config.tipping.defaultTipUsdt, `hunt tip: ${topic}`);
        contractActions.push({ action: r.action, success: r.success, demoMode: r.demoMode });
      }

      if (whaleSignal === "ACCUMULATION" || topicLower.includes("yield")) {
        const r = await depositToVault(5);
        contractActions.push({ action: r.action, success: r.success, demoMode: r.demoMode });
      }

      // XAUT reward: if gold/xaut is mentioned, send XAUT
      if (confidence >= 40 && (topicLower.includes("gold") || topicLower.includes("xaut"))) {
        const xautRecipient = config.tipping.creatorAddress || getAgentAddress("hunter");
        const r = await sendXAUTReward(xautRecipient, 0.001);
        contractActions.push({ action: r.action, success: r.success, demoMode: r.demoMode });
      }

      // WDK Protocol: swap USDT→XAUT when rebalancing is needed
      if (topicLower.includes("swap") || topicLower.includes("rebalance")) {
        const r = await swapTokens(config.wdk.usdtContract, config.wdk.xautContract, 10);
        contractActions.push({ action: r.action, success: r.success, demoMode: r.demoMode });
      }

      // WDK Protocol: bridge USDT cross-chain when bridging is requested
      if (topicLower.includes("bridge") || topicLower.includes("cross-chain")) {
        const r = await bridgeUSDT(5, config.bridgeDefaultChain);
        contractActions.push({ action: r.action, success: r.success, demoMode: r.demoMode });
      }

      // WDK Protocol: withdraw from Aave when de-risking
      if (confidence < 30 && topicLower.includes("withdraw")) {
        const r = await aaveWithdraw(5);
        contractActions.push({ action: r.action, success: r.success, demoMode: r.demoMode });
      }
    } catch (contractErr) {
      log.warn("hunt contract execution failed (non-critical)", { error: (contractErr as Error).message });
    }

    res.json({
      service: "galactica-strategy-engine",
      timestamp: ts,
      topic,
      huntId,
      alpha,
      acpRound,
      agentPayments: paymentLog,
      cachedReport: { id: reportId, availableAt: `/report/${reportId}`, price: "$0.01" },
      dynamicPricing: alpha.dynamicPricing,
      economicCycle: {
        bought: `$${dp.reduce((s, p) => s + parseFloat(p.effectivePrice.replace("$", "")), 0).toFixed(4)} from 5 agents (reputation-adjusted)`,
        sold: "$0.050 to client",
        margin: `$${(0.05 - dp.reduce((s, p) => s + parseFloat(p.effectivePrice.replace("$", "")), 0)).toFixed(4)} per hunt`,
      },
      contractActions: contractActions.length > 0 ? contractActions : undefined,
    });
    } catch (err) {
      log.error("hunt failed", { error: (err as Error).message });
      if (!res.headersSent) {
        res.status(500).json({ error: "Hunt failed", message: (err as Error).message });
      }
    }
  });
}
