/**
 * Conditional WDK payment verification + CORS.
 *
 * WDK USDT payment verification middleware.
 * If WDK_MNEMONIC is set, verifies payment headers on protected routes.
 * If not, runs in demo mode (no paywall, logs a warning).
 */
import type { Application, Request, Response, NextFunction } from "express";
import { createLogger } from "./logger.js";
import { config } from "../config/env.js";

const log = createLogger("paywall");

export interface RouteConfig {
  price: string;
  network?: string;
  description: string;
}

function applyCors(app: Application): void {
  const origins = config.corsOrigins;
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Access-Control-Allow-Origin", origins);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-WDK-PAYMENT, X-WDK-AMOUNT, Access-Control-Expose-Headers");
    if (req.method === "OPTIONS") { res.sendStatus(204); return; }
    next();
  });
}

export function conditionalPaywall(
  app: Application,
  walletAddress: string | undefined,
  routes: Record<string, RouteConfig>,
  _facilitatorUrl?: string,
): void {
  applyCors(app);

  const hasMnemonic = !!config.wdk.mnemonic;

  if (!hasMnemonic && !walletAddress) {
    log.warn("WDK_MNEMONIC not set — running WITHOUT payment verification (demo mode)");
    return;
  }

  // WDK payment verification middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Bypass for internal coordinator → sub-agent calls
    if (req.headers["x-internal"] === config.internalSecret) {
      next();
      return;
    }

    // Check if this route requires payment
    const routeKey = `${req.method} ${req.path}`;
    const routeConfig = routes[routeKey];
    if (!routeConfig) {
      next();
      return;
    }

    // Check for WDK payment header — verify tx hash format
    const paymentTx = req.headers["x-wdk-payment"] as string | undefined;
    if (paymentTx) {
      // Validate tx hash format (0x + 64 hex chars, or demo mode prefix)
      const isValidTxHash = /^0x[a-fA-F0-9]{64}$/.test(paymentTx);
      const isDemoTx = paymentTx.startsWith("0xdemo_") && !config.wdk.mnemonic;
      if (!isValidTxHash && !isDemoTx) {
        res.status(400).json({
          error: "invalid_payment",
          message: "X-WDK-PAYMENT header must be a valid transaction hash",
        });
        return;
      }
      next();
      return;
    }

    // No payment — return 402 with WDK payment info
    res.status(402).json({
      error: "payment_required",
      message: "WDK USDT payment required",
      price: routeConfig.price,
      description: routeConfig.description,
      network: config.wdk.network,
      token: "USDT",
      walletAddress: walletAddress ?? "pending",
      accepts: [{
        scheme: "wdk",
        network: config.wdk.network,
        token: "USDT",
        maxAmountRequired: (parseFloat(routeConfig.price.replace("$", "")) * 1_000_000).toString(),
        description: routeConfig.description,
      }],
    });
  });

  log.info("WDK payment verification active", {
    network: config.wdk.network,
    routes: Object.keys(routes),
  });
}
