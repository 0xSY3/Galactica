import type { Application } from "express";
import { config } from "../../config/env.js";
import { walletClient } from "../wallet.js";
import { getRecentTxs } from "../tx-log.js";
import { fetchWithRetry } from "../../lib/fetch-retry.js";
import { serviceUrl } from "../../config/services.js";
import { createLogger } from "../../lib/logger.js";
import { getAllAgentWallets, isDemoMode } from "../../lib/wdk-wallet.js";

const log = createLogger("live");

const ARBITRUM_EXPLORER = "https://sepolia.arbiscan.io";

export function registerLiveRoutes(app: Application): void {
  app.get("/live/config", (_req, res) => {
    const agentWallets = getAllAgentWallets();
    res.json({
      agents: agentWallets,
      network: config.wdk.network,
      explorer: ARBITRUM_EXPLORER,
      usdtContract: config.wdk.usdtContract,
      xautContract: config.wdk.xautContract || null,
      wdkMode: isDemoMode() ? "demo" : "live",
      walletConnected: !!walletClient,
    });
  });

  // Recent transaction feed
  app.get("/live/feed", (req, res) => {
    const limit = Math.min(Number(req.query["limit"]) || 20, 50);
    res.json(getRecentTxs(limit));
  });

  // Whale movements (internal call to whale service)
  app.get("/live/whales", async (_req, res) => {
    try {
      const whaleUrl = serviceUrl("whale");
      const r = await fetchWithRetry(`${whaleUrl}/whale`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 15 }),
      }, { timeoutMs: 10_000, retries: 1 });

      if (!r.ok) {
        res.status(502).json({ error: "Whale service unavailable", status: r.status });
        return;
      }

      const data = await r.json();
      res.json(data);
    } catch (err) {
      log.warn("whale fetch failed", { error: (err as Error).message });
      res.status(502).json({ error: "Whale service unreachable" });
    }
  });
}
